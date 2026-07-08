"""S15 단계7: sheet_meta read API — 조회·본문검색·설비역방향. 핸들러 직접 호출(httpx 회피).

prompts/20 O4 소비 표면·사이드카 계약(GET 200 + 스키마).
"""
import asyncio
import importlib
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # backend/

import config  # noqa: E402


def _setup(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "UPLOADS_DIR", tmp_path)
    monkeypatch.setattr(config, "STORE_BACKEND", "json")
    import store as store_mod
    importlib.reload(store_mod)
    import routes_sheet_meta as rsm
    importlib.reload(rsm)
    s = rsm.get_store()
    s.upsert_sheet_meta(
        sheet_key="sk1", project_name="P", file_id="F1", sheet_index=0, sheet_id="F1_s0",
        source_kind="pdf", content_hash="sha256:a", text_index="PANEL BOARD PP-380V FEEDER",
        tags=[{"tag": "PP-380V", "type": "panel", "confidence": 0.92, "src": "rule"}])
    s.upsert_sheet_meta(
        sheet_key="sk1", project_name="P", file_id="F2", sheet_index=0, sheet_id="F2_s0",
        source_kind="dxf", content_hash="sha256:b", text_index="REV B PP-380V UPDATED",
        tags=[{"tag": "PP-380V", "type": "panel", "confidence": 0.92, "src": "rule"}])
    s.upsert_sheet_meta(
        sheet_key="sk2", project_name="P", file_id="F3", sheet_index=0, sheet_id="F3_s0",
        source_kind="pdf", content_hash="sha256:c", text_index="TRANSFORMER TR-A1 6.6kV",
        tags=[{"tag": "TR-A1", "type": "transformer", "confidence": 0.65, "src": "rule"}])
    return rsm


def test_get_default_current_only(tmp_path, monkeypatch):
    rsm = _setup(tmp_path, monkeypatch)
    r = asyncio.run(rsm.get_sheet_meta(project_name="P"))
    assert r["count"] == 2   # sk1 최신(dxf) + sk2. 과거 rev 제외.
    kinds = {x["sheet_key"] for x in r["results"]}
    assert kinds == {"sk1", "sk2"}


def test_get_history_when_current_only_false(tmp_path, monkeypatch):
    rsm = _setup(tmp_path, monkeypatch)
    r = asyncio.run(rsm.get_sheet_meta(sheet_key="sk1", current_only=False))
    assert r["count"] == 2   # rev A + rev B 이력 전부


def test_search_text_index(tmp_path, monkeypatch):
    rsm = _setup(tmp_path, monkeypatch)
    # 기본(current_only): "updated"는 sk1 최신 rev B(F2)에만.
    r = asyncio.run(rsm.search_sheet_meta(q="updated", project_name="P"))
    assert r["count"] == 1 and r["results"][0]["sheet_id"] == "F2_s0"
    assert "PP-380V" in r["results"][0]["snippet"]
    # "feeder"는 강등된 rev A에만 → current_only=true면 0, false면 1(이력 검색).
    assert asyncio.run(rsm.search_sheet_meta(q="feeder", project_name="P"))["count"] == 0
    assert asyncio.run(rsm.search_sheet_meta(q="feeder", current_only=False))["count"] == 1
    assert asyncio.run(rsm.search_sheet_meta(q=""))["count"] == 0


def test_by_equipment_reverse_lookup(tmp_path, monkeypatch):
    rsm = _setup(tmp_path, monkeypatch)
    r = asyncio.run(rsm.by_equipment(tag="PP-380V", project_name="P"))
    assert r["count"] == 1   # current sk1(dxf rev B)만
    assert r["results"][0]["matched_tags"][0]["tag"] == "PP-380V"
    # 부분일치·대소문자 무시
    assert asyncio.run(rsm.by_equipment(tag="tr-a1"))["count"] == 1
    assert asyncio.run(rsm.by_equipment(tag="ZZZ"))["count"] == 0
