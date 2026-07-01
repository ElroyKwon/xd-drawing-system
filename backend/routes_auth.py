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


def _active_admin_ids(store, project_name: str) -> set:
    """프로젝트의 활성 관리자 member_id 집합. 마지막 관리자 락아웃/강등 방지에 사용."""
    return {
        pm["member_id"]
        for pm in store.list_project_members(project_name)
        if pm.get("role") == "관리자" and pm.get("status") == "활성"
    }


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
    # 렌즈1 BLOCKER-A: 기존 이름 프로젝트에 대한 생성은 그 프로젝트 관리자만(비관리자 → 403).
    # 신규(미구성) 이름은 require_role이 통과시켜 생성자를 관리자로 부트스트랩한다.
    require_role(name, "관리자")
    # 렌즈1 BLOCKER-A: 이름 중복 금지 — project_member가 project_name 키라 동명 생성은
    # 기존 구성원 집합에 병합/승격되는 권한상승 벡터가 된다.
    if any(p.get("name") == name for p in store.list_projects()):
        raise HTTPException(409, f"이미 존재하는 프로젝트 이름입니다: {name}")
    # 렌즈1 BLOCKER-B: id는 서버가 생성(클라 지정 id로 시드/기존 레코드 덮어쓰기 차단).
    creator = store.get_current_user()
    meta = {**body, "id": f"project-{uuid.uuid4().hex[:8]}", "name": name}
    meta.setdefault("created_by", creator)
    store.add_project(meta)
    # 생성자를 관리자로 자동 부여.
    store.add_project_member({
        "project_name": name, "member_id": creator,
        "role": "관리자", "status": "활성",
        "added_at": datetime.now().strftime("%Y.%m.%d."),
    })
    logger.info("project created %s (%s) by %s", meta["id"], name, creator)
    return meta


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
    # 렌즈1 MAJOR-E: 마지막 활성 관리자를 강등(role≠관리자)하거나 비활성화(status≠활성)하면
    # 거버넌스 영구 락아웃 → 차단.
    admins = _active_admin_ids(store, project_name)
    demotes_admin = member_id in admins and (
        (body.role is not None and body.role != "관리자")
        or (body.status is not None and body.status != "활성")
    )
    if demotes_admin and len(admins) <= 1:
        raise HTTPException(400, "마지막 관리자는 강등/비활성화할 수 없습니다")
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
    # 렌즈1 MAJOR-D: 마지막 활성 관리자를 제거하면 구성원 0명→'미구성'으로 강등되어
    # RBAC이 무력화되거나 거버넌스가 락아웃된다 → 차단.
    admins = _active_admin_ids(store, project_name)
    if member_id in admins and len(admins) <= 1:
        raise HTTPException(400, "마지막 관리자는 제거할 수 없습니다")
    if not store.remove_project_member(project_name, member_id):
        raise HTTPException(404, "프로젝트 구성원 없음")
    return {"removed": member_id}
