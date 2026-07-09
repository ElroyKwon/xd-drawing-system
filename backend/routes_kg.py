"""지식그래프 조회 라우트 (읽기 전용) — 스냅샷 순회. 쓰기 없음(⑥ write-back 이연).

GET /api/kg/node/{id}      : 노드 + 인접 엣지
GET /api/kg/neighbors      : N홉 이웃(depth 상한)
GET /api/kg/path           : 두 노드 최단 경로
GET /api/kg/evidence       : 근거체인(엣지 evidence + describes 노트)
GET /api/kg/graph          : 시각화용 서브그래프(scope 필터)
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

import kg_store

router = APIRouter(prefix="/api/kg", tags=["knowledge-graph"])


@router.get("/node/{node_id}")
def node(node_id: str, project_name: str = Query(...)):
    r = kg_store.get_node(project_name, node_id)
    if not r.get("found"):
        raise HTTPException(404, f"노드 없음: {node_id}")
    return r


@router.get("/neighbors")
def neighbors(project_name: str = Query(...), id: str = Query(...),
             depth: int = 1, types: Optional[str] = None):
    type_list = [t for t in (types or "").split(",") if t] or None
    r = kg_store.neighbors(project_name, id, depth=depth, types=type_list)
    if not r.get("found"):
        raise HTTPException(404, f"노드 없음: {id}")
    return r


@router.get("/path")
def path(project_name: str = Query(...),
         src: str = Query(..., alias="from"),
         dst: str = Query(..., alias="to")):
    r = kg_store.path(project_name, src, dst)
    if not r.get("found"):
        raise HTTPException(404, f"노드 없음: {src} 또는 {dst}")
    return r


@router.get("/evidence")
def evidence(project_name: str = Query(...), id: str = Query(...)):
    r = kg_store.evidence(project_name, id)
    if not r.get("found"):
        raise HTTPException(404, f"노드 없음: {id}")
    return r


@router.get("/graph")
def graph(project_name: str = Query(...), scope: Optional[str] = None):
    r = kg_store.subgraph(project_name, scope)
    if not r.get("found", True):
        raise HTTPException(404, f"노드 없음: {scope}")
    return r
