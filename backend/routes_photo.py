"""S9.2: 사진(Photos) 영속 라우트.

현장/검수 사진 업로드 + 갤러리 + 선택적 시트 연결. 이미지 파일은
uploads/<project>/photos/<photo_id>/ 아래에 저장하고, 메타는 store에 둔다.
mutation은 편집자 이상 역할을 요구한다(S7 RBAC 계승). prefix=/api/photos.
"""
from __future__ import annotations

import logging
import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

import config
from auth import require_role
from routes_drawing import _png_url  # /files 상대 URL 구성 재사용
from store import get_store

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/photos", tags=["photo"])

# 사진은 이미지 포맷만 허용.
IMAGE_EXTS = {"jpg", "jpeg", "png", "webp", "gif"}


class PhotoPatch(BaseModel):
    title: Optional[str] = None
    caption: Optional[str] = None
    sheet_id: Optional[str] = None


def _with_url(row: dict) -> dict:
    row = dict(row)
    row["photo_url"] = _png_url(row.get("file_path"))
    row.pop("file_path", None)  # 절대 서버경로 노출 차단(도면 _with_urls와 일관)
    return row


def _require_photo_role(photo_id: str, min_role: str) -> dict:
    photo = get_store().get_photo(photo_id)
    if not photo:
        raise HTTPException(404, f"사진 없음: {photo_id}")
    require_role(photo.get("project_name"), min_role)
    return photo


@router.get("")
async def list_photos(project_name: Optional[str] = None, sheet_id: Optional[str] = None):
    rows = get_store().list_photos(project_name=project_name, sheet_id=sheet_id)
    return [_with_url(r) for r in rows]


@router.get("/summary")
async def photo_summary(project_name: Optional[str] = None):
    """총계 + 시트 연결/미연결 집계(홈 위젯용)."""
    rows = get_store().list_photos(project_name=project_name)
    linked = sum(1 for r in rows if r.get("sheet_id"))
    return {"total": len(rows), "linked": linked, "unlinked": len(rows) - linked}


@router.post("")
async def upload_photo(
    file: UploadFile = File(...),
    project_name: str = Form("Study_Project"),
    title: str = Form(""),
    caption: str = Form(""),
    sheet_id: str = Form(""),
    uploaded_by: str = Form("업로드"),
):
    require_role(project_name, "편집자")  # S7: 사진 업로드 = 편집자 이상
    ext = Path(file.filename or "").suffix.lower().lstrip(".")
    if ext not in IMAGE_EXTS:
        raise HTTPException(400, f"지원하지 않는 이미지 형식: .{ext} (지원: {sorted(IMAGE_EXTS)})")
    # 경로 방어: project_name 조작으로 uploads 밖에 쓰지 못하게 한다(도면 업로드와 동일 정책).
    photo_id = str(uuid.uuid4())
    uploads_root = Path(config.UPLOADS_DIR).resolve()
    base_dir = uploads_root / project_name / "photos" / photo_id
    if not base_dir.resolve().is_relative_to(uploads_root):
        raise HTTPException(400, "project_name 경로 위반")
    base_dir.mkdir(parents=True, exist_ok=True)
    dest = base_dir / f"original.{ext}"
    data = await file.read()
    dest.write_bytes(data)
    now = datetime.now().isoformat()
    meta = {
        "photo_id": photo_id,
        "filename": file.filename,
        "file_path": str(dest),
        "file_format": ext,
        "file_size": len(data),
        "title": (title or file.filename or "사진").strip(),
        "caption": caption.strip(),
        "sheet_id": sheet_id or None,
        "project_name": project_name,
        "uploaded_by": uploaded_by,
        "created_at": now,
        "updated_at": now,
    }
    get_store().add_photo(meta)
    logger.info("photo uploaded %s (%s, %d bytes)", photo_id, file.filename, len(data))
    return _with_url(meta)


@router.patch("/{photo_id}")
async def patch_photo(photo_id: str, body: PhotoPatch):
    _require_photo_role(photo_id, "편집자")
    fields = body.model_dump(exclude_none=True)
    updated = get_store().update_photo(photo_id, **fields)
    if not updated:
        raise HTTPException(404, f"사진 없음: {photo_id}")
    return _with_url(updated)


@router.delete("/{photo_id}")
async def delete_photo(photo_id: str):
    photo = _require_photo_role(photo_id, "편집자")
    if not get_store().delete_photo(photo_id):
        raise HTTPException(404, f"사진 없음: {photo_id}")
    # 저장 이미지 파일 정리(디렉토리 통째 제거). uploads 밖이면 건드리지 않는다.
    fp = photo.get("file_path")
    if fp:
        try:
            base = Path(fp).resolve().parent
            if base.is_relative_to(Path(config.UPLOADS_DIR).resolve()):
                shutil.rmtree(str(base), ignore_errors=True)
        except (OSError, ValueError):
            pass
    return {"deleted": photo_id}
