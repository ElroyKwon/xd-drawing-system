"""S5b: 협업 깊이 B1(댓글 스레드)·B2(해결버전 링크)·B3(sheet_key 계승) — 백엔드.

Acceptance C1~C9(FROZEN, 2026-07-10 스펙). store 단위 + 라우트(TestClient 대신 직접 호출,
기존 test_s5_issues.py 스타일 계승) + C6 크로스버전 통합 + C7 backfill 멱등.
"""
import asyncio
import importlib
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # backend/
_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(_ROOT, "scripts"))

import config  # noqa: E402


def _fresh_store(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "UPLOADS_DIR", tmp_path)
    import store as store_mod
    importlib.reload(store_mod)
    return store_mod, store_mod.JsonDrawingStore()


def _drawing(tmp_path, file_id, sheet_id, sheet_number="A-101", version_set_id=None, project="P"):
    row = {
        "file_id": file_id, "filename": f"{file_id}.dwg",
        "file_path": str(tmp_path / file_id / "original.dwg"),
        "file_format": "dwg", "file_size": 10,
        "upload_date": "2026-06-29T00:00:01", "project_name": project,
        "version": "1", "conversion_status": "completed",
        "sheets": [{"sheet_id": sheet_id, "sheet_name": "S", "sheet_index": 0,
                    "sheet_number": sheet_number}],
    }
    if version_set_id:
        row["version_set_id"] = version_set_id
    return row


def _issue_rec(issue_id, file_id=None, sheet_id=None, status="열림", project_name="P"):
    return {
        "issue_id": issue_id, "file_id": file_id, "sheet_id": sheet_id,
        "sheet_key": None, "title": "t", "type": "설계 검토", "status": status,
        "category": "clash", "assignee": "", "author": "사용자", "description": "",
        "project_name": project_name, "pin": None, "comments": [],
        "created_at": "2026-06-29T00:00:01", "updated_at": "2026-06-29T00:00:01",
    }


def _reload_routes(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "UPLOADS_DIR", tmp_path)
    monkeypatch.setattr(config, "STORE_BACKEND", "json")
    monkeypatch.setenv("XD_NOTIFY", "1")
    monkeypatch.setenv("XD_EMAIL_PROVIDER", "mock")
    import store as store_mod
    importlib.reload(store_mod)
    import email_service as es
    importlib.reload(es)
    es._mode = None
    import auth
    importlib.reload(auth)
    import notifications
    importlib.reload(notifications)
    import routes_drawing
    importlib.reload(routes_drawing)
    import routes_issue as ri
    importlib.reload(ri)
    return ri, es


# --- store 단위: B1 append-only / B3 필터 / B2 화이트리스트 ---

def test_store_add_issue_comment_append_only(tmp_path, monkeypatch):
    """C1(store): add_issue_comment 는 append-only(공존)·영속, 없는 이슈는 None."""
    _, s = _fresh_store(tmp_path, monkeypatch)
    s.add_issue(_issue_rec("i1"))
    r1 = s.add_issue_comment("i1", {"comment_id": "c1", "author_id": "u1",
                                    "author_name": "A", "body": "확인함", "created_at": "t1"})
    assert [c["comment_id"] for c in r1["comments"]] == ["c1"]
    r2 = s.add_issue_comment("i1", {"comment_id": "c2", "author_id": "u2",
                                    "author_name": "B", "body": "현장 상이", "created_at": "t2"})
    assert [c["comment_id"] for c in r2["comments"]] == ["c1", "c2"]   # 덮어쓰기 아님
    assert [c["comment_id"] for c in s.get_issue("i1")["comments"]] == ["c1", "c2"]  # 영속
    assert s.add_issue_comment("ghost", {"comment_id": "x"}) is None


