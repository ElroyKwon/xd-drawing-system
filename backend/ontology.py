"""XD 온톨로지 스토어 (S10) — equipment + 시트 바인딩.

TypeDB가 equipment/binding의 SoT(권위). 조회는 **실제 TypeDB READ 쿼리**(ConceptRow 파싱).
TypeDB 미가동 시 JSON 미러(`uploads/_ontology.json`)로 우아 폴백.
도면 메타(file/sheet)는 기존대로 JSON 미러 권위 — equipment만 TypeDB 권위(무파괴).
"""
from __future__ import annotations

import json
import logging
import os
import threading
from pathlib import Path
from typing import Optional

import config

logger = logging.getLogger(__name__)

_MIRROR_PATH = Path(config.UPLOADS_DIR) / "_ontology.json"
_SCHEMA_PATH = Path(config.BACKEND_DIR) / "schema" / "05-ontology.tql"
_lock = threading.Lock()


def _esc(s) -> str:
    return str(s).replace("\\", "/").replace('"', "'")


def _norm_tag(tag: str) -> str:
    """추출 태그 집계/충돌 키 — 대문자·공백제거만. OCR 혼동 접기(O↔0 등)는 하지 않는다:
    서로 다른 설비(PL-1 vs PI-1)를 붕괴시켜 유실하는 것을 막기 위함(sheet_merge 손실방지 원칙)."""
    return "".join((tag or "").upper().split())


