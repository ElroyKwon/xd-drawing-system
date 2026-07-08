"""S8.2 툴 카탈로그 단위 테스트 (respx 스텁 — 회귀 위생, 이밸 아님).

5종 추가 툴(get_project_summary·get_sheet·list_issues·get_issue·list_files)의
HTTP 매핑 정확성·not-found·조합 카운트를 결정적으로 검증한다. 실 LLM 그라운딩/
환각 골든 이밸은 라이브(evidence/s8_2-golden-eval.md)로 별도 입증한다.
"""
from __future__ import annotations

import httpx
import respx

import tools

BASE = "http://127.0.0.1:8000"

_DRAWINGS = [
    {
        "file_id": "f1", "filename": "single-line.pdf", "folder_id": "fd1",
        "conversion_status": "completed",
        "sheets": [
            {"sheet_id": "s1", "sheet_number": "E-101", "sheet_title": "단선결선도",
             "discipline_code": "E", "discipline_label": "E (전기)"},
            {"sheet_id": "s2", "sheet_number": "M-201", "sheet_title": "배관도",
             "discipline_code": "M", "discipline_label": "M (기계)"},
        ],
    },
    {"file_id": "f2", "filename": "wip.dwg", "folder_id": None,
     "conversion_status": "converting", "sheets": []},
]
_ISSUES = [
    {"issue_id": "i1", "title": "접지 누락", "status": "열림", "category": "설계",
     "type": "결함", "sheet_id": "s1", "file_id": "f1", "description": "상세", "created_at": "2026-01-02"},
    {"issue_id": "i2", "title": "치수 오류", "status": "닫힘", "category": "시공",
     "type": "질문", "sheet_id": None, "file_id": None, "created_at": "2026-01-01"},
]
_FOLDERS = [
    {"folder_id": "fd1", "name": "시방서", "parent_id": None},
    {"folder_id": "fd2", "name": "제출물", "parent_id": None},
]


@respx.mock
def test_list_issues_maps_rows():
    respx.get(f"{BASE}/api/issues").mock(return_value=httpx.Response(200, json=_ISSUES))
    out = tools.list_issues("Study_Project")
    assert out["count"] == 2
    assert out["issues"][0]["issue_id"] == "i1"
    assert out["issues"][0]["sheet_id"] == "s1"


@respx.mock
def test_list_issues_status_filter_passes_param():
    route = respx.get(f"{BASE}/api/issues").mock(
        return_value=httpx.Response(200, json=[_ISSUES[1]]))
    out = tools.list_issues("Study_Project", status="닫힘")
    assert out["count"] == 1
    assert route.calls.last.request.url.params["status"] == "닫힘"


@respx.mock
def test_list_issues_category_filter_passes_param():
    route = respx.get(f"{BASE}/api/issues").mock(
        return_value=httpx.Response(200, json=[_ISSUES[0]]))
    out = tools.list_issues("Study_Project", category="설계")
    assert out["count"] == 1
    assert route.calls.last.request.url.params["category"] == "설계"


@respx.mock
def test_get_issue_found():
    respx.get(f"{BASE}/api/issues").mock(return_value=httpx.Response(200, json=_ISSUES))
    out = tools.get_issue("Study_Project", "i1")
    assert out["found"] is True
    assert out["title"] == "접지 누락"
    assert out["description"] == "상세"


@respx.mock
def test_get_issue_not_found():
    respx.get(f"{BASE}/api/issues").mock(return_value=httpx.Response(200, json=_ISSUES))
    out = tools.get_issue("Study_Project", "i-999")
    assert out == {"found": False, "issue_id": "i-999"}


_META_EMPTY = {"count": 0, "results": [], "truncated": False}  # S15 단계8 강화 호출 스텁
_META_S2 = {"count": 1, "truncated": False, "results": [{
    "meta_id": "sm1", "sheet_key": "sk-2", "sheet_id": "s2", "file_id": "f1",
    "source_kind": "dxf", "is_current": True, "summary": "배관 상세",
    "text_index": "PIPE ROUTING M-201 " * 100,
    "tags": [{"tag": "PP-380V", "type": "분전반", "confidence": 0.92, "src": "rule",
              "evidence": "타이틀블록 PP-380V"},
             {"tag": "TR-2", "type": "transformer", "confidence": 0.5, "src": "rule",
              "evidence": "저신뢰 접두 추론"}],
}]}


@respx.mock
def test_get_sheet_found():
    respx.get(f"{BASE}/api/drawings").mock(return_value=httpx.Response(200, json=_DRAWINGS))
    respx.get(f"{BASE}/api/sheet-meta").mock(return_value=httpx.Response(200, json=_META_S2))
    out = tools.get_sheet("Study_Project", "s2")
    assert out["found"] is True
    assert out["number"] == "M-201"
    assert out["file_id"] == "f1"
    # S15 단계8: 자동추출본 조인 — tags·summary·sheet_key·has_content
    assert out["sheet_key"] == "sk-2"
    assert out["summary"] == "배관 상세"
    assert out["has_content"] is True
    assert {t["tag"] for t in out["tags"]} == {"PP-380V", "TR-2"}
    assert "evidence" not in out["tags"][0]  # 축약(장문 제외)


