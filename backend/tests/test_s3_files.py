"""S3 회귀: 폴더 CRUD + seed-on-create idempotent + 버전세트 + 삭제 + folder 필터."""
import asyncio
import importlib
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # backend/

import config  # noqa: E402


def _fresh_store(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "UPLOADS_DIR", tmp_path)
    import store as store_mod
    importlib.reload(store_mod)
    return store_mod, store_mod.JsonDrawingStore()


def _drawing(file_id, project="P", folder_id=None, vset=None, vno=1, latest=True):
    return {
        "file_id": file_id,
        "filename": f"{file_id}.dwg",
        "file_path": f"/uploads/P/{file_id}/original.dwg",
        "file_format": "dwg",
        "file_size": 10,
        "upload_date": f"2026-06-25T00:00:0{vno}",
        "project_name": project,
        "version": str(vno),
        "version_set_id": vset or file_id,
        "version_no": vno,
        "is_latest": latest,
        "folder_id": folder_id,
        "conversion_status": "completed",
        "sheets": [],
    }


# --- 폴더 seed-on-create ---

def test_default_folders_seeded_once_idempotent(tmp_path, monkeypatch):
    store_mod, s = _fresh_store(tmp_path, monkeypatch)
    first = s.list_folders("P")
    assert len(first) == len(store_mod.DEFAULT_FOLDERS)  # ACC 기본 세트
    names = {f["name"] for f in first}
    assert {"Bids", "Drawings", "Supported files", "PDFs"} <= names
    # PDFs는 Supported files 자식
    pdfs = next(f for f in first if f["name"] == "PDFs")
    sf = next(f for f in first if f["name"] == "Supported files")
    assert pdfs["parent_id"] == sf["folder_id"]
    # 두 번째 호출은 재생성하지 않는다(idempotent).
    second = s.list_folders("P")
    assert len(second) == len(first)
    assert {f["folder_id"] for f in second} == {f["folder_id"] for f in first}


def test_folders_isolated_per_project(tmp_path, monkeypatch):
    _, s = _fresh_store(tmp_path, monkeypatch)
    s.list_folders("P1")
    s.list_folders("P2")
    assert all(f["project_name"] == "P1" for f in s.list_folders("P1"))
    assert all(f["project_name"] == "P2" for f in s.list_folders("P2"))


# --- 폴더 CRUD ---

def test_folder_create_update_delete(tmp_path, monkeypatch):
    _, s = _fresh_store(tmp_path, monkeypatch)
    s.add_folder({
        "folder_id": "fold-1", "project_name": "P", "name": "신규폴더",
        "parent_id": None, "share_status": "비공개", "permissions": [],
        "updated_at": "t", "updated_by": "u",
    })
    assert s.get_folder("fold-1")["name"] == "신규폴더"
    updated = s.update_folder("fold-1", name="이름변경", share_status="프로젝트 공유")
    assert updated["name"] == "이름변경"
    assert updated["share_status"] == "프로젝트 공유"
    assert s.update_folder("does-not-exist", name="x") is None
    assert s.delete_folder("fold-1") is True
    assert s.get_folder("fold-1") is None
    assert s.delete_folder("fold-1") is False


def test_delete_folder_cascades_children_and_resets_drawings(tmp_path, monkeypatch):
    _, s = _fresh_store(tmp_path, monkeypatch)
    s.add_folder({"folder_id": "parent", "project_name": "P", "name": "부모",
                  "parent_id": None, "share_status": "비공개", "permissions": [],
                  "updated_at": "t", "updated_by": "u"})
    s.add_folder({"folder_id": "child", "project_name": "P", "name": "자식",
                  "parent_id": "parent", "share_status": "비공개", "permissions": [],
                  "updated_at": "t", "updated_by": "u"})
    s.add_drawing(_drawing("d1", folder_id="child"))
    assert s.delete_folder("parent") is True
    assert s.get_folder("child") is None  # 하위 폴더도 삭제
    # 소속 도면은 삭제되지 않고 folder_id가 리셋(고아 방지)
    assert s.get_drawing("d1") is not None
    assert s.get_drawing("d1")["folder_id"] is None


# --- 버전세트 ---

