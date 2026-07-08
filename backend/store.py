"""도면 메타/시트 적재 추상화 (S1-a).

Study_TypeDB는 TypeDB에 직접 결합돼 있었다. 여기서는 인터페이스로 분리해
- JsonDrawingStore: Docker 없이 동작하는 파일 기반 폴백 (walking skeleton)
- TypeDBDrawingStore: Docker typedb/typedb:3.7.3 기동 시 04-drawings 온톨로지 적재
둘 다 동일 API를 만족시킨다. STORE_BACKEND=auto면 typedb 시도→실패 시 json.
"""
from __future__ import annotations

import json
import logging
import os
import threading
import uuid
from abc import ABC, abstractmethod
from datetime import datetime
from pathlib import Path
from typing import Optional

import config

logger = logging.getLogger(__name__)


# S3: 신규 프로젝트 첫 접근 시 백엔드가 실제 레코드로 생성하는 ACC 기본 폴더 세트.
# (slug, 표시명, parent_slug). 정적 프론트 시드(buildFilesData)를 대체한다.
DEFAULT_FOLDERS = [
    ("bids", "Bids", None),
    ("contractors", "Contractors", None),
    ("coordination", "Coordination", None),
    ("correspondence", "Correspondence", None),
    ("drawings", "Drawings", None),
    ("for-the-field", "For the Field", None),
    ("handover", "Handover documents", None),
    ("quantity-models", "Quantity models", None),
    ("supported-files", "Supported files", None),
    ("pdfs", "PDFs", "supported-files"),
]

# S3: 폴더/파일 권한 메타 기본값(역할별 접근 레벨). 강제(enforcement)는 S7에서 추가됨.
_DEFAULT_PERMISSIONS = [
    {"role": "관리자", "level": "관리"},
    {"role": "편집자", "level": "편집"},
    {"role": "뷰어", "level": "보기"},
]

# S7: 구성원·프로젝트·역할 시드(seed-on-create, idempotent). project_member는 project_name 키.
_SEED_MEMBERS = [
    {"id": "member-owner", "name": "개혁 이", "email": "cruelkh@gmail.com", "phone": "+82 10-4112-9638"},
    {"id": "member-reviewer", "name": "도면 검토자", "email": "reviewer@xd.local", "phone": "+82 10-2000-1200"},
    {"id": "member-field", "name": "현장 담당자", "email": "field@xd.local", "phone": "+82 10-3000-3400"},
    {"id": "member-viewer", "name": "고객 열람자", "email": "viewer@xd.local", "phone": "+82 10-4000-5600"},
]
_SEED_PROJECTS = [
    {"id": "project-study", "typeIcon": "project", "name": "Study_Project", "number": "",
     "projectType": "지정되지 않음", "templateId": "none", "address": "", "manualAddress": False,
     "timezone": "서울", "startDate": "", "endDate": "", "projectValue": "", "currency": "USD",
     "defaultAccess": "Build", "hub": "TEST-", "createdAt": "2026년 6월 12일", "created_by": "member-owner"},
    {"id": "project-seaport", "typeIcon": "project",
     "name": "Construction : Sample Project - Seaport Civic Center", "number": "",
     "projectType": "건설", "templateId": "owner", "address": "300 Mission Street", "manualAddress": False,
     "timezone": "서울", "startDate": "", "endDate": "", "projectValue": "", "currency": "USD",
     "defaultAccess": "Build", "hub": "TEST-", "createdAt": "2026년 6월 12일", "created_by": "member-field"},
]
_SEED_PROJECT_MEMBERS = [
    {"project_name": "Study_Project", "member_id": "member-owner", "role": "관리자", "status": "활성", "added_at": "2026.06.12."},
    {"project_name": "Study_Project", "member_id": "member-reviewer", "role": "편집자", "status": "활성", "added_at": "2026.06.13."},
    {"project_name": "Study_Project", "member_id": "member-viewer", "role": "뷰어", "status": "활성", "added_at": "2026.06.13."},
    {"project_name": "Construction : Sample Project - Seaport Civic Center", "member_id": "member-field", "role": "관리자", "status": "활성", "added_at": "2026.06.14."},
]
# S9.3: 허브 기본 템플릿 시드. folders=추가 폴더(ACC 기본 폴더 위에 더함),
# default_members=새 프로젝트에 자동 부여할 구성원(생성자=관리자는 별도).
_SEED_TEMPLATES = [
    {"template_id": "template-standard", "name": "표준 프로젝트 템플릿", "access": "소유자",
     "source": "blank", "source_project": None,
     "folders": ["시방서", "제출물", "회의록"],
     "default_members": [{"member_id": "member-reviewer", "role": "편집자"},
                         {"member_id": "member-viewer", "role": "뷰어"}],
     "created_by": "member-owner", "created_at": "2026.06.20."},
    {"template_id": "template-electrical", "name": "전기 시공 표준", "access": "일반 액세스",
     "source": "blank", "source_project": None,
     "folders": ["단선결선도", "부하계산서", "준공도서"],
     "default_members": [{"member_id": "member-field", "role": "편집자"}],
     "created_by": "member-owner", "created_at": "2026.06.20."},
]


