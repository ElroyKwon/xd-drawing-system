"""S4: 마크업·측정 영속 + 시트 비교 라우트 (§E 마크업 / §F 측정 / §G 비교).

마크업/측정은 (file_id, sheet_id) 스코프로 DrawingStore에 영속. 좌표계는
coord_space로 구분한다(DXF 벡터=world model 좌표 / PDF·래스터=정규화 이미지 0~1).
측정 실척 환산은 프론트에서 vector 단위(unit_scale)로 수행하고 결과값만 저장한다.
비교는 같은 version_set 두 버전 PNG의 백엔드 픽셀 diff 마스크를 만든다.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import config
from auth import require_role_for_file
from compare import compute_diff
from routes_drawing import _png_url
from store import get_store

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/drawings", tags=["markup"])

_MARKUP_KINDS = {"텍스트", "도형", "클라우드", "폴리라인", "다각형", "펜"}
_MEASURE_TYPES = {"선형", "다각형 면적", "지름"}


# ---------------------------------------------------------------------------
# 요청 모델
# ---------------------------------------------------------------------------

class MarkupCreate(BaseModel):
    sheet_id: str
    kind: str
    coord_space: str = "world"            # world | image
    geometry: list[list[float]] = []      # [[x,y], ...] (텍스트=단일 점)
    style: dict[str, Any] = {}            # color/width/fill/opacity
    text: str = ""
    author: str = "사용자"


class MarkupPatch(BaseModel):
    geometry: list[list[float]] | None = None
    style: dict[str, Any] | None = None
    text: str | None = None
    kind: str | None = None


class MeasurementCreate(BaseModel):
    sheet_id: str
    type: str                             # 선형 | 다각형 면적 | 지름
    geometry: list[list[float]] = []      # world 좌표
    value: float
    unit: str = ""


# ---------------------------------------------------------------------------
# 공통 검증
# ---------------------------------------------------------------------------

def _require_drawing(store, file_id: str) -> dict:
    row = store.get_drawing(file_id)
    if not row:
        raise HTTPException(404, f"도면 없음: {file_id}")
    return row


def _require_sheet(row: dict, sheet_id: str) -> dict:
    for s in row.get("sheets", []) or []:
        if s.get("sheet_id") == sheet_id:
            return s
    raise HTTPException(404, f"시트 없음: {sheet_id}")


# ---------------------------------------------------------------------------
# 마크업
# ---------------------------------------------------------------------------

@router.get("/{file_id}/markups")
async def list_markups(file_id: str, sheet_id: str):
    store = get_store()
    _require_drawing(store, file_id)
    return store.list_markups(file_id, sheet_id)


@router.post("/{file_id}/markups")
async def create_markup(file_id: str, body: MarkupCreate):
    require_role_for_file(file_id, "편집자")  # S7: 마크업 작성 = 편집자 이상
    store = get_store()
    row = _require_drawing(store, file_id)
    _require_sheet(row, body.sheet_id)
    if body.kind not in _MARKUP_KINDS:
        raise HTTPException(400, f"알 수 없는 마크업 종류: {body.kind}")
    if body.coord_space not in ("world", "image"):
        raise HTTPException(400, f"잘못된 coord_space: {body.coord_space}")
    if not body.geometry:
        raise HTTPException(400, "geometry 좌표가 비어 있습니다")
    meta = {
        "markup_id": str(uuid.uuid4()),
        "file_id": file_id,
        "sheet_id": body.sheet_id,
        "kind": body.kind,
        "coord_space": body.coord_space,
        "geometry": body.geometry,
        "style": body.style,
        "text": body.text,
        "author": body.author,
        "created_at": datetime.now().isoformat(),
    }
    store.add_markup(meta)
    logger.info("markup created %s (%s, %s)", meta["markup_id"], file_id, body.kind)
    return meta


@router.patch("/{file_id}/markups/{markup_id}")
async def patch_markup(file_id: str, markup_id: str, body: MarkupPatch):
    require_role_for_file(file_id, "편집자")  # S7
    store = get_store()
    _require_drawing(store, file_id)
    fields = body.model_dump(exclude_none=True)
    if "kind" in fields and fields["kind"] not in _MARKUP_KINDS:
        raise HTTPException(400, f"알 수 없는 마크업 종류: {fields['kind']}")
    updated = store.update_markup(markup_id, **fields)
    if not updated:
        raise HTTPException(404, f"마크업 없음: {markup_id}")
    return updated


@router.delete("/{file_id}/markups/{markup_id}")
async def delete_markup(file_id: str, markup_id: str):
    require_role_for_file(file_id, "편집자")  # S7
    store = get_store()
    _require_drawing(store, file_id)
    if not store.delete_markup(markup_id):
        raise HTTPException(404, f"마크업 없음: {markup_id}")
    return {"deleted": markup_id}


# ---------------------------------------------------------------------------
# 측정
# ---------------------------------------------------------------------------

@router.get("/{file_id}/measurements")
async def list_measurements(file_id: str, sheet_id: str):
    store = get_store()
    _require_drawing(store, file_id)
    return store.list_measurements(file_id, sheet_id)


@router.post("/{file_id}/measurements")
async def create_measurement(file_id: str, body: MeasurementCreate):
    require_role_for_file(file_id, "편집자")  # S7
    store = get_store()
    row = _require_drawing(store, file_id)
    _require_sheet(row, body.sheet_id)
    if body.type not in _MEASURE_TYPES:
        raise HTTPException(400, f"알 수 없는 측정 종류: {body.type}")
    if not body.geometry:
        raise HTTPException(400, "geometry 좌표가 비어 있습니다")
    meta = {
        "measurement_id": str(uuid.uuid4()),
        "file_id": file_id,
        "sheet_id": body.sheet_id,
        "type": body.type,
        "geometry": body.geometry,
        "value": body.value,
        "unit": body.unit,
        "created_at": datetime.now().isoformat(),
    }
    store.add_measurement(meta)
    logger.info("measurement created %s (%s, %s=%.4f%s)",
                meta["measurement_id"], file_id, body.type, body.value, body.unit)
    return meta


@router.delete("/{file_id}/measurements/{measurement_id}")
async def delete_measurement(file_id: str, measurement_id: str):
    require_role_for_file(file_id, "편집자")  # S7
    store = get_store()
    _require_drawing(store, file_id)
    if not store.delete_measurement(measurement_id):
        raise HTTPException(404, f"측정 없음: {measurement_id}")
    return {"deleted": measurement_id}


# ---------------------------------------------------------------------------
# 시트 비교 (백엔드 픽셀 diff)
# ---------------------------------------------------------------------------

def _sheet_png(row: dict, sheet_index: int) -> Path:
    sheets = row.get("sheets", []) or []
    if not (0 <= sheet_index < len(sheets)):
        raise HTTPException(400, f"시트 인덱스 범위 초과: {sheet_index}")
    png = sheets[sheet_index].get("png_path")
    if not png:
        raise HTTPException(400, "시트 PNG 없음(변환 미완)")
    uploads_root = Path(config.UPLOADS_DIR).resolve()
    abs_png = Path(png).resolve()
    if not abs_png.is_relative_to(uploads_root) or not abs_png.exists():
        raise HTTPException(404, "시트 PNG 파일 없음")
    return abs_png


@router.get("/{file_id}/compare")
async def compare_versions(file_id: str, against: str, sheet_index: int = 0):
    """같은 version_set의 두 버전 PNG 픽셀 diff 마스크 생성·반환(+변경 통계)."""
    store = get_store()
    row_a = _require_drawing(store, file_id)
    row_b = _require_drawing(store, against)
    # 같은 version_set만 비교 허용(서로 다른 도면 비교는 범위 밖).
    vset_a = row_a.get("version_set_id") or row_a["file_id"]
    vset_b = row_b.get("version_set_id") or row_b["file_id"]
    if vset_a != vset_b:
        raise HTTPException(400, "같은 버전세트의 두 버전만 비교할 수 있습니다")
    png_a = _sheet_png(row_a, sheet_index)
    png_b = _sheet_png(row_b, sheet_index)

    # 마스크는 A의 시트 디렉토리에 캐시(against+index 키). 이미 있으면 재사용.
    mask_path = png_a.with_name(f"compare_{against}_{sheet_index}.png")
    stat_path = mask_path.with_suffix(".json")
    if mask_path.exists() and stat_path.exists():
        import json
        try:
            stats = json.loads(stat_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            stats = compute_diff(str(png_a), str(png_b), str(mask_path))
    else:
        stats = compute_diff(str(png_a), str(png_b), str(mask_path))
        try:
            import json
            stat_path.write_text(json.dumps(stats, ensure_ascii=False), encoding="utf-8")
        except OSError:
            pass

    return {
        "file_id": file_id,
        "against": against,
        "sheet_index": sheet_index,
        "mask_url": _png_url(str(mask_path)),
        "png_a_url": _png_url(str(png_a)),
        "png_b_url": _png_url(str(png_b)),
        **stats,
    }