def test_version_set_latest_transition(tmp_path, monkeypatch):
    _, s = _fresh_store(tmp_path, monkeypatch)
    s.add_drawing(_drawing("v1", vset="set-A", vno=1, latest=True))
    s.add_version("set-A", _drawing("v2", vset="set-A", vno=2, latest=True))
    # 이전 버전 is_latest 꺼짐, 보관됨
    assert s.get_drawing("v1")["is_latest"] is False
    assert s.get_drawing("v2")["is_latest"] is True
    versions = s.list_versions("set-A")
    assert [v["version_no"] for v in versions] == [2, 1]  # 내림차순
    # latest_only는 최신 1행만
    latest = s.list_drawings("P", latest_only=True)
    assert [r["file_id"] for r in latest] == ["v2"]


def test_list_drawings_folder_filter(tmp_path, monkeypatch):
    _, s = _fresh_store(tmp_path, monkeypatch)
    s.add_drawing(_drawing("a", folder_id="F1"))
    s.add_drawing(_drawing("b", folder_id="F2"))
    s.add_drawing(_drawing("c", folder_id=None))
    assert {r["file_id"] for r in s.list_drawings("P", folder_id="F1")} == {"a"}
    assert {r["file_id"] for r in s.list_drawings("P", folder_id="")} == {"c"}  # 루트(미지정)
    assert {r["file_id"] for r in s.list_drawings("P")} == {"a", "b", "c"}  # 필터 없음


def test_delete_drawing(tmp_path, monkeypatch):
    _, s = _fresh_store(tmp_path, monkeypatch)
    s.add_drawing(_drawing("x"))
    assert s.delete_drawing("x") is True
    assert s.get_drawing("x") is None
    assert s.delete_drawing("x") is False


def test_add_version_on_legacy_base_demotes_and_backfills(tmp_path, monkeypatch):
    """BLOCKER-1 회귀: version_set_id 없는 레거시 base에 버전 추가 시 base가 demote+백필되고 중복 행이 없어야 한다."""
    _, s = _fresh_store(tmp_path, monkeypatch)
    legacy = _drawing("base")
    for k in ("version_set_id", "version_no", "is_latest"):
        legacy.pop(k, None)
    s.add_drawing(legacy)
    # 라우트처럼 vset = base.version_set_id or file_id = "base"
    s.add_version("base", {**_drawing("v2"), "version_set_id": "base", "is_latest": True})
    latest = s.list_drawings("P", latest_only=True)
    assert [r["file_id"] for r in latest] == ["v2"]  # 레거시 base가 중복으로 남지 않음
    base = s.get_drawing("base")
    assert base["is_latest"] is False
    assert base["version_set_id"] == "base"  # 백필됨
    vs = s.list_versions("base")
    assert {v["file_id"] for v in vs} == {"base", "v2"}  # 이력에 base+v2 모두
    assert vs[0]["file_id"] == "v2" and vs[0]["version_no"] == 2


def test_version_no_assigned_by_store(tmp_path, monkeypatch):
    """MAJOR-2 회귀: version_no는 store가 lock 안에서 max+1로 할당 — 연속 추가 시 1,2,3."""
    _, s = _fresh_store(tmp_path, monkeypatch)
    s.add_drawing(_drawing("v1", vset="setX", vno=1))
    s.add_version("setX", {**_drawing("va"), "version_set_id": "setX"})
    s.add_version("setX", {**_drawing("vb"), "version_set_id": "setX"})
    nos = sorted(v["version_no"] for v in s.list_versions("setX"))
    assert nos == [1, 2, 3]
    # 최신은 마지막(version_no=3)만
    assert [r["file_id"] for r in s.list_drawings("P", latest_only=True)] == ["vb"]


def test_legacy_drawing_without_is_latest_counts_as_latest(tmp_path, monkeypatch):
    """버전세트 도입 전 레코드(is_latest 누락)는 latest_only에서 누락되지 않아야 한다."""
    _, s = _fresh_store(tmp_path, monkeypatch)
    legacy = _drawing("old")
    del legacy["is_latest"]
    s.add_drawing(legacy)
    assert [r["file_id"] for r in s.list_drawings("P", latest_only=True)] == ["old"]


# --- folders 라우트(검증/생성) ---

