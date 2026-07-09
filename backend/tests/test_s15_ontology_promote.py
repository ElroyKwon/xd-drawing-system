"""S15 단계10 — 추출 태그 온톨로지 승격(O13, TypeDB off 케이스).

추출 태그(_sheet_meta.json, is_current)가 /api/ontology/equipment 표면으로 승격되되,
수동 시드(curated)가 권위. read-time overlay 라 TypeDB on/off 무관(여기선 json backend).
TypeDB on e2e 는 scripts 로 별도(컨테이너 필요).
"""
import importlib
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # backend/

import config  # noqa: E402


def _fresh(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "UPLOADS_DIR", tmp_path)
    monkeypatch.setattr(config, "STORE_BACKEND", "json")
    monkeypatch.delenv("XD_ONTOLOGY_DIRECT_TYPEDB", raising=False)
    import store as store_mod
    importlib.reload(store_mod)
    import ontology as ont_mod
    importlib.reload(ont_mod)  # _MIRROR_PATH 재계산 + _singleton 리셋
    return store_mod.get_store(), ont_mod.get_ontology()


def _seed_meta(s, tags, sheet_id="F1_s0", ch="sha256:a"):
    s.upsert_sheet_meta(
        sheet_key="sk1", project_name="P", file_id="F1", sheet_index=0,
        sheet_id=sheet_id, source_kind="pdf", content_hash=ch,
        text_index="idx", tags=tags)


def test_backend_is_json_when_typedb_off(tmp_path, monkeypatch):
    _, ont = _fresh(tmp_path, monkeypatch)
    assert ont.backend == "json"  # O13: TypeDB 미연결 상태에서 동작


def test_extracted_tags_promoted_with_origin(tmp_path, monkeypatch):
    s, ont = _fresh(tmp_path, monkeypatch)
    ont.add_equipment("P", {"equipment_id": "eq1", "tag": "VCB-1", "type": "차단기"},
                      sheet_ids=["F1_s0"])
    _seed_meta(s, [{"tag": "PP-380V", "type": "분전반", "confidence": 0.65, "src": "rule"},
                   {"tag": "MTR-1", "type": "", "confidence": 0.65, "src": "rule"}])
    items = ont.list_equipment("P")
    by = {e["tag"]: e for e in items}
    assert by["VCB-1"]["origin"] == "curated"          # 수동 시드 = curated 권위
    assert by["PP-380V"]["origin"] == "extracted"      # 추출 태그 승격
    assert by["PP-380V"]["confidence"] == 0.65         # 신뢰도 노출(정직성)
    assert by["MTR-1"]["origin"] == "extracted"
    assert "F1_s0" in by["PP-380V"]["sheet_ids"]       # 등장 시트 바인딩


def test_curated_absorbs_exact_extracted(tmp_path, monkeypatch):
    s, ont = _fresh(tmp_path, monkeypatch)
    ont.add_equipment("P", {"equipment_id": "eq1", "tag": "PP-380V", "type": "분전반"},
                      sheet_ids=["F1_s0"])
    _seed_meta(s, [{"tag": "PP-380V", "confidence": 0.65, "src": "rule"}])  # 정확 동일 표기
    items = ont.list_equipment("P")
    tags = [e["tag"] for e in items]
    assert tags.count("PP-380V") == 1  # 같은 표기 추출본은 curated 로 흡수(중복 없음)
    assert next(e for e in items if e["tag"] == "PP-380V")["origin"] == "curated"


def test_ocr_variant_extracted_kept_distinct(tmp_path, monkeypatch):
    # OCR 변형(PP-38OV)은 curated(PP-380V)와 canon 이 같지만 자동으로 접지 않는다.
    # 서로 다른 설비를 오병합해 유실하는 위험보다, 별개 노출 + 신뢰도 표기가 정직하다.
    s, ont = _fresh(tmp_path, monkeypatch)
    ont.add_equipment("P", {"equipment_id": "eq1", "tag": "PP-380V", "type": "분전반"},
                      sheet_ids=["F1_s0"])
    _seed_meta(s, [{"tag": "PP-38OV", "confidence": 0.65, "src": "rule"}])
    items = ont.list_equipment("P")
    by = {e["tag"]: e for e in items}
    assert by["PP-380V"]["origin"] == "curated"
    assert by["PP-38OV"]["origin"] == "extracted"   # 유실 없이 별개 노출
    assert by["PP-38OV"]["confidence"] == 0.65       # 미검증 신뢰도 표기(정직성)


def test_distinct_extracted_tags_not_collapsed(tmp_path, monkeypatch):
    # PL-1 과 PI-1 은 canon 충돌(P1-1)이나 서로 다른 설비 — overlay 집계에서 유실 금지.
    s, ont = _fresh(tmp_path, monkeypatch)
    _seed_meta(s, [{"tag": "PL-1", "confidence": 0.65, "src": "rule"},
                   {"tag": "PI-1", "confidence": 0.65, "src": "rule"}])
    tags = {e["tag"] for e in ont.list_equipment("P")}
    assert {"PL-1", "PI-1"} <= tags  # 둘 다 승격(붕괴 없음)


def test_include_extracted_false_returns_curated_only(tmp_path, monkeypatch):
    s, ont = _fresh(tmp_path, monkeypatch)
    ont.add_equipment("P", {"equipment_id": "eq1", "tag": "VCB-1"}, sheet_ids=["F1_s0"])
    _seed_meta(s, [{"tag": "PP-380V", "confidence": 0.65, "src": "rule"}])
    items = ont.list_equipment("P", include_extracted=False)
    assert [e["tag"] for e in items] == ["VCB-1"]


def test_sheet_id_filter_scopes_extracted(tmp_path, monkeypatch):
    s, ont = _fresh(tmp_path, monkeypatch)
    _seed_meta(s, [{"tag": "PP-380V", "confidence": 0.65, "src": "rule"}], sheet_id="F1_s0", ch="sha256:a")
    _seed_meta(s, [{"tag": "MTR-9", "confidence": 0.65, "src": "rule"}], sheet_id="F1_s1", ch="sha256:b")
    only = ont.list_equipment("P", sheet_id="F1_s1")
    assert [e["tag"] for e in only] == ["MTR-9"]
