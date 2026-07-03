"""이메일 라우트 (S11) — 발송(mock=outbox)·outbox·상태·킬스위치.

POST /api/email/send    : 발송(RBAC 편집자). mock 모드면 outbox 기록(외부 0).
GET  /api/email/outbox  : mock outbox(발송됐을 메일).
GET  /api/email/status  : provider·mode·smtp 구성여부(자격증명 미노출).
POST /api/email/mode    : 런타임 킬스위치(mock|smtp).
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import email_service
from auth import require_role

router = APIRouter(prefix="/api/email", tags=["email"])


class SendRequest(BaseModel):
    to: str
    subject: str = ""
    body: str = ""
    template: Optional[str] = None
    context: Optional[dict] = None
    project_name: str


class ModeRequest(BaseModel):
    mode: str
    project_name: str


@router.post("/send")
def send(body: SendRequest):
    require_role(body.project_name, "편집자")
    if not body.to.strip():
        raise HTTPException(400, "수신자(to)가 비었습니다")
    return email_service.send_email(
        body.to, body.subject, body.body,
        template=body.template, context=body.context, project=body.project_name,
    )


@router.get("/outbox")
def outbox(project_name: str, limit: int = 100):
    # 프로젝트 스코프 + 편집자 이상(본문 교차노출 차단).
    require_role(project_name, "편집자")
    items = email_service.read_outbox(project_name, limit)
    return {"count": len(items), "outbox": items}


@router.get("/status")
def status():
    return email_service.status()


@router.post("/mode")
def set_mode(body: ModeRequest):
    # egress 킬스위치 = 운영 통제 → 편집자 이상(프로젝트 컨텍스트 요구).
    require_role(body.project_name, "편집자")
    try:
        email_service.set_mode(body.mode)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return email_service.status()
