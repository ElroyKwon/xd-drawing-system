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
    """pdf+dxf 태그 병합. DXF 권위(충돌 시 DXF 채택), 충돌은 conflicts[]에 기록.

    - 정규화 키가 같고 원문이 다르면 충돌 → DXF 원문 채택 + 기록.
    - 정규화 키가 같고 원문도 같으면 합의 → src='merged'.
    - 한쪽에만 있으면 그대로 유지.
    """
    conflicts: list = []
    by_canon: dict = {}
    for t in pdf_tags or []:
        by_canon[_canon(t.get("tag", ""))] = dict(t)
    for t in dxf_tags or []:
        c = _canon(t.get("tag", ""))
        prior = by_canon.get(c)
        merged = dict(t)
        if prior is not None:
            if (prior.get("tag") or "") != (t.get("tag") or ""):
                conflicts.append({"field": "tag", "dxf": t.get("tag"),
                                  "pdf": prior.get("tag"), "resolved": t.get("tag")})
            merged["src"] = "merged"   # 두 소스가 같은 설비를 가리킴(DXF 채택)
        by_canon[c] = merged
    return list(by_canon.values()), conflicts


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

    # sheet_source(단계6 통합 후 sheet_key로 조회 가능) → 연결된 DWG 파일들.
    links = [l for l in store.list_sheet_sources(project_name=project_name, sheet_key=sheet_key)
             if l.get("is_current")]
    dwg_file_ids: list = []
    for l in links:
        for dl in l.get("dwg_links") or []:
            fid = dl.get("dwg_file_id")
            if fid and fid not in dwg_file_ids:
                dwg_file_ids.append(fid)

    dxf_rows: list = []
    for fid in dwg_file_ids:
        for r in store.list_sheet_meta(project_name=project_name, file_id=fid, current_only=True):
            if r.get("source_kind") in ("dxf", "dwg"):
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
