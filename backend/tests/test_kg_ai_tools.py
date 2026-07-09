"""kg_* AI 툴 — 8000 HTTP GET 만(격리). client.get 를 스텁으로 계약 검증."""
import importlib
import pathlib
import sys

# backend/ai 가 sys.path에 없으면 ai/tools.py 내부의 `from client import ...`(flat import)가
# 실패한다(ai/conftest.py는 backend/ai/tests/ 트리에만 적용되고 backend/tests/ 에는 안 미침).
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "ai"))


def test_kg_neighbors_calls_backend_get(monkeypatch):
    import ai.tools as tools
    importlib.reload(tools)
    calls = {}
    def fake_get(path, params=None):
        calls["path"] = path
        calls["params"] = params
        return {"found": True, "nodes": [{"id": "eq:E1"}], "edges": []}
    monkeypatch.setattr(tools, "get", fake_get)
    out = tools.kg_neighbors("P1", "eq:E1", depth=2)
    assert calls["path"] == "/api/kg/neighbors"
    assert calls["params"]["id"] == "eq:E1" and calls["params"]["depth"] == 2
    assert out["nodes"][0]["id"] == "eq:E1"


def test_kg_path_calls_backend_get_with_from_to(monkeypatch):
    import ai.tools as tools
    importlib.reload(tools)
    calls = {}
    def fake_get(path, params=None):
        calls["path"] = path
        calls["params"] = params
        return {"found": True, "path": ["eq:E1", "sh:s1"]}
    monkeypatch.setattr(tools, "get", fake_get)
    out = tools.kg_path("P1", "eq:E1", "sh:s1")
    assert calls["path"] == "/api/kg/path"
    assert calls["params"]["from"] == "eq:E1" and calls["params"]["to"] == "sh:s1"
    assert out["path"] == ["eq:E1", "sh:s1"]


def test_kg_evidence_calls_backend_get(monkeypatch):
    import ai.tools as tools
    importlib.reload(tools)
    calls = {}
    def fake_get(path, params=None):
        calls["path"] = path
        calls["params"] = params
        return {"found": True, "edges": [], "notes": []}
    monkeypatch.setattr(tools, "get", fake_get)
    out = tools.kg_evidence("P1", "eq:E1")
    assert calls["path"] == "/api/kg/evidence"
    assert calls["params"]["id"] == "eq:E1"
    assert out["found"] is True
