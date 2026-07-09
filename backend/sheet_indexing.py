"""S15 — 시트 색인(공용): sheet_key 발급/계승 + 규칙 트랙 추출 → sheet_meta 이력 적재.

변환 완료(routes_drawing)와 소급 마이그레이션(scripts/migrate_sheet_keys)이 같은 경로를 쓴다.
egress 0(규칙 트랙만). 실패는 변환을 막지 않는다(정직: 태그 0으로 적재).
"""
from __future__ import annotations

import hashlib
import logging

import config
import rule_extract

logger = logging.getLogger(__name__)


def _llm_augment(extracted: dict, file_id: str, sheet_id: str) -> dict:
    """XD_EXTRACT_LLM=1 일 때만 8002 사이드카에 규칙 결과를 보내 병합받는다(D8).

    localhost 사이드카 오케스트레이션(외부 egress 아님). 8002 미기동·오류는 삼키고
    규칙 결과를 그대로 쓴다(정직: 사이드카 없이도 정상). 기본 off 경로는 이 함수 미호출.
    """
    if not config.EXTRACT_LLM:
        return extracted
    try:
        import httpx  # lazy — 기본 off 경로는 httpx 의존조차 없다.

        file_url = f"{config.SELF_BASE_URL}/api/drawings/{file_id}/file" if file_id else None
        resp = httpx.post(
            f"http://{config.EXTRACT_ADDR}/extract",
            json={
                "file_url": file_url,
                "source_kind": extracted.get("source_kind", ""),
                "rule_tags": extracted.get("tags", []),
                "text_index": extracted.get("text_index", ""),
            },
            timeout=30.0,
        )
        resp.raise_for_status()
        merged = resp.json()
        return {
            "text_index": extracted.get("text_index", ""),
            "source_kind": extracted.get("source_kind", ""),
            "tags": merged.get("tags", extracted.get("tags", [])),
            "summary": merged.get("summary"),
            "conflicts": merged.get("conflicts", []),
            "extractor": merged.get("extractor"),
        }
    except Exception as e:  # noqa: BLE001 — 사이드카 실패는 변환/색인을 막지 않는다.
        logger.warning("8002 추출 사이드카 병합 실패(규칙 결과 유지) %s: %s", sheet_id, e)
        return extracted


def file_content_hash(path: str) -> str:
    h = hashlib.sha256()
    try:
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                h.update(chunk)
    except OSError:
        return ""
    return "sha256:" + h.hexdigest()


def index_drawing(store, file_id: str) -> int:
    """완료된 도면의 전 시트에 sheet_key 발급 + 규칙 추출본 적재. 색인한 시트 수 반환.
    sheet_key/추출본은 row["sheets"]에 심지 않는다(재변환 소멸) — 외부 JSON 조인."""
    row = store.get_drawing(file_id)
    if not row:
        return 0
    project_name = row.get("project_name")
    version_set_id = row.get("version_set_id") or file_id
    file_path = row.get("file_path")
    file_format = row.get("file_format", "")
    content_hash = file_content_hash(file_path) if file_path else ""
    n = 0
    for s in row.get("sheets", []):
        sheet_index = s.get("sheet_index", 0)
        sheet_key = store.issue_sheet_key(
            project_name=project_name, version_set_id=version_set_id,
            sheet_number=s.get("sheet_number", ""), sheet_index=sheet_index,
        )
        try:
            extracted = rule_extract.extract_rule(
                file_path, file_format, sheet_index=sheet_index,
                layout_name=s.get("sheet_name") if file_format in ("dxf", "dwg") else None,
            )
        except Exception as e:  # noqa: BLE001 — 추출 실패는 변환을 막지 않는다.
            logger.warning("규칙 추출 실패 %s sheet%s: %s", file_id, sheet_index, e)
            extracted = {"text_index": "", "tags": [], "source_kind": file_format}
        extracted = _llm_augment(extracted, file_id, s.get("sheet_id", ""))
        store.upsert_sheet_meta(
            sheet_key=sheet_key, project_name=project_name, file_id=file_id,
            sheet_index=sheet_index, sheet_id=s.get("sheet_id", ""),
            source_kind=extracted["source_kind"], content_hash=content_hash,
            text_index=extracted["text_index"], tags=extracted["tags"],
            summary=extracted.get("summary"), conflicts=extracted.get("conflicts"),
            extractor=extracted.get("extractor"),
        )
        n += 1
    return n
