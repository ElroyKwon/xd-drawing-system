"""B3 소급 — file_id+sheet_id 는 있으나 sheet_key 가 없는 기존 이슈에 sheet_key 부여(멱등).

발급 규칙은 routes_issue 의 create 경로와 동일(store.resolve_sheet_key / issue_sheet_key).
(project_name, version_set_id, 시트라벨)이 정체성이므로 재실행해도 신규 발급 0(멱등).
sheet_key 는 update_issue 화이트리스트 밖(불변)이라, 신뢰된 마이그레이션은 레코드를 통째
다시 적재(add_issue)해 심는다.

사용:
    backend/.venv/Scripts/python.exe scripts/backfill_issue_sheet_keys.py
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from store import get_store  # noqa: E402


def _resolve(store, row: dict, sheet_id: str):
    sheet = next((s for s in (row.get("sheets") or []) if s.get("sheet_id") == sheet_id), None)
    if sheet is None:
        return None
    project_name = row.get("project_name")
    version_set_id = row.get("version_set_id") or row.get("file_id")
    sheet_number = sheet.get("sheet_number", "")
    sheet_index = sheet.get("sheet_index", 0)
    key = store.resolve_sheet_key(
        project_name=project_name, version_set_id=version_set_id,
        sheet_number=sheet_number, sheet_index=sheet_index)
    if key is None:
        key = store.issue_sheet_key(
            project_name=project_name, version_set_id=version_set_id,
            sheet_number=sheet_number, sheet_index=sheet_index)
    return key


def backfill(store=None) -> dict:
    store = store or get_store()
    scanned = updated = skipped = 0
    for issue in store.list_issues():
        file_id = issue.get("file_id")
        sheet_id = issue.get("sheet_id")
        if not file_id or not sheet_id:
            continue           # 전역/핀 없는 이슈 — 대상 아님
        if issue.get("sheet_key"):
            skipped += 1
            continue           # 이미 계승 — 멱등
        scanned += 1
        row = store.get_drawing(file_id)
        if not row:
            continue           # 도면 유실 — 건너뜀(정직: 강제 발급 안 함)
        key = _resolve(store, row, sheet_id)
        if not key:
            continue
        issue["sheet_key"] = key
        store.add_issue(issue)  # 레코드 통째 재적재(sheet_key 불변 우회 = 신뢰된 마이그레이션)
        updated += 1
    return {"backend": store.backend_name, "scanned": scanned,
            "updated": updated, "already": skipped}


def main() -> None:
    r = backfill()
    print(f"[backfill_issue_sheet_keys] store={r['backend']} "
          f"scanned={r['scanned']} updated={r['updated']} already={r['already']}")
    if r["updated"] == 0:
        print("  idempotent OK - no issue needed a sheet_key.")


if __name__ == "__main__":
    main()