class OntologyStore:
    def __init__(self):
        self._driver = None
        self._db = config.TYPEDB_DB
        # 안정성: TypeDB Python 드라이버가 이 Windows 호스트에서 간헐적으로
        # "overflow subtracting durations" 패닉(프로세스 abort, Python 미포착)을 낸다.
        # 8000 서버는 기본적으로 TypeDB에 직접 연결하지 않고 **JSON 미러**(add_equipment가
        # TypeDB와 동시 기록 → 항상 동기)에서 읽어 크래시를 원천 차단한다. 시드/적재 등
        # TypeDB 권위 쓰기가 필요한 프로세스만 XD_ONTOLOGY_DIRECT_TYPEDB=1로 직접 연결한다.
        if os.environ.get("XD_ONTOLOGY_DIRECT_TYPEDB") != "1":
            logger.info("Ontology: 미러 읽기 모드(서버 안정성 — TypeDB 직접연결 비활성)")
            self._driver = None
            return
        # 기존 store가 TypeDB 드라이버를 이미 열었으면 **재사용**(2개 native 연결 시 드라이버
        # 패닉 "overflow subtracting durations" 회피). 없으면 자체 연결.
        try:
            from store import get_store  # noqa: E402
            s = get_store()
            shared = getattr(s, "_driver", None)
            if getattr(s, "backend_name", "") == "typedb" and shared is not None:
                self._driver = shared
                self._ensure_schema()
                logger.info("Ontology: store TypeDB 드라이버 재사용 (%s)", self._db)
                return
        except Exception as e:  # noqa: BLE001
            logger.warning("Ontology: store 드라이버 재사용 실패, 자체 연결 시도: %s", e)
        try:
            from typedb.driver import TypeDB, Credentials, DriverOptions  # type: ignore
            self._driver = TypeDB.driver(
                config.TYPEDB_ADDR, Credentials("admin", "password"),
                DriverOptions(is_tls_enabled=False),
            )
            self._ensure_schema()
            logger.info("Ontology: TypeDB 자체 연결 (%s/%s)", config.TYPEDB_ADDR, self._db)
        except Exception as e:  # noqa: BLE001
            logger.warning("Ontology: TypeDB 미가동 → JSON 미러 폴백: %s", e)
            self._driver = None

    @property
    def backend(self) -> str:
        return "typedb" if self._driver else "json"

    def _ensure_schema(self):
        from typedb.driver import TransactionType  # type: ignore
        schema = _SCHEMA_PATH.read_text(encoding="utf-8")
        with self._driver.transaction(self._db, TransactionType.SCHEMA) as tx:
            tx.query(schema).resolve()
            tx.commit()

    # ── JSON 미러 ──────────────────────────────────────────────
    def _read_mirror(self) -> dict:
        if _MIRROR_PATH.exists():
            try:
                return json.loads(_MIRROR_PATH.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                pass
        return {"equipment": []}

    def _write_mirror(self, data: dict):
        _MIRROR_PATH.parent.mkdir(parents=True, exist_ok=True)
        tmp = _MIRROR_PATH.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(tmp, _MIRROR_PATH)

    # ── 쓰기 ───────────────────────────────────────────────────
    def add_equipment(self, project: str, equip: dict, sheet_ids: Optional[list] = None) -> dict:
        """equipment 1건 적재 + 시트 바인딩(appears_on). TypeDB write + JSON 미러."""
        sheet_ids = list(sheet_ids or [])
        eid = equip["equipment_id"]
        rec = {
            "equipment_id": eid, "tag": equip.get("tag", ""), "name": equip.get("name", ""),
            "type": equip.get("type", ""), "status": equip.get("status", "ACTIVE"),
            "discipline": equip.get("discipline", ""), "project_name": project,
            "sheet_ids": sheet_ids,
        }
        if self._driver:
            from typedb.driver import TransactionType  # type: ignore
            with self._driver.transaction(self._db, TransactionType.WRITE) as tx:
                # 멱등: 기존 동일 id 제거 후 재삽입.
                tx.query(f'match $e isa equipment, has equipment_id "{_esc(eid)}"; delete $e;').resolve()
                tx.query(
                    'insert $e isa equipment, '
                    f'has equipment_id "{_esc(eid)}", has equip_tag "{_esc(rec["tag"])}", '
                    f'has equip_name "{_esc(rec["name"])}", has equip_type "{_esc(rec["type"])}", '
                    f'has equip_status "{_esc(rec["status"])}", has equip_discipline "{_esc(rec["discipline"])}", '
                    f'has project_name "{_esc(project)}";'
                ).resolve()
                for sid in sheet_ids:
                    # drawing_sheet는 JSON 미러 권위 → TypeDB엔 없을 수 있다. put으로 스텁 보장 후 바인딩.
                    tx.query(f'put $s isa drawing_sheet, has sheet_id "{_esc(sid)}";').resolve()
                    tx.query(
                        f'match $e isa equipment, has equipment_id "{_esc(eid)}"; '
                        f'$s isa drawing_sheet, has sheet_id "{_esc(sid)}"; '
                        'insert (equip: $e, on_sheet: $s) isa appears_on;'
                    ).resolve()
                tx.commit()
        with _lock:
            data = self._read_mirror()
            data["equipment"] = [e for e in data["equipment"] if e["equipment_id"] != eid]
            data["equipment"].append(rec)
            self._write_mirror(data)
        return rec

    def clear_project(self, project: str) -> int:
        """프로젝트 equipment 전체 삭제(멱등 시드용). 반환=삭제 수."""
        removed = 0
        if self._driver:
            from typedb.driver import TransactionType  # type: ignore
            with self._driver.transaction(self._db, TransactionType.WRITE) as tx:
                tx.query(f'match $e isa equipment, has project_name "{_esc(project)}"; delete $e;').resolve()
                tx.commit()
        with _lock:
            data = self._read_mirror()
            before = len(data["equipment"])
            data["equipment"] = [e for e in data["equipment"] if e["project_name"] != project]
            removed = before - len(data["equipment"])
            self._write_mirror(data)
        return removed

    # ── 조회(TypeDB READ 쿼리) ─────────────────────────────────
    def _query_equipment(self, project: str) -> list:
        from typedb.driver import TransactionType  # type: ignore
        with self._driver.transaction(self._db, TransactionType.READ) as tx:
            base = {}
            ans = tx.query(
                f'match $e isa equipment, has project_name "{_esc(project)}", '
                'has equipment_id $id, has equip_tag $t, has equip_name $n, '
                'has equip_type $ty, has equip_status $st, has equip_discipline $d; '
                'select $id, $t, $n, $ty, $st, $d;'
            ).resolve()
            for r in ans:
                eid = r.get("id").get_string()
                base[eid] = {
                    "equipment_id": eid, "tag": r.get("t").get_string(),
                    "name": r.get("n").get_string(), "type": r.get("ty").get_string(),
                    "status": r.get("st").get_string(), "discipline": r.get("d").get_string(),
                    "project_name": project, "sheet_ids": [],
                }
            # 바인딩(appears_on) 매핑.
            binds = tx.query(
                f'match $e isa equipment, has project_name "{_esc(project)}", has equipment_id $id; '
                '(equip: $e, on_sheet: $s) isa appears_on; $s has sheet_id $sid; '
                'select $id, $sid;'
            ).resolve()
            for r in binds:
                eid = r.get("id").get_string()
                if eid in base:
                    base[eid]["sheet_ids"].append(r.get("sid").get_string())
        return list(base.values())

    def _extracted_overlay(self, project: str, sheet_id: Optional[str] = None) -> list:
        """S15 단계10 — 업로드 추출 태그(_sheet_meta.json, is_current)를 equipment 표면으로
        승격. **read-time overlay**(TypeDB 원칙 LOCKED: 추출 SoT는 내부 JSON, TypeDB 미기록).
        TypeDB on/off 무관하게 동작한다. origin="extracted" + confidence/src 로 curated 와 구분."""
        try:
            from store import get_store  # lazy — 순환 import 회피
            metas = get_store().list_sheet_meta(project_name=project, current_only=True)
        except Exception as e:  # noqa: BLE001
            logger.warning("추출 태그 overlay 조회 실패: %s", e)
            return []
        agg: dict = {}
        for m in metas:
            sid = m.get("sheet_id", "")
            if sheet_id and sid != sheet_id:
                continue
            for t in (m.get("tags") or []):
                tag = t.get("tag", "")
                if not tag:
                    continue
                key = _norm_tag(tag)
                conf = float(t.get("confidence", 0.0))
                rec = agg.get(key)
                if rec is None:
                    agg[key] = rec = {
                        "equipment_id": f"ex_{key}", "tag": tag, "name": "",
                        "type": t.get("type", ""), "status": "", "discipline": "",
                        "project_name": project, "sheet_ids": [],
                        "origin": "extracted", "confidence": conf, "src": t.get("src", ""),
                    }
                elif conf > rec["confidence"]:  # 대표는 고신뢰 표기.
                    rec.update(tag=tag, confidence=conf, src=t.get("src", ""),
                               type=t.get("type", "") or rec["type"])
                if sid and sid not in rec["sheet_ids"]:
                    rec["sheet_ids"].append(sid)
        return list(agg.values())

    def list_equipment(self, project: str, sheet_id: Optional[str] = None,
                       include_extracted: bool = True) -> list:
        if self._driver:
            try:
                items = self._query_equipment(project)
            except Exception as e:  # noqa: BLE001
                logger.error("ontology TypeDB read 실패 → 미러 폴백: %s", e)
                items = [e for e in self._read_mirror()["equipment"] if e["project_name"] == project]
        else:
            items = [e for e in self._read_mirror()["equipment"] if e["project_name"] == project]
        if sheet_id:
            items = [e for e in items if sheet_id in e.get("sheet_ids", [])]
        for e in items:
            e.setdefault("origin", "curated")  # 수동 시드 = 고신뢰 curated overlay(D 정신).
        if include_extracted:
            curated_norm = {_norm_tag(e.get("tag", "")) for e in items if e.get("tag")}
            for ex in self._extracted_overlay(project, sheet_id):
                if _norm_tag(ex["tag"]) in curated_norm:
                    continue  # curated 가 권위 — 같은 표기 추출본은 흡수(중복 방지).
                items.append(ex)
        items.sort(key=lambda e: e.get("tag", ""))
        return items

    def get_equipment(self, equipment_id: str) -> Optional[dict]:
        # 미러로 프로젝트 역인덱스(단건 조회 편의) 후 TypeDB 쿼리 결과와 합치.
        for e in self._read_mirror()["equipment"]:
            if e["equipment_id"] == equipment_id:
                if self._driver:
                    try:
                        for q in self._query_equipment(e["project_name"]):
                            if q["equipment_id"] == equipment_id:
                                return q
                    except Exception:  # noqa: BLE001
                        pass
                return e
        return None


_singleton: Optional[OntologyStore] = None


def get_ontology() -> OntologyStore:
    global _singleton
    if _singleton is None:
        _singleton = OntologyStore()
    return _singleton
