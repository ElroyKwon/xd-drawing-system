"""S14: 발행분(Package) + 시트↔DWG 소스 링크 — store CRUD + 라우트 + 매핑/발행/RBAC.

prompts/19 FROZEN 채점 대상: package/sheet_source CRUD·next_rev A→B·is_current 내림·
project 스코프·publish 미매핑 허용+요약·RBAC 403·에러계약.
"""
import asyncio
import importlib
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # backend/

import config  # noqa: E402


def _fresh_store(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "UPLOADS_DIR", tmp_path)
    monkeypatch.setattr(config, "STORE_BACKEND", "json")
    import store as store_mod
    importlib.reload(store_mod)
    return store_mod, store_mod.JsonDrawingStore()


def _reload_routes(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "UPLOADS_DIR", tmp_path)
    monkeypatch.setattr(config, "STORE_BACKEND", "json")
    import store as store_mod
    importlib.reload(store_mod)
    import auth
    importlib.reload(auth)
    import routes_drawing
    importlib.reload(routes_drawing)
    import routes_package as rp
    importlib.reload(rp)
    return rp


def _pdf_drawing(tmp_path, file_id, n_sheets=2, project="P"):
    sheets = [{
        "sheet_id": f"{file_id}_sheet_{i:03d}", "sheet_name": f"page{i}", "sheet_index": i,
        "source": "pdf-page", "sheet_number": f"EE-01-{i:03d}", "sheet_title": f"단선도 {i}",
    } for i in range(n_sheets)]
    return {
        "file_id": file_id, "filename": f"{file_id}.pdf",
        "file_path": str(tmp_path / file_id / "original.pdf"), "file_format": "pdf",
        "file_size": 100, "upload_date": "2026-07-06T00:00:01", "project_name": project,
        "version": "1", "conversion_status": "completed", "sheets": sheets,
    }


def _dwg_drawing(tmp_path, file_id, layouts=("EE-01-000", "EE-01-001"), project="P"):
    sheets = [{
        "sheet_id": f"{file_id}_sheet_{i:03d}", "sheet_name": name, "sheet_index": i,
        "source": "paperspace",
    } for i, name in enumerate(layouts)]
    return {
        "file_id": file_id, "filename": f"{file_id}.dxf",
        "file_path": str(tmp_path / file_id / "original.dxf"), "file_format": "dxf",
        "file_size": 200, "upload_date": "2026-07-06T00:00:02", "project_name": project,
        "version": "1", "conversion_status": "completed", "sheets": sheets,
    }


# --- store: package CRUD + 스코프 ---

def test_package_crud_and_project_scope(tmp_path, monkeypatch):
    _, s = _fresh_store(tmp_path, monkeypatch)
    s.add_package({"package_id": "pkg_1", "project_name": "A", "title": "세트1",
                   "status": "draft", "created_at": "t1", "dwg_file_ids": [], "pdf_file_ids": []})
    s.add_package({"package_id": "pkg_2", "project_name": "B", "title": "세트2",
                   "status": "draft", "created_at": "t2", "dwg_file_ids": [], "pdf_file_ids": []})
    assert s.get_package("pkg_1")["title"] == "세트1"
    assert [p["package_id"] for p in s.list_packages(project_name="A")] == ["pkg_1"]
    assert [p["package_id"] for p in s.list_packages()] == ["pkg_2", "pkg_1"]  # 최신 우선
    upd = s.update_package("pkg_1", status="published", published_at="t9")
    assert upd["status"] == "published" and upd["published_at"] == "t9"
    assert s.update_package("ghost", status="x") is None


# --- store: sheet_source CRUD + 필터 + next_rev + is_current ---

