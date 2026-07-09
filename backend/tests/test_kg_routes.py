"""지식그래프 조회 라우트 — node/neighbors/path/evidence/graph."""
import importlib
import json

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("XD_UPLOADS_DIR", str(tmp_path))
    import config
    importlib.reload(config)
    snapshot = {"graphs": {"P1": {"built_at": "2026-07-09T00:00:00",
        "nodes": [
            {"id": "eq:E1", "type": "equipment", "ref_id": "E1", "label": "MTR-1", "props": {}},
            {"id": "eq:E2", "type": "equipment", "ref_id": "E2", "label": "VCB-1", "props": {}},
            {"id": "sh:s1", "type": "sheet", "ref_id": "s1", "label": "E-101", "props": {}}],
        "edges": [
            {"src": "eq:E1", "dst": "sh:s1", "type": "appears_on", "confidence": 1.0, "track": "curated", "evidence": None},
            {"src": "eq:E1", "dst": "eq:E2", "type": "relates_to", "confidence": 0.6, "track": "llm", "evidence": "공출현"}]}}}
    (tmp_path / "_knowledge_graph.json").write_text(json.dumps(snapshot), encoding="utf-8")
    import kg_store
    importlib.reload(kg_store)
    import routes_kg
    importlib.reload(routes_kg)
    from fastapi import FastAPI
    app = FastAPI()
    app.include_router(routes_kg.router)
    return TestClient(app)


def test_node(client):
    r = client.get("/api/kg/node/eq:E1?project_name=P1")
    assert r.status_code == 200 and r.json()["node"]["label"] == "MTR-1"


def test_neighbors(client):
    r = client.get("/api/kg/neighbors?project_name=P1&id=eq:E1&depth=1")
    ids = {n["id"] for n in r.json()["nodes"]}
    assert ids == {"eq:E1", "sh:s1", "eq:E2"}


def test_path(client):
    r = client.get("/api/kg/path?project_name=P1&from=sh:s1&to=eq:E2")
    assert r.json()["reachable"] is True and r.json()["hops"] == 2


def test_evidence(client):
    r = client.get("/api/kg/evidence?project_name=P1&id=eq:E2")
    ev = r.json()["evidence"]
    assert any(e["evidence"] == "공출현" and e["track"] == "llm" for e in ev)


def test_graph_full(client):
    r = client.get("/api/kg/graph?project_name=P1")
    assert len(r.json()["nodes"]) == 3 and len(r.json()["edges"]) == 2


def test_node_missing_404(client):
    r = client.get("/api/kg/node/eq:NOPE?project_name=P1")
    assert r.status_code == 404


def test_path_missing_node_404(client):
    r = client.get("/api/kg/path?project_name=P1&from=eq:NOPE&to=eq:E2")
    assert r.status_code == 404


def test_graph_scope_bad_404(client):
    r = client.get("/api/kg/graph?project_name=P1&scope=eq:NOPE")
    assert r.status_code == 404


def test_graph_scope_valid(client):
    r = client.get("/api/kg/graph?project_name=P1&scope=eq:E1")
    assert r.status_code == 200
    body = r.json()
    assert "nodes" in body and "edges" in body