@respx.mock
def test_get_sheet_found_no_meta():
    respx.get(f"{BASE}/api/drawings").mock(return_value=httpx.Response(200, json=_DRAWINGS))
    respx.get(f"{BASE}/api/sheet-meta").mock(return_value=httpx.Response(200, json=_META_EMPTY))
    out = tools.get_sheet("Study_Project", "s2")
    assert out["found"] is True
    assert out["tags"] == [] and out["summary"] is None and out["has_content"] is False


# 단계6: get_sheet_content는 /merged(병합 뷰)를 소비. DXF 권위 병합 + conflicts.
_MERGED_S2 = {"found": True, "sheet_key": "sk-2", "sheet_id": "s2", "file_id": "f1",
              "source_kind": "merged", "sources": ["dxf", "pdf"], "summary": "배관 상세",
              "text_index": "PIPE ROUTING M-201 " * 100,
              "conflicts": [{"field": "tag", "dxf": "PP-380V", "pdf": "PP-38OV", "resolved": "PP-380V"}],
              "tags": [{"tag": "PP-380V", "type": "분전반", "confidence": 0.92, "src": "merged"},
                       {"tag": "TR-2", "type": "transformer", "confidence": 0.5, "src": "rule"}]}


@respx.mock
def test_get_sheet_content_by_id():
    respx.get(f"{BASE}/api/sheet-meta/merged").mock(return_value=httpx.Response(200, json=_MERGED_S2))
    out = tools.get_sheet_content("Study_Project", sheet_id="s2")
    assert out["found"] is True
    assert out["sheet_key"] == "sk-2"
    assert out["source_kind"] == "merged" and out["sources"] == ["dxf", "pdf"]
    assert out["conflicts"][0]["resolved"] == "PP-380V"  # DXF 권위
    assert out["text_truncated"] is True and len(out["text_excerpt"]) == 1200
    assert out["tags"][1]["confidence"] == 0.5  # 저신뢰 유지(정직성 판정용)


@respx.mock
def test_get_sheet_content_needs_id():
    out = tools.get_sheet_content("Study_Project")
    assert out["found"] is False and "sheet_id" in out["reason"]


@respx.mock
def test_get_sheet_content_not_found():
    respx.get(f"{BASE}/api/sheet-meta/merged").mock(
        return_value=httpx.Response(200, json={"found": False, "sheet_key": "sk-none"}))
    out = tools.get_sheet_content("Study_Project", sheet_key="sk-none")
    assert out["found"] is False and out["sheet_key"] == "sk-none"


_BY_EQUIP = {"tag": "PP-380V", "count": 1, "truncated": False, "results": [{
    "sheet_key": "sk-2", "sheet_id": "s2", "file_id": "f1", "source_kind": "dxf",
    "matched_tags": [{"tag": "PP-380V", "type": "분전반", "confidence": 0.92, "src": "rule",
                      "evidence": "타이틀블록"}]}]}


@respx.mock
def test_find_sheets_by_equipment():
    route = respx.get(f"{BASE}/api/sheet-meta/by-equipment").mock(
        return_value=httpx.Response(200, json=_BY_EQUIP))
    out = tools.find_sheets_by_equipment("Study_Project", "PP-380V")
    assert out["count"] == 1
    assert out["sheets"][0]["sheet_id"] == "s2"
    assert out["sheets"][0]["matched_tags"][0]["tag"] == "PP-380V"
    assert "evidence" not in out["sheets"][0]["matched_tags"][0]  # 축약
    assert route.calls.last.request.url.params["tag"] == "PP-380V"


_SEARCH = {"query": "케이블", "sheets": [{"sheet_id": "s1", "number": "E-101"}],
           "issues": [], "files": [], "folders": [], "truncated": False}
_CONTENT = {"query": "케이블", "count": 1, "truncated": False, "results": [{
    "sheet_key": "sk-9", "sheet_id": "s9", "file_id": "f3", "source_kind": "pdf",
    "snippet": "…케이블 트레이 경로…"}]}


@respx.mock
def test_search_merges_content_matches():
    respx.get(f"{BASE}/api/search").mock(return_value=httpx.Response(200, json=_SEARCH))
    respx.get(f"{BASE}/api/sheet-meta/search").mock(return_value=httpx.Response(200, json=_CONTENT))
    out = tools.search("Study_Project", "케이블")
    assert out["sheets"][0]["sheet_id"] == "s1"
    assert len(out["content_matches"]) == 1
    assert out["content_matches"][0]["sheet_id"] == "s9"
    assert "케이블" in out["content_matches"][0]["snippet"]


