"""S15 단계2: 소급 마이그레이션 스크립트 — 멱등(O3) + 버전 간 키 공유.

prompts/20 O3: 기존 도면 소급 마이그레이션 완료, 2회 실행 시 키 diff 0.
"""
import importlib
import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # backend/
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))

import config  # noqa: E402


def _drawing(file_id, project, vset, numbers):
    return {
        "file_id": file_id, "filename": f"{file_id}.pdf", "project_name": project,
        "version_set_id": vset, "conversion_status": "completed",
        "sheets": [{"sheet_id": f"{file_id}_s{i}", "sheet_index": i, "sheet_number": n}
                   for i, n in enumerate(numbers)],
    }


def test_migration_idempotent_and_versions_share_keys(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "UPLOADS_DIR", tmp_path)
    monkeypatch.setattr(config, "STORE_BACKEND", "json")
    import store as store_mod
    importlib.reload(store_mod)
    s = store_mod.JsonDrawingStore()
    # 같은 도면(vs1)의 두 버전 + 다른 도면(vs2) + 미완료(스킵) + 시트없음(스킵).
    s.add_drawing(_drawing("F1", "P", "vs1", ["EE-01-000", "EE-01-001"]))
    s.add_drawing(_drawing("F2", "P", "vs1", ["EE-01-000", "EE-01-001"]))  # vs1의 새 버전
    s.add_drawing(_drawing("F3", "P", "vs2", ["EE-02-000"]))
    s.add_drawing({"file_id": "F4", "project_name": "P", "version_set_id": "vs3",
                   "conversion_status": "converting", "sheets": []})

    import migrate_sheet_keys
    importlib.reload(migrate_sheet_keys)

    r1 = migrate_sheet_keys.migrate(store=s)
    # vs1(2시트) 계승 공유 + vs2(1시트) = 고유 키 3개.
    assert r1["newly_issued"] == 3
    assert r1["keys_after"] == 3
    assert r1["files"] == 3   # F4(미완료) 제외

    r2 = migrate_sheet_keys.migrate(store=s)   # O3: 2회차 멱등
    assert r2["newly_issued"] == 0
    assert r2["keys_after"] == 3

    # 버전 간 공유: F1·F2의 같은 번호는 동일 sheet_key.
    k_f1_000 = s.resolve_sheet_key(project_name="P", version_set_id="vs1",
                                   sheet_number="EE-01-000")
    k_f2_000 = s.resolve_sheet_key(project_name="P", version_set_id="vs1",
                                   sheet_number="EE-01-000")
    assert k_f1_000 == k_f2_000 is not None
