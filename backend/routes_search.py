"""S6: 프로젝트 전역 검색 (시트·이슈·파일·폴더 교차).

기존 store 목록(list_drawings/list_issues/list_folders)을 서버측에서 대소문자 무시
부분일치로 필터해 타입별 그룹으로 반환한다. 신규 엔티티 없음 — 집계/검색 조합.
결과는 프론트 딥링크용 식별자(file_id/sheet_id/issue_id/folder_id)를 포함한다.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter

from store import get_store

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/search", tags=["search"])

# 타입별 결과 상한(무성 절단 금지 — 초과 시 truncated 플래그).
_PER_TYPE_LIMIT = 20


def _match(needle: str, *fields: Optional[str]) -> bool:
    return any(needle in (f or "").lower() for f in fields)


@router.get("")
async def search(q: str = "", project_name: Optional[str] = None):
    """q를 시트 번호/제목, 이슈 제목, 파일명, 폴더명에 부분일치로 교차 검색."""
    needle = q.strip().lower()
    result = {
        "query": q.strip(),
        "sheets": [],
        "issues": [],
        "files": [],
        "folders": [],
        "truncated": False,
    }
    if not needle:
        return result

    store = get_store()
    truncated = False

    # 시트 — 완료 도면의 sheets(번호/제목/이름). projectSheets와 동일 집합 → 딥링크 매핑.
    sheets: list[dict] = []
    for d in store.list_drawings(project_name):
        if d.get("conversion_status") != "completed":
            continue
        for s in d.get("sheets") or []:
            number = s.get("sheet_number") or s.get("sheet_name") or d.get("filename")
            title = s.get("sheet_title") or d.get("filename")
            if _match(needle, number, title, s.get("sheet_name")):
                sheets.append({
                    "file_id": d.get("file_id"),
                    "sheet_id": s.get("sheet_id"),
                    "number": number,
                    "title": title,
                    "label": f"{number} · {title}" if title and title != number else number,
                })
    if len(sheets) > _PER_TYPE_LIMIT:
        truncated = True
    result["sheets"] = sheets[:_PER_TYPE_LIMIT]

    # 이슈 — 제목 매칭(삭제됨 제외).
    issues: list[dict] = []
    for i in store.list_issues(project_name=project_name):
        if i.get("status") == "삭제됨":
            continue
        if _match(needle, i.get("title")):
            issues.append({
                "issue_id": i.get("issue_id"),
                "file_id": i.get("file_id"),
                "sheet_id": i.get("sheet_id"),
                "title": i.get("title"),
                "status": i.get("status"),
                "label": i.get("title"),
            })
    if len(issues) > _PER_TYPE_LIMIT:
        truncated = True
    result["issues"] = issues[:_PER_TYPE_LIMIT]

    # 파일 — 최신 버전 도면의 파일명 매칭.
    files: list[dict] = []
    for d in store.list_drawings(project_name, latest_only=True):
        if _match(needle, d.get("filename")):
            files.append({
                "file_id": d.get("file_id"),
                "folder_id": d.get("folder_id"),
                "filename": d.get("filename"),
                "label": d.get("filename"),
            })
    if len(files) > _PER_TYPE_LIMIT:
        truncated = True
    result["files"] = files[:_PER_TYPE_LIMIT]

    # 폴더 — 이름 매칭.
    folders: list[dict] = []
    if project_name:
        # 검색은 read-only — 폴더가 없어도 seed-on-create를 트리거하지 않는다(GET 안전성).
        for f in store.list_folders(project_name, seed=False):
            if _match(needle, f.get("name")):
                folders.append({
                    "folder_id": f.get("folder_id"),
                    "name": f.get("name"),
                    "label": f.get("name"),
                })
    if len(folders) > _PER_TYPE_LIMIT:
        truncated = True
    result["folders"] = folders[:_PER_TYPE_LIMIT]

    result["truncated"] = truncated
    return result
