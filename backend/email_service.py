"""이메일 발송 인프라 (S11) — provider 추상화 + 템플릿 + 감사 + 킬스위치.

기본 = **mock**(발송 안 함, outbox 기록). 실 SMTP는 `XD_SMTP_*` env 자격증명 미구성 시
동작 안 함(HUMAN_GATE GATE-5). S8.4 egress 패턴 재사용(메타데이터만 감사·런타임 킬스위치).
"""
from __future__ import annotations

import json
import logging
import os
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import config

logger = logging.getLogger(__name__)

_OUTBOX_PATH = Path(config.UPLOADS_DIR) / "_email_outbox.json"
_AUDIT_PATH = Path(config.UPLOADS_DIR) / "_email_audit.jsonl"
_VALID_MODES = ("mock", "smtp")
_lock = threading.Lock()

_AUDIT_FIELDS = ("ts", "to", "subject", "template", "provider", "sent", "project", "error")


# ── 템플릿(안전 문자열 조합) ─────────────────────────────────────
_TEMPLATES = {
    "generic": ("{subject}", "{body}"),
    "issue_created": (
        "[XD] 새 이슈: {issue_title}",
        "프로젝트 '{project}'에 새 이슈가 등록되었습니다.\n\n"
        "제목: {issue_title}\n상태: {issue_status}\n분류: {issue_category}\n\n"
        "앱에서 확인하세요.",
    ),
    "issue_status_changed": (
        "[XD] 이슈 상태 변경: {issue_title}",
        "프로젝트 '{project}'의 이슈 상태가 변경되었습니다.\n\n"
        "제목: {issue_title}\n새 상태: {issue_status}\n\n앱에서 확인하세요.",
    ),
}


def render_template(kind: str, context: dict) -> tuple[str, str]:
    """(subject, body) 렌더. 미지 kind는 generic. 안전 format(주입 없음)."""
    subj_t, body_t = _TEMPLATES.get(kind, _TEMPLATES["generic"])
    ctx = {"subject": "", "body": "", "project": "", "issue_title": "",
           "issue_status": "", "issue_category": "", **(context or {})}
    try:
        return subj_t.format(**ctx), body_t.format(**ctx)
    except (KeyError, IndexError):
        return ctx.get("subject", "(제목 없음)"), ctx.get("body", "")


# ── provider 추상화 ──────────────────────────────────────────────
class EmailProvider:
    name = "abstract"

    def send(self, to: str, subject: str, body: str) -> bool:
        raise NotImplementedError


class MockEmailProvider(EmailProvider):
    """발송하지 않고 outbox에 기록(외부 egress 0)."""
    name = "mock"

    def send(self, to: str, subject: str, body: str) -> bool:
        # outbox 기록은 send_email이 project 포함해 수행(스코프 필터 위해). 여기선 발송 흉내만.
        return True  # mock '전송 성공'. 외부로 나가지 않음.


class SmtpEmailProvider(EmailProvider):
    """실 SMTP. XD_SMTP_HOST/자격증명 필요 — 미구성 시 생성 실패(HUMAN_GATE GATE-5)."""
    name = "smtp"

    def __init__(self):
        self._host = os.environ.get("XD_SMTP_HOST")
        if not self._host:
            raise RuntimeError("XD_SMTP_HOST 미구성 — 실 SMTP 발송 불가(HUMAN_GATE GATE-5)")
        self._port = int(os.environ.get("XD_SMTP_PORT", "587"))
        self._user = os.environ.get("XD_SMTP_USER", "")
        self._pass = os.environ.get("XD_SMTP_PASS", "")
        self._from = os.environ.get("XD_SMTP_FROM", self._user)

    def send(self, to: str, subject: str, body: str) -> bool:  # pragma: no cover — 게이트
        import smtplib
        from email.mime.text import MIMEText
        msg = MIMEText(body, _charset="utf-8")
        msg["Subject"] = subject
        msg["From"] = self._from
        msg["To"] = to
        with smtplib.SMTP(self._host, self._port) as s:
            s.starttls()
            if self._user:
                s.login(self._user, self._pass)
            s.send_message(msg)
        return True


