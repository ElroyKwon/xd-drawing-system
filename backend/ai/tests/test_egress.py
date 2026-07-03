"""egress 감사/게이트 테스트 (S8.4). 킬스위치·감사로그(메타데이터만)·키 마스킹.

라우트(/api/egress/*)는 8000을 호출하지 않으므로 TestClient만으로 검증.
킬스위치의 실 챗 반영은 effective_provider + run_chat(MockProvider, respx)로 검증.
"""
from __future__ import annotations

import json

import httpx
import respx
from fastapi.testclient import TestClient

import agent
import egress
from main_ai import app

BASE = "http://127.0.0.1:8000"

_DRAWINGS = [
    {"file_id": "f1", "filename": "x.pdf", "conversion_status": "completed",
     "sheets": [{"sheet_id": "s1", "sheet_number": "E-101", "sheet_title": "단선결선도",
                 "discipline_code": "E", "discipline_label": "E (전기)"}]},
]


def _reset_mode():
    egress._mode = None  # env 기본값으로 리셋


def _isolate_audit(tmp_path, monkeypatch):
    monkeypatch.setattr(egress, "_DATA_DIR", tmp_path)
    monkeypatch.setattr(egress, "_AUDIT_PATH", tmp_path / "egress_audit.jsonl")


# ── M2: 런타임 킬스위치 토글 ──────────────────────────────────────
def test_mode_toggle_and_invalid(monkeypatch):
    _reset_mode()
    monkeypatch.setenv("XD_AI_PROVIDER", "openai")
    client = TestClient(app)
    assert egress.current_mode() == "openai"
    r = client.post("/api/egress/mode", json={"mode": "mock"})
    assert r.status_code == 200
    assert r.json()["current_mode"] == "mock"
    assert client.get("/api/egress/status").json()["current_mode"] == "mock"
    # 잘못된 값 → 400
    assert client.post("/api/egress/mode", json={"mode": "gpt"}).status_code == 400
    _reset_mode()


# ── M3: 킬스위치 ON이면 chat이 mock 강제(외부 전송 0) ─────────────
def test_kill_switch_forces_mock_provider():
    _reset_mode()
    egress.set_mode("mock")
    # 요청/기본이 openai여도 effective=mock
    assert egress.effective_provider("openai") == "mock"
    assert egress.effective_provider(None) == "mock"
    _reset_mode()
    egress.set_mode("openai")
    assert egress.effective_provider("mock") == "mock"  # 명시 mock 존중
    assert egress.effective_provider(None) == "openai"
    _reset_mode()


@respx.mock
def test_kill_switch_chat_no_openai_egress():
    """mode=mock에서 run_chat이 MockProvider로 돌아 openai 호출이 0."""
    respx.get(f"{BASE}/api/drawings").mock(return_value=httpx.Response(200, json=_DRAWINGS))
    _reset_mode()
    egress.set_mode("mock")
    from provider import make_provider
    provider = make_provider(egress.effective_provider("openai"))
    assert provider.name == "mock"
    out = agent.run_chat("Study_Project", "시트 몇 장?", provider=provider)
    assert out["provider"] == "mock"  # 실 LLM 미사용 = 외부 전송 0
    _reset_mode()


# ── M4: 감사로그 메타데이터만(본문·키 부재) ───────────────────────
def test_audit_record_metadata_only(tmp_path, monkeypatch):
    _isolate_audit(tmp_path, monkeypatch)
    # 화이트리스트 밖 필드(본문·키)는 직렬화에서 탈락해야 한다.
    egress.record({
        "provider": "openai", "model": "gpt-5.5", "conversation_id": "conv-1",
        "project": "Study_Project", "tool_names": ["list_sheets"], "token_estimate": 12,
        "egress": True, "ok": True,
        "message": "비밀 사용자 질문 본문", "api_key": "sk-REALSECRETKEY1234",  # 침입 필드
    })
    rows = egress.read(10)
    assert len(rows) == 1
    row = rows[0]
    assert row["provider"] == "openai" and row["egress"] is True
    assert row["tool_names"] == ["list_sheets"]
    raw = json.dumps(row, ensure_ascii=False)
    assert "비밀 사용자 질문" not in raw   # 본문 미기록
    assert "message" not in row
    assert "REALSECRETKEY" not in raw      # 원문 키 미기록
    assert "api_key" not in row


def test_audit_masks_key_in_string_fields(tmp_path, monkeypatch):
    _isolate_audit(tmp_path, monkeypatch)
    # error 같은 문자열 필드에 키가 섞여도 마스킹.
    egress.record({"provider": "openai", "ok": False,
                   "error": "실패: key sk-REALSECRETKEY1234 로 호출"})
    raw = json.dumps(egress.read(1)[0], ensure_ascii=False)
    assert "REALSECRETKEY" not in raw
    assert "sk-…1234" in raw


# ── M5: audit 최신순 + limit ──────────────────────────────────────
def test_audit_read_order_and_limit(tmp_path, monkeypatch):
    _isolate_audit(tmp_path, monkeypatch)
    for i in range(5):
        egress.record({"provider": "mock", "conversation_id": f"c{i}", "ok": True})
    rows = egress.read(3)
    assert len(rows) == 3
    assert rows[0]["conversation_id"] == "c4"  # 최신순
    assert rows[2]["conversation_id"] == "c2"


def test_audit_route(tmp_path, monkeypatch):
    _isolate_audit(tmp_path, monkeypatch)
    egress.record({"provider": "openai", "ok": True})
    client = TestClient(app)
    r = client.get("/api/egress/audit?limit=5")
    assert r.status_code == 200
    body = r.json()
    assert body["limit"] == 5 and len(body["events"]) == 1


# ── M6/M7: 키 마스킹·상태(원문 미노출) ────────────────────────────
def test_mask_key():
    assert egress.masked_preview("sk-abcd1234efgh5678") == "sk-…5678"
    assert egress.masked_preview(None) is None
    masked = egress.mask_key("토큰은 sk-abcd1234efgh5678 입니다")
    assert "abcd1234efgh" not in masked
    assert "sk-…5678" in masked


def test_status_never_leaks_raw_key(monkeypatch):
    _reset_mode()
    monkeypatch.setenv("OPENAI_API_KEY", "sk-abcd1234efgh5678")
    monkeypatch.setenv("XD_AI_PROVIDER", "openai")
    st = egress.status()
    assert st["key_present"] is True
    assert st["key_masked"] == "sk-…5678"
    assert "abcd1234efgh" not in json.dumps(st)  # 원문 키 미노출
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    assert egress.status()["key_present"] is False
    _reset_mode()


# ── M8: 부팅 검증이 예외 없이 동작(마스킹 로깅) ───────────────────
def test_boot_validation_no_raise(monkeypatch):
    import main_ai
    monkeypatch.setenv("OPENAI_API_KEY", "sk-abcd1234efgh5678")
    main_ai._validate_key_at_boot()  # 예외 없이 완료
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    main_ai._validate_key_at_boot()  # 키 없어도 graceful
