"""kg_* AI 툴 — 8000 HTTP GET 만(격리). client.get 를 스텁으로 계약 검증."""
import importlib
import pathlib
import sys

# 두 경로 모두 필요(독립 실행 보장):
#   backend/     — `import ai.tools`(패키지 import)용
#   backend/ai/  — tools.py 내부의 flat `from client import ...`용
# (ai/conftest.py는 backend/ai/tests/ 트리에만 적용, backend/tests/ 에는 안 미침.)
_BACKEND = pathlib.Path(__file__).resolve().parents[1]   # backend/
sys.path.insert(0, str(_BACKEND))          # for `import ai.tools`
sys.path.insert(0, str(_BACKEND / "ai"))   # for tools.py's flat `from client import ...`


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


def test_kg_neighbors_404_returns_not_found(monkeypatch):
    """라우트 404 → BackendError → 허위 대신 {"found": False}(정직성 계약)."""
    import ai.tools as tools
    importlib.reload(tools)
    from client import BackendError
    def fake_get(path, params=None):
        raise BackendError("8000 오류 404", status=404)
    monkeypatch.setattr(tools, "get", fake_get)
    out = tools.kg_neighbors("P1", "eq:NOPE")
    assert out == {"found": False, "id": "eq:NOPE"}


def test_kg_path_404_returns_not_found(monkeypatch):
    import ai.tools as tools
    importlib.reload(tools)
    from client import BackendError
    def fake_get(path, params=None):
        raise BackendError("8000 오류 404", status=404)
    monkeypatch.setattr(tools, "get", fake_get)
    out = tools.kg_path("P1", "eq:E1", "eq:NOPE")
    assert out == {"found": False, "from": "eq:E1", "to": "eq:NOPE"}


def test_kg_evidence_404_returns_not_found(monkeypatch):
    import ai.tools as tools
    importlib.reload(tools)
    from client import BackendError
    def fake_get(path, params=None):
        raise BackendError("8000 오류 404", status=404)
    monkeypatch.setattr(tools, "get", fake_get)
    out = tools.kg_evidence("P1", "eq:NOPE")
    assert out == {"found": False, "id": "eq:NOPE"}
