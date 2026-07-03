"""이슈 라이프사이클 이메일 알림 (S12) — 이슈 생성/상태변경 → 구독자에게 발송.

S11 이메일 인프라 위에 구축(기본 mock=외부 발송 0, outbox 기록). 구독자 = 프로젝트
구성원 중 이메일 보유자. 알림 실패가 이슈 작업을 깨뜨리지 않도록 호출부에서 방어.
"""
from __future__ import annotations

import logging
import os
from typing import Optional

import email_service
from store import get_store

logger = logging.getLogger(__name__)

_TEMPLATES = {"created": "issue_created", "status_changed": "issue_status_changed"}


def enabled() -> bool:
    return os.environ.get("XD_NOTIFY", "1") != "0"


def subscribers_for(project: str, exclude: Optional[str] = None) -> list[str]:
    """프로젝트 구성원 중 이메일 보유자(actor 제외). 구성원 미구성 프로젝트는
    전체 구성원으로 폴백(로컬 데모 편의)."""
    store = get_store()
    all_members = {m["id"]: m for m in store.list_members()}
    pmembers = store.list_project_members(project)
    subs = []
    for pm in pmembers:
        mid = pm.get("member_id")
        if mid == exclude:
            continue
        m = all_members.get(mid)
        if m and m.get("email"):
            subs.append(m["email"])
    if not subs and not pmembers:  # 미구성 프로젝트 폴백
        subs = [m["email"] for m in all_members.values()
                if m.get("email") and m["id"] != exclude]
    return subs


def notify_issue_event(kind: str, issue: dict, project: str,
                       actor: Optional[str] = None) -> dict:
    """kind = 'created' | 'status_changed'. 구독자에게 mock 발송(outbox). 예외 삼킴."""
    if not enabled():
        return {"notified": 0, "reason": "disabled"}
    template = _TEMPLATES.get(kind, "generic")
    ctx = {
        "project": project,
        "issue_title": issue.get("title", ""),
        "issue_status": issue.get("status", ""),
        "issue_category": issue.get("category", ""),
    }
    subs = subscribers_for(project, exclude=actor)
    n = 0
    for to in subs:
        try:
            email_service.send_email(to, template=template, context=ctx, project=project)
            n += 1
        except Exception as e:  # noqa: BLE001 — 알림 실패가 이슈 작업을 깨지 않게
            logger.warning("이슈 알림 발송 실패(%s): %s", to, e)
    logger.info("이슈 알림 %s: %d명 (%s)", kind, n, issue.get("issue_id"))
    return {"notified": n, "subscribers": subs}
