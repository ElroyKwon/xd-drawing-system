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


@respx.mock
def test_get_sheet_found():
    respx.get(f"{BASE}/api/drawings").mock(return_value=httpx.Response(200, json=_DRAWINGS))
    out = tools.get_sheet("Study_Project", "s2")
    assert out["found"] is True
    assert out["number"] == "M-201"
    assert out["file_id"] == "f1"


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
