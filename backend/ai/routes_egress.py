"""egress 라우트 (S8.4) — 런타임 킬스위치 + 상태 + 감사로그 조회.

POST /api/egress/mode    : 런타임 provider mode 토글({"mode":"mock"|"openai"}). 재기동 불필요.
GET  /api/egress/status  : 키 존재여부(마스킹)·기본 provider·현재 mode·모델(원문 키 미노출).
GET  /api/egress/audit   : egress 이벤트 감사로그(메타데이터만, 최신순 read-only).
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

import egress

router = APIRouter(prefix="/api/egress", tags=["egress"])


class ModeRequest(BaseModel):
    mode: str


@router.post("/mode")
async def set_mode(body: ModeRequest):
    try:
        egress.set_mode(body.mode)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return egress.status()


@router.get("/status")
async def get_status():
    return egress.status()


@router.get("/audit")
async def get_audit(limit: int = Query(50, ge=1, le=1000)):
    return {"events": egress.read(limit), "limit": limit}
