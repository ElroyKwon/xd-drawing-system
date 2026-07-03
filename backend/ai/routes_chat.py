"""챗 라우트 (S8.1) — 대화 생성/계속 + 목록/조회.

POST /api/chat            : 한 턴 실행(신규 or 기존 대화). 실 LLM tool-use 그라운딩.
GET  /api/chat/conversations        : 대화 목록(요약).
GET  /api/chat/conversations/{cid}  : 대화 상세(메시지 포함).

owner는 전송 시점 8000 current_user로 고정(GATE-3 하향 — 표시용).
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import ai_store
from agent import run_chat
from client import BackendError, get_me
from provider import make_provider

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatRequest(BaseModel):
    project: str
    message: str
    conversation_id: Optional[str] = None
    provider: Optional[str] = None  # "openai" | "mock" (테스트/폴백)


def _current_owner() -> Optional[str]:
    """전송 시점 8000 현재 사용자(도달 실패 시 None — 표시용이라 치명적 아님)."""
    try:
        return get_me().get("member_id")
    except BackendError:
        return None


@router.post("")
async def chat(body: ChatRequest):
    if not body.message.strip():
        raise HTTPException(400, "메시지가 비었습니다")

    # 대화 확보(신규 or 기존).
    if body.conversation_id:
        conv = ai_store.get_conversation(body.conversation_id)
        if conv is None:
            raise HTTPException(404, f"대화 없음: {body.conversation_id}")
        if conv["project"] != body.project:
            raise HTTPException(400, "대화의 프로젝트와 요청 프로젝트가 다릅니다")
    else:
        conv = ai_store.create_conversation(body.project, _current_owner())

    history = [{"role": m["role"], "content": m["content"]}
               for m in conv["messages"] if m["role"] in ("user", "assistant")]

    ai_store.append_message(conv["id"], "user", body.message)
    provider = make_provider(body.provider)
    try:
        result = run_chat(body.project, body.message, history=history, provider=provider)
    except Exception as e:
        logger.exception("chat 실행 실패")
        raise HTTPException(502, f"LLM 실행 실패: {e}")

    ai_store.append_message(conv["id"], "assistant", result["answer"],
                            tool_calls=result.get("tool_calls"),
                            references=result.get("references"))
    return {
        "conversation_id": conv["id"],
        "answer": result["answer"],
        "tool_calls": result.get("tool_calls", []),
        "references": result.get("references", []),
        "provider": result.get("provider"),
    }


@router.get("/conversations")
async def list_conversations(project: Optional[str] = None):
    return ai_store.list_conversations(project=project)


@router.get("/conversations/{cid}")
async def get_conversation(cid: str):
    conv = ai_store.get_conversation(cid)
    if conv is None:
        raise HTTPException(404, f"대화 없음: {cid}")
    return conv
