"""S7: 로컬 모의 인증 + 프로젝트/구성원 영속 라우트.

- 현재 사용자(로컬 모의): GET/PUT /api/auth/me — 비밀번호/세션 없이 구성원 전환.
- 프로젝트: GET/POST /api/projects (생성자=관리자 자동).
- 구성원: GET /api/members, GET/POST/PATCH/DELETE /api/projects/{project_name}/members
  (추가/역할변경/제거는 관리자 — auth.require_role로 강제).
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
router = APIRouter(prefix="/api", tags=["auth"])

_ROLES = {"관리자", "편집자", "뷰어"}
_STATUSES = {"활성", "대기"}


# ---------------------------------------------------------------------------
# 요청 모델
# ---------------------------------------------------------------------------

class SwitchUser(BaseModel):
    member_id: str


class AddProjectMember(BaseModel):
    member_id: str
    role: str = "뷰어"
    status: str = "활성"


class PatchProjectMember(BaseModel):
    role: Optional[str] = None
    status: Optional[str] = None


# ---------------------------------------------------------------------------
# 인증 (로컬 모의 현재 사용자)
# ---------------------------------------------------------------------------

def _me_payload(store) -> dict:
    uid = store.get_current_user()
    member = store.get_member(uid)
    # 현재 사용자의 프로젝트별 역할 맵(project_name → role).
    roles = {
        pm["project_name"]: pm["role"]
        for pm in (
            r
            for p in store.list_projects()
            for r in store.list_project_members(p["name"])
        )
        if pm["member_id"] == uid
    }
    return {"member_id": uid, "member": member, "roles": roles}


@router.get("/auth/me")
async def get_me():
    return _me_payload(get_store())


@router.put("/auth/me")
async def switch_user(body: SwitchUser):
    store = get_store()
    if not store.get_member(body.member_id):
        raise HTTPException(404, f"구성원 없음: {body.member_id}")
    store.set_current_user(body.member_id)
    return _me_payload(store)


# ---------------------------------------------------------------------------
# 프로젝트
# ---------------------------------------------------------------------------

@router.get("/projects")
async def list_projects():
    return get_store().list_projects()


@router.post("/projects")
async def create_project(body: dict):
    store = get_store()
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "프로젝트 이름은 필수입니다")
    project_id = body.get("id") or f"project-{uuid.uuid4().hex[:8]}"
    body["id"] = project_id
    creator = store.get_current_user()
    body.setdefault("created_by", creator)
    store.add_project(body)
    # 생성자를 관리자로 자동 부여.
    store.add_project_member({
        "project_name": name, "member_id": creator,
        "role": "관리자", "status": "활성",
        "added_at": datetime.now().strftime("%Y.%m.%d."),
    })
    logger.info("project created %s (%s) by %s", project_id, name, creator)
    return body


# ---------------------------------------------------------------------------
# 구성원
# ---------------------------------------------------------------------------

@router.get("/members")
async def list_members():
    return get_store().list_members()


@router.get("/projects/{project_name}/members")
async def list_project_members(project_name: str):
    """프로젝트 구성원(member + role/status 조인)."""
    store = get_store()
    members = {m["id"]: m for m in store.list_members()}
    rows = []
    for pm in store.list_project_members(project_name):
        m = members.get(pm["member_id"])
        if m:
            rows.append({**m, **pm})
    return rows


@router.post("/projects/{project_name}/members")
async def add_project_member(project_name: str, body: AddProjectMember):
    store = get_store()
    require_role(project_name, "관리자")  # 구성원 추가 = 관리자
    if body.role not in _ROLES:
        raise HTTPException(400, f"알 수 없는 역할: {body.role}")
    if body.status not in _STATUSES:
        raise HTTPException(400, f"알 수 없는 상태: {body.status}")
    if not store.get_member(body.member_id):
        raise HTTPException(404, f"구성원 없음: {body.member_id}")
    if store.get_project_member(project_name, body.member_id):
        raise HTTPException(400, "이미 프로젝트 구성원입니다")
    meta = {
        "project_name": project_name, "member_id": body.member_id,
        "role": body.role, "status": body.status,
        "added_at": datetime.now().strftime("%Y.%m.%d."),
    }
    store.add_project_member(meta)
    return meta


@router.patch("/projects/{project_name}/members/{member_id}")
async def patch_project_member(project_name: str, member_id: str, body: PatchProjectMember):
    store = get_store()
    require_role(project_name, "관리자")  # 역할/상태 변경 = 관리자
    if body.role is not None and body.role not in _ROLES:
        raise HTTPException(400, f"알 수 없는 역할: {body.role}")
    if body.status is not None and body.status not in _STATUSES:
        raise HTTPException(400, f"알 수 없는 상태: {body.status}")
    updated = store.update_project_member(
        project_name, member_id,
        **{k: v for k, v in body.model_dump().items() if v is not None},
    )
    if not updated:
        raise HTTPException(404, "프로젝트 구성원 없음")
    return updated


@router.delete("/projects/{project_name}/members/{member_id}")
async def remove_project_member(project_name: str, member_id: str):
    store = get_store()
    require_role(project_name, "관리자")  # 구성원 제거 = 관리자
    if not store.remove_project_member(project_name, member_id):
        raise HTTPException(404, "프로젝트 구성원 없음")
    return {"removed": member_id}
