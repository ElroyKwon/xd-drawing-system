"""S9.1: 양식(Forms) 영속 라우트.

체크리스트 기반 점검표(항목별 체크 상태). 완료율은 체크된 항목 비율로 산출한다.
mutation은 편집자 이상 역할을 요구한다(S7 RBAC 계승). prefix=/api/forms.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from auth import require_role
from store import get_store

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/forms", tags=["form"])

_FORM_TYPES = {"점검", "안전", "품질", "검사"}
_FORM_STATUSES = {"미시작", "진행중", "제출", "완료"}
_OPEN_STATUSES = {"미시작", "진행중"}


class FormItem(BaseModel):
    label: str
    checked: bool = False


class FormCreate(BaseModel):
    title: str
    form_type: str = "점검"
    status: str = "미시작"
    assignee: str = ""
    due_date: str = ""
    items: list[FormItem] = []
    project_name: str = "Study_Project"


class FormPatch(BaseModel):
    title: Optional[str] = None
    form_type: Optional[str] = None
    status: Optional[str] = None
    assignee: Optional[str] = None
    due_date: Optional[str] = None
    items: Optional[list[FormItem]] = None


def _require_form_role(form_id: str, min_role: str):
    form = get_store().get_form(form_id)
    if not form:
        raise HTTPException(404, f"양식 없음: {form_id}")
    require_role(form.get("project_name"), min_role)
    return form


def _validate(form_type: str, status: str) -> None:
    if form_type not in _FORM_TYPES:
        raise HTTPException(400, f"알 수 없는 양식 유형: {form_type}")
    if status not in _FORM_STATUSES:
        raise HTTPException(400, f"알 수 없는 상태: {status}")


def _completion(items: list[dict]) -> int:
    """체크된 항목 비율(%). 항목 없으면 0."""
    if not items:
        return 0
    done = sum(1 for it in items if it.get("checked"))
    return round(done / len(items) * 100)


@router.get("")
async def list_forms(project_name: Optional[str] = None, status: Optional[str] = None,
                     form_type: Optional[str] = None):
    rows = get_store().list_forms(project_name=project_name, status=status, form_type=form_type)
    for r in rows:
        r["completion"] = _completion(r.get("items") or [])
    return rows


@router.get("/summary")
async def form_summary(project_name: Optional[str] = None):
    """상태별 집계 + 평균 완료율(홈 위젯용)."""
    rows = get_store().list_forms(project_name=project_name)
    counts = {s: 0 for s in _FORM_STATUSES}
    for r in rows:
        s = r.get("status")
        if s in counts:
            counts[s] += 1
    avg = round(sum(_completion(r.get("items") or []) for r in rows) / len(rows)) if rows else 0
    return {
        "total": len(rows),
        "open": sum(counts[s] for s in _OPEN_STATUSES),
        "done": counts["완료"],
        "avg_completion": avg,
        "by_status": counts,
    }


@router.post("")
async def create_form(body: FormCreate):
    require_role(body.project_name, "편집자")  # S7: 양식 작성 = 편집자 이상
    store = get_store()
    if not body.title.strip():
        raise HTTPException(400, "양식 제목은 필수입니다")
    _validate(body.form_type, body.status)
    now = datetime.now().isoformat()
    meta = {
        "form_id": str(uuid.uuid4()),
        "title": body.title.strip(),
        "form_type": body.form_type,
        "status": body.status,
        "assignee": body.assignee,
        "due_date": body.due_date,
        "items": [it.model_dump() for it in body.items],
        "project_name": body.project_name,
        "created_at": now,
        "updated_at": now,
    }
    store.add_form(meta)
    logger.info("form created %s (%s, %s)", meta["form_id"], meta["title"], meta["form_type"])
    return {**meta, "completion": _completion(meta["items"])}


@router.patch("/{form_id}")
async def patch_form(form_id: str, body: FormPatch):
    _require_form_role(form_id, "편집자")
    store = get_store()
    fields = body.model_dump(exclude_none=True)
    if "form_type" in fields and fields["form_type"] not in _FORM_TYPES:
        raise HTTPException(400, f"알 수 없는 양식 유형: {fields['form_type']}")
    if "status" in fields and fields["status"] not in _FORM_STATUSES:
        raise HTTPException(400, f"알 수 없는 상태: {fields['status']}")
    updated = store.update_form(form_id, **fields)
    if not updated:
        raise HTTPException(404, f"양식 없음: {form_id}")
    return {**updated, "completion": _completion(updated.get("items") or [])}


@router.delete("/{form_id}")
async def delete_form(form_id: str):
    _require_form_role(form_id, "편집자")
    if not get_store().delete_form(form_id):
        raise HTTPException(404, f"양식 없음: {form_id}")
    return {"deleted": form_id}
