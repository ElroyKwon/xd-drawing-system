"""지식그래프 쓰기 라우트 (⑥ write-back) — relates_to 승격 확인·오탐 거부.

읽기 routes_kg.py 와 분리(격리 경계 명확화). 8000 egress 0 — 로컬 파일 쓰기만.
검증은 순수 스냅샷(kg_store._graph)에서 relates_to 엣지 존재 + track=='llm' 확인.
actor 는 X-Actor 헤더 옵셔널(인증 강제는 GATE-6 이연). at 은 요청 시각 주입.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

import kg_store

router = APIRouter(prefix="/api/kg/edge", tags=["knowledge-graph-writeback"])


class EdgeRef(BaseModel):
    project_name: str
    src: str
    dst: str
    reason: Optional[str] = None


def _require_llm_relates_to(project: str, src: str, dst: str) -> str:
    """순수 스냅샷에서 정규화 키의 relates_to 엣지가 존재하고 track=='llm' 인지 검증.

    성공 시 edge_key 반환, 아니면 400. (승격 대상은 오직 AI 제안 relates_to.)
    """
    key = kg_store.edge_key(src, dst)
    g = kg_store._graph(project)  # 순수 스냅샷(병합 전).
    for e in g.get("edges", []):
        if e.get("type") == "relates_to" and kg_store.edge_key(e["src"], e["dst"]) == key:
            if e.get("track") != "llm":
                raise HTTPException(400, f"승격 대상 아님(track={e.get('track')}): {key}")
            return key
    raise HTTPException(400, f"relates_to(llm) 엣지 없음: {key}")


@router.post("/confirm")
def confirm(ref: EdgeRef, x_actor: Optional[str] = Header(default=None)) -> dict:
    """AI 제안 relates_to(track=llm)를 사람이 확인 → curated 승격(오버레이 append)."""
    key = _require_llm_relates_to(ref.project_name, ref.src, ref.dst)
    at = datetime.now(timezone.utc).isoformat()
    kg_store.append_override(ref.project_name, key, "confirm", actor=x_actor, at=at, reason=None)
    return {"ok": True, "edge_key": key, "new_track": "curated"}


@router.post("/reject")
def reject(ref: EdgeRef, x_actor: Optional[str] = Header(default=None)) -> dict:
    """AI 제안 relates_to(track=llm)를 오탐 판정 → 뷰/순회에서 drop(오버레이 append)."""
    key = _require_llm_relates_to(ref.project_name, ref.src, ref.dst)
    at = datetime.now(timezone.utc).isoformat()
    kg_store.append_override(ref.project_name, key, "reject", actor=x_actor, at=at, reason=ref.reason)
    return {"ok": True, "edge_key": key, "hidden": True}
