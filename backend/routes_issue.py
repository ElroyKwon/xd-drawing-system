"""S5: 이슈 영속 + 뷰어 핀 연계 라우트 (§H 이슈).

독립 Issue 엔티티(마크업과 별개). 이슈는 프로젝트 전역 목록(IssuesView)과
시트 컨텍스트(뷰어 핀)를 모두 지원한다. 핀은 선택적이며 좌표계는 S4 coord_space를
계승한다(DXF=world model 좌표 / PDF·래스터=정규화 이미지 0~1).

prefix=/api/issues — `/api/drawings/{file_id}`가 "issues"를 file_id로 오인하는
경로 충돌을 피하기 위해 도면 라우터와 분리한다(동작은 동일, URL만 별도 네임스페이스).
"""
from __future__ import annotations

import logging
import math
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from auth import require_role, require_role_for_file, require_role_for_issue
from store import get_store

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/issues", tags=["issue"])

# ACC식 상태 머신. 삭제됨은 soft delete 종착.
_ISSUE_STATUSES = {"열림", "진행중", "답변됨", "닫힘", "삭제됨"}
_STATUS_TRANSITIONS = {
    "열림": {"진행중", "답변됨", "닫힘", "삭제됨"},
    "진행중": {"답변됨", "닫힘", "열림", "삭제됨"},
    "답변됨": {"닫힘", "진행중", "열림", "삭제됨"},
    "닫힘": {"열림", "삭제됨"},        # 닫힌 이슈는 재오픈 후에만 진행 가능
    "삭제됨": {"열림"},               # 복원
}
_ISSUE_TYPES = {"설계 검토", "현장 확인", "간섭", "품질", "협의", "기타"}
# IssueAddPanel 카테고리(검색 및 추가). count는 실집계.
_ISSUE_CATEGORIES = {"clash", "quality", "coordination"}
# 카테고리 count = 진행 중인(닫힘/삭제 제외) 이슈 수.
_OPEN_STATUSES = {"열림", "진행중", "답변됨"}


# ---------------------------------------------------------------------------
# 요청 모델
# ---------------------------------------------------------------------------

class IssuePin(BaseModel):
    point: list[float]                    # [x, y] — world 또는 정규화 image 좌표
    coord_space: str = "world"            # world | image


class IssueCreate(BaseModel):
    title: str
    type: str = "설계 검토"
    category: str = ""
    assignee: str = ""
    description: str = ""
    status: str = "열림"
    author: str = "사용자"
    project_name: str = "Study_Project"
    file_id: Optional[str] = None
    sheet_id: Optional[str] = None
    pin: Optional[IssuePin] = None        # 선택적(핀 없는 전역 이슈 허용)


class IssuePatch(BaseModel):
    title: Optional[str] = None
    type: Optional[str] = None
    category: Optional[str] = None
    assignee: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    sheet_id: Optional[str] = None
    pin: Optional[IssuePin] = None


# ---------------------------------------------------------------------------
# 검증 헬퍼
# ---------------------------------------------------------------------------

def _validate_pin(pin: IssuePin) -> dict:
    if pin.coord_space not in ("world", "image"):
        raise HTTPException(400, f"잘못된 coord_space: {pin.coord_space}")
    if len(pin.point) != 2:
        raise HTTPException(400, "핀 좌표는 [x, y] 두 값이어야 합니다")
    x, y = pin.point
    if not (math.isfinite(x) and math.isfinite(y)):
        raise HTTPException(400, "핀 좌표는 유한한 숫자여야 합니다")
    if pin.coord_space == "image":
        if not (0.0 <= x <= 1.0 and 0.0 <= y <= 1.0):
            raise HTTPException(400, "image 핀 좌표는 [0,1] 범위여야 합니다")
    return {"point": list(pin.point), "coord_space": pin.coord_space}


def _validate_type(t: str) -> None:
    if t not in _ISSUE_TYPES:
        raise HTTPException(400, f"알 수 없는 이슈 유형: {t}")


def _validate_category(c: str) -> None:
    if c and c not in _ISSUE_CATEGORIES:
        raise HTTPException(400, f"알 수 없는 카테고리: {c}")


def _require_pin_location(file_id: Optional[str], sheet_id: Optional[str], store) -> None:
    """핀이 있으면 도면/시트 컨텍스트가 있어야 한다(부유 핀 금지)."""
    if not file_id or not sheet_id:
        raise HTTPException(400, "핀 이슈는 file_id와 sheet_id가 필요합니다")
    row = store.get_drawing(file_id)
    if not row:
        raise HTTPException(404, f"도면 없음: {file_id}")
    if not any(s.get("sheet_id") == sheet_id for s in (row.get("sheets") or [])):
        raise HTTPException(404, f"시트 없음: {sheet_id}")