def test_sheet_source_crud_filters(tmp_path, monkeypatch):
    _, s = _fresh_store(tmp_path, monkeypatch)
    s.add_sheet_source({"link_id": "lnk_1", "sheet_key": "sk_A", "rev": "A", "package_id": "pkg_1",
                        "project_name": "P", "pdf_file_id": "PF", "sheet_id": "PF_sheet_000",
                        "sheet_number": "EE-01-000", "dwg_links": [{"dwg_file_id": "DF"}],
                        "is_current": True, "created_at": "t1"})
    s.add_sheet_source({"link_id": "lnk_2", "sheet_key": "sk_B", "rev": "A", "package_id": "pkg_1",
                        "project_name": "P", "pdf_file_id": "PF", "sheet_id": "PF_sheet_001",
                        "sheet_number": "EE-01-001", "dwg_links": [], "is_current": True,
                        "created_at": "t2"})
    assert s.get_sheet_source("lnk_1")["sheet_key"] == "sk_A"
    assert [r["link_id"] for r in s.list_sheet_sources(package_id="pkg_1")] == ["lnk_1", "lnk_2"]
    assert [r["link_id"] for r in s.list_sheet_sources(sheet_key="sk_A")] == ["lnk_1"]
    assert [r["link_id"] for r in s.list_sheet_sources(sheet_id="PF_sheet_001")] == ["lnk_2"]
    assert [r["link_id"] for r in s.list_sheet_sources(pdf_file_id="PF")] == ["lnk_1", "lnk_2"]
    upd = s.update_sheet_source("lnk_1", is_current=False)
    assert upd["is_current"] is False


def test_next_rev_sequence(tmp_path, monkeypatch):
    _, s = _fresh_store(tmp_path, monkeypatch)
    assert s.next_rev("sk_new") == "A"                 # 링크 없음 → A
    s.add_sheet_source({"link_id": "l1", "sheet_key": "sk_x", "rev": "A", "is_current": True,
                        "created_at": "t1"})
    assert s.next_rev("sk_x") == "B"
    s.add_sheet_source({"link_id": "l2", "sheet_key": "sk_x", "rev": "B", "is_current": True,
                        "created_at": "t2"})
    assert s.next_rev("sk_x") == "C"


# --- 라우트: 생성 → 파일 귀속 → 상세 → 힌트 ---

def test_create_add_files_detail_hints(tmp_path, monkeypatch):
    rp = _reload_routes(tmp_path, monkeypatch)
    s = rp.get_store()
    s.add_drawing(_pdf_drawing(tmp_path, "PF", n_sheets=2))
    s.add_drawing(_dwg_drawing(tmp_path, "DF", layouts=("EE-01-000", "EE-01-001")))
    pkg = asyncio.run(rp.create_package(rp.PackageCreate(project_name="P", title="발행세트")))
    pid = pkg["package_id"]
    assert pkg["status"] == "draft" and pkg["pdf_file_ids"] == []
    detail = asyncio.run(rp.add_package_files(pid, rp.PackageFiles(
        dwg_file_ids=["DF"], pdf_file_ids=["PF"])))
    assert detail["dwg_file_ids"] == ["DF"] and detail["pdf_file_ids"] == ["PF"]
    assert len(detail["pdf_sheets"]) == 2
    assert detail["dwgs"][0]["layouts"][0]["layout_name"] == "EE-01-000"
    # 힌트: PF_sheet_000(번호 EE-01-000) → DF 레이아웃 EE-01-000 정확 일치.
    hints = asyncio.run(rp.package_hints(pid))
    top = hints["PF_sheet_000"][0]
    assert top["dwg_file_id"] == "DF" and top["score"] == 1.0


def test_add_files_classifies_by_format(tmp_path, monkeypatch):
    """dwg/dxf는 dwg 트랙, pdf는 pdf 트랙으로 형식 재확인 분류(자기신고 무시)."""
    rp = _reload_routes(tmp_path, monkeypatch)
    s = rp.get_store()
    s.add_drawing(_pdf_drawing(tmp_path, "PF", n_sheets=1))
    s.add_drawing(_dwg_drawing(tmp_path, "DF"))
    pkg = asyncio.run(rp.create_package(rp.PackageCreate(project_name="P")))
    pid = pkg["package_id"]
    # 일부러 반대로 신고해도 형식 기준으로 재분류된다.
    detail = asyncio.run(rp.add_package_files(pid, rp.PackageFiles(
        dwg_file_ids=["PF"], pdf_file_ids=["DF"])))
    assert detail["dwg_file_ids"] == ["DF"] and detail["pdf_file_ids"] == ["PF"]


# --- 라우트: 매핑 draft 저장/복원 → 발행 ---

