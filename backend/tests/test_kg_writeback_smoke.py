"""통합 스모크(스펙 §10) — 시드 → confirm(→curated) → reject(→drop) 왕복.

in-process: 스냅샷에 두 llm 엣지를 직접 깔고, 쓰기 라우트 TestClient 로 confirm/reject,
kg_store 병합 조회로 결과 육안 대체(curated 확인·drop 확인).
"""
import importlib
import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

_SNAP = {"graphs": {"P1": {"built_at": None,
    "nodes": [
        {"id": "eq:E1", "type": "equipment", "ref_id": "E1", "label": "MTR-1", "props": {}},
        {"id": "eq:E2", "type": "equipment", "ref_id": "E2", "label": "VCB-1", "props": {}},
        {"id": "eq:E3", "type": "equipment", "ref_id": "E3", "label": "TR-1", "props": {}}],
    "edges": [
        {"src": "eq:E1", "dst": "eq:E2", "type": "relates_to", "confidence": 0.6, "track": "llm", "evidence": "공출현A"},
        {"src": "eq:E2", "dst": "eq:E3", "type": "relates_to", "confidence": 0.5, "track": "llm", "evidence": "공출현B"}]}}}


@pytest.fixture()
def env(tmp_path, monkeypatch):
    monkeypatch.setenv("XD_UPLOADS_DIR", str(tmp_path))
    import config
    importlib.reload(config)
    (tmp_path / "_knowledge_graph.json").write_text(json.dumps(_SNAP), encoding="utf-8")
    import kg_store
    importlib.reload(kg_store)
    import routes_kg_writeback
    importlib.reload(routes_kg_writeback)
    app = FastAPI()
    app.include_router(routes_kg_writeback.router)
    return TestClient(app), kg_store


def test_confirm_then_reject_roundtrip(env):
    c, kg = env
    # 1) E1–E2 confirm → 병합 조회에서 curated.
    assert c.post("/api/kg/edge/confirm", json={"project_name": "P1", "src": "eq:E1", "dst": "eq:E2"}).status_code == 200
    g = kg._merged_graph("P1")
    e12 = [e for e in g["edges"] if {e["src"], e["dst"]} == {"eq:E1", "eq:E2"}][0]
    assert e12["track"] == "curated"
    # 2) E2–E3 reject → 병합 조회에서 사라짐.
    assert c.post("/api/kg/edge/reject", json={"project_name": "P1", "src": "eq:E2", "dst": "eq:E3"}).status_code == 200
    g2 = kg._merged_graph("P1")
    assert [e for e in g2["edges"] if {e["src"], e["dst"]} == {"eq:E2", "eq:E3"}] == []
    # 3) 되돌림: E2–E3 confirm 재-append → last-write-wins 로 다시 보임(curated).
    assert c.post("/api/kg/edge/confirm", json={"project_name": "P1", "src": "eq:E2", "dst": "eq:E3"}).status_code == 200
    g3 = kg._merged_graph("P1")
    e23 = [e for e in g3["edges"] if {e["src"], e["dst"]} == {"eq:E2", "eq:E3"}]
    assert len(e23) == 1 and e23[0]["track"] == "curated"
