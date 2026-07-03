"""읽기 툴 카탈로그 7종. 오직 8000 공개 HTTP GET으로 그라운딩.

S8.0: search, list_sheets. S8.2 추가: get_project_summary, get_sheet,
list_issues, get_issue, list_files. 각 툴은 구조화 JSON + 안정 ID
(sheet_id/file_id/issue_id, 딥링크용)를 반환한다. 존재하지 않는 ID는
허위 생성 대신 {"found": False, ...}로 정직하게 응답한다.
"""
from __future__ import annotations

from typing import Optional

from client import get


def search(project: str, query: str) -> dict:
    """GET /api/search — 시트·이슈·파일·폴더 교차 부분일치 검색 결과."""
    data = get("/api/search", params={"q": query, "project_name": project})
    return {
        "query": data.get("query", query),
        "sheets": data.get("sheets", []),
        "issues": data.get("issues", []),
        "files": data.get("files", []),
        "folders": data.get("folders", []),
        "truncated": data.get("truncated", False),
    }


def list_sheets(project: str, discipline: Optional[str] = None) -> dict:
    """GET /api/drawings — 완료 도면의 시트 목록(공종 코드 선택 필터).

    검색 라우트와 동일 매핑(sheet_number→number, sheet_title→title)으로 딥링크 ID 유지.
    """
    drawings = get("/api/drawings", params={"project_name": project})
    sheets = []
    for d in drawings:
        if d.get("conversion_status") != "completed":
            continue
        for s in d.get("sheets") or []:
            code = s.get("discipline_code") or "G"
            if discipline and code != discipline:
                continue
            number = s.get("sheet_number") or s.get("sheet_name") or d.get("filename")
            sheets.append({
                "sheet_id": s.get("sheet_id"),
                "file_id": d.get("file_id"),
                "number": number,
                "title": s.get("sheet_title") or d.get("filename"),
                "discipline_code": code,
                "discipline_label": s.get("discipline_label") or "",
            })
    return {"project": project, "count": len(sheets), "sheets": sheets}


def _issue_row(r: dict) -> dict:
    """이슈 레코드 → 딥링크용 안정 ID 포함 구조화 항목."""
    return {
        "issue_id": r.get("issue_id"),
        "title": r.get("title"),
        "status": r.get("status"),
        "category": r.get("category"),
        "type": r.get("type"),
        "sheet_id": r.get("sheet_id"),
        "file_id": r.get("file_id"),
    }


def list_issues(project: str, status: Optional[str] = None,
                category: Optional[str] = None) -> dict:
    """GET /api/issues — 이슈 목록(상태·분류 선택 필터). status 미지정 시 삭제됨 제외."""
    params = {"project_name": project}
    if status:
        params["status"] = status
    if category:
        params["category"] = category
    rows = get("/api/issues", params=params)
    issues = [_issue_row(r) for r in rows]
    return {"project": project, "count": len(issues), "issues": issues}


def get_issue(project: str, issue_id: str) -> dict:
    """GET /api/issues에서 issue_id로 단일 이슈 조회. 없으면 found=False."""
    rows = get("/api/issues", params={"project_name": project})
    for r in rows:
        if r.get("issue_id") == issue_id:
            return {
                "found": True,
                "issue_id": r.get("issue_id"),
                "title": r.get("title"),
                "status": r.get("status"),
                "category": r.get("category"),
                "type": r.get("type"),
                "description": r.get("description") or "",
                "sheet_id": r.get("sheet_id"),
                "file_id": r.get("file_id"),
                "pin": r.get("pin"),
                "created_at": r.get("created_at"),
            }
    return {"found": False, "issue_id": issue_id}


def get_sheet(project: str, sheet_id: str) -> dict:
    """GET /api/drawings 완료 도면 시트에서 sheet_id로 단일 시트 조회. 없으면 found=False."""
    drawings = get("/api/drawings", params={"project_name": project})
    for d in drawings:
        for s in d.get("sheets") or []:
            if s.get("sheet_id") == sheet_id:
                return {
                    "found": True,
                    "sheet_id": s.get("sheet_id"),
                    "file_id": d.get("file_id"),
                    "filename": d.get("filename"),
                    "number": s.get("sheet_number") or s.get("sheet_name") or d.get("filename"),
                    "title": s.get("sheet_title") or d.get("filename"),
                    "discipline_code": s.get("discipline_code") or "G",
                    "discipline_label": s.get("discipline_label") or "",
                }
    return {"found": False, "sheet_id": sheet_id}


def list_files(project: str, folder: Optional[str] = None) -> dict:
    """GET /api/folders + /api/drawings — 폴더 목록 + 파일 목록(folder로 선택 필터)."""
    folders = get("/api/folders", params={"project_name": project})
    params = {"project_name": project}
    if folder:
        params["folder_id"] = folder
    drawings = get("/api/drawings", params=params)
    files = [{
        "file_id": d.get("file_id"),
        "filename": d.get("filename"),
        "conversion_status": d.get("conversion_status"),
        "folder_id": d.get("folder_id"),
        "sheet_count": len(d.get("sheets") or []),
    } for d in drawings]
    folder_list = [{
        "folder_id": f.get("folder_id"),
        "name": f.get("name"),
        "parent_id": f.get("parent_id"),
    } for f in folders]
    return {
        "project": project,
        "folders": folder_list,
        "folder_count": len(folder_list),
        "files": files,
        "file_count": len(files),
    }


def get_project_summary(project: str) -> dict:
    """여러 8000 GET 조합 — 완료도면·시트·열린이슈·폴더·파일 카운트(전용 엔드포인트 없음)."""
    drawings = get("/api/drawings", params={"project_name": project})
    completed = [d for d in drawings if d.get("conversion_status") == "completed"]
    sheet_total = sum(len(d.get("sheets") or []) for d in completed)
    issues = get("/api/issues", params={"project_name": project})  # status 미지정 = 삭제됨 제외
    folders = get("/api/folders", params={"project_name": project})
    return {
        "project": project,
        "files": len(drawings),
        "completed_drawings": len(completed),
        "sheets": sheet_total,
        "open_issues": len(issues),
        "folders": len(folders),
    }


def list_equipment(project: str, sheet_id: Optional[str] = None) -> dict:
    """GET /api/ontology/equipment — TypeDB 온톨로지의 장비 목록(프로젝트·시트 스코프).

    장비는 도면 시트에 바인딩(appears_on)돼 있다. 각 장비는 tag·name·type·status와
    바인딩된 sheet_ids(딥링크용)를 갖는다. 온톨로지에 없으면 count=0.
    """
    params = {"project_name": project}
    if sheet_id:
        params["sheet_id"] = sheet_id
    data = get("/api/ontology/equipment", params=params)
    return {
        "project": project,
        "sheet_id": sheet_id,
        "count": data.get("count", 0),
        "equipment": data.get("equipment", []),
    }


def get_equipment(project: str, equipment_id: str) -> dict:
    """GET /api/ontology/equipment/{id} — 장비 단건. 없으면 {"found": False}."""
    try:
        e = get(f"/api/ontology/equipment/{equipment_id}")
    except Exception:  # noqa: BLE001 — 404 등은 not-found로 정직 반환
        return {"found": False, "equipment_id": equipment_id}
    if not e or e.get("project_name") != project:
        return {"found": False, "equipment_id": equipment_id}
    return {"found": True, **e}
