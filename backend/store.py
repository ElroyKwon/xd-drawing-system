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

# S3: 폴더/파일 권한 메타 기본값(역할별 접근 레벨). 인증/RBAC 강제는 S7 — 여기선 메타·표시만.
_DEFAULT_PERMISSIONS = [
    {"role": "관리자", "level": "관리"},
    {"role": "편집자", "level": "편집"},
    {"role": "뷰어", "level": "보기"},
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


class JsonDrawingStore(DrawingStore):
    """uploads/_index.json 단일 인덱스. 단일 프로세스 로컬 개발용."""
    backend_name = "json"

    def __init__(self):
        self._path = Path(config.UPLOADS_DIR) / "_index.json"
        self._folders_path = Path(config.UPLOADS_DIR) / "_folders.json"
        self._markups_path = Path(config.UPLOADS_DIR) / "_markups.json"
        self._measurements_path = Path(config.UPLOADS_DIR) / "_measurements.json"
        self._issues_path = Path(config.UPLOADS_DIR) / "_issues.json"
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