def test_store_list_issues_sheet_key_filter(tmp_path, monkeypatch):
    """C6(store): list_issues 에 sheet_key 필터."""
    _, s = _fresh_store(tmp_path, monkeypatch)
    s.add_issue({**_issue_rec("i1"), "sheet_key": "sk_A"})
    s.add_issue({**_issue_rec("i2"), "sheet_key": "sk_B"})
    s.add_issue(_issue_rec("i3"))  # sheet_key 없음
    assert [r["issue_id"] for r in s.list_issues(sheet_key="sk_A")] == ["i1"]
    assert s.list_issues(sheet_key="sk_none") == []


def test_store_update_issue_resolution_and_sheet_key_immutable(tmp_path, monkeypatch):
    """C4(store): resolution 세팅·명시 None 해제. sheet_key 는 화이트리스트 밖(불변)."""
    _, s = _fresh_store(tmp_path, monkeypatch)
    s.add_issue(_issue_rec("i1"))
    upd = s.update_issue("i1", resolution={"file_id": "F2", "version_no": 2, "note": "개정 반영"})
    assert upd["resolution"]["version_no"] == 2
    assert s.get_issue("i1")["resolution"]["file_id"] == "F2"
    cleared = s.update_issue("i1", resolution=None)
    assert cleared["resolution"] is None                     # 명시 해제
    s.add_issue({**_issue_rec("i2"), "sheet_key": "sk_keep"})
    assert s.update_issue("i2", sheet_key="sk_hack")["sheet_key"] == "sk_keep"  # 불변


# --- 라우트: B1 댓글 ---

def test_route_comment_append_and_author(tmp_path, monkeypatch):
    """C1: POST comments 성공, author=현재 유저·created_at 존재, 2회 호출 공존(append-only)."""
    ri, _ = _reload_routes(tmp_path, monkeypatch)
    created = asyncio.run(ri.create_issue(ri.IssueCreate(title="전역 이슈", category="quality")))
    iid = created["issue_id"]
    assert created["comments"] == []
    c1 = asyncio.run(ri.add_comment(iid, ri.CommentCreate(body="  현장 확인 완료  ")))
    assert len(c1["comments"]) == 1
    assert c1["comments"][0]["body"] == "현장 확인 완료"        # trim
    assert c1["comments"][0]["author_id"] == "member-owner"    # 현재 유저 고정
    assert c1["comments"][0]["created_at"]
    c2 = asyncio.run(ri.add_comment(iid, ri.CommentCreate(body="추가 답글")))
    assert [c["body"] for c in c2["comments"]] == ["현장 확인 완료", "추가 답글"]


def test_route_comment_404_and_empty_400(tmp_path, monkeypatch):
    """C2: 없는 이슈 → 404, body 공백 → 400."""
    ri, _ = _reload_routes(tmp_path, monkeypatch)
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as e1:
        asyncio.run(ri.add_comment("ghost", ri.CommentCreate(body="x")))
    assert e1.value.status_code == 404
    created = asyncio.run(ri.create_issue(ri.IssueCreate(title="t")))
    with pytest.raises(HTTPException) as e2:
        asyncio.run(ri.add_comment(created["issue_id"], ri.CommentCreate(body="   ")))
    assert e2.value.status_code == 400


def test_route_get_single_issue_ordered(tmp_path, monkeypatch):
    """C3: GET /{id} 가 댓글을 시간순 반환. 없는 이슈 → 404."""
    ri, _ = _reload_routes(tmp_path, monkeypatch)
    from fastapi import HTTPException
    created = asyncio.run(ri.create_issue(ri.IssueCreate(title="t")))
    iid = created["issue_id"]
    asyncio.run(ri.add_comment(iid, ri.CommentCreate(body="첫 번째")))
    asyncio.run(ri.add_comment(iid, ri.CommentCreate(body="두 번째")))
    got = asyncio.run(ri.get_issue(iid))
    assert [c["body"] for c in got["comments"]] == ["첫 번째", "두 번째"]
    with pytest.raises(HTTPException) as e:
        asyncio.run(ri.get_issue("ghost"))
    assert e.value.status_code == 404


