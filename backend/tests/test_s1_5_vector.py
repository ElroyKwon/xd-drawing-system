"""S1.5 ②벡터 추출 회귀: 다종 엔티티(LINE/CIRCLE/LWPOLYLINE/TEXT/INSERT/HATCH)가
벡터 JSON으로 폭넓게 추출되는지 + 캐시 동작."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # backend/

import ezdxf  # noqa: E402

import vector  # noqa: E402


def _make_dxf(path):
    doc = ezdxf.new("R2018")
    doc.layers.add("DETAIL", color=1)
    msp = doc.modelspace()
    msp.add_line((0, 0), (100, 0), dxfattribs={"layer": "DETAIL"})
    msp.add_circle((50, 50), 20, dxfattribs={"layer": "DETAIL"})
    msp.add_arc((50, 50), 30, 0, 90, dxfattribs={"layer": "DETAIL"})
    msp.add_ellipse((50, 50), major_axis=(25, 0), ratio=0.5, dxfattribs={"layer": "DETAIL"})
    msp.add_lwpolyline([(0, 0), (100, 0), (100, 80), (0, 80)], close=True)
    msp.add_text("XD", dxfattribs={"height": 10, "layer": "DETAIL"}).set_placement((10, 60))
    msp.add_mtext("멀티\n라인", dxfattribs={"char_height": 8, "layer": "DETAIL"}).set_location((10, 40))
    # 선형 치수(DIMENSION 엔티티) — render()로 지오메트리 블록 생성
    msp.add_linear_dim(base=(0, -12), p1=(0, 0), p2=(100, 0), dxfattribs={"layer": "DIM"}).render()

    # 중첩 블록 INSERT
    blk = doc.blocks.new(name="PILLAR")
    blk.add_line((-5, -5), (5, 5))
    blk.add_circle((0, 0), 3)
    msp.add_blockref("PILLAR", (70, 20))

    # HATCH(채움)
    h = msp.add_hatch(color=2)
    h.paths.add_polyline_path([(0, 0), (20, 0), (20, 20), (0, 20)], is_closed=True)

    doc.saveas(path)


def test_extract_vector_broad_coverage(tmp_path):
    dxf = str(tmp_path / "multi.dxf")
    _make_dxf(dxf)
    d = vector.extract_vector(dxf)

    # strokes(선)와 fills(채움: HATCH + 텍스트 path) 모두 존재
    assert len(d["strokes"]) > 0
    assert len(d["fills"]) > 0
    assert d["bbox"] is not None
    assert len(d["bbox"]) == 4

    # 엔티티 타입이 폭넓게 잡혀야 한다(INSERT 중첩 explode + DIMENSION/MTEXT/ELLIPSE/ARC 포함).
    # 메타프롬프트 B2가 요구한 커버리지를 device stats가 아닌 회귀로 고정한다.
    types = d["stats"]["entity_types"]
    for t in ("LINE", "CIRCLE", "ARC", "ELLIPSE", "LWPOLYLINE", "TEXT", "MTEXT", "INSERT", "HATCH", "DIMENSION"):
        assert t in types, f"엔티티 {t} 누락: {types}"

    # 커스텀 레이어가 보존돼야 레이어 토글이 가능(DIM 포함)
    assert "DETAIL" in d["layers"]
    assert "DIM" in d["layers"]

    # 좌표/색상/레이어 메타가 stroke마다 있어야 한다
    s0 = d["strokes"][0]
    assert "pts" in s0 and "color" in s0 and "layer" in s0
    assert s0["color"].startswith("#")


def test_get_vector_json_caches(tmp_path):
    dxf = str(tmp_path / "multi.dxf")
    _make_dxf(dxf)
    cache = str(tmp_path / "vector.json")
    assert not os.path.exists(cache)
    d1 = vector.get_vector_json(dxf, cache)
    assert os.path.exists(cache)
    # 두 번째 호출은 캐시에서 동일 결과
    d2 = vector.get_vector_json(dxf, cache)
    assert d1["stats"] == d2["stats"]
