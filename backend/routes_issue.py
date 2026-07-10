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

import notifications
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
    resolution: Optional[dict] = None     # B2: {file_id, version_no, note} | None(해제)


class CommentCreate(BaseModel):
    body: str                             # B1: 댓글 본문(뷰어 이상 작성 가능)


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


def _resolve_sheet_key(file_id: Optional[str], sheet_id: Optional[str], store) -> Optional[str]:
    """B3: (도면, 시트) 컨텍스트 → 버전을 가로지르는 영속 sheet_key. 발급(멱등).

    version_set_id = row.version_set_id or file_id. 시트 라벨(sheet_number/index) 기준이라
    개정본에서 sheet_id 가 재발급돼도 같은 시트는 같은 sheet_key 로 계승된다."""
    if not file_id or not sheet_id:
        return None
    row = store.get_drawing(file_id)
    if not row:
        return None
    sheet = next((s for s in (row.get("sheets") or []) if s.get("sheet_id") == sheet_id), None)
    if sheet is None:
        return None
    project_name = row.get("project_name")
    version_set_id = row.get("version_set_id") or file_id
    sheet_number = sheet.get("sheet_number", "")
    sheet_index = sheet.get("sheet_index", 0)
    key = store.resolve_sheet_key(
        project_name=project_name, version_set_id=version_set_id,
        sheet_number=sheet_number, sheet_index=sheet_index)
    if key is None:  # 미발급(색인 전) → 멱등 발급
        key = store.issue_sheet_key(
            project_name=project_name, version_set_id=version_set_id,
            sheet_number=sheet_number, sheet_index=sheet_index)
    return key


# ---------------------------------------------------------------------------
# 라우트
# ---------------------------------------------------------------------------

@router.get("")
async def list_issues(status: Optional[str] = None, file_id: Optional[str] = None,
                      sheet_id: Optional[str] = None, category: Optional[str] = None,
                      project_name: Optional[str] = None, sheet_key: Optional[str] = None):
    """전역/파일/시트 스코프 목록. status 미지정 시 삭제됨 제외(열린+활성 이슈).

    sheet_key 스코프(B3): 버전을 가로지르는 시트 정체성으로 조회 — sheet_id 가 개정으로
    재발급돼도 같은 시트의 이슈를 계속 반환한다."""
    store = get_store()
    rows = store.list_issues(file_id=file_id, sheet_id=sheet_id, status=status,
                             category=category, project_name=project_name, sheet_key=sheet_key)
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


@router.get("/{issue_id}")
async def get_issue(issue_id: str):
    """단건 조회(댓글 포함) — 상세 새로고침용. 댓글은 시간순(append-only 저장 순서)."""
    store = get_store()
    issue = store.get_issue(issue_id)
    if not issue:
        raise HTTPException(404, f"이슈 없음: {issue_id}")
    return issue


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
    # B3: 도면+시트 컨텍스트가 있으면 버전 계승용 sheet_key 를 해석/발급해 이슈에 못박는다.
    sheet_key = _resolve_sheet_key(body.file_id, body.sheet_id, store)
    now = datetime.now().isoformat()
    meta = {
        "issue_id": str(uuid.uuid4()),
        "file_id": body.file_id,
        "sheet_id": body.sheet_id,
        "sheet_key": sheet_key,
        "title": body.title.strip(),
        "type": body.type,
        "status": body.status,
        "category": body.category,
        "assignee": body.assignee,
        "author": body.author,
        "description": body.description,
        "project_name": body.project_name,
        "pin": pin,
        "comments": [],
        "created_at": now,
        "updated_at": now,
    }
    store.add_issue(meta)
    logger.info("issue created %s (%s, %s, pin=%s)", meta["issue_id"], body.title.strip(),
                body.status, bool(pin))
    # S12: 이슈 생성 알림(구독자 mock 발송). 생성자 본인 제외. 실패해도 생성은 성공 유지.
    try:
        notifications.notify_issue_event(
            "created", meta, body.project_name, actor=store.get_current_user())
    except Exception:  # noqa: BLE001
        logger.exception("이슈 생성 알림 실패(무시)")
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
    # B2: 해결버전 링크. 명시 None(해제)도 반영해야 하므로 model_fields_set 로 감지
    # (model_dump(exclude_none)은 None 을 떨궈 clear 를 못 함).
    if "resolution" in body.model_fields_set:
        res = body.resolution
        if res is not None:
            res_file_id = res.get("file_id")
            if res_file_id and not store.get_drawing(res_file_id):
                raise HTTPException(404, f"해결버전 도면 없음: {res_file_id}")
        fields["resolution"] = res
    # 핀 위치 불변식: 결과 이슈가 핀을 가지면 file_id/sheet_id가 유효해야 한다
    # (create와 동일 — 부유 핀·존재하지 않는 시트로의 재배치 금지).
    result_pin = fields.get("pin", current.get("pin"))
    if result_pin is not None:
        result_sheet_id = fields.get("sheet_id", current.get("sheet_id"))
        _require_pin_location(current.get("file_id"), result_sheet_id, store)
    updated = store.update_issue(issue_id, **fields)
    if not updated:
        raise HTTPException(404, f"이슈 없음: {issue_id}")
    # S12: 상태 변경 시 알림(실제로 바뀐 경우만). 실패해도 변경은 성공 유지.
    if "status" in fields and fields["status"] != current.get("status"):
        try:
            notifications.notify_issue_event(
                "status_changed", updated, updated.get("project_name") or "",
                actor=store.get_current_user())
        except Exception:  # noqa: BLE001
            logger.exception("이슈 상태변경 알림 실패(무시)")
    return updated


@router.post("/{issue_id}/comments")
async def add_comment(issue_id: str, body: CommentCreate):
    """B1: 이슈 댓글/답글(append-only). 뷰어 이상(프로젝트 구성원 누구나) 작성 가능 —
    협력사(뷰어)가 상태를 오염시키지 않고 현장 확인만 남기는 시나리오를 살린다."""
    store = get_store()
    require_role_for_issue(issue_id, "뷰어")   # 뷰어 이상(생성/변경=편집자와 별도)
    text = (body.body or "").strip()
    if not text:
        raise HTTPException(400, "댓글 내용은 필수입니다")
    uid = store.get_current_user()
    member = store.get_member(uid) if uid else None
    comment = {
        "comment_id": str(uuid.uuid4()),
        "author_id": uid,
        "author_name": (member or {}).get("name") or "사용자",
        "body": text,
        "created_at": datetime.now().isoformat(),
    }
    updated = store.add_issue_comment(issue_id, comment)
    if not updated:
        raise HTTPException(404, f"이슈 없음: {issue_id}")
    # B1: 댓글 알림(작성자 제외). 실패해도 댓글 성공 유지.
    try:
        notifications.notify_issue_event(
            "commented", updated, updated.get("project_name") or "", actor=uid)
    except Exception:  # noqa: BLE001
        logger.exception("이슈 댓글 알림 실패(무시)")
    return updated


@router.delete("/{issue_id}")
async def delete_issue(issue_id: str):
    store = get_store()
    require_role_for_issue(issue_id, "편집자")  # S7: 이슈 삭제 = 편집자 이상
    if not store.delete_issue(issue_id):
        raise HTTPException(404, f"이슈 없음: {issue_id}")
    return {"deleted": issue_id}
