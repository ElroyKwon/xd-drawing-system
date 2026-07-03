"""온톨로지 라우트 (S10) — equipment 조회(프로젝트 스코프).

GET /api/ontology/equipment?project_name=&sheet_id=  : 프로젝트(선택 시트) 장비 목록.
GET /api/ontology/equipment/{equipment_id}           : 단건.
GET /api/ontology/status                             : 백엔드(typedb|json)·카운트.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from ontology import get_ontology

router = APIRouter(prefix="/api/ontology", tags=["ontology"])


@router.get("/equipment")
def list_equipment(project_name: str = Query(...), sheet_id: Optional[str] = None):
    items = get_ontology().list_equipment(project_name, sheet_id=sheet_id)
    return {"project_name": project_name, "sheet_id": sheet_id,
            "count": len(items), "equipment": items}


@router.get("/equipment/{equipment_id}")
def get_equipment(equipment_id: str):
    e = get_ontology().get_equipment(equipment_id)
    if e is None:
        raise HTTPException(404, f"장비 없음: {equipment_id}")
    return e


@router.get("/status")
def status():
    ont = get_ontology()
    return {"backend": ont.backend}
