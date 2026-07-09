"""읽기 툴 카탈로그. 오직 8000 공개 HTTP GET으로 그라운딩.

S8.0: search, list_sheets. S8.2 추가: get_project_summary, get_sheet,
list_issues, get_issue, list_files. S10: list_equipment, get_equipment.
S15 단계8 추가: get_sheet_content, find_sheets_by_equipment(업로드 도면의
자동추출 본문색인·설비태그를 AI 그라운딩 표면으로) + search 본문검색 병합,
get_sheet/list_sheets에 tags·summary 강화. 각 툴은 구조화 JSON + 안정 ID
(sheet_id/file_id/issue_id, 딥링크용)를 반환한다. 존재하지 않는 ID는
허위 생성 대신 {"found": False, ...}로 정직하게 응답한다.
"""
from __future__ import annotations

from typing import Optional

from client import BackendError, get

# list_sheets 강화가 전 시트 태그를 받도록 상향(read API 기본 50캡을 우회 — 50 초과 프로젝트 침묵누락 방지).
_META_ALL = 5000


def _compact_tags(tags: Optional[list]) -> list:
    """자동추출 태그를 AI 노출용으로 축약 — 장문 evidence는 빼고, 정직성 판정에 필요한
    confidence·src(rule/llm/merged)는 유지한다(저신뢰 태그는 '자동추출(미검증)' 명시용)."""
    return [{
        "tag": t.get("tag"),
        "type": t.get("type"),
        "confidence": t.get("confidence"),
        "src": t.get("src"),
    } for t in (tags or [])]


def _current_meta_by_sheet_id(project: str) -> dict:
    """현재 rev(sheet_meta) 추출본을 sheet_id로 색인한 맵(list_sheets 강화용, 1회 GET).
    limit 상향으로 50 초과 프로젝트에서도 전 시트 태그를 담는다(침묵누락 방지)."""
    data = get("/api/sheet-meta",
               params={"project_name": project, "current_only": "true", "limit": _META_ALL})
    out = {}
    for r in data.get("results", []):
        sid = r.get("sheet_id")
        if sid:
            out[sid] = r
    return out


def search(project: str, query: str) -> dict:
    """GET /api/search + /api/sheet-meta/search — 교차 검색 + 도면 본문색인 매칭 병합.

    본문색인(강화분)이 실패해도 교차검색은 살린다(회복력: content_matches만 비우고 부분성 표기)."""
    data = get("/api/search", params={"q": query, "project_name": project})
    content_matches: list = []
    content_truncated = False
    try:
        content = get("/api/sheet-meta/search", params={"q": query, "project_name": project})
        content_matches = [{
            "sheet_key": m.get("sheet_key"),
            "sheet_id": m.get("sheet_id"),
            "file_id": m.get("file_id"),
            "source_kind": m.get("source_kind"),
            "snippet": m.get("snippet"),
        } for m in content.get("results", [])]
        content_truncated = content.get("truncated", False)
    except BackendError:
        content_matches = []   # 본문색인 미도달 → 교차검색 결과는 유지, 본문매칭만 생략
    return {
        "query": data.get("query", query),
        "sheets": data.get("sheets", []),
        "issues": data.get("issues", []),
        "files": data.get("files", []),
        "folders": data.get("folders", []),
        "content_matches": content_matches,
        "truncated": data.get("truncated", False) or content_truncated,
    }