def _mapping_entry(rp, sheet_id, pdf_file_id, dwg_file_id, sheet_number, layout=None, inherit=None):
    return rp.MappingEntry(
        sheet_id=sheet_id, pdf_file_id=pdf_file_id, sheet_number=sheet_number,
        dwg_links=[rp.DwgLink(dwg_file_id=dwg_file_id, layout_name=layout)] if dwg_file_id else [],
        inherit_sheet_key=inherit)


def test_mapping_save_restore_and_publish(tmp_path, monkeypatch):
    rp = _reload_routes(tmp_path, monkeypatch)
    s = rp.get_store()
    s.add_drawing(_pdf_drawing(tmp_path, "PF", n_sheets=2))
    s.add_drawing(_dwg_drawing(tmp_path, "DF"))
    pkg = asyncio.run(rp.create_package(rp.PackageCreate(project_name="P")))
    pid = pkg["package_id"]
    asyncio.run(rp.add_package_files(pid, rp.PackageFiles(dwg_file_ids=["DF"], pdf_file_ids=["PF"])))
    # sheet_000만 매핑, sheet_001은 미매핑으로 남김(loose).
    mapping = {"PF_sheet_000": _mapping_entry(rp, "PF_sheet_000", "PF", "DF", "EE-01-000", "EE-01-000")}
    saved = asyncio.run(rp.save_mapping(pid, rp.MappingSave(mapping=mapping)))
    # 복원: getPackage가 draft_mapping을 반환.
    reopened = asyncio.run(rp.get_package(pid))
    assert "PF_sheet_000" in reopened["draft_mapping"]
    # 발행: sheet_000 링크 생성 + 미매핑 sheet_001 요약.
    res = asyncio.run(rp.publish_package(pid))
    assert res["status"] == "published" and res["published"] == 1
    assert res["unmapped_sheets"] == ["PF_sheet_001"]
    assert res["unlinked_dwgs"] == []
    link = res["links"][0]
    assert link["rev"] == "A" and link["sheet_key"].startswith("sk_")
    assert link["is_current"] is True
    # 영속: 새 store 조회에서도 링크 복원(sheet_id 스코프).
    links = s.list_sheet_sources(sheet_id="PF_sheet_000")
    assert len(links) == 1 and links[0]["dwg_links"][0]["dwg_file_id"] == "DF"


def test_publish_loose_all_unmapped_allowed(tmp_path, monkeypatch):
    """미매핑만 남긴 채 발행해도 막지 않는다(N5 loose)."""
    rp = _reload_routes(tmp_path, monkeypatch)
    s = rp.get_store()
    s.add_drawing(_pdf_drawing(tmp_path, "PF", n_sheets=2))
    s.add_drawing(_dwg_drawing(tmp_path, "DF"))
    pkg = asyncio.run(rp.create_package(rp.PackageCreate(project_name="P")))
    pid = pkg["package_id"]
    asyncio.run(rp.add_package_files(pid, rp.PackageFiles(dwg_file_ids=["DF"], pdf_file_ids=["PF"])))
    res = asyncio.run(rp.publish_package(pid))   # 매핑 0
    assert res["status"] == "published" and res["published"] == 0
    assert set(res["unmapped_sheets"]) == {"PF_sheet_000", "PF_sheet_001"}
    assert res["unlinked_dwgs"] == ["DF"]


def test_publish_sheet_key_inheritance(tmp_path, monkeypatch):
    """기존 sheet_key 계승 시 rev가 B로 오르고 이전 링크 is_current=false."""
    rp = _reload_routes(tmp_path, monkeypatch)
    s = rp.get_store()
    s.add_drawing(_pdf_drawing(tmp_path, "PF", n_sheets=1))
    s.add_drawing(_dwg_drawing(tmp_path, "DF"))
    # 1차 발행: 신규 sheet_key rev A.
    p1 = asyncio.run(rp.create_package(rp.PackageCreate(project_name="P")))["package_id"]
    asyncio.run(rp.add_package_files(p1, rp.PackageFiles(dwg_file_ids=["DF"], pdf_file_ids=["PF"])))
    asyncio.run(rp.save_mapping(p1, rp.MappingSave(mapping={
        "PF_sheet_000": _mapping_entry(rp, "PF_sheet_000", "PF", "DF", "EE-01-000", "EE-01-000")})))
    r1 = asyncio.run(rp.publish_package(p1))
    sk = r1["links"][0]["sheet_key"]
    # 2차 발행: 같은 sheet_key 계승.
    p2 = asyncio.run(rp.create_package(rp.PackageCreate(project_name="P")))["package_id"]
    asyncio.run(rp.add_package_files(p2, rp.PackageFiles(dwg_file_ids=["DF"], pdf_file_ids=["PF"])))
    asyncio.run(rp.save_mapping(p2, rp.MappingSave(mapping={
        "PF_sheet_000": _mapping_entry(rp, "PF_sheet_000", "PF", "DF", "EE-01-000", "EE-01-000",
                                       inherit=sk)})))
    r2 = asyncio.run(rp.publish_package(p2))
    assert r2["links"][0]["rev"] == "B" and r2["links"][0]["sheet_key"] == sk
    # 계승 후: 최신(rev B)만 is_current=true, 이전(rev A)은 false.
    all_links = s.list_sheet_sources(sheet_key=sk)
    current = [l for l in all_links if l["is_current"]]
    assert len(current) == 1 and current[0]["rev"] == "B"


