"""지식그래프 스토어 — 로드·조회·순회·참조 무결성."""
import json
import importlib

import pytest


@pytest.fixture()
def kg(tmp_path, monkeypatch):
    monkeypatch.setenv("XD_UPLOADS_DIR", str(tmp_path))
    import config
    importlib.reload(config)
    import kg_store
    importlib.reload(kg_store)
    snapshot = {
        "graphs": {
            "P1": {
                "built_at": "2026-07-09T00:00:00",
                "nodes": [
                    {"id": "eq:E1", "type": "equipment", "ref_id": "E1", "label": "MTR-1", "props": {}},
                    {"id": "eq:E2", "type": "equipment", "ref_id": "E2", "label": "VCB-1", "props": {}},
                    {"id": "sh:s1", "type": "sheet", "ref_id": "s1", "label": "E-101", "props": {}},
                ],
                "edges": [
                    {"src": "eq:E1", "dst": "sh:s1", "type": "appears_on", "confidence": 1.0, "track": "curated", "evidence": None},
                    {"src": "eq:E1", "dst": "eq:E2", "type": "relates_to", "confidence": 0.6, "track": "llm", "evidence": "같은 시트 공출현"},
                ],
            }
        }
    }
    (tmp_path / "_knowledge_graph.json").write_text(json.dumps(snapshot), encoding="utf-8")
    return kg_store


def test_get_node_with_incident_edges(kg):
    n = kg.get_node("P1", "eq:E1")
    assert n["node"]["label"] == "MTR-1"
    types = sorted(e["type"] for e in n["edges"])
    assert types == ["appears_on", "relates_to"]


def test_get_node_missing_returns_found_false(kg):
    assert kg.get_node("P1", "eq:NOPE") == {"found": False, "id": "eq:NOPE"}


def test_neighbors_depth(kg):
    # depth=1: E1 의 직접 이웃 = sh:s1, eq:E2
    ids = {x["id"] for x in kg.neighbors("P1", "eq:E1", depth=1)["nodes"]}
    assert ids == {"eq:E1", "sh:s1", "eq:E2"}


def test_referential_integrity_flags_dangling(kg):
    # dst 없는 엣지를 넣으면 무결성 검사가 잡는다.
    bad = {"graphs": {"P1": {"nodes": [{"id": "sh:s1", "type": "sheet", "ref_id": "s1", "label": "", "props": {}}],
                             "edges": [{"src": "sh:s1", "dst": "eq:GONE", "type": "has_tag",
                                        "confidence": 1.0, "track": "rule", "evidence": None}], "built_at": None}}}
    problems = kg.check_integrity(bad["graphs"]["P1"])
    assert any("eq:GONE" in p for p in problems)
