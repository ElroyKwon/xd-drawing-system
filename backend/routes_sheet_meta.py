"""S15 단계7 — sheet_meta read API(8000, read-only). 사이드카/AI가 GET으로만 소비.

- GET /api/sheet-meta                 : sheet_key·sheet_id·current_only 필터 조회
- GET /api/sheet-meta/search?q=       : 본문 색인(text_index) 부분일치 검색
- GET /api/sheet-meta/by-equipment?tag= : 설비 태그 역방향 조회

신규 엔티티 없음 — store.list_sheet_meta 조합. 기본은 is_current(D6, AI 그라운딩 기본축).
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter

import sheet_merge
from store import get_store

router = APIRouter(prefix="/api/sheet-meta", tags=["sheet-meta"])

_LIMIT = 50


@router.get("")
async def get_sheet_meta(project_name: Optional[str] = None, sheet_key: Optional[str] = None,
                         sheet_id: Optional[str] = None, current_only: bool = True):
    """추출본 조회. 기본 current_only=true(최신 rev). 과거 rev는 current_only=false."""
    rows = get_store().list_sheet_meta(
        project_name=project_name, sheet_key=sheet_key, sheet_id=sheet_id,
        current_only=current_only)
    return {"count": len(rows), "results": rows[:_LIMIT], "truncated": len(rows) > _LIMIT}


@router.get("/search")
async def search_sheet_meta(q: str = "", project_name: Optional[str] = None,
                            current_only: bool = True):
    """본문 색인 부분일치. 매칭 스니펫과 시트 좌표(sheet_key·sheet_id) 반환."""
    needle = q.strip().lower()
    if not needle:
        return {"query": "", "count": 0, "results": [], "truncated": False}
    rows = get_store().list_sheet_meta(project_name=project_name, current_only=current_only)
    hits = []
    for r in rows:
        idx = r.get("text_index", "")
        pos = idx.lower().find(needle)
        if pos < 0:
            continue
        hits.append({
            "sheet_key": r.get("sheet_key"), "sheet_id": r.get("sheet_id"),
            "file_id": r.get("file_id"), "project_name": r.get("project_name"),
            "source_kind": r.get("source_kind"),
            "snippet": idx[max(0, pos - 40):pos + len(needle) + 40].strip(),
        })
    return {"query": q.strip(), "count": len(hits), "results": hits[:_LIMIT],
            "truncated": len(hits) > _LIMIT}


@router.get("/merged")
async def merged_sheet_meta(project_name: Optional[str] = None, sheet_key: Optional[str] = None,
                           sheet_id: Optional[str] = None):
    """DWG↔PDF 병합 뷰(D7). DWG 원본이 연결된 시트면 DXF 권위로 병합한 태그·conflicts를,
    아니면 pdf 추출본을 그대로 반환. sheet_key 또는 sheet_id(→sheet_key 해소)로 조회."""
    if not sheet_key and sheet_id:
        rows = get_store().list_sheet_meta(
            project_name=project_name, sheet_id=sheet_id, current_only=True)
        if rows:
            sheet_key = rows[0].get("sheet_key")
    if not sheet_key:
        return {"found": False}
    view = sheet_merge.merge_current(get_store(), project_name, sheet_key)
    if not view:
        return {"found": False, "sheet_key": sheet_key}
    return {"found": True, **view}


@router.get("/by-equipment")
async def by_equipment(tag: str = "", project_name: Optional[str] = None,
                       current_only: bool = True):
    """설비 태그로 나타나는 시트 역방향 조회(대소문자 무시 부분일치)."""
    needle = tag.strip().lower()
    if not needle:
        return {"tag": "", "count": 0, "results": [], "truncated": False}
    rows = get_store().list_sheet_meta(project_name=project_name, current_only=current_only)
    hits = []
    for r in rows:
        matched = [t for t in r.get("tags", []) if needle in (t.get("tag", "").lower())]
        if not matched:
            continue
        hits.append({
            "sheet_key": r.get("sheet_key"), "sheet_id": r.get("sheet_id"),
            "file_id": r.get("file_id"), "project_name": r.get("project_name"),
            "source_kind": r.get("source_kind"), "matched_tags": matched,
        })
    return {"tag": tag.strip(), "count": len(hits), "results": hits[:_LIMIT],
            "truncated": len(hits) > _LIMIT}
