"""쓰기 라우트 — confirm/reject 성공, 비llm/부재 엣지 400, X-Actor 기록."""
import importlib
import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

_SNAP = {"graphs": {"P1": {"built_at": None,
    "nodes": [
        {"id": "eq:E1", "type": "equipment", "ref_id": "E1", "label": "MTR-1", "props": {}},
        {"id": "eq:E2", "type": "equipment", "ref_id": "E2", "label": "VCB-1", "props": {}},
        {"id": "sh:s1", "type": "sheet", "ref_id": "s1", "label": "E-101", "props": {}}],
    "edges": [
        {"src": "eq:E1", "dst": "sh:s1", "type": "appears_on", "confidence": 1.0, "track": "curated", "evidence": None},
        {"src": "eq:E1", "dst": "eq:E2", "type": "relates_to", "confidence": 0.6, "track": "llm", "evidence": "공출현"}]}}}


@pytest.fixture()
def client(tmp_path, monkeypatch):
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
    return TestClient(app), tmp_path


def test_confirm_promotes_and_records_actor(client):
    c, tmp = client
    r = c.post("/api/kg/edge/confirm", json={"project_name": "P1", "src": "eq:E1", "dst": "eq:E2"},
               headers={"X-Actor": "khlee"})
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True and body["new_track"] == "curated"
    assert body["edge_key"] == "eq:E1|eq:E2|relates_to"
    ov = json.loads((tmp / "_kg_overlay.json").read_text(encoding="utf-8"))
    entry = ov["graphs"]["P1"]["overrides"][-1]
    assert entry["action"] == "confirm" and entry["actor"] == "khlee"
    assert entry["at"] is not None  # API 가 요청 시각 주입.


def test_confirm_is_undirected(client):
    c, _ = client
    # src/dst 뒤집어 보내도 같은 엣지로 인식(정규화 키).
    r = c.post("/api/kg/edge/confirm", json={"project_name": "P1", "src": "eq:E2", "dst": "eq:E1"})
    assert r.status_code == 200 and r.json()["edge_key"] == "eq:E1|eq:E2|relates_to"


def test_reject_hides_edge(client):
    c, _ = client
    r = c.post("/api/kg/edge/reject", json={"project_name": "P1", "src": "eq:E1", "dst": "eq:E2", "reason": "오탐"})
    assert r.status_code == 200 and r.json()["hidden"] is True


def test_confirm_nonexistent_edge_400(client):
    c, _ = client
    r = c.post("/api/kg/edge/confirm", json={"project_name": "P1", "src": "eq:E1", "dst": "eq:NOPE"})
    assert r.status_code == 400


def test_confirm_non_llm_edge_400(client):
    c, _ = client
    # appears_on(curated) 은 relates_to 도 아니고 llm 도 아님 → 400.
    r = c.post("/api/kg/edge/confirm", json={"project_name": "P1", "src": "eq:E1", "dst": "sh:s1"})
    assert r.status_code == 400


def test_actor_optional(client):
    c, tmp = client
    r = c.post("/api/kg/edge/reject", json={"project_name": "P1", "src": "eq:E1", "dst": "eq:E2"})
    assert r.status_code == 200
    ov = json.loads((tmp / "_kg_overlay.json").read_text(encoding="utf-8"))
    assert ov["graphs"]["P1"]["overrides"][-1]["actor"] is None