class DrawingStore(ABC):
    backend_name: str = "abstract"

    @abstractmethod
    def add_drawing(self, meta: dict) -> None: ...

    @abstractmethod
    def get_drawing(self, file_id: str) -> Optional[dict]: ...

    @abstractmethod
    def list_drawings(self, project_name: Optional[str] = None, *,
                      folder_id: Optional[str] = None,
                      latest_only: bool = False) -> list: ...

    @abstractmethod
    def update_conversion(self, file_id: str, status: str, *,
                          sheets: Optional[list] = None,
                          scan: Optional[dict] = None,
                          dxf_path: Optional[str] = None,
                          error: Optional[str] = None) -> None: ...

    # --- S3: 버전세트 ---
    @abstractmethod
    def add_version(self, version_set_id: str, meta: dict) -> None:
        """같은 논리 파일(version_set)의 기존 버전 is_latest를 끄고 새 버전을 최신으로 적재."""

    @abstractmethod
    def list_versions(self, version_set_id: str) -> list:
        """한 version_set의 모든 버전(version_no 내림차순)."""

    @abstractmethod
    def delete_drawing(self, file_id: str) -> bool:
        """단일 도면(버전) 삭제. 삭제 시 True."""

    # --- S3: 폴더 트리 ---
    @abstractmethod
    def add_folder(self, meta: dict) -> None: ...

    @abstractmethod
    def get_folder(self, folder_id: str) -> Optional[dict]: ...

    @abstractmethod
    def list_folders(self, project_name: str, *, seed: bool = True) -> list:
        """프로젝트 폴더 목록. seed=True이고 폴더가 없으면 ACC 기본 세트를 seed-on-create(idempotent).
        seed=False는 read-only(검색 등 부작용 금지)."""

    @abstractmethod
    def update_folder(self, folder_id: str, **fields) -> Optional[dict]: ...

    @abstractmethod
    def delete_folder(self, folder_id: str) -> bool:
        """폴더 + 하위 폴더 삭제. 소속 도면의 folder_id는 None으로 리셋(고아 방지)."""

    # --- S4: 마크업/측정 영속 ((file_id, sheet_id) 스코프) ---
    @abstractmethod
    def add_markup(self, meta: dict) -> None: ...

    @abstractmethod
    def list_markups(self, file_id: str, sheet_id: str) -> list: ...

    @abstractmethod
    def update_markup(self, markup_id: str, **fields) -> Optional[dict]: ...

    @abstractmethod
    def delete_markup(self, markup_id: str) -> bool: ...

    @abstractmethod
    def add_measurement(self, meta: dict) -> None: ...

    @abstractmethod
    def list_measurements(self, file_id: str, sheet_id: str) -> list: ...

    @abstractmethod
    def delete_measurement(self, measurement_id: str) -> bool: ...

    # --- S5: 이슈 영속 (file_id/sheet_id 선택적 = 핀 없는 프로젝트 전역 이슈 허용) ---
    @abstractmethod
    def add_issue(self, meta: dict) -> None: ...

    @abstractmethod
    def list_issues(self, *, file_id: Optional[str] = None, sheet_id: Optional[str] = None,
                    status: Optional[str] = None, category: Optional[str] = None,
                    project_name: Optional[str] = None) -> list: ...

    @abstractmethod
    def get_issue(self, issue_id: str) -> Optional[dict]: ...

    @abstractmethod
    def update_issue(self, issue_id: str, **fields) -> Optional[dict]: ...

    @abstractmethod
    def delete_issue(self, issue_id: str) -> bool:
        """soft delete: status를 '삭제됨'으로 전환(이력 보존)."""

    # --- S9: 작업(Tasks) — 프로젝트 전역 작업 항목(담당·상태·기한). 핀 없음 ---
    @abstractmethod
    def add_task(self, meta: dict) -> None: ...

    @abstractmethod
    def list_tasks(self, *, project_name: Optional[str] = None,
                   status: Optional[str] = None, assignee: Optional[str] = None) -> list: ...

    @abstractmethod
    def get_task(self, task_id: str) -> Optional[dict]: ...

    @abstractmethod
    def update_task(self, task_id: str, **fields) -> Optional[dict]: ...

    @abstractmethod
    def delete_task(self, task_id: str) -> bool: ...

    # --- S9.1: 양식(Forms) — 체크리스트 기반 점검표. 항목(items) 체크 상태 포함 ---
    @abstractmethod
    def add_form(self, meta: dict) -> None: ...

    @abstractmethod
    def list_forms(self, *, project_name: Optional[str] = None,
                   status: Optional[str] = None, form_type: Optional[str] = None) -> list: ...

    @abstractmethod
    def get_form(self, form_id: str) -> Optional[dict]: ...

    @abstractmethod
    def update_form(self, form_id: str, **fields) -> Optional[dict]: ...

    @abstractmethod
    def delete_form(self, form_id: str) -> bool: ...

    # --- S9.2: 사진(Photos) — 업로드 이미지 + 선택적 시트 연결. 메타만 store, 파일은 uploads/ ---
    @abstractmethod
    def add_photo(self, meta: dict) -> None: ...

    @abstractmethod
    def list_photos(self, *, project_name: Optional[str] = None,
                    sheet_id: Optional[str] = None) -> list: ...

    @abstractmethod
    def get_photo(self, photo_id: str) -> Optional[dict]: ...

    @abstractmethod
    def update_photo(self, photo_id: str, **fields) -> Optional[dict]: ...

    @abstractmethod
    def delete_photo(self, photo_id: str) -> bool: ...

    # --- S9.3: 프로젝트 템플릿(허브 레벨) — 폴더/구성원 사전구성을 새 프로젝트에 적용 ---
    @abstractmethod
    def list_templates(self) -> list: ...

    @abstractmethod
    def add_template(self, meta: dict) -> None: ...

    @abstractmethod
    def get_template(self, template_id: str) -> Optional[dict]: ...

    @abstractmethod
    def delete_template(self, template_id: str) -> bool: ...

    # --- S7: 구성원 · 프로젝트 · 프로젝트-구성원(역할) · 현재 사용자(로컬 모의) ---
    @abstractmethod
    def list_members(self) -> list: ...

    @abstractmethod
    def get_member(self, member_id: str) -> Optional[dict]: ...

    @abstractmethod
    def add_member(self, meta: dict) -> None: ...

    @abstractmethod
    def list_projects(self) -> list: ...

    @abstractmethod
    def add_project(self, meta: dict) -> None: ...

    @abstractmethod
    def remove_project(self, project_id: str) -> Optional[dict]:
        """프로젝트를 삭제하고 소속 구성원(project_member)을 cascade 삭제. 삭제된 레코드 반환(없으면 None)."""

    @abstractmethod
    def list_project_members(self, project_name: str) -> list: ...

    @abstractmethod
    def get_project_member(self, project_name: str, member_id: str) -> Optional[dict]: ...

    @abstractmethod
    def add_project_member(self, meta: dict) -> None: ...

    @abstractmethod
    def update_project_member(self, project_name: str, member_id: str, **fields) -> Optional[dict]: ...

    @abstractmethod
    def remove_project_member(self, project_name: str, member_id: str) -> bool: ...

    @abstractmethod
    def get_current_user(self) -> Optional[str]:
        """현재 사용자 member_id(로컬 모의 인증). 없으면 시드 관리자."""

    @abstractmethod
    def set_current_user(self, member_id: str) -> None: ...

    # --- S14: 발행분(Package/Transmittal) + 시트↔DWG 소스 링크(sheet_source) ---
    # 기존 drawing/sheet/folder/version_set 무변경. 새 JSON 2개로 외부 조인(S5 이슈 선례).
    @abstractmethod
    def add_package(self, meta: dict) -> None: ...

    @abstractmethod
    def get_package(self, package_id: str) -> Optional[dict]: ...

    @abstractmethod
    def list_packages(self, *, project_name: Optional[str] = None) -> list: ...

    @abstractmethod
    def update_package(self, package_id: str, **fields) -> Optional[dict]: ...

    @abstractmethod
    def add_sheet_source(self, meta: dict) -> None: ...

    @abstractmethod
    def get_sheet_source(self, link_id: str) -> Optional[dict]: ...

    @abstractmethod
    def list_sheet_sources(self, *, project_name: Optional[str] = None,
                           package_id: Optional[str] = None, sheet_key: Optional[str] = None,
                           pdf_file_id: Optional[str] = None, sheet_id: Optional[str] = None) -> list: ...

    @abstractmethod
    def update_sheet_source(self, link_id: str, **fields) -> Optional[dict]: ...

    @abstractmethod
    def next_rev(self, sheet_key: str, project_name: Optional[str] = None) -> str:
        """sheet_key의 다음 리비전 라벨(A→B→C…). 기존 링크 없으면 'A'.
        project_name 지정 시 해당 프로젝트 링크만 센다(프로젝트 격리)."""

    # --- S15: 시트 정체성 레지스트리(_sheet_keys.json, 유일 권위) ---
    # 버전을 가로지르는 영속 시트 정체성. 변환 완료 시 시트마다 get-or-create.
    @abstractmethod
    def issue_sheet_key(self, *, project_name: str, version_set_id: Optional[str],
                        sheet_number: str, sheet_index: int = 0) -> str:
        """(project_name, version_set_id, 시트라벨)에 대한 영속 sheet_key를 계승 또는 신규 발급.
        시트라벨 = sheet_number(비어있지 않으면) 또는 위치폴백(빈 번호). 멱등."""

    @abstractmethod
    def resolve_sheet_key(self, *, project_name: str, version_set_id: Optional[str],
                          sheet_number: str, sheet_index: int = 0) -> Optional[str]:
        """읽기 전용: 이미 발급된 sheet_key를 반환(없으면 None). 발급하지 않는다."""

    @abstractmethod
    def get_sheet_key(self, sheet_key: str) -> Optional[dict]:
        """레지스트리 레코드(project_name·version_set_id·sheet_number·…) 조회."""

    @abstractmethod
    def list_sheet_keys(self, *, project_name: Optional[str] = None) -> dict:
        """sheet_key → 레코드 매핑. project_name 지정 시 해당 프로젝트만."""

    # --- S15: 버전별 추출본(_sheet_meta.json, 이력 보존) ---
    @abstractmethod
    def upsert_sheet_meta(self, *, sheet_key: str, project_name: str, file_id: str,
                          sheet_index: int, sheet_id: str, source_kind: str,
                          content_hash: str, text_index: str, tags: list,
                          summary: Optional[str] = None, conflicts: Optional[list] = None,
                          extractor: Optional[dict] = None) -> dict:
        """새 추출본을 이력으로 적재. 같은 sheet_key+content_hash면 no-op(멱등).
        새 이력이면 같은 sheet_key의 기존 is_current를 강등하고 신규만 is_current=True(D6)."""

    @abstractmethod
    def get_sheet_meta(self, meta_id: str) -> Optional[dict]: ...

    @abstractmethod
    def list_sheet_meta(self, *, project_name: Optional[str] = None,
                        sheet_key: Optional[str] = None, file_id: Optional[str] = None,
                        sheet_id: Optional[str] = None, current_only: bool = False) -> list: ...