# ── 킬스위치(런타임 mode) ────────────────────────────────────────
def _default_mode() -> str:
    m = (os.environ.get("XD_EMAIL_PROVIDER") or "mock").strip().lower()
    return m if m in _VALID_MODES else "mock"


_mode: Optional[str] = None


def current_mode() -> str:
    global _mode
    if _mode is None:
        _mode = _default_mode()
    return _mode


def set_mode(mode: str) -> str:
    global _mode
    m = (mode or "").strip().lower()
    if m not in _VALID_MODES:
        raise ValueError(f"잘못된 mode: {mode!r} (허용: {_VALID_MODES})")
    _mode = m
    return _mode


def smtp_configured() -> bool:
    return bool(os.environ.get("XD_SMTP_HOST"))


def make_email_provider() -> EmailProvider:
    """mode=smtp면 실 SMTP 시도(미구성 시 mock 폴백). 기본 mock."""
    if current_mode() == "smtp":
        try:
            return SmtpEmailProvider()
        except Exception as e:  # noqa: BLE001
            logger.warning("SMTP 미구성 → mock 폴백(외부 발송 0): %s", e)
    return MockEmailProvider()


# ── 발송 + 감사 ──────────────────────────────────────────────────
def send_email(to: str, subject: str = "", body: str = "",
               template: Optional[str] = None, context: Optional[dict] = None,
               project: Optional[str] = None) -> dict:
    if template:
        subject, body = render_template(template, {**(context or {}), "subject": subject, "body": body})
    provider = make_email_provider()
    sent, error = False, None
    try:
        sent = provider.send(to, subject, body)
    except Exception as e:  # noqa: BLE001
        error = str(e)[:200]
    if provider.name == "mock" and sent:
        # mock outbox 기록(project 포함 — 스코프 필터용).
        with _lock:
            box = _read_json(_OUTBOX_PATH, [])
            box.append({"ts": datetime.now(timezone.utc).isoformat(),
                        "to": to, "subject": subject, "body": body, "project": project})
            _write_json(_OUTBOX_PATH, box)
    _audit({
        "to": to, "subject": subject, "template": template or "generic",
        "provider": provider.name, "sent": sent, "project": project, "error": error,
    })
    return {"to": to, "subject": subject, "provider": provider.name, "sent": sent, "error": error}


# ── 감사(메타데이터만·본문 미기록) ───────────────────────────────
def _audit(event: dict):
    row = {"ts": datetime.now(timezone.utc).isoformat()}
    for k in _AUDIT_FIELDS:
        if k != "ts" and event.get(k) is not None:
            row[k] = event[k]
    with _lock:
        _AUDIT_PATH.parent.mkdir(parents=True, exist_ok=True)
        with _AUDIT_PATH.open("a", encoding="utf-8") as f:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def read_outbox(project: Optional[str] = None, limit: int = 100) -> list:
    box = _read_json(_OUTBOX_PATH, [])
    if project is not None:
        box = [m for m in box if m.get("project") == project]  # 프로젝트 스코프(교차노출 차단)
    box.reverse()
    return box[: max(0, limit)]


def read_audit(limit: int = 100) -> list:
    if not _AUDIT_PATH.exists():
        return []
    lines = _AUDIT_PATH.read_text(encoding="utf-8").splitlines()
    rows = [json.loads(x) for x in lines if x.strip()]
    rows.reverse()
    return rows[: max(0, limit)]


def status() -> dict:
    return {
        "provider_default": _default_mode(),
        "current_mode": current_mode(),
        "smtp_configured": smtp_configured(),
        "outbox_count": len(_read_json(_OUTBOX_PATH, [])),
    }


# ── json 헬퍼(원자적) ────────────────────────────────────────────
def _read_json(path: Path, default):
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            pass
    return default


def _write_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, path)
