"""S7: 로컬 모의 인증 + RBAC 강제 + 프로젝트/구성원 영속."""
import asyncio
import importlib
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # backend/

import config  # noqa: E402


def _reload(tmp_path, monkeypatch):
    """store→auth→routes 순으로 reload(같은 store 싱글톤 공유 보장)."""
    monkeypatch.setattr(config, "UPLOADS_DIR", tmp_path)
    monkeypatch.setattr(config, "STORE_BACKEND", "json")
    import store as store_mod
    importlib.reload(store_mod)
    import auth as auth_mod
    importlib.reload(auth_mod)
    import routes_drawing
    importlib.reload(routes_drawing)
    import routes_files
    importlib.reload(routes_files)
    import routes_auth as ra
    importlib.reload(ra)
    return ra, store_mod


def test_seed_and_current_user_default(tmp_path, monkeypatch):
    ra, store_mod = _reload(tmp_path, monkeypatch)
    s = ra.get_store()
    # seed-on-create: 4 구성원 + Study_Project 역할 시드
    assert len(s.list_members()) == 4
    assert s.get_current_user() == "member-owner"          # 기본 = 시드 관리자(개혁)
    me = asyncio.run(ra.get_me())
    assert me["member"]["name"] == "개혁 이"
    assert me["roles"]["Study_Project"] == "관리자"


def test_switch_user_persists(tmp_path, monkeypatch):
    ra, _ = _reload(tmp_path, monkeypatch)
    from fastapi import HTTPException
    me = asyncio.run(ra.switch_user(ra.SwitchUser(member_id="member-viewer")))
    assert me["member_id"] == "member-viewer"
    assert me["roles"]["Study_Project"] == "뷰어"
    assert ra.get_store().get_current_user() == "member-viewer"   # 영속
    with pytest.raises(HTTPException) as e:
        asyncio.run(ra.switch_user(ra.SwitchUser(member_id="ghost")))
    assert e.value.status_code == 404


def test_rbac_viewer_blocked_editor_allowed(tmp_path, monkeypatch):
    ra, store_mod = _reload(tmp_path, monkeypatch)
    import routes_files
    from fastapi import HTTPException
    s = ra.get_store()
    # 뷰어로 전환 → 폴더 생성 403
    s.set_current_user("member-viewer")
    with pytest.raises(HTTPException) as e1:
        asyncio.run(routes_files.create_folder(routes_files.FolderCreate(project_name="Study_Project", name="뷰어폴더")))
    assert e1.value.status_code == 403
    # 편집자로 전환 → 폴더 생성 허용
    s.set_current_user("member-reviewer")
    created = asyncio.run(routes_files.create_folder(routes_files.FolderCreate(project_name="Study_Project", name="편집자폴더")))
    assert created["name"] == "편집자폴더"


def test_rbac_member_management_admin_only(tmp_path, monkeypatch):
    ra, _ = _reload(tmp_path, monkeypatch)
    from fastapi import HTTPException
    s = ra.get_store()
    # 편집자는 구성원 추가 거부(403)
    s.set_current_user("member-reviewer")
    with pytest.raises(HTTPException) as e1:
        asyncio.run(ra.add_project_member("Study_Project", ra.AddProjectMember(member_id="member-field", role="뷰어")))
    assert e1.value.status_code == 403
    # 관리자는 추가 허용
    s.set_current_user("member-owner")
    added = asyncio.run(ra.add_project_member("Study_Project", ra.AddProjectMember(member_id="member-field", role="편집자")))
    assert added["role"] == "편집자"
    # 역할 변경(관리자) 영속
    patched = asyncio.run(ra.patch_project_member("Study_Project", "member-field", ra.PatchProjectMember(role="뷰어")))
    assert patched["role"] == "뷰어"
    # 잘못된 역할 거부
    with pytest.raises(HTTPException) as e2:
        asyncio.run(ra.patch_project_member("Study_Project", "member-field", ra.PatchProjectMember(role="왕")))
    assert e2.value.status_code == 400
    # 제거
    assert asyncio.run(ra.remove_project_member("Study_Project", "member-field"))["removed"] == "member-field"


def test_project_create_persists_and_creator_admin(tmp_path, monkeypatch):
    ra, _ = _reload(tmp_path, monkeypatch)
    s = ra.get_store()
    s.set_current_user("member-reviewer")          # 생성자
    proj = asyncio.run(ra.create_project({"name": "신규 현장 A"}))
    assert proj["name"] == "신규 현장 A"
    assert proj["created_by"] == "member-reviewer"
    # 영속 + 생성자=관리자 자동
    assert any(p["name"] == "신규 현장 A" for p in s.list_projects())
    pm = s.get_project_member("신규 현장 A", "member-reviewer")
    assert pm and pm["role"] == "관리자"


def test_list_project_members_join(tmp_path, monkeypatch):
    ra, _ = _reload(tmp_path, monkeypatch)
    rows = asyncio.run(ra.list_project_members("Study_Project"))
    by_id = {r["member_id"]: r for r in rows}
    assert by_id["member-owner"]["role"] == "관리자"
    assert by_id["member-owner"]["name"] == "개혁 이"      # member 조인
    assert by_id["member-viewer"]["role"] == "뷰어"
