"""S11: 이메일 인프라 — mock 발송(outbox)·감사 메타데이터만·킬스위치·템플릿·상태."""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # backend/

import email_service as es  # noqa: E402


def _isolate(tmp_path, monkeypatch):
    monkeypatch.setattr(es, "_OUTBOX_PATH", tmp_path / "_email_outbox.json")
    monkeypatch.setattr(es, "_AUDIT_PATH", tmp_path / "_email_audit.jsonl")
    es._mode = None  # 기본값 리셋
    monkeypatch.setenv("XD_EMAIL_PROVIDER", "mock")
    monkeypatch.delenv("XD_SMTP_HOST", raising=False)


def test_mock_send_to_outbox_no_egress(tmp_path, monkeypatch):
    _isolate(tmp_path, monkeypatch)
    r = es.send_email("a@b.com", "제목", "본문", project="Study_Project")
    assert r["provider"] == "mock" and r["sent"] is True
    box = es.read_outbox()
    assert len(box) == 1 and box[0]["to"] == "a@b.com"


def test_audit_metadata_only_no_body(tmp_path, monkeypatch):
    _isolate(tmp_path, monkeypatch)
    es.send_email("x@y.com", "비밀제목", "매우 비밀스러운 본문내용", project="P")
    rows = es.read_audit()
    assert len(rows) == 1
    raw = json.dumps(rows[0], ensure_ascii=False)
    assert "매우 비밀스러운 본문" not in raw  # 본문 미기록
    assert "body" not in rows[0]
    assert rows[0]["to"] == "x@y.com" and rows[0]["provider"] == "mock" and rows[0]["sent"] is True


def test_kill_switch_smtp_unconfigured_no_send(tmp_path, monkeypatch):
    _isolate(tmp_path, monkeypatch)
    # mode=smtp 강제하되 XD_SMTP_HOST 미구성 → mock 폴백(외부 발송 0).
    es.set_mode("smtp")
    p = es.make_email_provider()
    assert p.name == "mock"  # 미구성 → mock 폴백
    r = es.send_email("a@b.com", "s", "b", project="P")
    assert r["provider"] == "mock"  # 외부로 안 나감
    # 잘못된 mode → ValueError
    try:
        es.set_mode("carrier-pigeon")
        assert False
    except ValueError:
        pass


def test_smtp_provider_raises_without_config(tmp_path, monkeypatch):
    _isolate(tmp_path, monkeypatch)
    try:
        es.SmtpEmailProvider()
        assert False, "미구성인데 생성됨"
    except RuntimeError as e:
        assert "GATE-5" in str(e)


def test_templates_render(tmp_path, monkeypatch):
    _isolate(tmp_path, monkeypatch)
    subj, body = es.render_template("issue_created", {
        "project": "Study_Project", "issue_title": "케이블 간섭",
        "issue_status": "open", "issue_category": "간섭",
    })
    assert "케이블 간섭" in subj and "Study_Project" in body and "open" in body
    subj2, body2 = es.render_template("issue_status_changed", {"issue_title": "T", "issue_status": "closed"})
    assert "closed" in body2
    # 미지 템플릿 → generic
    subj3, _ = es.render_template("nope", {"subject": "직접제목"})
    assert subj3 == "직접제목"


def test_status_no_credential_leak(tmp_path, monkeypatch):
    _isolate(tmp_path, monkeypatch)
    monkeypatch.setenv("XD_SMTP_PASS", "super-secret-pw")
    st = es.status()
    assert st["current_mode"] == "mock"
    assert st["smtp_configured"] is False  # HOST 없음
    assert "super-secret-pw" not in json.dumps(st)  # 자격증명 미노출


def test_outbox_project_scoped(tmp_path, monkeypatch):
    _isolate(tmp_path, monkeypatch)
    es.send_email("a@b.com", "s1", "b1", project="ProjA")
    es.send_email("c@d.com", "s2", "b2", project="ProjB")
    a = es.read_outbox("ProjA")
    assert len(a) == 1 and a[0]["to"] == "a@b.com"  # 타 프로젝트 본문 미노출
    assert len(es.read_outbox("ProjB")) == 1
    assert len(es.read_outbox()) == 2  # 무필터 = 전체(내부용)