# --- 에러 계약 + RBAC ---

def test_error_contracts(tmp_path, monkeypatch):
    rp = _reload_routes(tmp_path, monkeypatch)
    from fastapi import HTTPException
    s = rp.get_store()
    s.add_drawing(_pdf_drawing(tmp_path, "PF", n_sheets=1))
    # 없는 패키지 조회 → 404
    with pytest.raises(HTTPException) as e1:
        asyncio.run(rp.get_package("pkg_ghost"))
    assert e1.value.status_code == 404
    pkg = asyncio.run(rp.create_package(rp.PackageCreate(project_name="P")))
    pid = pkg["package_id"]
    # 없는 도면 귀속 → 404
    with pytest.raises(HTTPException) as e2:
        asyncio.run(rp.add_package_files(pid, rp.PackageFiles(pdf_file_ids=["ghost"])))
    assert e2.value.status_code == 404
    # 발행 후 재발행 → 400
    asyncio.run(rp.add_package_files(pid, rp.PackageFiles(pdf_file_ids=["PF"])))
    asyncio.run(rp.publish_package(pid))
    with pytest.raises(HTTPException) as e3:
        asyncio.run(rp.publish_package(pid))
    assert e3.value.status_code == 400
    # 발행된 패키지 파일 추가 → 400
    with pytest.raises(HTTPException) as e4:
        asyncio.run(rp.add_package_files(pid, rp.PackageFiles(pdf_file_ids=["PF"])))
    assert e4.value.status_code == 400


# --- 렌즈1 수리 회귀: 프로젝트 스코프 계승 · rev 시퀀스 · 형식 · orphan ---

def test_rev_sequence_helpers():
    from store import _index_to_rev, _rev_to_index
    seq = [_index_to_rev(i) for i in range(28)]
    assert seq[:3] == ["A", "B", "C"]
    assert seq[25] == "Z" and seq[26] == "AA" and seq[27] == "AB"
    for i in range(60):
        assert _rev_to_index(_index_to_rev(i)) == i     # 왕복 무손실
    assert _rev_to_index("") == -1 and _rev_to_index("A1") == -1


def test_next_rev_exhaustion_no_duplicate(tmp_path, monkeypatch):
    _, s = _fresh_store(tmp_path, monkeypatch)
    for i, r in enumerate(["Z", "AA"]):
        s.add_sheet_source({"link_id": f"l{i}", "sheet_key": "sk", "rev": r,
                            "project_name": "P", "is_current": True, "created_at": f"t{i}"})
    assert s.next_rev("sk", project_name="P") == "AB"   # AA 다음은 AB(중복 없음)


def test_next_rev_project_scoped(tmp_path, monkeypatch):
    """다른 프로젝트의 같은 sheet_key는 rev 계산에 끼어들지 않는다."""
    _, s = _fresh_store(tmp_path, monkeypatch)
    s.add_sheet_source({"link_id": "la", "sheet_key": "sk", "rev": "A", "project_name": "A",
                        "is_current": True, "created_at": "t1"})
    assert s.next_rev("sk", project_name="B") == "A"    # B에는 이력 없음 → A


