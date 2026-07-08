"""S15 단계2 — 기존 도면 전 시트에 sheet_key 소급 발급(멱등).

발급 규칙은 store.issue_sheet_key와 동일(변환 완료 경로와 같은 유일 권위).
변환 완료(sheets 존재) 도면의 모든 버전을 훑어 시트마다 get-or-create.
(project_name, version_set_id, sheet_number)이 정체성이므로 같은 도면의
여러 버전·재실행에서 계승 → 2회 실행해도 신규 발급 0(멱등).

사용:
    backend/.venv/Scripts/python.exe scripts/migrate_sheet_keys.py
    XD_STORE=json backend/.venv/Scripts/python.exe scripts/migrate_sheet_keys.py --project "LS 청주사업장"
"""
import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from sheet_indexing import index_drawing  # noqa: E402
from store import get_store  # noqa: E402


def migrate(project_name: str | None = None, store=None) -> dict:
    store = store or get_store()
    before = len(store.list_sheet_keys())
    files = 0
    sheets = 0
    for row in store.list_drawings(project_name):
        if row.get("conversion_status") != "completed" or not (row.get("sheets") or []):
            continue
        files += 1
        # sheet_key 발급/계승 + 규칙 추출본(text_index·태그) 적재 — 변환 경로와 동일 색인.
        sheets += index_drawing(store, row["file_id"])
    after = len(store.list_sheet_keys())
    return {"backend": store.backend_name, "files": files, "sheets": sheets,
            "keys_before": before, "keys_after": after, "newly_issued": after - before}


def main() -> None:
    ap = argparse.ArgumentParser(description="기존 도면에 sheet_key 소급 발급(멱등)")
    ap.add_argument("--project", default=None, help="특정 프로젝트만 (기본: 전체)")
    args = ap.parse_args()
    r = migrate(args.project)
    print(f"[migrate_sheet_keys] store={r['backend']} "
          f"files={r['files']} sheets={r['sheets']} "
          f"keys {r['keys_before']}->{r['keys_after']} (newly_issued {r['newly_issued']})")
    if r["newly_issued"] == 0 and r["keys_after"] > 0:
        print("  idempotent OK - no new keys (already migrated).")


if __name__ == "__main__":
    main()
