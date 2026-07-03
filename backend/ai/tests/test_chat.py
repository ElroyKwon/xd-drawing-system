"""챗 오케스트레이션 + ai_store 테스트 (S8.1). MockProvider + respx(egress 0)."""
from __future__ import annotations

import httpx
import respx

import ai_store
import agent
from provider import MockProvider

BASE = "http://127.0.0.1:8000"

_DRAWINGS = [
    {"file_id": "f1", "filename": "x.pdf", "conversion_status": "completed",
     "sheets": [
         {"sheet_id": "s1", "sheet_number": "E-101", "sheet_title": "단선결선도",
          "discipline_code": "E", "discipline_label": "E (전기)"},
     ]},
]
_SEARCH = {"query": "케이블", "sheets": [], "issues": [{"issue_id": "i1", "title": "케이블 트레이"}],
           "files": [], "folders": [], "truncated": False}


@respx.mock
def test_run_chat_mock_list_sheets():
    respx.get(f"{BASE}/api/drawings").mock(return_value=httpx.Response(200, json=_DRAWINGS))
    out = agent.run_chat("Study_Project", "시트 몇 장 있어?", provider=MockProvider())
    assert out["provider"] == "mock"
    assert out["tool_calls"][0]["name"] == "list_sheets"
    assert "count=1" in out["tool_calls"][0]["result_summary"]
    assert out["answer"]  # 최종 합성 답 존재


@respx.mock
def test_run_chat_mock_search():
    respx.get(f"{BASE}/api/search").mock(return_value=httpx.Response(200, json=_SEARCH))
    out = agent.run_chat("Study_Project", "케이블 이슈 있나", provider=MockProvider())
    assert out["tool_calls"][0]["name"] == "search"
    assert "issues=1" in out["tool_calls"][0]["result_summary"]


def test_ai_store_roundtrip(tmp_path, monkeypatch):
    monkeypatch.setattr(ai_store, "_DATA_DIR", tmp_path)
    monkeypatch.setattr(ai_store, "_PATH", tmp_path / "conversations.json")
    conv = ai_store.create_conversation("Study_Project", "member-owner")
    assert conv["id"].startswith("conv-")
    ai_store.append_message(conv["id"], "user", "안녕")
    ai_store.append_message(conv["id"], "assistant", "네", tool_calls=[{"name": "search"}])
    got = ai_store.get_conversation(conv["id"])
    assert len(got["messages"]) == 2
    assert got["messages"][1]["tool_calls"][0]["name"] == "search"
    lst = ai_store.list_conversations(project="Study_Project")
    assert lst[0]["message_count"] == 2
    assert "messages" not in lst[0]  # 목록은 본문 제외


def test_ai_store_project_mismatch_isolation(tmp_path, monkeypatch):
    monkeypatch.setattr(ai_store, "_DATA_DIR", tmp_path)
    monkeypatch.setattr(ai_store, "_PATH", tmp_path / "conversations.json")
    ai_store.create_conversation("A", "u1")
    ai_store.create_conversation("B", "u1")
    assert len(ai_store.list_conversations(project="A")) == 1
    assert len(ai_store.list_conversations()) == 2
