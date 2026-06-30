"""S7: 로컬 모의 인증 + RBAC 강제 헬퍼.

현재 사용자(store에 영속)의 '해당 프로젝트 역할'로 mutation을 강제한다.
역할 위계: 뷰어(1) < 편집자(2) < 관리자(3).
- 콘텐츠 mutation(폴더·파일·마크업·이슈) = 편집자 이상.
- 구성원/역할 관리·프로젝트 생성 = 관리자.
- 읽기(GET) = 무검사.
기본 현재 사용자 = 시드 관리자(개혁)이므로 S1~S6 기존 동작·테스트가 보존된다.
"""
from __future__ import annotations

from typing import Optional

from fastapi import HTTPException

from store import get_store

ROLE_RANK = {"뷰어": 1, "편집자": 2, "관리자": 3}


def current_role(project_name: Optional[str]) -> Optional[str]:
    """현재 사용자의 project_name 프로젝트 역할(없으면 None)."""
    if not project_name:
        return None
    store = get_store()
    uid = store.get_current_user()
    pm = store.get_project_member(project_name, uid)
    return pm.get("role") if pm else None


def require_role(project_name: Optional[str], min_role: str) -> None:
    """현재 사용자가 project_name에서 min_role 이상이 아니면 403.

    프로젝트 컨텍스트가 없거나(project_name=None) 구성원이 한 명도 등록되지 않은
    '미구성 프로젝트'(레거시/부트스트랩)는 강제하지 않는다 — 프로젝트 생성 시 생성자가
    관리자로 자동 등록되므로 실사용 프로젝트는 항상 구성됨. 구성된 프로젝트만 강제.
    """
    if not project_name:
        return
    store = get_store()
    if not store.list_project_members(project_name):
        return  # 미구성 프로젝트 → RBAC 미적용
    uid = store.get_current_user()
    pm = store.get_project_member(project_name, uid)
    role = pm.get("role") if pm else None
    if role is None or ROLE_RANK.get(role, 0) < ROLE_RANK[min_role]:
        raise HTTPException(
            403,
            f"권한 부족: '{min_role}' 이상 필요 (현재 역할: {role or '권한 없음'})",
        )


def require_role_for_file(file_id: str, min_role: str) -> None:
    """file_id 도면의 프로젝트에서 역할 강제."""
    row = get_store().get_drawing(file_id)
    if not row:
        raise HTTPException(404, f"도면 없음: {file_id}")
    require_role(row.get("project_name"), min_role)


def require_role_for_folder(folder_id: str, min_role: str) -> None:
    """folder_id 폴더의 프로젝트에서 역할 강제."""
    folder = get_store().get_folder(folder_id)
    if not folder:
        raise HTTPException(404, f"폴더 없음: {folder_id}")
    require_role(folder.get("project_name"), min_role)


def require_role_for_issue(issue_id: str, min_role: str) -> None:
    """issue_id 이슈의 프로젝트에서 역할 강제."""
    issue = get_store().get_issue(issue_id)
    if not issue:
        raise HTTPException(404, f"이슈 없음: {issue_id}")
    require_role(issue.get("project_name"), min_role)
