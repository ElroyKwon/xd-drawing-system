"""S6: 전역 검색 라우트 — 시트·이슈·파일·폴더 교차, 부분일치, 스코프, 빈 쿼리, 상한."""
import asyncio
import importlib
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # backend/

import config  # noqa: E402


def _reload(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "UPLOADS_DIR", tmp_path)
    monkeypatch.setattr(config, "STORE_BACKEND", "json")
    import store as store_mod
    importlib.reload(store_mod)
    import routes_search as rs
    importlib.reload(rs)
    return rs


def _drawing(file_id, filename, sheet_number, sheet_title, project="Study_Project", status="completed"):
    return {
        "file_id": file_id, "filename": filename, "file_format": "pdf", "file_size": 10,
        "upload_date": "2026-06-30T00:00:01", "project_name": project, "version": "1",
        "version_set_id": file_id, "is_latest": True, "folder_id": None,
        "conversion_status": status,
        "sheets": [{"sheet_id": f"{file_id}_s1", "sheet_name": "S", "sheet_index": 0,
                    "sheet_number": sheet_number, "sheet_title": sheet_title}],
    }


def _issue(issue_id, title, status="열림", project="Study_Project"):
    return {
        "issue_id": issue_id, "file_id": None, "sheet_id": None, "title": title,
        "type": "설계 검토", "status": status, "category": "quality", "assignee": "",
        "author": "사용자", "description": "", "project_name": project,
        "pin": None, "created_at": "2026-06-30T00:00:01", "updated_at": "2026-06-30T00:00:01",
    }


def test_search_cross_type(tmp_path, monkeypatch):
    rs = _reload(tmp_path, monkeypatch)
    s = rs.get_store()
    s.add_drawing(_drawing("F1", "EE-01-006.pdf", "EE-01-006", "단선결선도"))
    s.add_issue(_issue("I1", "EE 분전반 위치 확인 요청"))
    s.list_folders("Study_Project")  # 기본 폴더 시드(Drawings 등)

    r = asyncio.run(rs.search(q="EE", project_name="Study_Project"))
    # 시트 + 파일 + 이슈 교차 매칭
    assert [h["sheet_id"] for h in r["sheets"]] == ["F1_s1"]
    assert [h["file_id"] for h in r["files"]] == ["F1"]
    assert [h["issue_id"] for h in r["issues"]] == ["I1"]
    # 딥링크 식별자 존재
    assert r["sheets"][0]["file_id"] == "F1"
    assert r["truncated"] is False


def test_search_case_insensitive_and_title(tmp_path, monkeypatch):
    rs = _reload(tmp_path, monkeypatch)
    s = rs.get_store()
    s.add_drawing(_drawing("F1", "plan.pdf", "A-101", "기초 평면도"))
    # 대소문자 무시 + 시트 제목 매칭
    assert len(asyncio.run(rs.search(q="a-101", project_name="Study_Project"))["sheets"]) == 1
    assert len(asyncio.run(rs.search(q="평면", project_name="Study_Project"))["sheets"]) == 1


def test_search_folder_and_empty(tmp_path, monkeypatch):
    rs = _reload(tmp_path, monkeypatch)
    s = rs.get_store()
    s.list_folders("Study_Project")  # 기본 폴더(Drawings) 시드
    r = asyncio.run(rs.search(q="Drawing", project_name="Study_Project"))
    assert any(f["name"] == "Drawings" for f in r["folders"])
    # 빈/공백 쿼리 → 전부 빈 결과
    empty = asyncio.run(rs.search(q="   ", project_name="Study_Project"))
    assert empty["sheets"] == [] and empty["issues"] == [] and empty["files"] == [] and empty["folders"] == []


def test_search_excludes_deleted_issue_and_scope(tmp_path, monkeypatch):
    rs = _reload(tmp_path, monkeypatch)
    s = rs.get_store()
    s.add_issue(_issue("I1", "삭제된 케이블 이슈", status="삭제됨"))
    s.add_issue(_issue("I2", "케이블 경로 협의", status="열림"))
    s.add_issue(_issue("I3", "다른 프로젝트 케이블", status="열림", project="Other"))
    r = asyncio.run(rs.search(q="케이블", project_name="Study_Project"))
    # 삭제됨 제외 + 프로젝트 스코프(Other 제외)
    assert [i["issue_id"] for i in r["issues"]] == ["I2"]


def test_search_truncated_flag(tmp_path, monkeypatch):
    rs = _reload(tmp_path, monkeypatch)
    monkeypatch.setattr(rs, "_PER_TYPE_LIMIT", 2)
    s = rs.get_store()
    for n in range(4):
        s.add_issue(_issue(f"I{n}", f"케이블 이슈 {n}"))
    r = asyncio.run(rs.search(q="케이블", project_name="Study_Project"))
    assert len(r["issues"]) == 2
    assert r["truncated"] is True


def test_search_does_not_seed_folders(tmp_path, monkeypatch):
    """GET /api/search는 read-only — 존재하지 않는 프로젝트 검색이 폴더를 seed하지 않는다."""
    rs = _reload(tmp_path, monkeypatch)
    s = rs.get_store()
    # 폴더가 한 번도 없던 프로젝트로 검색 → 폴더 결과 빈, seed 부작용 없음
    r = asyncio.run(rs.search(q="draw", project_name="Phantom_Proj"))
    assert r["folders"] == []
    # 검색 후에도 seed-없이 read하면 여전히 빈 목록(seed 부작용 검증)
    assert s.list_folders("Phantom_Proj", seed=False) == []


def test_search_excludes_pending_drawing(tmp_path, monkeypatch):
    rs = _reload(tmp_path, monkeypatch)
    s = rs.get_store()
    s.add_drawing(_drawing("F1", "EE-pending.pdf", "EE-99", "변환중", status="pending"))
    # 변환 미완 도면의 시트(번호 EE-99)는 검색에서 제외(시트 그룹은 completed만).
    # (파일 그룹은 변환 여부 무관히 filename 노출 — FilesView와 정합, 별도 관심사.)
    r = asyncio.run(rs.search(q="EE-99", project_name="Study_Project"))
    assert r["sheets"] == []