# ---------------------------------------------------------------------------
# 라우트
# ---------------------------------------------------------------------------

@router.get("")
async def list_issues(status: Optional[str] = None, file_id: Optional[str] = None,
                      sheet_id: Optional[str] = None, category: Optional[str] = None,
                      project_name: Optional[str] = None):
    """전역/파일/시트 스코프 목록. status 미지정 시 삭제됨 제외(열린+활성 이슈)."""
    store = get_store()
    rows = store.list_issues(file_id=file_id, sheet_id=sheet_id, status=status,
                             category=category, project_name=project_name)
    if status is None:
        rows = [r for r in rows if r.get("status") != "삭제됨"]
    return rows


@router.get("/categories")
async def issue_categories(project_name: Optional[str] = None):
    """카테고리별 진행 중(닫힘/삭제 제외) 이슈 수 실집계."""
    store = get_store()
    rows = store.list_issues(project_name=project_name)
    counts = {c: 0 for c in _ISSUE_CATEGORIES}
    for r in rows:
        c = r.get("category")
        if c in counts and r.get("status") in _OPEN_STATUSES:
            counts[c] += 1
    return counts


@router.post("")
async def create_issue(body: IssueCreate):
    store = get_store()
    # 렌즈1 MAJOR-C: file_id가 있으면 자기신고 project_name이 아니라 '실 도면 유래' 역할로 강제한다
    # (마크업/측정과 동일 원칙). 가짜 project_name으로 실도면에 이슈를 주입하는 우회를 차단.
    if body.file_id:
        require_role_for_file(body.file_id, "편집자")  # S7: 이슈 작성 = 편집자 이상
    else:
        require_role(body.project_name, "편집자")
    if not body.title.strip():
        raise HTTPException(400, "이슈 제목은 필수입니다")
    if body.status not in _ISSUE_STATUSES:
        raise HTTPException(400, f"알 수 없는 상태: {body.status}")
    _validate_type(body.type)
    _validate_category(body.category)
    pin = None
    if body.pin is not None:
        pin = _validate_pin(body.pin)
        _require_pin_location(body.file_id, body.sheet_id, store)
    now = datetime.now().isoformat()
    meta = {
        "issue_id": str(uuid.uuid4()),
        "file_id": body.file_id,
        "sheet_id": body.sheet_id,
        "title": body.title.strip(),
        "type": body.type,
        "status": body.status,
        "category": body.category,
        "assignee": body.assignee,
        "author": body.author,
        "description": body.description,
        "project_name": body.project_name,
        "pin": pin,
        "created_at": now,
        "updated_at": now,
    }
    store.add_issue(meta)
    logger.info("issue created %s (%s, %s, pin=%s)", meta["issue_id"], body.title.strip(),
                body.status, bool(pin))
    return meta


@router.patch("/{issue_id}")
async def patch_issue(issue_id: str, body: IssuePatch):
    store = get_store()
    require_role_for_issue(issue_id, "편집자")  # S7: 이슈 변경 = 편집자 이상
    current = store.get_issue(issue_id)
    if not current:
        raise HTTPException(404, f"이슈 없음: {issue_id}")
    fields = body.model_dump(exclude_none=True)
    if "status" in fields:
        new_status = fields["status"]
        if new_status not in _ISSUE_STATUSES:
            raise HTTPException(400, f"알 수 없는 상태: {new_status}")
        cur_status = current.get("status", "열림")
        if new_status != cur_status and new_status not in _STATUS_TRANSITIONS.get(cur_status, set()):
            raise HTTPException(400, f"허용되지 않은 상태 전이: {cur_status} → {new_status}")
    if "type" in fields:
        _validate_type(fields["type"])
    if "category" in fields:
        _validate_category(fields["category"])
    if "pin" in fields and body.pin is not None:
        fields["pin"] = _validate_pin(body.pin)
    # 핀 위치 불변식: 결과 이슈가 핀을 가지면 file_id/sheet_id가 유효해야 한다
    # (create와 동일 — 부유 핀·존재하지 않는 시트로의 재배치 금지).
    result_pin = fields.get("pin", current.get("pin"))
    if result_pin is not None:
        result_sheet_id = fields.get("sheet_id", current.get("sheet_id"))
        _require_pin_location(current.get("file_id"), result_sheet_id, store)
    updated = store.update_issue(issue_id, **fields)
    if not updated:
        raise HTTPException(404, f"이슈 없음: {issue_id}")
    return updated


@router.delete("/{issue_id}")
async def delete_issue(issue_id: str):
    store = get_store()
    require_role_for_issue(issue_id, "편집자")  # S7: 이슈 삭제 = 편집자 이상
    if not store.delete_issue(issue_id):
        raise HTTPException(404, f"이슈 없음: {issue_id}")
    return {"deleted": issue_id}
