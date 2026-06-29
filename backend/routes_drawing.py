"""도면 업로드/변환/조회 라우트 (S1-b/c). Study_TypeDB drawing route 이식."""
from __future__ import annotations

import logging
import os
import re
import shutil
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


def _storage_bytes(row: dict) -> int:
    """도면의 저장 용량(원본+파생 PNG/벡터). file 디렉토리 전체 합. (S2.5 용량 가시화)"""
    fp = row.get("file_path")
    if not fp:
        return 0
    try:
        base = Path(fp).parent
        return sum(f.stat().st_size for f in base.rglob("*") if f.is_file())
    except OSError:
        return 0


def _with_urls(row: dict) -> dict:
    row = dict(row)
    sheets = []
    for s in row.get("sheets", []) or []:
        s = dict(s)
        s["png_url"] = _png_url(s.get("png_path"))
        s.pop("png_path", None)  # 절대 서버경로는 응답에서 제거(정보 노출 차단)
        sheets.append(s)
    row["sheets"] = sheets
    row["storage_bytes"] = _storage_bytes(row)  # S2.5: 도면별 저장 용량
    return row


def _run_conversion(file_id: str, file_path: str, file_format: str, base_dir: str, filename: str = ""):
    store = get_store()
    store.update_conversion(file_id, "converting")
    res = process_drawing(file_path, file_id, file_format, base_dir, filename)
    store.update_conversion(
        file_id, res.status, sheets=res.sheets, scan=res.scan,
        dxf_path=res.dxf_path, error=res.error,
    )


def _folder_share(store, folder_id: str | None) -> str:
    """폴더의 공유 상태(없으면 비공개). 파일은 이를 상속한다."""
    if folder_id:
        f = store.get_folder(folder_id)
        if f:
            return f.get("share_status", "비공개")
    return "비공개"


async def _save_upload(file: UploadFile, project_name: str) -> tuple[str, Path, str, int]:
    """업로드 파일을 uploads/<project>/<file_id>/original.<ext>에 저장. (file_id, dest, ext, size)."""
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
    return file_id, dest, ext, len(data)


@router.post("")
async def upload_drawing(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    project_name: str = Form("Study_Project"),
    version: str = Form("1.0"),
    folder_id: str = Form(""),
    uploaded_by: str = Form("업로드"),
):
    store = get_store()
    file_id, dest, ext, size = await _save_upload(file, project_name)
    meta = {
        "file_id": file_id,
        "filename": file.filename,
        "file_path": str(dest),
        "file_format": ext,
        "file_size": size,
        "upload_date": datetime.now().isoformat(),
        "project_name": project_name,
        "version": version,
        # S3 버전세트: 첫 업로드 = 자기 자신이 set 루트, v1, 최신.
        "version_set_id": file_id,
        "version_no": 1,
        "is_latest": True,
        "folder_id": folder_id or None,
        # S3 권한: 파일은 소속 폴더의 공유 상태를 상속(폴더 미지정=비공개). 강제는 S7.
        "share_status": _folder_share(store, folder_id),
        "uploaded_by": uploaded_by,
        "conversion_status": "pending",
        "sheets": [],
    }
    store.add_drawing(meta)
    background.add_task(_run_conversion, file_id, str(dest), ext, str(dest.parent), file.filename or "")
    logger.info("uploaded %s (%s, %d bytes)", file_id, file.filename, size)
    return _with_urls(meta)


@router.get("")
async def list_drawings(
    project_name: str | None = None,
    folder_id: str | None = None,
    latest_only: bool = False,
):
    # 각 시트에 png_url을 부여해야 시트 레지스터(목록)에서 뷰어가 실 렌더를 띄운다.
    rows = get_store().list_drawings(project_name, folder_id=folder_id, latest_only=latest_only)
    return [_with_urls(r) for r in rows]


@router.post("/{file_id}/versions")
async def add_drawing_version(
    file_id: str,
    background: BackgroundTasks,
    file: UploadFile = File(...),
    uploaded_by: str = Form("업로드"),
):
    """S3: 같은 논리 파일(version_set)에 새 버전을 명시적으로 추가. 이전 버전은 보관."""
    store = get_store()
    base = store.get_drawing(file_id)
    if not base:
        raise HTTPException(404, f"도면 없음: {file_id}")
    project_name = base.get("project_name", "Study_Project")
    vset = base.get("version_set_id") or file_id

    new_id, dest, ext, size = await _save_upload(file, project_name)
    meta = {
        "file_id": new_id,
        "filename": file.filename,
        "file_path": str(dest),
        "file_format": ext,
        "file_size": size,
        "upload_date": datetime.now().isoformat(),
        "project_name": project_name,
        # version_no/version은 store.add_version이 lock 안에서 할당(경합 방지).
        "version_set_id": vset,
        "is_latest": True,
        "folder_id": base.get("folder_id"),
        "share_status": base.get("share_status") or _folder_share(store, base.get("folder_id")),
        "uploaded_by": uploaded_by,
        "conversion_status": "pending",
        "sheets": [],
    }
    store.add_version(vset, meta)
    background.add_task(_run_conversion, new_id, str(dest), ext, str(dest.parent), file.filename or "")
    logger.info("version added %s → %s (v%s)", file_id, new_id, meta.get("version_no"))
    return _with_urls(meta)


@router.get("/{file_id}/versions")
async def list_drawing_versions(file_id: str):
    store = get_store()
    row = store.get_drawing(file_id)
    if not row:
        raise HTTPException(404, f"도면 없음: {file_id}")
    vset = row.get("version_set_id") or file_id
    return [_with_urls(r) for r in store.list_versions(vset)]


@router.get("/{file_id}/download")
async def download_drawing(file_id: str):
    row = get_store().get_drawing(file_id)
    if not row:
        raise HTTPException(404, f"도면 없음: {file_id}")
    uploads_root = Path(config.UPLOADS_DIR).resolve()
    abs_path = Path(row.get("file_path", "")).resolve()
    if not abs_path.is_relative_to(uploads_root) or not abs_path.exists():
        raise HTTPException(404, "원본 파일 없음")
    return FileResponse(
        str(abs_path),
        filename=row.get("filename") or abs_path.name,
        media_type="application/octet-stream",
    )


@router.delete("/{file_id}")
async def delete_drawing_route(file_id: str):
    store = get_store()
    row = store.get_drawing(file_id)
    if not row:
        raise HTTPException(404, f"도면 없음: {file_id}")
    # 업로드 디렉토리(uploads 내부 한정) 정리 후 메타 삭제.
    uploads_root = Path(config.UPLOADS_DIR).resolve()
    fp = row.get("file_path")
    if fp:
        base_dir = Path(fp).resolve().parent
        # 업로드 구조는 항상 uploads/<project>/<file_id>/original.ext.
        # file_id 디렉토리(깊이 2)만 삭제 — 비정상 file_path가 프로젝트/uploads를 통째로
        # 지우지 못하도록 깊이를 단언한다(인접 도면 동반 삭제 방지).
        if base_dir.is_relative_to(uploads_root) and base_dir.parent.parent == uploads_root:
            shutil.rmtree(str(base_dir), ignore_errors=True)
    store.delete_drawing(file_id)
    return {"deleted": file_id}


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