def test_folders_route_create_and_validate(tmp_path, monkeypatch):
    """라우트 핸들러를 직접 호출(TestClient의 httpx 의존 회피)."""
    monkeypatch.setattr(config, "UPLOADS_DIR", tmp_path)
    monkeypatch.setattr(config, "STORE_BACKEND", "json")
    import store as store_mod
    importlib.reload(store_mod)
    import routes_drawing
    importlib.reload(routes_drawing)
    import routes_files as rf
    importlib.reload(rf)
    from fastapi import HTTPException

    # 첫 GET → seed
    folders = asyncio.run(rf.list_folders("P"))
    assert len(folders) >= 9
    # 빈 이름 거부
    with pytest.raises(HTTPException) as e1:
        asyncio.run(rf.create_folder(rf.FolderCreate(project_name="P", name="  ")))
    assert e1.value.status_code == 400
    # 정상 생성
    created = asyncio.run(rf.create_folder(rf.FolderCreate(project_name="P", name="내폴더")))
    fid = created["folder_id"]
    assert created["permissions"]  # 기본 권한 메타 부여
    # PATCH
    patched = asyncio.run(rf.patch_folder(fid, rf.FolderPatch(name="수정폴더")))
    assert patched["name"] == "수정폴더"
    # DELETE 존재 → ok
    assert asyncio.run(rf.delete_folder(fid))["deleted"] == fid
    # DELETE 없음 → 404
    with pytest.raises(HTTPException) as e2:
        asyncio.run(rf.delete_folder(fid))
    assert e2.value.status_code == 404


def test_patch_folder_parent_validation(tmp_path, monkeypatch):
    """MAJOR-3 회귀: PATCH parent_id는 존재·자기참조·순환을 거부해야 한다(create와 대칭)."""
    monkeypatch.setattr(config, "UPLOADS_DIR", tmp_path)
    monkeypatch.setattr(config, "STORE_BACKEND", "json")
    import store as store_mod
    importlib.reload(store_mod)
    import routes_drawing
    importlib.reload(routes_drawing)
    import routes_files as rf
    importlib.reload(rf)
    from fastapi import HTTPException

    a = asyncio.run(rf.create_folder(rf.FolderCreate(project_name="P", name="A")))
    b = asyncio.run(rf.create_folder(rf.FolderCreate(project_name="P", name="B", parent_id=a["folder_id"])))
    # 존재하지 않는 parent → 404
    with pytest.raises(HTTPException) as e1:
        asyncio.run(rf.patch_folder(b["folder_id"], rf.FolderPatch(parent_id="ghost")))
    assert e1.value.status_code == 404
    # 자기 자신 → 400
    with pytest.raises(HTTPException) as e2:
        asyncio.run(rf.patch_folder(a["folder_id"], rf.FolderPatch(parent_id=a["folder_id"])))
    assert e2.value.status_code == 400
    # 순환(A를 자기 후손 B의 하위로) → 400
    with pytest.raises(HTTPException) as e3:
        asyncio.run(rf.patch_folder(a["folder_id"], rf.FolderPatch(parent_id=b["folder_id"])))
    assert e3.value.status_code == 400
    # 정상 이동(B를 루트로) → ok
    moved = asyncio.run(rf.patch_folder(b["folder_id"], rf.FolderPatch(parent_id=None)))
    assert moved["folder_id"] == b["folder_id"]


def test_folder_share_inheritance(tmp_path, monkeypatch):
    """D7 회귀: 파일은 소속 폴더의 share_status를 상속, 폴더 미지정/없음은 비공개."""
    monkeypatch.setattr(config, "UPLOADS_DIR", tmp_path)
    monkeypatch.setattr(config, "STORE_BACKEND", "json")
    import store as store_mod
    importlib.reload(store_mod)
    import routes_drawing as rd
    importlib.reload(rd)
    s = rd.get_store()
    s.add_folder({"folder_id": "shared-f", "project_name": "P", "name": "X", "parent_id": None,
                  "share_status": "프로젝트 공유", "permissions": [], "updated_at": "t", "updated_by": "u"})
    assert rd._folder_share(s, "shared-f") == "프로젝트 공유"
    assert rd._folder_share(s, None) == "비공개"
    assert rd._folder_share(s, "nonexistent") == "비공개"
