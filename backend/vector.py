"""DXF → 벡터 엔티티 추출 (S1.5 ②오픈소스 벡터 경로).

S1의 래스터 PNG(①하이브리드)와 나란히 비교하기 위한 벡터 렌더 입력을 만든다.
ezdxf `drawing` 애드온의 Frontend를 커스텀 recording 백엔드에 연결해
- INSERT(중첩 블록), DIMENSION, HATCH를 자동 explode/flatten
- TEXT/MTEXT를 path로 변환
한 결과를 레이어·색상·선두께 메타와 함께 2D 폴리라인/채움 폴리곤 JSON으로 직렬화한다.

프론트(canvas2D)는 이 JSON을 무손실 줌·레이어 토글로 렌더한다.
"""
from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Iterable

logger = logging.getLogger(__name__)

# flatten 시 곡선→직선 근사 거리(도면 단위). 작을수록 곡선이 매끄럽지만 점이 많아진다.
_FLATTEN_DISTANCE = 0.5
# 좌표 반올림 자리수. 도면은 보통 수만~수십만 단위 폭이라 소수 1자리면 표시에 충분.
_COORD_NDIGITS = 1


class _JSONRecorderBackend:
    """ezdxf BackendInterface 구현 — draw 콜을 2D 좌표 JSON으로 수집."""

    def __init__(self) -> None:
        self.strokes: list[dict] = []   # {pts:[[x,y]...], color, layer, width}
        self.fills: list[dict] = []     # {pts:[[x,y]...], color, layer}
        self.points: list[dict] = []    # {x, y, color, layer}
        self.layers: set[str] = set()
        self.type_counts: dict[str, int] = {}
        self._cur_type: str | None = None
        self._minx = self._miny = float("inf")
        self._maxx = self._maxy = float("-inf")

    # --- bbox 추적 ---
    def _bump(self, x: float, y: float) -> None:
        if x < self._minx:
            self._minx = x
        if x > self._maxx:
            self._maxx = x
        if y < self._miny:
            self._miny = y
        if y > self._maxy:
            self._maxy = y

    def _poly(self, pts: list, props) -> list[list[float]]:
        out: list[list[float]] = []
        for p in pts:
            x, y = float(p.x), float(p.y)
            self._bump(x, y)
            out.append([round(x, _COORD_NDIGITS), round(y, _COORD_NDIGITS)])
        self.layers.add(props.layer)
        return out

    def _flatten(self, path) -> list:
        try:
            return list(path.flattening(_FLATTEN_DISTANCE))
        except TypeError:
            return list(path.flattening())

    # --- BackendInterface 메서드 ---
    def enter_entity(self, entity, properties) -> None:
        self._cur_type = entity.dxftype()
        self.type_counts[self._cur_type] = self.type_counts.get(self._cur_type, 0) + 1

    def exit_entity(self, entity) -> None:
        self._cur_type = None

    def draw_line(self, start, end, properties) -> None:
        pts = self._poly([start, end], properties)
        self.strokes.append({"pts": pts, "color": properties.color,
                             "layer": properties.layer, "width": properties.lineweight})

    def draw_solid_lines(self, lines: Iterable, properties) -> None:
        for start, end in lines:
            self.draw_line(start, end, properties)

    def draw_path(self, path, properties) -> None:
        pts = self._poly(self._flatten(path), properties)
        if len(pts) >= 2:
            self.strokes.append({"pts": pts, "color": properties.color,
                                 "layer": properties.layer, "width": properties.lineweight})

    def draw_filled_paths(self, paths: Iterable, properties) -> None:
        for path in paths:
            pts = self._poly(self._flatten(path), properties)
            if len(pts) >= 3:
                self.fills.append({"pts": pts, "color": properties.color, "layer": properties.layer})

    def draw_filled_polygon(self, points, properties) -> None:
        seq = points.vertices() if hasattr(points, "vertices") else list(points)
        pts = self._poly(seq, properties)
        if len(pts) >= 3:
            self.fills.append({"pts": pts, "color": properties.color, "layer": properties.layer})

    def draw_point(self, pos, properties) -> None:
        x, y = float(pos.x), float(pos.y)
        self._bump(x, y)
        self.layers.add(properties.layer)
        self.points.append({"x": round(x, 3), "y": round(y, 3),
                            "color": properties.color, "layer": properties.layer})

    def draw_image(self, image_data, properties) -> None:  # 래스터 이미지는 ②범위 밖
        pass

    # --- 라이프사이클(no-op) ---
    def configure(self, config) -> None: ...
    def set_background(self, color) -> None: ...
    def clear(self) -> None: ...
    def finalize(self) -> None: ...

    def bbox(self) -> list[float] | None:
        if self._minx == float("inf"):
            return None
        return [round(self._minx, 3), round(self._miny, 3),
                round(self._maxx, 3), round(self._maxy, 3)]


def extract_vector(dxf_path: str) -> dict:
    """DXF의 modelspace를 벡터 엔티티 JSON으로 추출."""
    import ezdxf
    from ezdxf.addons.drawing import Frontend, RenderContext
    from ezdxf.addons.drawing.config import Configuration

    doc = ezdxf.readfile(dxf_path)
    msp = doc.modelspace()
    backend = _JSONRecorderBackend()
    ctx = RenderContext(doc)
    try:
        config = Configuration(max_flattening_distance=_FLATTEN_DISTANCE)
    except TypeError:
        config = Configuration()
    Frontend(ctx, backend, config=config).draw_layout(msp, finalize=True)

    bbox = backend.bbox()
    return {
        "strokes": backend.strokes,
        "fills": backend.fills,
        "points": backend.points,
        "layers": sorted(backend.layers),
        "bbox": bbox,
        "stats": {
            "strokes": len(backend.strokes),
            "fills": len(backend.fills),
            "points": len(backend.points),
            "layers": len(backend.layers),
            "entity_types": backend.type_counts,
        },
    }


def get_vector_json(dxf_path: str, cache_path: str) -> dict:
    """추출 결과를 cache_path(JSON)에 캐시. 있으면 재사용."""
    cache = Path(cache_path)
    if cache.exists():
        try:
            return json.loads(cache.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
    data = extract_vector(dxf_path)
    try:
        # atomic write(store.py 규율과 일치): temp에 쓴 뒤 교체(부분쓰기/동시쓰기 방지).
        tmp = cache.with_name(cache.name + ".tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        os.replace(str(tmp), str(cache))
    except OSError as e:  # noqa: BLE001
        logger.warning("vector cache write failed: %s", e)
    return data
