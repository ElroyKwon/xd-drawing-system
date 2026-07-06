"""S14: 발행분(Package/Transmittal) + 시트(PDF)↔소스 DWG 수동 매핑 라우트.

설계사가 DWG(들)+발행 PDF(들)를 한 세트로 제출하면 하나의 package로 묶고,
담당자가 각 PDF 시트에 소스 DWG를 수동 연결(N:M)한 뒤 publish 하면
시트마다 버전을 가로지르는 영속 정체성(sheet_key)+리비전(rev)이 확정된다.

prefix=/api/packages(+/api/sheet-sources) — `/api/drawings/{file_id}`가 하위 명사를
file_id로 오인하는 경로 충돌을 피하기 위해 도면 라우터와 분리(S5 routes_issue 선례).

기존 drawing/sheet/folder/version_set 스키마는 무변경. package·sheet_source는
_packages.json·_sheet_sources.json 외부 조인 레이어로만 얹힌다(prompts/19 freeze).
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from auth import require_role
from routes_drawing import _with_urls
from sheet_meta import _normalize
from store import get_store

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/packages", tags=["package"])

# 소스 링크 조회 별칭 라우터(시트 상세 "소스 DWG 열기"용).
ss_router = APIRouter(prefix="/api/sheet-sources", tags=["sheet-source"])

_DWG_FORMATS = {"dwg", "dxf"}


# ---------------------------------------------------------------------------
# 요청 모델
# ---------------------------------------------------------------------------

class PackageCreate(BaseModel):
    project_name: str = "Study_Project"
    title: str = ""
    folder_id: Optional[str] = None


class PackageFiles(BaseModel):
    dwg_file_ids: list[str] = []
    pdf_file_ids: list[str] = []


class DwgLink(BaseModel):
    dwg_file_id: str
    layout_name: Optional[str] = None


class MappingEntry(BaseModel):
    sheet_id: str
    pdf_file_id: str
    sheet_index: int = 0
    sheet_number: str = ""
    dwg_links: list[DwgLink] = []
    inherit_sheet_key: Optional[str] = None   # 기존 시트 계승 선택(없으면 신규 발급)


class MappingSave(BaseModel):
    mapping: dict[str, MappingEntry] = {}     # key = sheet_id


# ---------------------------------------------------------------------------
# 조회 헬퍼
# ---------------------------------------------------------------------------

def _pdf_sheets(store, file_id: str) -> list[dict]:
    """PDF 드로잉의 pdf-page 시트 목록(png_url 포함)."""
    row = store.get_drawing(file_id)
    if not row:
        return []
    row = _with_urls(row)
    out = []
    for s in row.get("sheets", []) or []:
        out.append({
            "pdf_file_id": file_id,
            "filename": row.get("filename"),
            "sheet_id": s.get("sheet_id"),
            "sheet_index": s.get("sheet_index"),
            "sheet_number": s.get("sheet_number") or s.get("sheet_name") or "",
            "sheet_title": s.get("sheet_title") or "",
            "png_url": s.get("png_url"),
            "source": s.get("source"),
        })
    return out


def _dwg_layouts(store, file_id: str) -> dict:
    """DWG/DXF 드로잉의 시트(paperspace 레이아웃) 목록."""
    row = store.get_drawing(file_id)
    if not row:
        return {"dwg_file_id": file_id, "filename": None, "layouts": []}
    row = _with_urls(row)
    layouts = []
    for s in row.get("sheets", []) or []:
        layouts.append({
            "sheet_id": s.get("sheet_id"),
            "layout_name": s.get("sheet_name"),
            "source": s.get("source"),
            "sheet_index": s.get("sheet_index"),
        })
    return {"dwg_file_id": file_id, "filename": row.get("filename"),
            "file_format": row.get("file_format"), "layouts": layouts}


def _detail(store, pkg: dict) -> dict:
    """package + 임베드 PDF 시트/DWG 레이아웃 + 현 sheet_source 링크."""
    pdf_sheets: list[dict] = []
    for fid in pkg.get("pdf_file_ids", []):
        pdf_sheets.extend(_pdf_sheets(store, fid))
    dwgs = [_dwg_layouts(store, fid) for fid in pkg.get("dwg_file_ids", [])]
    links = store.list_sheet_sources(package_id=pkg["package_id"])
    return {**pkg, "pdf_sheets": pdf_sheets, "dwgs": dwgs, "sheet_sources": links}


# ---------------------------------------------------------------------------
# 라우트
# ---------------------------------------------------------------------------

@router.get("")
async def list_packages(project_name: Optional[str] = None):
    return get_store().list_packages(project_name=project_name)


@router.post("")
async def create_package(body: PackageCreate):
    store = get_store()
    require_role(body.project_name, "편집자")   # S7: 세트 발행 = 편집자 이상
    now = datetime.now().isoformat()
    meta = {
        "package_id": f"pkg_{uuid.uuid4().hex}",
        "project_name": body.project_name,
        "folder_id": body.folder_id,
        "title": body.title.strip() or f"세트 {now[:10]}",
        "issued_by": store.get_current_user(),
        "issued_at": now,
        "created_at": now,
        "published_at": None,
        "dwg_file_ids": [],
        "pdf_file_ids": [],
        "draft_mapping": {},
        "status": "draft",
    }
    store.add_package(meta)
    logger.info("package created %s (%s)", meta["package_id"], meta["title"])
    return meta


@router.get("/{package_id}")
async def get_package(package_id: str):
    store = get_store()
    pkg = store.get_package(package_id)
    if not pkg:
        raise HTTPException(404, f"패키지 없음: {package_id}")
    return _detail(store, pkg)


@router.post("/{package_id}/files")
async def add_package_files(package_id: str, body: PackageFiles):
    """업로드된 file_id를 draft 패키지에 귀속(형식으로 dwg/pdf 자동 분류·재확인)."""
    store = get_store()
    pkg = store.get_package(package_id)
    if not pkg:
        raise HTTPException(404, f"패키지 없음: {package_id}")
    require_role(pkg.get("project_name"), "편집자")
    if pkg.get("status") != "draft":
        raise HTTPException(400, "발행된 패키지에는 파일을 추가할 수 없습니다")
    dwg_ids = list(pkg.get("dwg_file_ids", []))
    pdf_ids = list(pkg.get("pdf_file_ids", []))
    for fid in body.dwg_file_ids + body.pdf_file_ids:
        row = store.get_drawing(fid)
        if not row:
            raise HTTPException(404, f"도면 없음: {fid}")
        if row.get("project_name") != pkg.get("project_name"):
            raise HTTPException(400, f"다른 프로젝트 도면은 귀속할 수 없습니다: {fid}")
        fmt = (row.get("file_format") or "").lower()
        # 렌즈1 MINOR-4: dwg/dxf→dwg, pdf→pdf. 그 외 형식은 거부(미지 형식 PDF 오분류 방지).
        if fmt in _DWG_FORMATS:
            target = dwg_ids
        elif fmt == "pdf":
            target = pdf_ids
        else:
            raise HTTPException(400, f"세트에 넣을 수 없는 형식: .{fmt} (dwg/dxf/pdf만)")
        if fid not in target:
            target.append(fid)
    updated = store.update_package(package_id, dwg_file_ids=dwg_ids, pdf_file_ids=pdf_ids)
    return _detail(store, updated)


@router.get("/{package_id}/hints")
async def package_hints(package_id: str):
    """약한 매칭 제안(자동 확정 아님). PDF 시트번호 ~ DWG 레이아웃명/파일 stem 정규화 비교."""
    store = get_store()
    pkg = store.get_package(package_id)
    if not pkg:
        raise HTTPException(404, f"패키지 없음: {package_id}")
    dwgs = [_dwg_layouts(store, fid) for fid in pkg.get("dwg_file_ids", [])]
    hints: dict[str, list[dict]] = {}
    for fid in pkg.get("pdf_file_ids", []):
        for sh in _pdf_sheets(store, fid):
            norm_num = _normalize(sh.get("sheet_number") or "")
            if not norm_num:
                continue
            scored = []
            for d in dwgs:
                stem = _normalize((d.get("filename") or "").rsplit(".", 1)[0])
                for lay in d["layouts"]:
                    norm_lay = _normalize(lay.get("layout_name") or "")
                    score, reason = _match_score(norm_num, norm_lay, stem)
                    if score > 0:
                        scored.append({
                            "dwg_file_id": d["dwg_file_id"],
                            "layout_name": lay.get("layout_name"),
                            "score": score, "reason": reason,
                        })
            if scored:
                scored.sort(key=lambda h: h["score"], reverse=True)
                hints[sh["sheet_id"]] = scored[:3]
    return hints


def _match_score(num: str, layout: str, stem: str) -> tuple[float, str]:
    """정확일치(1.0) > 접두일치(0.6) > 토큰 겹침(0.3). 약한 힌트 전용."""
    for cand, label in ((layout, "레이아웃명"), (stem, "파일명")):
        if not cand:
            continue
        if num == cand:
            return 1.0, f"{label} 정확 일치"
        if cand.startswith(num) or num.startswith(cand):
            return 0.6, f"{label} 접두 일치"
    # 토큰 겹침(하이픈 분해).
    ntok = {t for t in num.split("-") if t}
    for cand, label in ((layout, "레이아웃명"), (stem, "파일명")):
        ctok = {t for t in (cand or "").split("-") if t}
        if ntok and ctok and (ntok & ctok):
            return 0.3, f"{label} 토큰 겹침"
    return 0.0, ""


@router.put("/{package_id}/mapping")
async def save_mapping(package_id: str, body: MappingSave):
    """draft 부분 저장(sheet_key 미확정 허용). 재오픈 시 복원."""
    store = get_store()
    pkg = store.get_package(package_id)
    if not pkg:
        raise HTTPException(404, f"패키지 없음: {package_id}")
    require_role(pkg.get("project_name"), "편집자")
    if pkg.get("status") != "draft":
        raise HTTPException(400, "발행된 패키지의 매핑은 수정할 수 없습니다")
    mapping = {sid: e.model_dump() for sid, e in body.mapping.items()}
    updated = store.update_package(package_id, draft_mapping=mapping)
    return _detail(store, updated)


@router.post("/{package_id}/publish")
async def publish_package(package_id: str):
    """매핑 확정·sheet_key 발급/계승·rev 확정·sheet_source 영속. loose(미매핑) 허용."""
    store = get_store()
    pkg = store.get_package(package_id)
    if not pkg:
        raise HTTPException(404, f"패키지 없음: {package_id}")
    require_role(pkg.get("project_name"), "편집자")
    if pkg.get("status") == "published":
        raise HTTPException(400, "이미 발행된 패키지입니다 (재발행은 Phase 2)")

    project_name = pkg.get("project_name")
    mapping = pkg.get("draft_mapping") or {}
    now = datetime.now().isoformat()
    published_links = []
    linked_dwg_ids: set[str] = set()

    # 렌즈1 MINOR-5: 이 패키지의 실제 PDF 시트만 발행 대상(orphan sheet_id 링크 방지).
    valid_sheet_ids = {s["sheet_id"] for fid in pkg.get("pdf_file_ids", [])
                       for s in _pdf_sheets(store, fid)}

    for sheet_id, entry in mapping.items():
        dwg_links = [dl for dl in (entry.get("dwg_links") or [])]
        if not dwg_links:
            continue   # 미매핑 시트 → 링크 생성 안 함(loose, 요약에만 반영)
        if sheet_id not in valid_sheet_ids:
            continue   # 패키지 소속이 아닌 stale/orphan 엔트리는 건너뜀
        inherit = entry.get("inherit_sheet_key")
        if inherit:
            # 렌즈1 MAJOR-1/MINOR-2: 계승은 '같은 프로젝트에 존재하는' sheet_key만 허용
            # (타 프로젝트 키 조작·미존재 키 신규발급 차단).
            prior = store.list_sheet_sources(sheet_key=inherit, project_name=project_name)
            if not prior:
                raise HTTPException(400, f"계승할 기존 시트를 찾을 수 없습니다: {inherit}")
            sheet_key = inherit
            rev = store.next_rev(sheet_key, project_name=project_name)
            for prev in prior:
                if prev.get("is_current"):
                    store.update_sheet_source(prev["link_id"], is_current=False)
        else:
            sheet_key = f"sk_{uuid.uuid4().hex}"
            rev = "A"
        link = {
            "link_id": f"lnk_{uuid.uuid4().hex}",
            "sheet_key": sheet_key,
            "rev": rev,
            "package_id": package_id,
            "project_name": pkg.get("project_name"),
            "pdf_file_id": entry.get("pdf_file_id"),
            "sheet_id": sheet_id,
            "sheet_index": entry.get("sheet_index", 0),
            "sheet_number": entry.get("sheet_number", ""),
            "dwg_links": dwg_links,
            "is_current": True,
            "created_at": now,
        }
        store.add_sheet_source(link)
        published_links.append(link)
        for dl in dwg_links:
            linked_dwg_ids.add(dl.get("dwg_file_id"))

    # loose 요약: 미매핑 PDF 시트 / 미링크 DWG 파일.
    all_pdf_sheet_ids = [s["sheet_id"] for fid in pkg.get("pdf_file_ids", [])
                         for s in _pdf_sheets(store, fid)]
    mapped_ids = {ln["sheet_id"] for ln in published_links}
    unmapped_sheets = [sid for sid in all_pdf_sheet_ids if sid not in mapped_ids]
    unlinked_dwgs = [fid for fid in pkg.get("dwg_file_ids", []) if fid not in linked_dwg_ids]

    store.update_package(package_id, status="published", published_at=now)
    logger.info("package published %s: links=%d unmapped=%d unlinked_dwg=%d",
                package_id, len(published_links), len(unmapped_sheets), len(unlinked_dwgs))
    return {
        "package_id": package_id,
        "status": "published",
        "published": len(published_links),
        "links": published_links,
        "unmapped_sheets": unmapped_sheets,
        "unlinked_dwgs": unlinked_dwgs,
    }


# ---------------------------------------------------------------------------
# 소스 링크 조회(시트 상세 "소스 DWG 열기")
# ---------------------------------------------------------------------------

@ss_router.get("")
async def list_sheet_sources(project_name: Optional[str] = None,
                             sheet_id: Optional[str] = None,
                             sheet_key: Optional[str] = None):
    """시트/프로젝트 스코프 소스 링크. 시트 상세에서 dwg_links 보유 여부로 열기 버튼 노출."""
    return get_store().list_sheet_sources(
        project_name=project_name, sheet_id=sheet_id, sheet_key=sheet_key)
