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
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional

import config

logger = logging.getLogger(__name__)


class DrawingStore(ABC):
    backend_name: str = "abstract"

    @abstractmethod
    def add_drawing(self, meta: dict) -> None: ...

    @abstractmethod
    def get_drawing(self, file_id: str) -> Optional[dict]: ...

    @abstractmethod
    def list_drawings(self, project_name: Optional[str] = None) -> list: ...

    @abstractmethod
    def update_conversion(self, file_id: str, status: str, *,
                          sheets: Optional[list] = None,
                          scan: Optional[dict] = None,
                          error: Optional[str] = None) -> None: ...


class JsonDrawingStore(DrawingStore):
    """uploads/_index.json 단일 인덱스. 단일 프로세스 로컬 개발용."""
    backend_name = "json"

    def __init__(self):
        self._path = Path(config.UPLOADS_DIR) / "_index.json"
        self._lock = threading.Lock()
        if not self._path.exists():
            self._write({})

    def _read(self) -> dict:
        try:
            return json.loads(self._path.read_text(encoding="utf-8"))
        except FileNotFoundError:
            return {}
        except json.JSONDecodeError:
            # 손상 인덱스는 조용히 삼키지 않고 백업해 유실을 가시화한다.
            backup = self._path.with_name(self._path.name + ".corrupt")
            try:
                os.replace(str(self._path), str(backup))
                logger.error("index corrupt → backed up to %s", backup)
            except OSError:
                pass
            return {}

    def _write(self, data: dict) -> None:
        # atomic write: 임시파일에 쓴 뒤 교체(부분 쓰기/lost-update 방지).
        tmp = self._path.with_name(self._path.name + ".tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(str(tmp), str(self._path))

    def add_drawing(self, meta: dict) -> None:
        with self._lock:
            data = self._read()
            data[meta["file_id"]] = meta
            self._write(data)

    def get_drawing(self, file_id: str) -> Optional[dict]:
        return self._read().get(file_id)

    def list_drawings(self, project_name: Optional[str] = None) -> list:
        rows = list(self._read().values())
        if project_name:
            rows = [r for r in rows if r.get("project_name") == project_name]
        rows.sort(key=lambda r: r.get("upload_date", ""), reverse=True)
        return rows

    def update_conversion(self, file_id, status, *, sheets=None, scan=None, error=None):
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
            if error is not None:
                row["error"] = error
            self._write(data)


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

    def list_drawings(self, project_name: Optional[str] = None) -> list:
        return _MIRROR.list_drawings(project_name)

    def update_conversion(self, file_id, status, *, sheets=None, scan=None, error=None):
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
        _MIRROR.update_conversion(file_id, status, sheets=sheets, scan=scan, error=error)


def _esc(s: str) -> str:
    return str(s).replace("\\", "/").replace('"', "'")


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