class JsonDrawingStore(DrawingStore):
    """uploads/_index.json 단일 인덱스. 단일 프로세스 로컬 개발용."""
    backend_name = "json"

    def __init__(self):
        self._path = Path(config.UPLOADS_DIR) / "_index.json"
        self._folders_path = Path(config.UPLOADS_DIR) / "_folders.json"
        self._markups_path = Path(config.UPLOADS_DIR) / "_markups.json"
        self._measurements_path = Path(config.UPLOADS_DIR) / "_measurements.json"
        self._issues_path = Path(config.UPLOADS_DIR) / "_issues.json"
        self._tasks_path = Path(config.UPLOADS_DIR) / "_tasks.json"  # S9: 작업(Tasks)
        self._forms_path = Path(config.UPLOADS_DIR) / "_forms.json"  # S9.1: 양식(Forms)
        self._photos_path = Path(config.UPLOADS_DIR) / "_photos.json"  # S9.2: 사진(Photos)
        self._templates_path = Path(config.UPLOADS_DIR) / "_templates.json"  # S9.3: 프로젝트 템플릿
        self._packages_path = Path(config.UPLOADS_DIR) / "_packages.json"  # S14: 발행분(package/transmittal)
        self._sheet_sources_path = Path(config.UPLOADS_DIR) / "_sheet_sources.json"  # S14: 시트↔DWG 링크
        self._sheet_keys_path = Path(config.UPLOADS_DIR) / "_sheet_keys.json"  # S15: 시트 정체성 레지스트리
        self._sheet_meta_path = Path(config.UPLOADS_DIR) / "_sheet_meta.json"  # S15: 버전별 추출본(이력)
        # S7: 구성원·프로젝트·프로젝트-구성원·현재 사용자
        self._members_path = Path(config.UPLOADS_DIR) / "_members.json"
        self._projects_path = Path(config.UPLOADS_DIR) / "_projects.json"
        self._project_members_path = Path(config.UPLOADS_DIR) / "_project_members.json"
        self._auth_path = Path(config.UPLOADS_DIR) / "_auth.json"
        self._lock = threading.Lock()
        if not self._path.exists():
            self._write({})
        if not self._folders_path.exists():
            self._write_folders({})
        if not self._markups_path.exists():
            self._write_at(self._markups_path, {})
        if not self._measurements_path.exists():
            self._write_at(self._measurements_path, {})
        if not self._issues_path.exists():
            self._write_at(self._issues_path, {})
        if not self._tasks_path.exists():
            self._write_at(self._tasks_path, {})
        if not self._forms_path.exists():
            self._write_at(self._forms_path, {})
        if not self._photos_path.exists():
            self._write_at(self._photos_path, {})
        if not self._templates_path.exists():
            self._write_at(self._templates_path, {})
        if not self._packages_path.exists():
            self._write_at(self._packages_path, {})
        if not self._sheet_sources_path.exists():
            self._write_at(self._sheet_sources_path, {})
        if not self._sheet_keys_path.exists():
            self._write_at(self._sheet_keys_path, {})
        if not self._sheet_meta_path.exists():
            self._write_at(self._sheet_meta_path, {})

    def _read_at(self, path: Path) -> dict:
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except FileNotFoundError:
            return {}
        except json.JSONDecodeError:
            # 손상 인덱스는 조용히 삼키지 않고 백업해 유실을 가시화한다.
            backup = path.with_name(path.name + ".corrupt")
            try:
                os.replace(str(path), str(backup))
                logger.error("index corrupt → backed up to %s", backup)
            except OSError:
                pass
            return {}

    def _write_at(self, path: Path, data: dict) -> None:
        # atomic write: 임시파일에 쓴 뒤 교체(부분 쓰기/lost-update 방지).
        tmp = path.with_name(path.name + ".tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(str(tmp), str(path))

    def _read(self) -> dict:
        return self._read_at(self._path)

    def _write(self, data: dict) -> None:
        self._write_at(self._path, data)

    def _read_folders(self) -> dict:
        return self._read_at(self._folders_path)

    def _write_folders(self, data: dict) -> None:
        self._write_at(self._folders_path, data)

    def add_drawing(self, meta: dict) -> None:
        with self._lock:
            data = self._read()
            data[meta["file_id"]] = meta
            self._write(data)

    def get_drawing(self, file_id: str) -> Optional[dict]:
        return self._read().get(file_id)

    def list_drawings(self, project_name=None, *, folder_id=None, latest_only=False) -> list:
        rows = list(self._read().values())
        if project_name:
            rows = [r for r in rows if r.get("project_name") == project_name]
        if folder_id is not None:
            # folder_id="" → 폴더 미지정(루트) 도면. 그 외엔 정확 매치.
            rows = [r for r in rows if (r.get("folder_id") or "") == folder_id]
        if latest_only:
            # 레거시(버전세트 도입 전) 레코드는 is_latest 누락 → 최신으로 간주.
            rows = [r for r in rows if r.get("is_latest", True)]
        rows.sort(key=lambda r: r.get("upload_date", ""), reverse=True)
        return rows

    def update_conversion(self, file_id, status, *, sheets=None, scan=None, dxf_path=None, error=None):
        with self._lock:
            data = self._read()
            row = data.get(file_id)
            if not row:
                return
            row["conversion_status"] = status
            if sheets is not None:
                row["sheets"] = sheets
            if scan is not None:
                row["scan"] = scan
            if dxf_path is not None:
                row["dxf_path"] = dxf_path
            if error is not None:
                row["error"] = error
            self._write(data)

    # --- S3: 버전세트 ---
    def add_version(self, version_set_id: str, meta: dict) -> None:
        # version_no 할당과 de-latest 전환을 단일 lock 안에서 수행한다(동시 추가 경합 방지).
        with self._lock:
            data = self._read()
            members = [r for r in data.values() if _in_set(r, version_set_id)]
            # 레거시(version_no 없음) base는 v1로 간주(0으로 세면 새 버전과 번호가 충돌).
            next_no = max((r.get("version_no") or 1 for r in members), default=0) + 1
            meta["version_no"] = next_no
            meta["version"] = str(next_no)
            for r in members:
                r["is_latest"] = False
                # 레거시(version_set_id 없음) base를 set에 백필 — 안 하면 base가 latest로 남아 중복 행.
                if not r.get("version_set_id"):
                    r["version_set_id"] = version_set_id
                if r.get("version_no") is None:
                    r["version_no"] = 1
            data[meta["file_id"]] = meta
            self._write(data)

    def list_versions(self, version_set_id: str) -> list:
        rows = [r for r in self._read().values() if _in_set(r, version_set_id)]
        rows.sort(key=lambda r: r.get("version_no") or 1, reverse=True)
        return rows

    def delete_drawing(self, file_id: str) -> bool:
        with self._lock:
            data = self._read()
            if file_id not in data:
                return False
            del data[file_id]
            self._write(data)
            return True

    # --- S3: 폴더 트리 ---
    def add_folder(self, meta: dict) -> None:
        with self._lock:
            data = self._read_folders()
            data[meta["folder_id"]] = meta
            self._write_folders(data)

    def get_folder(self, folder_id: str) -> Optional[dict]:
        return self._read_folders().get(folder_id)

    def list_folders(self, project_name: str, *, seed: bool = True) -> list:
        with self._lock:
            data = self._read_folders()
            has_any = any(f.get("project_name") == project_name for f in data.values())
            if not has_any and seed:
                # seed-on-create: ACC 기본 폴더 세트를 실제 레코드로 생성(idempotent — 존재하면 skip).
                now = datetime.now().isoformat()
                for slug, name, parent_slug in DEFAULT_FOLDERS:
                    fid = f"{project_name}::{slug}"
                    data[fid] = {
                        "folder_id": fid,
                        "project_name": project_name,
                        "name": name,
                        "parent_id": f"{project_name}::{parent_slug}" if parent_slug else None,
                        "share_status": "프로젝트 공유",
                        "permissions": _DEFAULT_PERMISSIONS,
                        "updated_at": now,
                        "updated_by": "시스템",
                        "seeded": True,
                    }
                self._write_folders(data)
        rows = [f for f in self._read_folders().values() if f.get("project_name") == project_name]
        rows.sort(key=lambda f: f.get("name", ""))
        return rows

    def update_folder(self, folder_id: str, **fields) -> Optional[dict]:
        with self._lock:
            data = self._read_folders()
            row = data.get(folder_id)
            if not row:
                return None
            for k in ("name", "parent_id", "share_status", "permissions"):
                if k in fields and fields[k] is not None:
                    row[k] = fields[k]
            row["updated_at"] = datetime.now().isoformat()
            if fields.get("updated_by"):
                row["updated_by"] = fields["updated_by"]
            self._write_folders(data)
            return row

    def delete_folder(self, folder_id: str) -> bool:
        with self._lock:
            data = self._read_folders()
            if folder_id not in data:
                return False
            # 하위 폴더 재귀 수집
            to_delete = {folder_id}
            changed = True
            while changed:
                changed = False
                for fid, f in data.items():
                    if f.get("parent_id") in to_delete and fid not in to_delete:
                        to_delete.add(fid)
                        changed = True
            for fid in to_delete:
                data.pop(fid, None)
            self._write_folders(data)
        # 소속 도면 folder_id 리셋(고아 방지) — 별도 lock 구간.
        with self._lock:
            drawings = self._read()
            dirty = False
            for r in drawings.values():
                if r.get("folder_id") in to_delete:
                    r["folder_id"] = None
                    dirty = True
            if dirty:
                self._write(drawings)
        return True

    # --- S4: 마크업/측정 영속 ---
    def add_markup(self, meta: dict) -> None:
        with self._lock:
            data = self._read_at(self._markups_path)
            data[meta["markup_id"]] = meta
            self._write_at(self._markups_path, data)

    def list_markups(self, file_id: str, sheet_id: str) -> list:
        rows = [
            r for r in self._read_at(self._markups_path).values()
            if r.get("file_id") == file_id and r.get("sheet_id") == sheet_id
        ]
        rows.sort(key=lambda r: r.get("created_at", ""))
        return rows

    def update_markup(self, markup_id: str, **fields) -> Optional[dict]:
        with self._lock:
            data = self._read_at(self._markups_path)
            row = data.get(markup_id)
            if not row:
                return None
            # 좌표·내용·스타일·텍스트만 갱신 허용(스코프 키 file_id/sheet_id/coord_space는 불변).
            for k in ("geometry", "style", "text", "kind"):
                if k in fields and fields[k] is not None:
                    row[k] = fields[k]
            self._write_at(self._markups_path, data)
            return row

    def delete_markup(self, markup_id: str) -> bool:
        with self._lock:
            data = self._read_at(self._markups_path)
            if markup_id not in data:
                return False
            del data[markup_id]
            self._write_at(self._markups_path, data)
            return True

    def add_measurement(self, meta: dict) -> None:
        with self._lock:
            data = self._read_at(self._measurements_path)
            data[meta["measurement_id"]] = meta
            self._write_at(self._measurements_path, data)

    def list_measurements(self, file_id: str, sheet_id: str) -> list:
        rows = [
            r for r in self._read_at(self._measurements_path).values()
            if r.get("file_id") == file_id and r.get("sheet_id") == sheet_id
        ]
        rows.sort(key=lambda r: r.get("created_at", ""))
        return rows

    def delete_measurement(self, measurement_id: str) -> bool:
        with self._lock:
            data = self._read_at(self._measurements_path)
            if measurement_id not in data:
                return False
            del data[measurement_id]
            self._write_at(self._measurements_path, data)
            return True

    # --- S5: 이슈 ---
    def add_issue(self, meta: dict) -> None:
        with self._lock:
            data = self._read_at(self._issues_path)
            data[meta["issue_id"]] = meta
            self._write_at(self._issues_path, data)

    def list_issues(self, *, file_id=None, sheet_id=None, status=None,
                    category=None, project_name=None) -> list:
        rows = list(self._read_at(self._issues_path).values())
        if file_id is not None:
            rows = [r for r in rows if r.get("file_id") == file_id]
        if sheet_id is not None:
            rows = [r for r in rows if r.get("sheet_id") == sheet_id]
        if status is not None:
            rows = [r for r in rows if r.get("status") == status]
        if category is not None:
            rows = [r for r in rows if r.get("category") == category]
        if project_name is not None:
            rows = [r for r in rows if r.get("project_name") == project_name]
        # 최신 생성 우선(목록 상단 = 최근).
        rows.sort(key=lambda r: r.get("created_at", ""), reverse=True)
        return rows

    def get_issue(self, issue_id: str) -> Optional[dict]:
        return self._read_at(self._issues_path).get(issue_id)

    def update_issue(self, issue_id: str, **fields) -> Optional[dict]:
        with self._lock:
            data = self._read_at(self._issues_path)
            row = data.get(issue_id)
            if not row:
                return None
            # 스코프 키(file_id)는 불변. 핀(pin) 재배치는 허용.
            for k in ("title", "type", "status", "category", "assignee", "description", "pin", "sheet_id"):
                if k in fields and fields[k] is not None:
                    row[k] = fields[k]
            row["updated_at"] = datetime.now().isoformat()
            self._write_at(self._issues_path, data)
            return row

    def delete_issue(self, issue_id: str) -> bool:
        # soft delete: 레코드를 지우지 않고 status를 '삭제됨'으로 전환(삭제된 이슈 탭에서 조회).
        with self._lock:
            data = self._read_at(self._issues_path)
            row = data.get(issue_id)
            if not row:
                return False
            row["status"] = "삭제됨"
            row["updated_at"] = datetime.now().isoformat()
            self._write_at(self._issues_path, data)
            return True

    # --- S9: 작업(Tasks) ---
    def add_task(self, meta: dict) -> None:
        with self._lock:
            data = self._read_at(self._tasks_path)
            data[meta["task_id"]] = meta
            self._write_at(self._tasks_path, data)

    def list_tasks(self, *, project_name=None, status=None, assignee=None) -> list:
        rows = list(self._read_at(self._tasks_path).values())
        if project_name is not None:
            rows = [r for r in rows if r.get("project_name") == project_name]
        if status is not None:
            rows = [r for r in rows if r.get("status") == status]
        if assignee is not None:
            rows = [r for r in rows if r.get("assignee") == assignee]
        # 미완료 우선 + 최신 생성 우선(안정 정렬 2패스). 목록 상단 = 처리 대상.
        rows.sort(key=lambda r: r.get("created_at", ""), reverse=True)
        rows.sort(key=lambda r: r.get("status") == "완료")
        return rows

    def get_task(self, task_id: str) -> Optional[dict]:
        return self._read_at(self._tasks_path).get(task_id)

    def update_task(self, task_id: str, **fields) -> Optional[dict]:
        with self._lock:
            data = self._read_at(self._tasks_path)
            row = data.get(task_id)
            if not row:
                return None
            for k in ("title", "description", "assignee", "status", "priority", "due_date"):
                if k in fields and fields[k] is not None:
                    row[k] = fields[k]
            row["updated_at"] = datetime.now().isoformat()
            self._write_at(self._tasks_path, data)
            return row

    def delete_task(self, task_id: str) -> bool:
        # 작업은 하드 삭제(이슈와 달리 이력 보존 불필요).
        with self._lock:
            data = self._read_at(self._tasks_path)
            if task_id not in data:
                return False
            del data[task_id]
            self._write_at(self._tasks_path, data)
            return True

    # --- S9.1: 양식(Forms) ---
    def add_form(self, meta: dict) -> None:
        with self._lock:
            data = self._read_at(self._forms_path)
            data[meta["form_id"]] = meta
            self._write_at(self._forms_path, data)

    def list_forms(self, *, project_name=None, status=None, form_type=None) -> list:
        rows = list(self._read_at(self._forms_path).values())
        if project_name is not None:
            rows = [r for r in rows if r.get("project_name") == project_name]
        if status is not None:
            rows = [r for r in rows if r.get("status") == status]
        if form_type is not None:
            rows = [r for r in rows if r.get("form_type") == form_type]
        # 미완료 우선 + 최신순(안정 정렬 2패스).
        rows.sort(key=lambda r: r.get("created_at", ""), reverse=True)
        rows.sort(key=lambda r: r.get("status") == "완료")
        return rows

    def get_form(self, form_id: str) -> Optional[dict]:
        return self._read_at(self._forms_path).get(form_id)

    def update_form(self, form_id: str, **fields) -> Optional[dict]:
        with self._lock:
            data = self._read_at(self._forms_path)
            row = data.get(form_id)
            if not row:
                return None
            for k in ("title", "form_type", "status", "assignee", "due_date", "items"):
                if k in fields and fields[k] is not None:
                    row[k] = fields[k]
            row["updated_at"] = datetime.now().isoformat()
            self._write_at(self._forms_path, data)
            return row

    def delete_form(self, form_id: str) -> bool:
        with self._lock:
            data = self._read_at(self._forms_path)
            if form_id not in data:
                return False
            del data[form_id]
            self._write_at(self._forms_path, data)
            return True

    # --- S9.2: 사진(Photos) ---
    def add_photo(self, meta: dict) -> None:
        with self._lock:
            data = self._read_at(self._photos_path)
            data[meta["photo_id"]] = meta
            self._write_at(self._photos_path, data)

    def list_photos(self, *, project_name=None, sheet_id=None) -> list:
        rows = list(self._read_at(self._photos_path).values())
        if project_name is not None:
            rows = [r for r in rows if r.get("project_name") == project_name]
        if sheet_id is not None:
            rows = [r for r in rows if r.get("sheet_id") == sheet_id]
        # 최신 업로드 우선.
        rows.sort(key=lambda r: r.get("created_at", ""), reverse=True)
        return rows

    def get_photo(self, photo_id: str) -> Optional[dict]:
        return self._read_at(self._photos_path).get(photo_id)

    def update_photo(self, photo_id: str, **fields) -> Optional[dict]:
        with self._lock:
            data = self._read_at(self._photos_path)
            row = data.get(photo_id)
            if not row:
                return None
            for k in ("title", "caption", "sheet_id"):
                if k in fields and fields[k] is not None:
                    row[k] = fields[k]
            row["updated_at"] = datetime.now().isoformat()
            self._write_at(self._photos_path, data)
            return row

    def delete_photo(self, photo_id: str) -> bool:
        with self._lock:
            data = self._read_at(self._photos_path)
            if photo_id not in data:
                return False
            del data[photo_id]
            self._write_at(self._photos_path, data)
            return True

    # --- S9.3: 프로젝트 템플릿 ---
    def _seed_templates(self) -> None:
        """템플릿이 비었으면 허브 기본 템플릿 시드(idempotent)."""
        if self._read_at(self._templates_path):
            return
        self._write_at(self._templates_path, {t["template_id"]: t for t in _SEED_TEMPLATES})

    def list_templates(self) -> list:
        with self._lock:
            self._seed_templates()
        rows = list(self._read_at(self._templates_path).values())
        rows.sort(key=lambda t: t.get("created_at", ""), reverse=True)
        return rows

    def add_template(self, meta: dict) -> None:
        with self._lock:
            self._seed_templates()
            data = self._read_at(self._templates_path)
            data[meta["template_id"]] = meta
            self._write_at(self._templates_path, data)

    def get_template(self, template_id: str) -> Optional[dict]:
        with self._lock:
            self._seed_templates()
        return self._read_at(self._templates_path).get(template_id)

    def delete_template(self, template_id: str) -> bool:
        with self._lock:
            self._seed_templates()
            data = self._read_at(self._templates_path)
            if template_id not in data:
                return False
            del data[template_id]
            self._write_at(self._templates_path, data)
            return True

    # --- S7: 구성원 · 프로젝트 · 프로젝트-구성원(역할) · 현재 사용자 ---
    def _seed_s7(self) -> None:
        """구성원/프로젝트/역할이 비었으면 ACC식 시드 생성(idempotent). project_member는 project_name 키."""
        if self._read_at(self._members_path):
            return
        self._write_at(self._members_path, {m["id"]: m for m in _SEED_MEMBERS})
        if not self._read_at(self._projects_path):
            self._write_at(self._projects_path, {p["id"]: p for p in _SEED_PROJECTS})
        if not self._read_at(self._project_members_path):
            pm = {}
            for r in _SEED_PROJECT_MEMBERS:
                pm[f"{r['project_name']}::{r['member_id']}"] = r
            self._write_at(self._project_members_path, pm)

    def list_members(self) -> list:
        with self._lock:
            self._seed_s7()
        return list(self._read_at(self._members_path).values())

    def get_member(self, member_id: str) -> Optional[dict]:
        with self._lock:
            self._seed_s7()
        return self._read_at(self._members_path).get(member_id)

    def add_member(self, meta: dict) -> None:
        with self._lock:
            self._seed_s7()
            data = self._read_at(self._members_path)
            data[meta["id"]] = meta
            self._write_at(self._members_path, data)

    def list_projects(self) -> list:
        with self._lock:
            self._seed_s7()
        return list(self._read_at(self._projects_path).values())

    def add_project(self, meta: dict) -> None:
        with self._lock:
            self._seed_s7()
            data = self._read_at(self._projects_path)
            data[meta["id"]] = meta
            self._write_at(self._projects_path, data)

    def remove_project(self, project_id: str) -> Optional[dict]:
        with self._lock:
            self._seed_s7()
            projects = self._read_at(self._projects_path)
            removed = projects.pop(project_id, None)
            if removed is None:
                return None
            self._write_at(self._projects_path, projects)
            # cascade: 해당 프로젝트 이름의 구성원 레코드 삭제.
            name = removed.get("name")
            members = self._read_at(self._project_members_path)
            kept = {k: v for k, v in members.items() if v.get("project_name") != name}
            if len(kept) != len(members):
                self._write_at(self._project_members_path, kept)
            return removed

    def list_project_members(self, project_name: str) -> list:
        with self._lock:
            self._seed_s7()
        return [r for r in self._read_at(self._project_members_path).values()
                if r.get("project_name") == project_name]

    def get_project_member(self, project_name: str, member_id: str) -> Optional[dict]:
        with self._lock:
            self._seed_s7()
        return self._read_at(self._project_members_path).get(f"{project_name}::{member_id}")

    def add_project_member(self, meta: dict) -> None:
        with self._lock:
            self._seed_s7()
            data = self._read_at(self._project_members_path)
            data[f"{meta['project_name']}::{meta['member_id']}"] = meta
            self._write_at(self._project_members_path, data)

    def update_project_member(self, project_name: str, member_id: str, **fields) -> Optional[dict]:
        with self._lock:
            self._seed_s7()
            data = self._read_at(self._project_members_path)
            row = data.get(f"{project_name}::{member_id}")
            if not row:
                return None
            for k in ("role", "status"):
                if k in fields and fields[k] is not None:
                    row[k] = fields[k]
            self._write_at(self._project_members_path, data)
            return row

    def remove_project_member(self, project_name: str, member_id: str) -> bool:
        with self._lock:
            self._seed_s7()
            data = self._read_at(self._project_members_path)
            key = f"{project_name}::{member_id}"
            if key not in data:
                return False
            del data[key]
            self._write_at(self._project_members_path, data)
            return True

    def get_current_user(self) -> Optional[str]:
        with self._lock:
            self._seed_s7()
        uid = self._read_at(self._auth_path).get("current_user")
        # 미설정 시 시드 관리자(개혁) — 기존 동작·테스트 보존.
        return uid or _SEED_MEMBERS[0]["id"]

    def set_current_user(self, member_id: str) -> None:
        with self._lock:
            self._write_at(self._auth_path, {"current_user": member_id})

    # --- S14: 발행분(Package) + 시트↔DWG 소스 링크 ---
    def add_package(self, meta: dict) -> None:
        with self._lock:
            data = self._read_at(self._packages_path)
            data[meta["package_id"]] = meta
            self._write_at(self._packages_path, data)

    def get_package(self, package_id: str) -> Optional[dict]:
        return self._read_at(self._packages_path).get(package_id)

    def list_packages(self, *, project_name=None) -> list:
        rows = list(self._read_at(self._packages_path).values())
        if project_name is not None:
            rows = [r for r in rows if r.get("project_name") == project_name]
        rows.sort(key=lambda r: r.get("created_at", ""), reverse=True)
        return rows

    def update_package(self, package_id: str, **fields) -> Optional[dict]:
        with self._lock:
            data = self._read_at(self._packages_path)
            row = data.get(package_id)
            if not row:
                return None
            for k in ("title", "folder_id", "status", "published_at",
                      "dwg_file_ids", "pdf_file_ids", "draft_mapping"):
                if k in fields and fields[k] is not None:
                    row[k] = fields[k]
            self._write_at(self._packages_path, data)
            return row

    def add_sheet_source(self, meta: dict) -> None:
        with self._lock:
            data = self._read_at(self._sheet_sources_path)
            data[meta["link_id"]] = meta
            self._write_at(self._sheet_sources_path, data)

    def get_sheet_source(self, link_id: str) -> Optional[dict]:
        return self._read_at(self._sheet_sources_path).get(link_id)

    def list_sheet_sources(self, *, project_name=None, package_id=None, sheet_key=None,
                           pdf_file_id=None, sheet_id=None) -> list:
        rows = list(self._read_at(self._sheet_sources_path).values())
        if project_name is not None:
            rows = [r for r in rows if r.get("project_name") == project_name]
        if package_id is not None:
            rows = [r for r in rows if r.get("package_id") == package_id]
        if sheet_key is not None:
            rows = [r for r in rows if r.get("sheet_key") == sheet_key]
        if pdf_file_id is not None:
            rows = [r for r in rows if r.get("pdf_file_id") == pdf_file_id]
        if sheet_id is not None:
            rows = [r for r in rows if r.get("sheet_id") == sheet_id]
        rows.sort(key=lambda r: r.get("created_at", ""))
        return rows

    def update_sheet_source(self, link_id: str, **fields) -> Optional[dict]:
        with self._lock:
            data = self._read_at(self._sheet_sources_path)
            row = data.get(link_id)
            if not row:
                return None
            for k in ("sheet_key", "rev", "sheet_number", "dwg_links", "is_current"):
                if k in fields and fields[k] is not None:
                    row[k] = fields[k]
            self._write_at(self._sheet_sources_path, data)
            return row

    def next_rev(self, sheet_key: str, project_name: Optional[str] = None) -> str:
        # 렌즈1 MAJOR-1/MINOR-3: 같은 프로젝트의 sheet_key만 세고(프로젝트 격리),
        # A~Z 소진 후 AA·AB…까지 스프레드시트식 시퀀스로 유일 rev를 보장.
        revs = [r.get("rev", "") for r in
                self.list_sheet_sources(sheet_key=sheet_key, project_name=project_name)]
        idx = max((_rev_to_index(r) for r in revs), default=-1)
        return _index_to_rev(idx + 1)

    # --- S15: 시트 정체성 레지스트리 ---
    def _sk_match(self, rec: dict, project_name, version_set_id, label) -> bool:
        return (rec.get("project_name") == project_name
                and rec.get("version_set_id") == version_set_id
                and _sheet_label(rec.get("sheet_number", ""), rec.get("sheet_index", 0)) == label)

    def resolve_sheet_key(self, *, project_name, version_set_id, sheet_number, sheet_index=0):
        label = _sheet_label(sheet_number, sheet_index)
        for key, rec in self._read_at(self._sheet_keys_path).items():
            if self._sk_match(rec, project_name, version_set_id, label):
                return key
        return None

    def issue_sheet_key(self, *, project_name, version_set_id, sheet_number, sheet_index=0):
        label = _sheet_label(sheet_number, sheet_index)
        with self._lock:
            data = self._read_at(self._sheet_keys_path)
            for key, rec in data.items():
                if self._sk_match(rec, project_name, version_set_id, label):
                    return key   # 계승(멱등)
            key = f"sk_{uuid.uuid4().hex}"
            data[key] = {
                "project_name": project_name,
                "version_set_id": version_set_id,
                "sheet_number": sheet_number,
                "sheet_index": sheet_index,
                "created_at": datetime.now().isoformat(),
            }
            self._write_at(self._sheet_keys_path, data)
            return key

    def get_sheet_key(self, sheet_key: str) -> Optional[dict]:
        return self._read_at(self._sheet_keys_path).get(sheet_key)

    def list_sheet_keys(self, *, project_name=None) -> dict:
        data = self._read_at(self._sheet_keys_path)
        if project_name is None:
            return dict(data)
        return {k: v for k, v in data.items() if v.get("project_name") == project_name}

    # --- S15: 버전별 추출본(이력) ---
    def upsert_sheet_meta(self, *, sheet_key, project_name, file_id, sheet_index, sheet_id,
                          source_kind, content_hash, text_index, tags,
                          summary=None, conflicts=None, extractor=None) -> dict:
        with self._lock:
            data = self._read_at(self._sheet_meta_path)
            for rec in data.values():
                if rec.get("sheet_key") == sheet_key and rec.get("content_hash") == content_hash:
                    return rec   # 동일 콘텐츠 재변환 → no-op(멱등)
            for rec in data.values():
                if rec.get("sheet_key") == sheet_key and rec.get("is_current"):
                    rec["is_current"] = False   # 이전 rev 강등(이력은 보존)
            meta_id = f"sm_{uuid.uuid4().hex}"
            rec = {
                "meta_id": meta_id, "project_name": project_name, "sheet_key": sheet_key,
                "file_id": file_id, "sheet_index": sheet_index, "sheet_id": sheet_id,
                "content_hash": content_hash, "source_kind": source_kind,
                "is_current": True, "text_index": text_index, "tags": tags,
                "summary": summary, "conflicts": conflicts or [],
                "extractor": extractor or {"rule_version": "1", "llm_model": None},
                "extracted_at": datetime.now().isoformat(),
            }
            data[meta_id] = rec
            self._write_at(self._sheet_meta_path, data)
            return rec

    def get_sheet_meta(self, meta_id: str) -> Optional[dict]:
        return self._read_at(self._sheet_meta_path).get(meta_id)

    def list_sheet_meta(self, *, project_name=None, sheet_key=None, file_id=None,
                        sheet_id=None, current_only=False) -> list:
        rows = list(self._read_at(self._sheet_meta_path).values())
        if project_name is not None:
            rows = [r for r in rows if r.get("project_name") == project_name]
        if sheet_key is not None:
            rows = [r for r in rows if r.get("sheet_key") == sheet_key]
        if file_id is not None:
            rows = [r for r in rows if r.get("file_id") == file_id]
        if sheet_id is not None:
            rows = [r for r in rows if r.get("sheet_id") == sheet_id]
        if current_only:
            rows = [r for r in rows if r.get("is_current")]
        rows.sort(key=lambda r: r.get("extracted_at", ""), reverse=True)
        return rows


class TypeDBDrawingStore(DrawingStore):
    """typedb-driver 적재. 04-drawings 온톨로지(이식). 미가동 시 생성에서 예외."""
    backend_name = "typedb"

    def __init__(self):
        from typedb.driver import TypeDB, Credentials, DriverOptions  # type: ignore
        self._addr = config.TYPEDB_ADDR
        self._db = config.TYPEDB_DB
        # 연결 시도 (실패 시 예외 → 팩토리가 json으로 폴백)
        self._driver = TypeDB.driver(
            self._addr, Credentials("admin", "password"), DriverOptions(is_tls_enabled=False)
        )
        self._ensure_db()
        logger.info("TypeDB connected: %s/%s", self._addr, self._db)

    def _ensure_db(self):
        from typedb.driver import TransactionType
        if not self._driver.databases.contains(self._db):
            self._driver.databases.create(self._db)
            schema = (Path(config.BACKEND_DIR) / "schema" / "04-drawings.tql").read_text(encoding="utf-8")
            with self._driver.transaction(self._db, TransactionType.SCHEMA) as tx:
                tx.query(schema).resolve()
                tx.commit()
            logger.info("TypeDB schema applied")

    def add_drawing(self, meta: dict) -> None:
        from typedb.driver import TransactionType
        with self._driver.transaction(self._db, TransactionType.WRITE) as tx:
            tx.query(
                'insert $df isa drawing_file, '
                f'has file_id "{meta["file_id"]}", '
                f'has filename "{_esc(meta["filename"])}", '
                f'has file_path "{_esc(meta["file_path"])}", '
                f'has file_format "{meta["file_format"]}", '
                f'has file_size {meta["file_size"]}, '
                f'has upload_date {meta["upload_date"]}, '
                f'has project_name "{_esc(meta["project_name"])}", '
                f'has version_number "{meta["version"]}", '
                'has conversion_status "pending";'
            ).resolve()
            tx.commit()
        # 조회/시트는 JSON 미러를 권위로 쓰므로 미러에도 반드시 적재한다(누락 시 조회 깨짐).
        _MIRROR.add_drawing(meta)

    def get_drawing(self, file_id: str) -> Optional[dict]:
        # walking skeleton: 메타 권위는 JSON과 미러. TypeDB 조회는 후속(S2+)에서 강화.
        return _MIRROR.get_drawing(file_id)

    def list_drawings(self, project_name=None, *, folder_id=None, latest_only=False) -> list:
        return _MIRROR.list_drawings(project_name, folder_id=folder_id, latest_only=latest_only)

    def update_conversion(self, file_id, status, *, sheets=None, scan=None, dxf_path=None, error=None):
        from typedb.driver import TransactionType
        try:
            with self._driver.transaction(self._db, TransactionType.WRITE) as tx:
                tx.query(
                    f'match $df isa drawing_file, has file_id "{file_id}"; '
                    '$df has conversion_status $s; '
                    f'delete $df has $s; insert $df has conversion_status "{status}";'
                ).resolve()
                tx.commit()
        except Exception as e:  # noqa: BLE001
            logger.error("typedb update_conversion: %s", e)
        _MIRROR.update_conversion(file_id, status, sheets=sheets, scan=scan, dxf_path=dxf_path, error=error)

    # --- S3: 버전세트/폴더 — 메타 SoT는 JSON 미러(LOOP: TypeDB 직접쿼리화는 후속) ---
    def add_version(self, version_set_id: str, meta: dict) -> None:
        # 새 버전도 그래프에 적재(첫 업로드 add_drawing과 동일 경로).
        try:
            self.add_drawing(meta)
        except Exception as e:  # noqa: BLE001
            logger.error("typedb add_version insert: %s", e)
            _MIRROR.add_drawing(meta)
        # is_latest 전환은 미러 권위.
        _MIRROR.add_version(version_set_id, meta)

    def list_versions(self, version_set_id: str) -> list:
        return _MIRROR.list_versions(version_set_id)

    def delete_drawing(self, file_id: str) -> bool:
        try:
            from typedb.driver import TransactionType
            with self._driver.transaction(self._db, TransactionType.WRITE) as tx:
                tx.query(
                    f'match $df isa drawing_file, has file_id "{file_id}"; delete $df isa drawing_file;'
                ).resolve()
                tx.commit()
        except Exception as e:  # noqa: BLE001
            logger.error("typedb delete_drawing: %s", e)
        return _MIRROR.delete_drawing(file_id)

    def add_folder(self, meta: dict) -> None:
        _MIRROR.add_folder(meta)

    def get_folder(self, folder_id: str) -> Optional[dict]:
        return _MIRROR.get_folder(folder_id)

    def list_folders(self, project_name: str, *, seed: bool = True) -> list:
        return _MIRROR.list_folders(project_name, seed=seed)

    def update_folder(self, folder_id: str, **fields) -> Optional[dict]:
        return _MIRROR.update_folder(folder_id, **fields)

    def delete_folder(self, folder_id: str) -> bool:
        return _MIRROR.delete_folder(folder_id)

    # --- S4: 마크업/측정 — 그래프 best-effort 적재 + JSON 미러 SoT(직접쿼리화는 후속) ---
    def add_markup(self, meta: dict) -> None:
        try:
            from typedb.driver import TransactionType
            with self._driver.transaction(self._db, TransactionType.WRITE) as tx:
                tx.query(
                    'insert $m isa markup, '
                    f'has markup_id "{meta["markup_id"]}", '
                    f'has file_id "{meta["file_id"]}", '
                    f'has sheet_id "{meta["sheet_id"]}", '
                    f'has markup_kind "{_esc(meta.get("kind", ""))}", '
                    f'has coord_space "{meta.get("coord_space", "world")}", '
                    f'has geometry_json "{_esc(json.dumps(meta.get("geometry"), ensure_ascii=False))}", '
                    f'has created_at {meta["created_at"]};'
                ).resolve()
                tx.commit()
        except Exception as e:  # noqa: BLE001
            logger.error("typedb add_markup: %s", e)
        _MIRROR.add_markup(meta)

    def list_markups(self, file_id: str, sheet_id: str) -> list:
        return _MIRROR.list_markups(file_id, sheet_id)

    def update_markup(self, markup_id: str, **fields) -> Optional[dict]:
        return _MIRROR.update_markup(markup_id, **fields)

    def delete_markup(self, markup_id: str) -> bool:
        try:
            from typedb.driver import TransactionType
            with self._driver.transaction(self._db, TransactionType.WRITE) as tx:
                tx.query(
                    f'match $m isa markup, has markup_id "{markup_id}"; delete $m isa markup;'
                ).resolve()
                tx.commit()
        except Exception as e:  # noqa: BLE001
            logger.error("typedb delete_markup: %s", e)
        return _MIRROR.delete_markup(markup_id)

    def add_measurement(self, meta: dict) -> None:
        try:
            from typedb.driver import TransactionType
            with self._driver.transaction(self._db, TransactionType.WRITE) as tx:
                tx.query(
                    'insert $ms isa measurement, '
                    f'has measurement_id "{meta["measurement_id"]}", '
                    f'has file_id "{meta["file_id"]}", '
                    f'has sheet_id "{meta["sheet_id"]}", '
                    f'has measure_type "{_esc(meta.get("type", ""))}", '
                    f'has geometry_json "{_esc(json.dumps(meta.get("geometry"), ensure_ascii=False))}", '
                    f'has measure_value {float(meta.get("value") or 0)}, '
                    f'has measure_unit "{_esc(meta.get("unit", ""))}", '
                    f'has created_at {meta["created_at"]};'
                ).resolve()
                tx.commit()
        except Exception as e:  # noqa: BLE001
            logger.error("typedb add_measurement: %s", e)
        _MIRROR.add_measurement(meta)

    def list_measurements(self, file_id: str, sheet_id: str) -> list:
        return _MIRROR.list_measurements(file_id, sheet_id)

    def delete_measurement(self, measurement_id: str) -> bool:
        try:
            from typedb.driver import TransactionType
            with self._driver.transaction(self._db, TransactionType.WRITE) as tx:
                tx.query(
                    f'match $ms isa measurement, has measurement_id "{measurement_id}"; delete $ms isa measurement;'
                ).resolve()
                tx.commit()
        except Exception as e:  # noqa: BLE001
            logger.error("typedb delete_measurement: %s", e)
        return _MIRROR.delete_measurement(measurement_id)

    # --- S5: 이슈 — best-effort 그래프 적재 + JSON 미러 SoT(직접쿼리화는 후속) ---
    def add_issue(self, meta: dict) -> None:
        try:
            from typedb.driver import TransactionType
            with self._driver.transaction(self._db, TransactionType.WRITE) as tx:
                tx.query(
                    'insert $i isa issue, '
                    f'has issue_id "{meta["issue_id"]}", '
                    f'has file_id "{_esc(meta.get("file_id") or "")}", '
                    f'has sheet_id "{_esc(meta.get("sheet_id") or "")}", '
                    f'has issue_title "{_esc(meta.get("title", ""))}", '
                    f'has issue_type "{_esc(meta.get("type", ""))}", '
                    f'has issue_status "{_esc(meta.get("status", ""))}", '
                    f'has issue_category "{_esc(meta.get("category", ""))}", '
                    f'has issue_assignee "{_esc(meta.get("assignee", ""))}", '
                    f'has geometry_json "{_esc(json.dumps(meta.get("pin"), ensure_ascii=False))}", '
                    f'has created_at {meta["created_at"]};'
                ).resolve()
                tx.commit()
        except Exception as e:  # noqa: BLE001
            logger.error("typedb add_issue: %s", e)
        _MIRROR.add_issue(meta)

    def list_issues(self, *, file_id=None, sheet_id=None, status=None,
                    category=None, project_name=None) -> list:
        return _MIRROR.list_issues(file_id=file_id, sheet_id=sheet_id, status=status,
                                   category=category, project_name=project_name)

    def get_issue(self, issue_id: str) -> Optional[dict]:
        return _MIRROR.get_issue(issue_id)

    def update_issue(self, issue_id: str, **fields) -> Optional[dict]:
        # 상태/속성 변경은 미러 권위. 그래프 status 동기화는 best-effort.
        if "status" in fields and fields["status"]:
            try:
                from typedb.driver import TransactionType
                with self._driver.transaction(self._db, TransactionType.WRITE) as tx:
                    tx.query(
                        f'match $i isa issue, has issue_id "{issue_id}"; '
                        '$i has issue_status $s; '
                        f'delete $i has $s; insert $i has issue_status "{_esc(fields["status"])}";'
                    ).resolve()
                    tx.commit()
            except Exception as e:  # noqa: BLE001
                logger.error("typedb update_issue: %s", e)
        return _MIRROR.update_issue(issue_id, **fields)

    def delete_issue(self, issue_id: str) -> bool:
        return self.update_issue(issue_id, status="삭제됨") is not None

    # --- S7: 구성원·프로젝트·역할·현재 사용자 — JSON 미러 SoT(직접쿼리화는 후속) ---
    def list_members(self) -> list:
        return _MIRROR.list_members()

    def get_member(self, member_id: str) -> Optional[dict]:
        return _MIRROR.get_member(member_id)

    def add_member(self, meta: dict) -> None:
        _MIRROR.add_member(meta)

    def list_projects(self) -> list:
        return _MIRROR.list_projects()

    def add_project(self, meta: dict) -> None:
        _MIRROR.add_project(meta)

    def remove_project(self, project_id: str) -> Optional[dict]:
        return _MIRROR.remove_project(project_id)

    def list_project_members(self, project_name: str) -> list:
        return _MIRROR.list_project_members(project_name)

    def get_project_member(self, project_name: str, member_id: str) -> Optional[dict]:
        return _MIRROR.get_project_member(project_name, member_id)

    def add_project_member(self, meta: dict) -> None:
        _MIRROR.add_project_member(meta)

    def update_project_member(self, project_name: str, member_id: str, **fields) -> Optional[dict]:
        return _MIRROR.update_project_member(project_name, member_id, **fields)

    def remove_project_member(self, project_name: str, member_id: str) -> bool:
        return _MIRROR.remove_project_member(project_name, member_id)

    def get_current_user(self) -> Optional[str]:
        return _MIRROR.get_current_user()

    def set_current_user(self, member_id: str) -> None:
        _MIRROR.set_current_user(member_id)

    # --- S9: 작업(Tasks) — JSON 미러 SoT(직접쿼리화는 후속) ---
    def add_task(self, meta: dict) -> None:
        _MIRROR.add_task(meta)

    def list_tasks(self, *, project_name=None, status=None, assignee=None) -> list:
        return _MIRROR.list_tasks(project_name=project_name, status=status, assignee=assignee)

    def get_task(self, task_id: str) -> Optional[dict]:
        return _MIRROR.get_task(task_id)

    def update_task(self, task_id: str, **fields) -> Optional[dict]:
        return _MIRROR.update_task(task_id, **fields)

    def delete_task(self, task_id: str) -> bool:
        return _MIRROR.delete_task(task_id)

    # --- S9.1: 양식(Forms) — JSON 미러 SoT ---
    def add_form(self, meta: dict) -> None:
        _MIRROR.add_form(meta)

    def list_forms(self, *, project_name=None, status=None, form_type=None) -> list:
        return _MIRROR.list_forms(project_name=project_name, status=status, form_type=form_type)

    def get_form(self, form_id: str) -> Optional[dict]:
        return _MIRROR.get_form(form_id)

    def update_form(self, form_id: str, **fields) -> Optional[dict]:
        return _MIRROR.update_form(form_id, **fields)

    def delete_form(self, form_id: str) -> bool:
        return _MIRROR.delete_form(form_id)

    # --- S9.2: 사진(Photos) — JSON 미러 SoT ---
    def add_photo(self, meta: dict) -> None:
        _MIRROR.add_photo(meta)

    def list_photos(self, *, project_name=None, sheet_id=None) -> list:
        return _MIRROR.list_photos(project_name=project_name, sheet_id=sheet_id)

    def get_photo(self, photo_id: str) -> Optional[dict]:
        return _MIRROR.get_photo(photo_id)

    def update_photo(self, photo_id: str, **fields) -> Optional[dict]:
        return _MIRROR.update_photo(photo_id, **fields)

    def delete_photo(self, photo_id: str) -> bool:
        return _MIRROR.delete_photo(photo_id)

    # --- S9.3: 프로젝트 템플릿 — JSON 미러 SoT ---
    def list_templates(self) -> list:
        return _MIRROR.list_templates()

    def add_template(self, meta: dict) -> None:
        _MIRROR.add_template(meta)

    def get_template(self, template_id: str) -> Optional[dict]:
        return _MIRROR.get_template(template_id)

    def delete_template(self, template_id: str) -> bool:
        return _MIRROR.delete_template(template_id)

    # --- S14: 발행분·시트소스 — JSON 미러 SoT 위임(직접쿼리화는 후속, prompts/19 freeze) ---
    def add_package(self, meta: dict) -> None:
        _MIRROR.add_package(meta)

    def get_package(self, package_id: str) -> Optional[dict]:
        return _MIRROR.get_package(package_id)

    def list_packages(self, *, project_name=None) -> list:
        return _MIRROR.list_packages(project_name=project_name)

    def update_package(self, package_id: str, **fields) -> Optional[dict]:
        return _MIRROR.update_package(package_id, **fields)

    def add_sheet_source(self, meta: dict) -> None:
        _MIRROR.add_sheet_source(meta)

    def get_sheet_source(self, link_id: str) -> Optional[dict]:
        return _MIRROR.get_sheet_source(link_id)

    def list_sheet_sources(self, *, project_name=None, package_id=None, sheet_key=None,
                           pdf_file_id=None, sheet_id=None) -> list:
        return _MIRROR.list_sheet_sources(
            project_name=project_name, package_id=package_id, sheet_key=sheet_key,
            pdf_file_id=pdf_file_id, sheet_id=sheet_id)

    def update_sheet_source(self, link_id: str, **fields) -> Optional[dict]:
        return _MIRROR.update_sheet_source(link_id, **fields)

    def next_rev(self, sheet_key: str, project_name: Optional[str] = None) -> str:
        return _MIRROR.next_rev(sheet_key, project_name=project_name)

    def issue_sheet_key(self, *, project_name, version_set_id, sheet_number, sheet_index=0):
        return _MIRROR.issue_sheet_key(
            project_name=project_name, version_set_id=version_set_id,
            sheet_number=sheet_number, sheet_index=sheet_index)

    def resolve_sheet_key(self, *, project_name, version_set_id, sheet_number, sheet_index=0):
        return _MIRROR.resolve_sheet_key(
            project_name=project_name, version_set_id=version_set_id,
            sheet_number=sheet_number, sheet_index=sheet_index)

    def get_sheet_key(self, sheet_key: str) -> Optional[dict]:
        return _MIRROR.get_sheet_key(sheet_key)

    def list_sheet_keys(self, *, project_name=None) -> dict:
        return _MIRROR.list_sheet_keys(project_name=project_name)

    def upsert_sheet_meta(self, *, sheet_key, project_name, file_id, sheet_index, sheet_id,
                          source_kind, content_hash, text_index, tags,
                          summary=None, conflicts=None, extractor=None) -> dict:
        return _MIRROR.upsert_sheet_meta(
            sheet_key=sheet_key, project_name=project_name, file_id=file_id,
            sheet_index=sheet_index, sheet_id=sheet_id, source_kind=source_kind,
            content_hash=content_hash, text_index=text_index, tags=tags,
            summary=summary, conflicts=conflicts, extractor=extractor)

    def get_sheet_meta(self, meta_id: str) -> Optional[dict]:
        return _MIRROR.get_sheet_meta(meta_id)

    def list_sheet_meta(self, *, project_name=None, sheet_key=None, file_id=None,
                        sheet_id=None, current_only=False) -> list:
        return _MIRROR.list_sheet_meta(
            project_name=project_name, sheet_key=sheet_key, file_id=file_id,
            sheet_id=sheet_id, current_only=current_only)


def _sheet_label(sheet_number: str, sheet_index: int) -> str:
    """시트 정체성 라벨. sheet_number(번호)가 정체성이며, 위치(index)에 독립적이라
    rev가 올라가며 순서가 바뀌어도 계승된다. 빈 번호만 위치로 폴백(계승 불가한 퇴화 케이스)."""
    num = (sheet_number or "").strip()
    return num if num else f"idx:{sheet_index}"


_REV_SEQ = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def _rev_to_index(rev: str) -> int:
    """리비전 라벨 → 0-기반 인덱스(A=0 … Z=25, AA=26 …). 비정상 라벨은 -1."""
    r = (rev or "").strip().upper()
    if not r or any(c not in _REV_SEQ for c in r):
        return -1
    idx = 0
    for c in r:
        idx = idx * 26 + (_REV_SEQ.index(c) + 1)
    return idx - 1


def _index_to_rev(idx: int) -> str:
    """0-기반 인덱스 → 리비전 라벨(스프레드시트식 A…Z, AA…)."""
    if idx < 0:
        idx = 0
    out = ""
    idx += 1
    while idx > 0:
        idx, rem = divmod(idx - 1, 26)
        out = _REV_SEQ[rem] + out
    return out


def _esc(s: str) -> str:
    return str(s).replace("\\", "/").replace('"', "'")


def _in_set(row: dict, version_set_id: str) -> bool:
    """버전세트 멤버십. 레거시(version_set_id 없음) base는 file_id==vset로 매칭."""
    return (row.get("version_set_id") or row.get("file_id")) == version_set_id


# TypeDB 모드에서도 시트/조회 편의를 위해 JSON 미러를 함께 유지(메타 SoT는 JSON).
_MIRROR = JsonDrawingStore()


# 요청마다 새 인스턴스를 만들면 인스턴스별 Lock이 상호배제를 못 해 동시 업로드가
# _index.json을 손상시킨다(검증 BLOCKER-1). 단일 싱글톤으로 Lock과 상태를 공유한다.
_store_singleton: Optional[DrawingStore] = None


def get_store() -> DrawingStore:
    global _store_singleton
    if _store_singleton is not None:
        return _store_singleton
    backend = config.STORE_BACKEND
    chosen: Optional[DrawingStore] = None
    if backend in ("typedb", "auto"):
        try:
            chosen = TypeDBDrawingStore()
        except Exception as e:  # noqa: BLE001
            if backend == "typedb":
                raise
            logger.warning("TypeDB unavailable, falling back to JSON store: %s", e)
    if chosen is None:
        chosen = JsonDrawingStore()
    _store_singleton = chosen
    return _store_singleton
