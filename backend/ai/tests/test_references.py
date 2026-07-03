"""딥링크 references 수집 단위 테스트 (S8.3-폴리시).

_collect_refs가 툴 결과에서 시트·이슈 id→라벨을 수집하고, _build_references가
type/id/label 구조 + 캡을 적용하는지 검증한다.
"""
from __future__ import annotations

from agent import _build_references, _collect_refs


def test_collect_from_list_sheets_and_issues():
    sheets, issues = {}, {}
    _collect_refs("list_sheets", {"sheets": [
        {"sheet_id": "s1", "number": "E-101", "title": "단선결선도"},
        {"sheet_id": "s2", "number": "M-201"},
    ]}, sheets, issues)
    _collect_refs("list_issues", {"issues": [
        {"issue_id": "i1", "title": "접지 누락"},
    ]}, sheets, issues)
    assert sheets == {"s1": "E-101", "s2": "M-201"}
    assert issues == {"i1": "접지 누락"}


def test_collect_get_single_not_found_ignored():
    sheets, issues = {}, {}
    _collect_refs("get_sheet", {"found": False, "sheet_id": "x"}, sheets, issues)
    _collect_refs("get_issue", {"found": False, "issue_id": "y"}, sheets, issues)
    assert sheets == {} and issues == {}


def test_collect_search_both():
    sheets, issues = {}, {}
    _collect_refs("search", {
        "sheets": [{"sheet_id": "s1", "number": "E-101"}],
        "issues": [{"issue_id": "i1", "title": "케이블 트레이 협의"}],
    }, sheets, issues)
    assert sheets == {"s1": "E-101"}
    assert issues == {"i1": "케이블 트레이 협의"}


def test_build_references_structure_and_cap():
    sheets = {f"s{i}": f"E-{i}" for i in range(8)}
    issues = {"i1": "접지"}
    refs = _build_references(sheets, issues, cap=6)
    assert sum(1 for r in refs if r["type"] == "sheet") == 6  # 캡 적용
    assert {"type": "issue", "id": "i1", "label": "접지"} in refs
    assert all({"type", "id", "label"} <= set(r) for r in refs)
