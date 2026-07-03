"""egress 감사/게이트 (S8.4) — 외부 전송(OpenAI) 운영 안전장치.

R4(감사로그·킬스위치 없음) 해소. 순수 표준 라이브러리 + 자체 모듈만(격리 불변식: backend.* import 0).

세 축(2026-07-03 공동설계 freeze, `prompts/12`):
- 감사로그 = **메타데이터만**(본문·키 미기록), append-only JSONL `_ai_data/egress_audit.jsonl`.
- 킬스위치 = **런타임 API 토글**(프로세스 메모리 mode, 재기동 시 env 기본값 복귀).
- 키 관리 = **마스킹+유출가드+상태**(.env 평문 유지, 원문 키는 로그/감사/응답 어디에도 미노출).
"""
from __future__ import annotations

import json
import os
import re
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from provider import DEFAULT_MODEL

_DATA_DIR = Path(__file__).resolve().parent / "_ai_data"
_AUDIT_PATH = _DATA_DIR / "egress_audit.jsonl"

_VALID_MODES = ("openai", "mock")
_lock = threading.Lock()

# 감사 레코드에 허용되는 필드 화이트리스트 — 본문/키가 실수로 섞여도 직렬화 단계에서 탈락.
_AUDIT_FIELDS = (
    "ts", "provider", "model", "conversation_id", "project",
    "tool_names", "token_estimate", "egress", "ok", "error",
)

# api-key류(sk-...) 마스킹용. 20자 이상 토큰을 sk-…last4 형태로 축약.
_KEY_RE = re.compile(r"\bsk-[A-Za-z0-9_-]{8,}\b")


# ── 런타임 mode (킬스위치) ─────────────────────────────────────────
def _default_mode() -> str:
    m = (os.environ.get("XD_AI_PROVIDER") or "openai").strip().lower()
    return m if m in _VALID_MODES else "openai"


_mode: Optional[str] = None  # None = 아직 env 기본값 미확정(lazy)


def current_mode() -> str:
    global _mode
    if _mode is None:
        _mode = _default_mode()
    return _mode


def set_mode(mode: str) -> str:
    """런타임 mode 토글. 유효값만 허용. 반환=적용된 mode."""
    global _mode
    m = (mode or "").strip().lower()
    if m not in _VALID_MODES:
        raise ValueError(f"잘못된 mode: {mode!r} (허용: {_VALID_MODES})")
    _mode = m
    return _mode


def effective_provider(requested: Optional[str]) -> str:
    """킬스위치 반영 provider 결정. mode=mock이면 무조건 mock(외부 전송 차단)."""
    if current_mode() == "mock":
        return "mock"
    req = (requested or "").strip().lower()
    return req if req in _VALID_MODES else "openai"


# ── 키 마스킹·유출가드 ─────────────────────────────────────────────
def masked_preview(key: Optional[str]) -> Optional[str]:
    """원문 키 → 'sk-…abcd' 미리보기(값 미노출). 키 없으면 None."""
    if not key:
        return None
    tail = key[-4:] if len(key) >= 4 else key
    return f"sk-…{tail}"


def mask_key(text: str) -> str:
    """임의 문자열 안의 api-key류를 마스킹(로그/감사/응답 유출 가드)."""
    if not text:
        return text
    return _KEY_RE.sub(lambda m: f"sk-…{m.group(0)[-4:]}", text)


# ── 감사로그(메타데이터만) ─────────────────────────────────────────
def record(event: dict) -> None:
    """egress 이벤트 메타데이터 1건 append. 화이트리스트 필드만 직렬화(본문·키 배제)."""
    row = {"ts": datetime.now(timezone.utc).isoformat()}
    for k in _AUDIT_FIELDS:
        if k == "ts":
            continue
        if k in event and event[k] is not None:
            v = event[k]
            # 문자열 필드는 마스킹 가드 통과(만일의 키 유출 방지).
            if isinstance(v, str):
                v = mask_key(v)
            elif isinstance(v, list):
                v = [mask_key(x) if isinstance(x, str) else x for x in v]
            row[k] = v
    with _lock:
        _DATA_DIR.mkdir(parents=True, exist_ok=True)
        with _AUDIT_PATH.open("a", encoding="utf-8") as f:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def read(limit: int = 50) -> list[dict]:
    """최신순 audit 레코드(read-only)."""
    if not _AUDIT_PATH.exists():
        return []
    with _lock:
        lines = _AUDIT_PATH.read_text(encoding="utf-8").splitlines()
    rows = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    rows.reverse()  # 최신순
    return rows[: max(0, limit)]


# ── 상태(키 원문 미노출) ───────────────────────────────────────────
def status() -> dict:
    key = os.environ.get("OPENAI_API_KEY")
    return {
        "key_present": bool(key),
        "key_masked": masked_preview(key),
        "provider_default": _default_mode(),
        "current_mode": current_mode(),
        "model": os.environ.get("XD_AI_MODEL", DEFAULT_MODEL),
    }


def token_estimate(*texts: Optional[str]) -> int:
    """결정적 근사 토큰수(문자수/4). 실제 과금 아님, 감사 추적용."""
    total = sum(len(t) for t in texts if t)
    return total // 4
