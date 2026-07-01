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
    import routes_issue
    importlib.reload(routes_issue)
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


# --- 렌즈1 적대 검증 수리 회귀 ---

def test_create_project_blocks_duplicate_name_escalation(tmp_path, monkeypatch):
    """BLOCKER-A: 뷰어가 기존 프로젝트명으로 생성해 관리자로 승격하는 우회를 차단."""
    ra, _ = _reload(tmp_path, monkeypatch)
    from fastapi import HTTPException
    s = ra.get_store()
    s.set_current_user("member-viewer")            # Study_Project 뷰어
    # 기존 프로젝트명 재생성 시도 → require_role(관리자)로 403(구성원 키 병합 승격 차단)
    with pytest.raises(HTTPException) as e:
        asyncio.run(ra.create_project({"name": "Study_Project"}))
    assert e.value.status_code == 403
    # 뷰어 역할은 그대로(승격되지 않음)
    assert s.get_project_member("Study_Project", "member-viewer")["role"] == "뷰어"
    # 관리자여도 동명 중복은 409(병합 금지)
    s.set_current_user("member-owner")
    with pytest.raises(HTTPException) as e2:
        asyncio.run(ra.create_project({"name": "Study_Project"}))
    assert e2.value.status_code == 409


def test_create_project_ignores_client_id(tmp_path, monkeypatch):
    """BLOCKER-B: 클라 지정 id로 시드 프로젝트 레코드를 덮어쓰지 못한다."""
    ra, _ = _reload(tmp_path, monkeypatch)
    s = ra.get_store()
    before = {p["id"]: p["name"] for p in s.list_projects()}
    proj = asyncio.run(ra.create_project({"id": "project-study", "name": "가짜 덮어쓰기"}))
    assert proj["id"] != "project-study"           # 서버 생성 id
    # 시드 project-study 레코드 무손상
    seed = next(p for p in s.list_projects() if p["id"] == "project-study")
    assert seed["name"] == before["project-study"] == "Study_Project"


def test_create_issue_enforced_by_real_file_not_self_reported_project(tmp_path, monkeypatch):
    """MAJOR-C: file_id 있는 이슈는 자기신고 project_name이 아니라 실도면 역할로 강제."""
    ra, _ = _reload(tmp_path, monkeypatch)
    import routes_issue
    from fastapi import HTTPException
    s = ra.get_store()
    # Study_Project 소속 실도면 삽입
    s.add_drawing({"file_id": "F1", "project_name": "Study_Project", "filename": "p.dwg",
                   "conversion_status": "completed", "sheets": [{"sheet_id": "S1", "sheet_name": "L1"}]})
    s.set_current_user("member-viewer")            # Study_Project 뷰어
    # 가짜 project_name(0-구성원)으로 실도면 F1에 이슈 주입 시도 → 실도면 역할(뷰어)로 403
    body = routes_issue.IssueCreate(title="주입", type="설계 검토", category="quality",
                                    project_name="존재하지않는프로젝트", file_id="F1", sheet_id="S1",
                                    pin=routes_issue.IssuePin(point=[10.0, 20.0], coord_space="world"))
    with pytest.raises(HTTPException) as e:
        asyncio.run(routes_issue.create_issue(body))
    assert e.value.status_code == 403
    # 편집자로 전환하면 동일 요청 허용(실도면 역할 편집자)
    s.set_current_user("member-reviewer")
    created = asyncio.run(routes_issue.create_issue(body))
    assert created["file_id"] == "F1"


def test_last_admin_cannot_be_removed_or_demoted(tmp_path, monkeypatch):
    """MAJOR-D/E: 마지막 활성 관리자 제거·강등으로 RBAC 무력화/락아웃 방지."""
    ra, _ = _reload(tmp_path, monkeypatch)
    from fastapi import HTTPException
    s = ra.get_store()
    s.set_current_user("member-owner")             # 유일 관리자(개혁)
    # 마지막 관리자 강등 → 400
    with pytest.raises(HTTPException) as e1:
        asyncio.run(ra.patch_project_member("Study_Project", "member-owner", ra.PatchProjectMember(role="뷰어")))
    assert e1.value.status_code == 400
    # 마지막 관리자 제거 → 400
    with pytest.raises(HTTPException) as e2:
        asyncio.run(ra.remove_project_member("Study_Project", "member-owner"))
    assert e2.value.status_code == 400
    # 두 번째 관리자를 추가하면 첫 관리자 강등 허용(더 이상 마지막이 아님)
    asyncio.run(ra.add_project_member("Study_Project", ra.AddProjectMember(member_id="member-field", role="관리자")))
    patched = asyncio.run(ra.patch_project_member("Study_Project", "member-owner", ra.PatchProjectMember(role="편집자")))
    assert patched["role"] == "편집자"