# --- 라우트: B2 해결버전 ---

def test_route_patch_resolution(tmp_path, monkeypatch):
    """C4: PATCH resolution 세팅·영속, 없는 file_id → 404, resolution=null 해제."""
    ri, _ = _reload_routes(tmp_path, monkeypatch)
    from fastapi import HTTPException
    s = ri.get_store()
    s.add_drawing(_drawing(tmp_path, "F2", "F2_s1"))
    created = asyncio.run(ri.create_issue(ri.IssueCreate(title="t")))
    iid = created["issue_id"]
    upd = asyncio.run(ri.patch_issue(iid, ri.IssuePatch(
        resolution={"file_id": "F2", "version_no": 2, "note": "개정본에서 해결"})))
    assert upd["resolution"]["file_id"] == "F2"
    assert asyncio.run(ri.get_issue(iid))["resolution"]["version_no"] == 2  # 영속
    with pytest.raises(HTTPException) as e:
        asyncio.run(ri.patch_issue(iid, ri.IssuePatch(
            resolution={"file_id": "ghost", "version_no": 1, "note": ""})))
    assert e.value.status_code == 404
    cleared = asyncio.run(ri.patch_issue(iid, ri.IssuePatch(resolution=None)))
    assert cleared["resolution"] is None


# --- 라우트: B3 sheet_key 계승 ---

def test_route_create_stores_sheet_key(tmp_path, monkeypatch):
    """C5: 시트 컨텍스트 이슈가 resolve_sheet_key 와 일치하는 sheet_key 를 가진다."""
    ri, _ = _reload_routes(tmp_path, monkeypatch)
    s = ri.get_store()
    s.add_drawing(_drawing(tmp_path, "F", "F_s1", sheet_number="A-101", version_set_id="F"))
    created = asyncio.run(ri.create_issue(ri.IssueCreate(
        title="시트 이슈", file_id="F", sheet_id="F_s1")))
    assert created["sheet_key"]
    expected = s.resolve_sheet_key(project_name="P", version_set_id="F",
                                   sheet_number="A-101", sheet_index=0)
    assert created["sheet_key"] == expected


def test_issue_follows_version_by_sheet_key(tmp_path, monkeypatch):
    """C6(핵심): 새 버전 추가(새 sheet_id, 같은 version_set/sheet_number) 후에도
    list_issues(sheet_key=) 가 원 이슈를 계속 반환(이슈가 버전 따라감). 옛 sheet_id 하위호환."""
    ri, _ = _reload_routes(tmp_path, monkeypatch)
    s = ri.get_store()
    s.add_drawing(_drawing(tmp_path, "F", "F_s1", sheet_number="A-101", version_set_id="F"))
    created = asyncio.run(ri.create_issue(ri.IssueCreate(
        title="개정 필요", file_id="F", sheet_id="F_s1")))
    iid, sk = created["issue_id"], created["sheet_key"]
    assert sk
    # v2 추가: 새 sheet_id, 같은 version_set_id/sheet_number
    s.add_version("F", _drawing(tmp_path, "F2", "F2_s1", sheet_number="A-101", version_set_id="F"))
    sk_v2 = s.resolve_sheet_key(project_name="P", version_set_id="F",
                                sheet_number="A-101", sheet_index=0)
    assert sk_v2 == sk                                     # 새 버전 시트 = 같은 정체성
    assert [r["issue_id"] for r in asyncio.run(ri.list_issues(sheet_key=sk))] == [iid]
    # 하위호환: 옛 sheet_id 조회도 유지
    assert [r["issue_id"] for r in asyncio.run(
        ri.list_issues(file_id="F", sheet_id="F_s1"))] == [iid]