def test_publish_inherit_cross_project_or_missing_400(tmp_path, monkeypatch):
    rp = _reload_routes(tmp_path, monkeypatch)
    from fastapi import HTTPException
    s = rp.get_store()
    s.add_drawing(_pdf_drawing(tmp_path, "PF", n_sheets=1, project="B"))
    s.add_drawing(_dwg_drawing(tmp_path, "DF", project="B"))
    # 프로젝트 A에 실재하는 sheet_key(계승 후보) 하나 심어둠.
    s.add_sheet_source({"link_id": "lA", "sheet_key": "sk_from_A", "rev": "A", "project_name": "A",
                        "is_current": True, "created_at": "t1", "dwg_links": [{"dwg_file_id": "x"}]})
    p = asyncio.run(rp.create_package(rp.PackageCreate(project_name="B")))["package_id"]
    asyncio.run(rp.add_package_files(p, rp.PackageFiles(dwg_file_ids=["DF"], pdf_file_ids=["PF"])))
    # B 패키지가 A의 키를 계승 시도 → 400(프로젝트 격리)
    asyncio.run(rp.save_mapping(p, rp.MappingSave(mapping={
        "PF_sheet_000": _mapping_entry(rp, "PF_sheet_000", "PF", "DF", "EE-01-000", "EE-01-000",
                                       inherit="sk_from_A")})))
    with pytest.raises(HTTPException) as e:
        asyncio.run(rp.publish_package(p))
    assert e.value.status_code == 400
    # A의 원본 링크는 강등되지 않았다(is_current 보존).
    assert s.get_sheet_source("lA")["is_current"] is True


def test_add_files_rejects_unknown_format(tmp_path, monkeypatch):
    rp = _reload_routes(tmp_path, monkeypatch)
    from fastapi import HTTPException
    s = rp.get_store()
    png = _pdf_drawing(tmp_path, "IMG", n_sheets=1)
    png["file_format"] = "png"
    s.add_drawing(png)
    p = asyncio.run(rp.create_package(rp.PackageCreate(project_name="P")))["package_id"]
    with pytest.raises(HTTPException) as e:
        asyncio.run(rp.add_package_files(p, rp.PackageFiles(pdf_file_ids=["IMG"])))
    assert e.value.status_code == 400


def test_publish_skips_orphan_sheet(tmp_path, monkeypatch):
    """패키지에 속하지 않은 sheet_id 매핑 엔트리는 발행 링크로 만들지 않는다."""
    rp = _reload_routes(tmp_path, monkeypatch)
    s = rp.get_store()
    s.add_drawing(_pdf_drawing(tmp_path, "PF", n_sheets=1))
    s.add_drawing(_dwg_drawing(tmp_path, "DF"))
    p = asyncio.run(rp.create_package(rp.PackageCreate(project_name="P")))["package_id"]
    asyncio.run(rp.add_package_files(p, rp.PackageFiles(dwg_file_ids=["DF"], pdf_file_ids=["PF"])))
    asyncio.run(rp.save_mapping(p, rp.MappingSave(mapping={
        "GHOST_sheet_999": _mapping_entry(rp, "GHOST_sheet_999", "GHOST", "DF", "X", "EE-01-000")})))
    res = asyncio.run(rp.publish_package(p))
    assert res["published"] == 0                     # orphan은 발행 안 됨
    assert s.list_sheet_sources(sheet_id="GHOST_sheet_999") == []


def test_rbac_viewer_blocked(tmp_path, monkeypatch):
    """뷰어는 세트 생성·발행 403, 관리자는 허용(Study_Project 시드 역할)."""
    rp = _reload_routes(tmp_path, monkeypatch)
    from fastapi import HTTPException
    s = rp.get_store()
    s.list_project_members("Study_Project")   # seed 트리거
    s.set_current_user("member-viewer")
    with pytest.raises(HTTPException) as e:
        asyncio.run(rp.create_package(rp.PackageCreate(project_name="Study_Project")))
    assert e.value.status_code == 403
    # 관리자 전환 → 허용
    s.set_current_user("member-owner")
    pkg = asyncio.run(rp.create_package(rp.PackageCreate(project_name="Study_Project")))
    assert pkg["status"] == "draft"
    # 뷰어는 발행도 403
    s.set_current_user("member-viewer")
    with pytest.raises(HTTPException) as e2:
        asyncio.run(rp.publish_package(pkg["package_id"]))
    assert e2.value.status_code == 403
