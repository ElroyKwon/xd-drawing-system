"""S15 단계6 — DWG↔PDF 추출본 병합(D7). 순수·조회 시 계산(merge-on-read).

같은 PDF 시트의 pdf 추출본과, sheet_source로 연결된 원본 DWG의 dxf 추출본을
DXF 권위로 병합한다. 충돌(같은 설비의 다른 표기)은 버리지 않고 conflicts[]에 기록.
저장하지 않는다 — 항상 현재 rev로 fresh 계산. egress 0(내부 store 조회만).

병합 도달 경로: sheet_key(=PDF 시트 레지스트리 키, 단계6 통합 후 sheet_source.sheet_key와 동일)
→ sheet_source 링크 → dwg_file_id → 그 DWG 파일의 current dxf 추출본.
DWG 링크가 없으면 pdf 추출본을 그대로 통과(passthrough, source_kind 불변).
"""
from __future__ import annotations

# OCR/추출기 혼동 정규화(같은 설비의 다른 표기 판정용). PDF 텍스트층은 O↔0·I↔1 혼동이 흔하다.
_CONFUSE = str.maketrans({"O": "0", "I": "1", "L": "1"})


def _canon(tag: str) -> str:
    """설비 태그 정규화 키 — 대문자·영숫자/하이픈만·혼동문자 접기. PP-38OV ≡ PP-380V."""
    kept = "".join(ch for ch in (tag or "").upper() if ch.isalnum() or ch == "-")
    return kept.translate(_CONFUSE)


def _merge_tags(pdf_tags: list, dxf_tags: list) -> tuple[list, list]:
    """pdf+dxf 태그 병합. **교차 소스만** 접는다(DXF 권위). 소스 내부는 접지 않는다.

    - DXF 태그는 전부 보존(원문 완전중복만 제거). 첫 DXF가 그 정규화 슬롯의 권위.
    - PDF 태그가 DXF와 정규화 일치하면: 원문 다르면 충돌 기록(DXF 채택), 같으면 합의 →
      해당 DXF 태그를 src='merged' 표기하고 PDF 변형은 흡수. DXF에 없으면 PDF 태그 유지.
    - 빈 정규화(영숫자 없음)는 슬롯 키에서 제외 → 서로 다른 태그가 뭉개지지 않음.
    - 소스 내부 정규화 충돌(PL-1 vs PI-1)은 접지 않으므로 유실 없음.
    """
    conflicts: list = []
    result: list = []
    dxf_by_canon: dict = {}   # canon → 권위 DXF 태그(첫 항목)
    seen_dxf: set = set()
    for t in dxf_tags or []:
        raw = t.get("tag") or ""
        if raw and raw in seen_dxf:
            continue   # 비어있지 않은 원문의 완전중복만 제거(빈 태그·다른 원문은 보존)
        if raw:
            seen_dxf.add(raw)
        entry = dict(t)
        result.append(entry)
        c = _canon(raw)
        if c:
            dxf_by_canon.setdefault(c, entry)
    seen_pdf: set = set()
    for t in pdf_tags or []:
        raw = t.get("tag") or ""
        if raw and raw in seen_pdf:
            continue
        if raw:
            seen_pdf.add(raw)
        c = _canon(raw)
        auth = dxf_by_canon.get(c) if c else None
        if auth is not None:
            if (auth.get("tag") or "") != raw:
                conflicts.append({"field": "tag", "dxf": auth.get("tag"),
                                  "pdf": raw, "resolved": auth.get("tag")})
            auth["src"] = "merged"   # 두 소스가 같은 설비를 가리킴(DXF 채택, PDF 변형 흡수)
        else:
            result.append(dict(t))   # PDF 전용 태그 유지
    return result, conflicts


def _view(base: dict, *, sources: list, tags: list, conflicts: list,
          text: str, merged: bool) -> dict:
    return {
        "sheet_key": base.get("sheet_key"),
        "sheet_id": base.get("sheet_id"),
        "file_id": base.get("file_id"),
        "source_kind": "merged" if merged else base.get("source_kind"),
        "sources": sources,
        "summary": base.get("summary"),
        "tags": tags,
        "conflicts": conflicts,
        "text_index": text,
    }


def merge_current(store, project_name, sheet_key: str):
    """sheet_key의 현재 rev 병합 뷰를 반환. 추출본 없으면 None. DWG 링크 없으면 passthrough."""
    base_rows = store.list_sheet_meta(
        project_name=project_name, sheet_key=sheet_key, current_only=True)
    if not base_rows:
        return None
    base = base_rows[0]
    pn = base.get("project_name")   # 렌즈1 MINOR: base 기준으로 후속 조회 고정(교차 프로젝트 조인 차단)

    # sheet_source(단계6 통합 후 sheet_key로 조회 가능) → 연결된 (DWG 파일, layout) 쌍.
    links = [l for l in store.list_sheet_sources(project_name=pn, sheet_key=sheet_key)
             if l.get("is_current")]
    pairs: list = []
    for l in links:
        for dl in l.get("dwg_links") or []:
            fid = dl.get("dwg_file_id")
            if fid:
                pairs.append((fid, dl.get("layout_name")))

    # 렌즈1 MAJOR: layout_name이 있으면 그 layout 시트로 좁혀 조인(DWG의 무관 layout 태그 과병합 차단).
    dxf_rows: list = []
    seen_meta: set = set()
    for fid, layout in pairs:
        metas = [r for r in store.list_sheet_meta(project_name=pn, file_id=fid, current_only=True)
                 if r.get("source_kind") in ("dxf", "dwg")]
        if layout:
            draw = store.get_drawing(fid)
            sheet_ids = {s.get("sheet_id") for s in (draw.get("sheets") if draw else [])
                         if s.get("sheet_name") == layout}
            if sheet_ids:   # 해소되면 좁힘. 해소 불가(관례 불일치)면 best-effort로 파일 전체 유지.
                metas = [r for r in metas if r.get("sheet_id") in sheet_ids]
        for r in metas:
            mid = r.get("meta_id")
            if mid not in seen_meta:
                seen_meta.add(mid)
                dxf_rows.append(r)

    if not dxf_rows:  # 병합 대상 없음 → pdf 추출본 그대로
        return _view(base, sources=[base.get("source_kind")], tags=base.get("tags") or [],
                     conflicts=[], text=base.get("text_index") or "", merged=False)

    dxf_tags = [t for r in dxf_rows for t in (r.get("tags") or [])]
    merged_tags, conflicts = _merge_tags(base.get("tags") or [], dxf_tags)
    dxf_text = "\n".join(r.get("text_index") or "" for r in dxf_rows)
    text = (dxf_text + "\n" + (base.get("text_index") or "")).strip()
    sources = sorted({base.get("source_kind")} | {r.get("source_kind") for r in dxf_rows})
    return _view(base, sources=sources, tags=merged_tags, conflicts=conflicts,
                 text=text, merged=True)
