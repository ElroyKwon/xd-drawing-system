"""S15 단계1: 시트 정체성 레지스트리(_sheet_keys.json) — 발급·계승·멱등·격리.

prompts/20 FROZEN 채점 대상:
- O1 변환 완료 시 전 시트에 sheet_key 발급
- O2 같은 시트번호로 새 버전 → sheet_key 계승(동일 키)
- 저장설계: row["sheets"]에 심지 않음(외부 레지스트리 조인)
"""
import importlib
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # backend/

import config  # noqa: E402


def _fresh_store(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "UPLOADS_DIR", tmp_path)
    monkeypatch.setattr(config, "STORE_BACKEND", "json")
    import store as store_mod
    importlib.reload(store_mod)
    return store_mod, store_mod.JsonDrawingStore()


def _issue(s, project, vset, number, index=0):
    return s.issue_sheet_key(project_name=project, version_set_id=vset,
                             sheet_number=number, sheet_index=index)


# --- 발급 + 계승 ---

def test_issue_new_keys_per_sheet(tmp_path, monkeypatch):
    _, s = _fresh_store(tmp_path, monkeypatch)
    k0 = _issue(s, "P", "vs1", "EE-01-000", 0)
    k1 = _issue(s, "P", "vs1", "EE-01-001", 1)
    assert k0 != k1
    assert set(s.list_sheet_keys().keys()) == {k0, k1}
    assert s.get_sheet_key(k0)["sheet_number"] == "EE-01-000"


def test_reissue_same_tuple_is_idempotent(tmp_path, monkeypatch):
    _, s = _fresh_store(tmp_path, monkeypatch)
    k = _issue(s, "P", "vs1", "EE-01-000", 0)
    again = _issue(s, "P", "vs1", "EE-01-000", 0)   # 재변환(같은 파일)
    assert again == k
    assert len(s.list_sheet_keys()) == 1


def test_key_inherited_across_versions(tmp_path, monkeypatch):
    # O2: 같은 version_set의 같은 시트번호는 rev가 올라가도 동일 키를 계승.
    _, s = _fresh_store(tmp_path, monkeypatch)
    k_v1 = _issue(s, "P", "vs1", "EE-01-016", 3)
    k_v2 = _issue(s, "P", "vs1", "EE-01-016", 3)
    assert k_v2 == k_v1


def test_identity_is_number_not_position(tmp_path, monkeypatch):
    # 순서가 바뀌어도(시트 재배열) 번호가 같으면 계승 — 위치 독립.
    _, s = _fresh_store(tmp_path, monkeypatch)
    k_at_2 = _issue(s, "P", "vs1", "EE-01-016", 2)
    k_at_5 = _issue(s, "P", "vs1", "EE-01-016", 5)
    assert k_at_5 == k_at_2


def test_empty_number_falls_back_to_position(tmp_path, monkeypatch):
    # 빈 시트번호는 위치로 폴백해 각 시트가 별개 키를 받는다(충돌 방지).
    _, s = _fresh_store(tmp_path, monkeypatch)
    k0 = _issue(s, "P", "vs1", "", 0)
    k1 = _issue(s, "P", "vs1", "", 1)
    assert k0 != k1
    assert _issue(s, "P", "vs1", "", 0) == k0   # 재변환 시 위치로 계승


def test_project_and_versionset_isolation(tmp_path, monkeypatch):
    _, s = _fresh_store(tmp_path, monkeypatch)
    k_pA = _issue(s, "A", "vs1", "EE-01-000", 0)
    k_pB = _issue(s, "B", "vs1", "EE-01-000", 0)   # 다른 프로젝트
    k_vs2 = _issue(s, "A", "vs2", "EE-01-000", 0)  # 같은 프로젝트, 다른 도면
    assert len({k_pA, k_pB, k_vs2}) == 3
    assert set(s.list_sheet_keys(project_name="A").keys()) == {k_pA, k_vs2}


def test_resolve_is_read_only(tmp_path, monkeypatch):
    _, s = _fresh_store(tmp_path, monkeypatch)
    assert s.resolve_sheet_key(project_name="P", version_set_id="vs1",
                               sheet_number="EE-01-000") is None
    assert len(s.list_sheet_keys()) == 0   # 조회는 발급하지 않는다
    k = _issue(s, "P", "vs1", "EE-01-000", 0)
    assert s.resolve_sheet_key(project_name="P", version_set_id="vs1",
                               sheet_number="EE-01-000") == k


# --- 변환 완료 훅 배선 ---

def test_run_conversion_issues_keys_for_all_sheets(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "UPLOADS_DIR", tmp_path)
    monkeypatch.setattr(config, "STORE_BACKEND", "json")
    import store as store_mod
    importlib.reload(store_mod)
    import routes_drawing
    importlib.reload(routes_drawing)
    s = routes_drawing.get_store()
    s.add_drawing({
        "file_id": "F1", "filename": "F1.pdf", "project_name": "P",
        "version_set_id": "F1", "conversion_status": "completed",
        "sheets": [
            {"sheet_id": "F1_s0", "sheet_index": 0, "sheet_number": "EE-01-000"},
            {"sheet_id": "F1_s1", "sheet_index": 1, "sheet_number": "EE-01-001"},
        ],
    })
    routes_drawing._issue_sheet_keys(s, "F1")
    keys = s.list_sheet_keys(project_name="P")
    assert len(keys) == 2
    numbers = {v["sheet_number"] for v in keys.values()}
    assert numbers == {"EE-01-000", "EE-01-001"}
    # 저장설계: sheet_key는 row["sheets"]에 심지 않는다.
    row = s.get_drawing("F1")
    assert all("sheet_key" not in sh for sh in row["sheets"])