def test_backfill_issue_sheet_keys_idempotent(tmp_path, monkeypatch):
    """C7: file_id+sheet_id 있고 sheet_key 없는 레거시 이슈에 멱등 부여."""
    ri, _ = _reload_routes(tmp_path, monkeypatch)
    s = ri.get_store()
    s.add_drawing(_drawing(tmp_path, "F", "F_s1", sheet_number="A-101", version_set_id="F"))
    s.add_issue(_issue_rec("legacy", file_id="F", sheet_id="F_s1"))  # sheet_key=None
    assert s.get_issue("legacy").get("sheet_key") is None
    import backfill_issue_sheet_keys as bf
    importlib.reload(bf)
    r1 = bf.backfill(s)
    assert r1["updated"] == 1
    key = s.get_issue("legacy")["sheet_key"]
    assert key
    r2 = bf.backfill(s)                                    # 재실행 멱등
    assert r2["updated"] == 0
    assert s.get_issue("legacy")["sheet_key"] == key


# --- 권한(C8) + 알림(C9) ---

def test_comment_allows_viewer_blocks_nonmember(tmp_path, monkeypatch):
    """C1/C8: 뷰어(협력사)는 댓글 허용, 프로젝트 비구성원은 403."""
    ri, _ = _reload_routes(tmp_path, monkeypatch)
    from fastapi import HTTPException
    s = ri.get_store()
    created = asyncio.run(ri.create_issue(ri.IssueCreate(
        title="협업 이슈", project_name="Study_Project")))
    iid = created["issue_id"]
    s.set_current_user("member-viewer")                   # 뷰어 → 댓글 허용
    r = asyncio.run(ri.add_comment(iid, ri.CommentCreate(body="협력사 현장 확인")))
    assert r["comments"][-1]["author_id"] == "member-viewer"
    s.set_current_user("member-field")                    # Study_Project 비구성원 → 403
    with pytest.raises(HTTPException) as e:
        asyncio.run(ri.add_comment(iid, ri.CommentCreate(body="침입")))
    assert e.value.status_code == 403


def test_mutations_stay_editor(tmp_path, monkeypatch):
    """C8: create/patch/delete 는 편집자 유지 — 뷰어는 전부 403(댓글만 허용)."""
    ri, _ = _reload_routes(tmp_path, monkeypatch)
    from fastapi import HTTPException
    s = ri.get_store()
    created = asyncio.run(ri.create_issue(ri.IssueCreate(
        title="관리자 이슈", project_name="Study_Project")))
    iid = created["issue_id"]
    s.set_current_user("member-viewer")
    with pytest.raises(HTTPException) as e1:
        asyncio.run(ri.create_issue(ri.IssueCreate(title="뷰어 생성", project_name="Study_Project")))
    assert e1.value.status_code == 403
    with pytest.raises(HTTPException) as e2:
        asyncio.run(ri.patch_issue(iid, ri.IssuePatch(status="진행중")))
    assert e2.value.status_code == 403
    with pytest.raises(HTTPException) as e3:
        asyncio.run(ri.delete_issue(iid))
    assert e3.value.status_code == 403


def test_comment_notifies_outbox_excludes_actor(tmp_path, monkeypatch):
    """C9: 댓글 시 mock outbox 에 이벤트 기록, 작성자(actor) 제외."""
    ri, es = _reload_routes(tmp_path, monkeypatch)
    s = ri.get_store()
    created = asyncio.run(ri.create_issue(ri.IssueCreate(
        title="알림 이슈", project_name="Study_Project")))
    iid = created["issue_id"]
    s.set_current_user("member-viewer")                   # 작성자 = viewer@xd.local
    asyncio.run(ri.add_comment(iid, ri.CommentCreate(body="현장 확인")))
    box = es.read_outbox("Study_Project")
    comment_events = [m for m in box if m["subject"].startswith("[XD] 새 댓글")]
    assert comment_events                                 # 최소 1건 기록
    assert all(m["to"] != "viewer@xd.local" for m in comment_events)  # 작성자 제외
