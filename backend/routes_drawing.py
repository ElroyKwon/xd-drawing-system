"""도면 업로드/변환/조회 라우트 (S1-b/c). Study_TypeDB drawing route 이식."""
from __future__ import annotations

import logging
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile

import config
from conversion import process_drawing
from store import get_store

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/drawings", tags=["drawings"])

SUPPORTED = {"dwg", "dxf", "pdf"}


def _png_url(abs_png: str) -> str | None:
    if not abs_png:
        return None
    try:
        rel = Path(abs_png).resolve().relative_to(Path(config.UPLOADS_DIR).resolve())
        return "/files/" + str(rel).replace("\\", "/")
    except ValueError:
        return None


def _with_urls(row: dict) -> dict:
    row = dict(row)
    for s in row.get("sheets", []) or []:
        s["png_url"] = _png_url(s.get("png_path"))
    return row


def _run_conversion(file_id: str, file_path: str, file_format: str, base_dir: str):
    store = get_store()
    store.update_conversion(file_id, "converting")
    res = process_drawing(file_path, file_id, file_format, base_dir)
    store.update_conversion(
        file_id, res.status, sheets=res.sheets, scan=res.scan, error=res.error
    )


@router.post("")
async def upload_drawing(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    project_name: str = Form("Study_Project"),
    version: str = Form("1.0"),
):
    ext = Path(file.filename or "").suffix.lower().lstrip(".")
    if ext not in SUPPORTED:
        raise HTTPException(400, f"지원하지 않는 형식: .{ext} (지원: {sorted(SUPPORTED)})")

    file_id = str(uuid.uuid4())
    base_dir = Path(config.UPLOADS_DIR) / project_name / file_id
    base_dir.mkdir(parents=True, exist_ok=True)
    dest = base_dir / f"original.{ext}"
    data = await file.read()
    dest.write_bytes(data)

    meta = {
        "file_id": file_id,
        "filename": file.filename,
        "file_path": str(dest),
        "file_format": ext,
        "file_size": len(data),
        "upload_date": datetime.now().isoformat(),
        "project_name": project_name,
        "version": version,
        "conversion_status": "pending",
        "sheets": [],
    }
    get_store().add_drawing(meta)
    background.add_task(_run_conversion, file_id, str(dest), ext, str(base_dir))
    logger.info("uploaded %s (%s, %d bytes)", file_id, file.filename, len(data))
    return _with_urls(meta)


@router.get("")
async def list_drawings(project_name: str | None = None):
    return get_store().list_drawings(project_name)


@router.get("/{file_id}")
async def get_drawing(file_id: str):
    row = get_store().get_drawing(file_id)
    if not row:
        raise HTTPException(404, f"도면 없음: {file_id}")
    return _with_urls(row)