def list_sheets(project: str, discipline: Optional[str] = None) -> dict:
    """GET /api/drawings — 완료 도면의 시트 목록(공종 코드 선택 필터).

    검색 라우트와 동일 매핑(sheet_number→number, sheet_title→title)으로 딥링크 ID 유지.
    """
    drawings = get("/api/drawings", params={"project_name": project})
    meta = _current_meta_by_sheet_id(project)  # S15 단계8: 자동추출 태그·요약 강화
    sheets = []
    for d in drawings:
        if d.get("conversion_status") != "completed":
            continue
        for s in d.get("sheets") or []:
            code = s.get("discipline_code") or "G"
            if discipline and code != discipline:
                continue
            number = s.get("sheet_number") or s.get("sheet_name") or d.get("filename")
            m = meta.get(s.get("sheet_id")) or {}
            sheets.append({
                "sheet_id": s.get("sheet_id"),
                "file_id": d.get("file_id"),
                "number": number,
                "title": s.get("sheet_title") or d.get("filename"),
                "discipline_code": code,
                "discipline_label": s.get("discipline_label") or "",
                "tags": _compact_tags(m.get("tags")),
                "summary": m.get("summary"),
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
    """GET /api/drawings 완료 도면 시트에서 sheet_id로 단일 시트 조회. 없으면 found=False.

    S15 단계8: 자동추출본(tags·summary·sheet_key)을 sheet-meta에서 조인해 함께 반환.
    """
    drawings = get("/api/drawings", params={"project_name": project})
    for d in drawings:
        for s in d.get("sheets") or []:
            if s.get("sheet_id") == sheet_id:
                result = {
                    "found": True,
                    "sheet_id": s.get("sheet_id"),
                    "file_id": d.get("file_id"),
                    "filename": d.get("filename"),
                    "number": s.get("sheet_number") or s.get("sheet_name") or d.get("filename"),
                    "title": s.get("sheet_title") or d.get("filename"),
                    "discipline_code": s.get("discipline_code") or "G",
                    "discipline_label": s.get("discipline_label") or "",
                }
                meta = get("/api/sheet-meta", params={
                    "project_name": project, "sheet_id": sheet_id, "current_only": "true"})
                rows = meta.get("results", [])
                m = rows[0] if rows else {}
                result["sheet_key"] = m.get("sheet_key")
                result["tags"] = _compact_tags(m.get("tags"))
                result["summary"] = m.get("summary")
                result["has_content"] = bool(m.get("text_index"))
                return result
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


def get_sheet_content(project: str, sheet_id: Optional[str] = None,
                      sheet_key: Optional[str] = None) -> dict:
    """GET /api/sheet-meta/merged — 시트의 자동추출 본문색인·설비태그·요약(DWG↔PDF 병합 뷰).

    sheet_id 또는 sheet_key 중 하나로 조회. DWG 원본이 연결된 시트는 DXF 권위로 병합돼
    source_kind='merged'·conflicts[]를 함께 반환한다. 태그의 confidence·src가 있으므로
    저신뢰(<0.7) 항목을 인용할 땐 '자동추출(미검증)'으로 밝혀야 한다. 없으면 found=False.
    """
    if not sheet_id and not sheet_key:
        return {"found": False, "reason": "sheet_id 또는 sheet_key 필요"}
    params = {"project_name": project}
    if sheet_key:
        params["sheet_key"] = sheet_key
    if sheet_id:
        params["sheet_id"] = sheet_id
    r = get("/api/sheet-meta/merged", params=params)
    if not r.get("found"):
        return {"found": False, "sheet_id": sheet_id, "sheet_key": sheet_key}
    text = r.get("text_index") or ""
    return {
        "found": True,
        "sheet_key": r.get("sheet_key"),
        "sheet_id": r.get("sheet_id"),
        "file_id": r.get("file_id"),
        "source_kind": r.get("source_kind"),
        "sources": r.get("sources") or [],
        "summary": r.get("summary"),
        "tags": _compact_tags(r.get("tags")),
        "conflicts": r.get("conflicts") or [],
        "text_excerpt": text[:1200],
        "text_truncated": len(text) > 1200,
    }


def find_sheets_by_equipment(project: str, tag: str) -> dict:
    """GET /api/sheet-meta/by-equipment — 설비 태그가 나타나는 시트 역방향 조회.

    자동추출 태그이므로 confidence·src를 함께 반환한다(저신뢰 매칭은 '자동추출(미검증)').
    수동 큐레이트 온톨로지(list_equipment)와 구분할 것.
    """
    data = get("/api/sheet-meta/by-equipment", params={"project_name": project, "tag": tag})
    sheets = [{
        "sheet_key": r.get("sheet_key"),
        "sheet_id": r.get("sheet_id"),
        "file_id": r.get("file_id"),
        "source_kind": r.get("source_kind"),
        "matched_tags": _compact_tags(r.get("matched_tags")),
    } for r in data.get("results", [])]
    return {"tag": data.get("tag", tag), "count": len(sheets),
            "sheets": sheets, "truncated": data.get("truncated", False)}


def get_sheet_history(project: str, sheet_key: Optional[str] = None) -> dict:
    """GET /api/sheet-meta?current_only=false — 한 시트(sheet_key)의 버전별 추출 이력(O7·D6).

    기본 답변은 현재 rev(get_sheet_content)로 하고, 사용자가 '과거/이전 버전/예전 rev'를
    **명시적으로** 물을 때만 이 툴을 쓴다. is_current=true 가 현재, 나머지는 과거 rev.
    """
    if not sheet_key:
        return {"found": False, "reason": "sheet_key 필요"}
    data = get("/api/sheet-meta", params={
        "project_name": project, "sheet_key": sheet_key, "current_only": "false"})
    rows = data.get("results", [])
    if not rows:
        return {"found": False, "sheet_key": sheet_key}
    revs = []
    for r in rows:
        txt = r.get("text_index") or ""
        revs.append({
            "is_current": bool(r.get("is_current")),
            "extracted_at": r.get("extracted_at"),
            "file_id": r.get("file_id"),
            "source_kind": r.get("source_kind"),
            "summary": r.get("summary"),
            "tags": _compact_tags(r.get("tags")),
            "text_excerpt": txt[:400],
            "text_truncated": len(txt) > 400,   # 형제 get_sheet_content 와 정직성 일관
        })
    return {"found": True, "sheet_key": sheet_key, "rev_count": len(revs),
            "current_count": sum(1 for x in revs if x["is_current"]), "revisions": revs}


def kg_neighbors(project: str, id: str, depth: int = 1, types: Optional[str] = None) -> dict:
    """GET /api/kg/neighbors — 지식그래프 N홉 이웃(설비관계·자산 링크 순회).

    노드 id 접두: eq:설비 sh:시트 is:이슈 tk:작업 fl:파일 tg:태그 nt:노트. 엣지 track=llm/relates_to
    는 AI 추출(미검증) — 인용 시 밝힐 것. 자산 본문은 get_sheet_content, 태그 역조회는
    find_sheets_by_equipment 로 구분해 쓴다.
    """
    params = {"project_name": project, "id": id, "depth": depth}
    if types:
        params["types"] = types
    try:
        return get("/api/kg/neighbors", params=params)
    except BackendError:  # 404 등 → 허위 생성 대신 정직한 not-found
        return {"found": False, "id": id}


def kg_path(project: str, src: str, dst: str) -> dict:
    """GET /api/kg/path — 두 노드 최단 경로(관계 경로추적). from/to 는 노드 id."""
    try:
        return get("/api/kg/path", params={"project_name": project, "from": src, "to": dst})
    except BackendError:
        return {"found": False, "from": src, "to": dst}


def kg_evidence(project: str, id: str) -> dict:
    """GET /api/kg/evidence — 근거체인(엣지 evidence + describes 노트). track/confidence 동반."""
    try:
        return get("/api/kg/evidence", params={"project_name": project, "id": id})
    except BackendError:
        return {"found": False, "id": id}