@respx.mock
def test_list_sheets_enriched_with_tags():
    respx.get(f"{BASE}/api/drawings").mock(return_value=httpx.Response(200, json=_DRAWINGS))
    respx.get(f"{BASE}/api/sheet-meta").mock(return_value=httpx.Response(200, json=_META_S2))
    out = tools.list_sheets("Study_Project")
    s2 = next(s for s in out["sheets"] if s["sheet_id"] == "s2")
    assert {t["tag"] for t in s2["tags"]} == {"PP-380V", "TR-2"}
    assert s2["summary"] == "배관 상세"
    s1 = next(s for s in out["sheets"] if s["sheet_id"] == "s1")
    assert s1["tags"] == [] and s1["summary"] is None  # 추출본 없는 시트


@respx.mock
def test_get_sheet_not_found():
    respx.get(f"{BASE}/api/drawings").mock(return_value=httpx.Response(200, json=_DRAWINGS))
    out = tools.get_sheet("Study_Project", "s-999")
    assert out == {"found": False, "sheet_id": "s-999"}


@respx.mock
def test_list_files_folders_and_files():
    respx.get(f"{BASE}/api/folders").mock(return_value=httpx.Response(200, json=_FOLDERS))
    respx.get(f"{BASE}/api/drawings").mock(return_value=httpx.Response(200, json=_DRAWINGS))
    out = tools.list_files("Study_Project")
    assert out["folder_count"] == 2
    assert out["file_count"] == 2
    assert out["files"][0]["file_id"] == "f1"
    assert out["files"][0]["sheet_count"] == 2   # f1은 시트 2장
    assert out["folders"][0]["name"] == "시방서"


@respx.mock
def test_list_files_folder_filter_passes_param():
    respx.get(f"{BASE}/api/folders").mock(return_value=httpx.Response(200, json=_FOLDERS))
    route = respx.get(f"{BASE}/api/drawings").mock(
        return_value=httpx.Response(200, json=[_DRAWINGS[0]]))
    out = tools.list_files("Study_Project", folder="fd1")
    assert out["file_count"] == 1
    assert route.calls.last.request.url.params["folder_id"] == "fd1"


@respx.mock
def test_project_summary_composes_counts():
    respx.get(f"{BASE}/api/drawings").mock(return_value=httpx.Response(200, json=_DRAWINGS))
    respx.get(f"{BASE}/api/issues").mock(return_value=httpx.Response(200, json=_ISSUES))
    respx.get(f"{BASE}/api/folders").mock(return_value=httpx.Response(200, json=_FOLDERS))
    out = tools.get_project_summary("Study_Project")
    assert out["files"] == 2               # 전체 파일(변환중 포함)
    assert out["completed_drawings"] == 1  # 완료만
    assert out["sheets"] == 2              # 완료 도면의 시트 총수
    assert out["open_issues"] == 2         # /api/issues 반환(삭제됨 제외)
    assert out["folders"] == 2


# ── S10 온톨로지 툴(list_equipment·get_equipment) respx 매핑 ──────────
_EQUIP = {
    "project_name": "Study_Project", "sheet_id": None, "count": 2,
    "equipment": [
        {"equipment_id": "EQ-TR-01", "tag": "TR-01", "name": "주변압기", "type": "transformer",
         "status": "ACTIVE", "discipline": "E", "project_name": "Study_Project", "sheet_ids": ["s1"]},
        {"equipment_id": "EQ-PCS-01", "tag": "PCS-01", "name": "전력변환장치", "type": "pcs",
         "status": "ACTIVE", "discipline": "E", "project_name": "Study_Project", "sheet_ids": ["s2", "s3"]},
    ],
}


@respx.mock
def test_list_equipment_maps():
    respx.get(f"{BASE}/api/ontology/equipment").mock(return_value=httpx.Response(200, json=_EQUIP))
    out = tools.list_equipment("Study_Project")
    assert out["count"] == 2
    assert out["equipment"][0]["tag"] == "TR-01"
    assert out["equipment"][1]["sheet_ids"] == ["s2", "s3"]


@respx.mock
def test_get_equipment_found_and_scope():
    e = {"equipment_id": "EQ-TR-01", "tag": "TR-01", "name": "주변압기", "type": "transformer",
         "status": "ACTIVE", "project_name": "Study_Project", "sheet_ids": ["s1"]}
    respx.get(f"{BASE}/api/ontology/equipment/EQ-TR-01").mock(return_value=httpx.Response(200, json=e))
    out = tools.get_equipment("Study_Project", "EQ-TR-01")
    assert out["found"] is True and out["tag"] == "TR-01"
    # 프로젝트 스코프 불일치 → not-found(타 프로젝트 장비 누출 방지)
    out2 = tools.get_equipment("Other_Project", "EQ-TR-01")
    assert out2["found"] is False


@respx.mock
def test_get_equipment_404_honest():
    respx.get(f"{BASE}/api/ontology/equipment/EQ-NOPE").mock(return_value=httpx.Response(404, json={"detail": "없음"}))
    out = tools.get_equipment("Study_Project", "EQ-NOPE")
    assert out["found"] is False and out["equipment_id"] == "EQ-NOPE"
