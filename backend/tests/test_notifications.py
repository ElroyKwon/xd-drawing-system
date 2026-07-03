"""S12: 이슈 라이프사이클 알림 — 구독자 mock 발송·actor 제외·토글·실패 격리."""
import importlib
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # backend/

import config  # noqa: E402


def _setup(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "UPLOADS_DIR", tmp_path)
    monkeypatch.setattr(config, "STORE_BACKEND", "json")
    monkeypatch.setenv("XD_NOTIFY", "1")
    monkeypatch.setenv("XD_EMAIL_PROVIDER", "mock")
    import store as store_mod
    importlib.reload(store_mod)
    import email_service as es
    importlib.reload(es)
    es._mode = None
    import notifications as notif
    importlib.reload(notif)
    return notif, es


_ISSUE = {"issue_id": "i1", "title": "케이블 간섭", "status": "열림", "category": "간섭"}


def test_notify_created_sends_to_subscribers(tmp_path, monkeypatch):
    notif, es = _setup(tmp_path, monkeypatch)
    r = notif.notify_issue_event("created", _ISSUE, "Study_Project")
    assert r["notified"] >= 1  # 시드 구성원(이메일 보유) 대상
    box = es.read_outbox("Study_Project")
    assert len(box) == r["notified"]
    assert box[0]["subject"].startswith("[XD] 새 이슈")


def test_actor_excluded(tmp_path, monkeypatch):
    notif, es = _setup(tmp_path, monkeypatch)
    full = notif.subscribers_for("Study_Project")
    less = notif.subscribers_for("Study_Project", exclude="member-owner")
    # member-owner 이메일이 제외됨
    assert "cruelkh@gmail.com" in full
    assert "cruelkh@gmail.com" not in less
    assert len(less) == len(full) - 1


def test_status_changed_template(tmp_path, monkeypatch):
    notif, es = _setup(tmp_path, monkeypatch)
    notif.notify_issue_event("status_changed", {**_ISSUE, "status": "닫힘"}, "Study_Project")
    box = es.read_outbox("Study_Project")
    assert box[0]["subject"].startswith("[XD] 이슈 상태 변경")


def test_disabled_toggle(tmp_path, monkeypatch):
    notif, es = _setup(tmp_path, monkeypatch)
    monkeypatch.setenv("XD_NOTIFY", "0")
    r = notif.notify_issue_event("created", _ISSUE, "Study_Project")
    assert r["notified"] == 0
    assert len(es.read_outbox("Study_Project")) == 0


def test_notify_failure_isolated(tmp_path, monkeypatch):
    notif, es = _setup(tmp_path, monkeypatch)
    monkeypatch.setattr(es, "send_email", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("boom")))
    # 예외를 삼켜 notified 집계만 낮아지고 raise 안 함
    r = notif.notify_issue_event("created", _ISSUE, "Study_Project")
    assert r["notified"] == 0  # 전부 실패했지만 예외 없이 반환
