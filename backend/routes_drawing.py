"""도면 업로드/변환/조회 라우트 (S1-b/c). Study_TypeDB drawing route 이식."""
from __future__ import annotations

import logging
import os
import re
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

import config
from conversion import process_drawing
from store import get_store
from vector import get_vector_json

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/drawings", tags=["drawings"])

SUPPORTED = {"dwg", "dxf", "pdf"}
_PROJECT_NAME_RE = re.compile(r"[\w .()\-]{1,80}", re.UNICODE)


def _validate_project_name(name: str) -> None:
    # project_name이 uploads 밖으로 탈출(절대경로/../)하는 것을 차단(검증 BLOCKER-2).
    if (
        not name
        or os.path.isabs(name)
        or ".." in name
        or "/" in name
        or "\\" in name
        or not _PROJECT_NAME_RE.fullmatch(name)
    ):
        raise HTTPException(400, f"잘못된 project_name: {name!r}")


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
        file_id, res.status, sheets=res.sheets, scan=res.scan,
        dxf_path=res.dxf_path, error=res.error,
    )


@router.post("")
async def upload_drawing(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    project_name: str = Form("Study_Project"),
    version: str = Form("1.0"),
):
    _validate_project_name(project_name)
    ext = Path(file.filename or "").suffix.lower().lstrip(".")
    if ext not in SUPPORTED:
        raise HTTPException(400, f"지원하지 않는 형식: .{ext} (지원: {sorted(SUPPORTED)})")

    file_id = str(uuid.uuid4())
    uploads_root = Path(config.UPLOADS_DIR).resolve()
    base_dir = uploads_root / project_name / file_id
    # 이중 방어: 결합 결과가 uploads 하위가 아니면 거부.
    if not base_dir.resolve().is_relative_to(uploads_root):
        raise HTTPException(400, "project_name 경로 위반")
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


@router.get("/{file_id}/vector")
async def get_drawing_vector(file_id: str):
    """②오픈소스 벡터 경로: DXF에서 추출한 벡터 엔티티 JSON.

    DWG/DXF만 지원(PDF는 ①래스터 경로 유지). dxf_path는 uploads 내부여야 한다.
    """
    row = get_store().get_drawing(file_id)
    if not row:
        raise HTTPException(404, f"도면 없음: {file_id}")
    dxf_path = row.get("dxf_path")
    if not dxf_path:
        raise HTTPException(400, "벡터 미지원: DXF 산출물 없음(PDF이거나 변환 미완)")
    uploads_root = Path(config.UPLOADS_DIR).resolve()
    abs_dxf = Path(dxf_path).resolve()
    if not abs_dxf.is_relative_to(uploads_root) or not abs_dxf.exists():
        raise HTTPException(404, "DXF 파일 없음")
    cache_path = abs_dxf.with_name("vector.json")
    try:
        get_vector_json(str(abs_dxf), str(cache_path))  # 추출+캐시 보장
    except Exception:  # noqa: BLE001
        # 상세(경로 포함)는 서버 로그로만, 클라이언트엔 일반 메시지(정보 노출 차단).
        logger.exception("vector extract failed: %s", file_id)
        raise HTTPException(500, "벡터 추출 실패")
    # 캐시 파일을 그대로 서빙(대용량 JSON 재파싱/재직렬화 회피).
    if cache_path.exists():
        return FileResponse(str(cache_path), media_type="application/json")
    raise HTTPException(500, "벡터 캐시 생성 실패")
