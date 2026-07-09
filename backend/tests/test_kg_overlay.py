"""오버레이 저널 — edge_key 무방향 정규화·append-only·last-write-wins 맵."""
import importlib
import json

import pytest


@pytest.fixture()
def kg(tmp_path, monkeypatch):
    monkeypatch.setenv("XD_UPLOADS_DIR", str(tmp_path))
    import config
    importlib.reload(config)
    import kg_store
    importlib.reload(kg_store)
    return kg_store


def test_edge_key_is_undirected(kg):
    # A↔B 와 B↔A 는 동일 키(정렬 정규화).
    assert kg.edge_key("eq:E1", "eq:E2") == kg.edge_key("eq:E2", "eq:E1")
    assert kg.edge_key("eq:E1", "eq:E2") == "eq:E1|eq:E2|relates_to"


def test_append_override_is_appendonly(kg, tmp_path):
    k = kg.edge_key("eq:E1", "eq:E2")
    kg.append_override("P1", k, "confirm", actor="khlee", at="2026-07-09T00:00:00Z", reason=None)
    kg.append_override("P1", k, "reject", actor=None, at=None, reason="오탐")
    ov = json.loads((tmp_path / "_kg_overlay.json").read_text(encoding="utf-8"))
    entries = ov["graphs"]["P1"]["overrides"]
    # 두 항목 다 남아있다(append-only, 삭제 없음).
    assert [e["action"] for e in entries] == ["confirm", "reject"]
    assert entries[1]["reason"] == "오탐"


def test_overlay_map_is_last_write_wins(kg):
    k = kg.edge_key("eq:E1", "eq:E2")
    kg.append_override("P1", k, "confirm", actor="a", at=None, reason=None)
    kg.append_override("P1", k, "reject", actor="b", at=None, reason=None)
    m = kg._overlay_map("P1")
    # 같은 키에 confirm→reject 순서 → 마지막(reject)이 유효.
    assert m[k] == "reject"


def test_overlay_map_empty_when_no_file(kg):
    assert kg._overlay_map("P1") == {}
