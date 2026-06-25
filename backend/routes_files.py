"""S3: 파일/폴더 트리 라우트. 폴더 CRUD + 권한 메타.

폴더는 DrawingStore(folder API)에 영속. 신규 프로젝트 첫 GET에서 ACC 기본 폴더
세트를 seed-on-create. 권한은 메타·표시만(인증/RBAC 강제는 S7 — LOOP Human gate).
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from routes_drawing import _validate_project_name
from store import _DEFAULT_PERMISSIONS, get_store

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/folders", tags=["folders"])


class FolderCreate(BaseModel):
    project_name: str = "Study_Project"
    name: str
    parent_id: str | None = None
    share_status: str = "프로젝트 공유"
    created_by: str = "사용자"


class FolderPatch(BaseModel):
    name: str | None = None
    parent_id: str | None = None
    share_status: str | None = None
    permissions: list | None = None
    updated_by: str | None = None


@router.get("")
async def list_folders(project_name: str = "Study_Project"):
    _validate_project_name(project_name)
    return get_store().list_folders(project_name)


@router.post("")
async def create_folder(body: FolderCreate):
    _validate_project_name(body.project_name)
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "폴더 이름이 비어 있습니다")
    store = get_store()
    if body.parent_id and not store.get_folder(body.parent_id):
        raise HTTPException(404, f"상위 폴더 없음: {body.parent_id}")
    meta = {
        "folder_id": str(uuid.uuid4()),
        "project_name": body.project_name,
        "name": name,
        "parent_id": body.parent_id,
        "share_status": body.share_status,
        "permissions": list(_DEFAULT_PERMISSIONS),
        "updated_at": datetime.now().isoformat(),
        "updated_by": body.created_by,
        "seeded": False,
    }
    store.add_folder(meta)
    logger.info("folder created %s (%s)", meta["folder_id"], name)
    return meta


@router.patch("/{folder_id}")
async def patch_folder(folder_id: str, body: FolderPatch):
    fields = body.model_dump(exclude_none=True)
    if "name" in fields and not fields["name"].strip():
        raise HTTPException(400, "폴더 이름이 비어 있습니다")
    if "name" in fields:
        fields["name"] = fields["name"].strip()
    store = get_store()
    # parent_id 변경 시 존재·사이클 검증(create와 대칭). 사이클이면 트리가 끊긴다.
    if "parent_id" in fields and fields["parent_id"]:
        new_parent = fields["parent_id"]
        if new_parent == folder_id:
            raise HTTPException(400, "폴더를 자기 자신의 하위로 옮길 수 없습니다")
        cur = store.get_folder(new_parent)
        if not cur:
            raise HTTPException(404, f"상위 폴더 없음: {new_parent}")
        seen = set()
        while cur:
            if cur["folder_id"] == folder_id:
                raise HTTPException(400, "폴더를 자신의 하위 폴더로 옮길 수 없습니다(순환)")
            if cur["folder_id"] in seen:
                break
            seen.add(cur["folder_id"])
            pid = cur.get("parent_id")
            cur = store.get_folder(pid) if pid else None
    updated = store.update_folder(folder_id, **fields)
    if not updated:
        raise HTTPException(404, f"폴더 없음: {folder_id}")
    return updated


@router.delete("/{folder_id}")
async def delete_folder(folder_id: str):
    if not get_store().delete_folder(folder_id):
        raise HTTPException(404, f"폴더 없음: {folder_id}")
    return {"deleted": folder_id}
