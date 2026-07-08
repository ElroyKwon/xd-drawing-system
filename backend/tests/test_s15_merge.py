"""S15 단계6 — DWG↔PDF 병합(D7) + 시트정체성 발급자 통합(D5).

prompts/20 채점: 병합 DXF 권위·충돌 conflicts[] 기록(버리지 않음)·DWG 링크 없으면
passthrough / publish가 인라인 uuid 대신 레지스트리 sheet_key를 계승(단일 권위).
"""
import asyncio
import importlib
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # backend/

import config  # noqa: E402
import sheet_merge  # noqa: E402


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


def _upsert(s, *, sheet_key, file_id, sheet_id, kind, text, tags, project="P"):
    s.upsert_sheet_meta(sheet_key=sheet_key, project_name=project, file_id=file_id,
                        sheet_index=0, sheet_id=sheet_id, source_kind=kind,
                        content_hash=f"h_{sheet_id}", text_index=text, tags=tags)


# ── _merge_tags 순수 로직 ──────────────────────────────────────────

def test_merge_tags_conflict_dxf_authoritative():
    pdf = [{"tag": "PP-38OV", "type": "분전반", "confidence": 0.6, "src": "rule"},
           {"tag": "CABLE-1", "type": "cable", "confidence": 0.7, "src": "rule"}]
    dxf = [{"tag": "PP-380V", "type": "분전반", "confidence": 0.92, "src": "rule"},
           {"tag": "MTR-1", "type": "motor", "confidence": 0.9, "src": "rule"}]
    tags, conflicts = sheet_merge._merge_tags(pdf, dxf)
    names = {t["tag"] for t in tags}
    assert "PP-380V" in names and "PP-38OV" not in names   # DXF 채택, PDF 변형 흡수
    assert "CABLE-1" in names and "MTR-1" in names          # 한쪽 전용은 유지
    assert len(conflicts) == 1
    assert conflicts[0] == {"field": "tag", "dxf": "PP-380V", "pdf": "PP-38OV", "resolved": "PP-380V"}


def test_merge_tags_agreement_marks_merged():
    pdf = [{"tag": "TR-1", "type": "transformer", "confidence": 0.7, "src": "rule"}]
    dxf = [{"tag": "TR-1", "type": "transformer", "confidence": 0.95, "src": "rule"}]
    tags, conflicts = sheet_merge._merge_tags(pdf, dxf)
    assert conflicts == []                       # 원문 일치 → 충돌 아님
    assert len(tags) == 1 and tags[0]["src"] == "merged" and tags[0]["confidence"] == 0.95


def test_merge_tags_intra_source_no_loss():
    """렌즈1 MAJOR: 같은 소스 내 canon 충돌(PL-1 vs PI-1)·빈 태그는 접지 않아 유실 0."""
    pdf = [{"tag": "PL-1", "src": "rule"}, {"tag": "PI-1", "src": "rule"},
           {"tag": "", "type": "cable", "src": "rule"}, {"tag": "", "type": "wire", "src": "rule"}]
    tags, conflicts = sheet_merge._merge_tags(pdf, [])   # DXF 없음
    assert {t.get("tag") for t in tags} == {"PL-1", "PI-1", ""}  # PL-1·PI-1 둘 다 생존
    assert sum(1 for t in tags if t.get("tag") == "") == 2       # 빈 태그 2개 개별 보존
    assert conflicts == []


def test_merge_tags_dxf_intra_canon_both_survive():
    """DXF끼리 canon 충돌해도 둘 다 보존(원문 완전중복만 제거)."""
    dxf = [{"tag": "PL-1", "src": "rule"}, {"tag": "PI-1", "src": "rule"},
           {"tag": "PL-1", "src": "rule"}]   # 마지막은 완전중복
    tags, _ = sheet_merge._merge_tags([], dxf)
    assert [t["tag"] for t in tags] == ["PL-1", "PI-1"]   # 중복 1개만 제거, PI-1 유지


# ── merge_current: passthrough / 병합 ──────────────────────────────

def test_merge_current_passthrough_when_no_dwg(tmp_path, monkeypatch):
    _, s = _fresh_store(tmp_path, monkeypatch)
    sk = s.issue_sheet_key(project_name="P", version_set_id="PF", sheet_number="EE-01-000")
    _upsert(s, sheet_key=sk, file_id="PF", sheet_id="PF_s0", kind="pdf",
            text="PANEL PP-38OV", tags=[{"tag": "PP-38OV", "confidence": 0.6, "src": "rule"}])
    view = sheet_merge.merge_current(s, "P", sk)
    assert view["source_kind"] == "pdf" and view["sources"] == ["pdf"]
    assert view["conflicts"] == []
    assert [t["tag"] for t in view["tags"]] == ["PP-38OV"]


def test_merge_current_merges_dxf_over_pdf(tmp_path, monkeypatch):
    _, s = _fresh_store(tmp_path, monkeypatch)
    sk = s.issue_sheet_key(project_name="P", version_set_id="PF", sheet_number="EE-01-000")
    _upsert(s, sheet_key=sk, file_id="PF", sheet_id="PF_s0", kind="pdf",
            text="PANEL PP-38OV", tags=[{"tag": "PP-38OV", "type": "분전반", "confidence": 0.6, "src": "rule"},
                                        {"tag": "CABLE-1", "confidence": 0.7, "src": "rule"}])
    dwg_sk = s.issue_sheet_key(project_name="P", version_set_id="DF", sheet_number="EE-01-000")
    _upsert(s, sheet_key=dwg_sk, file_id="DF", sheet_id="DF_s0", kind="dxf",
            text="ENTITY PP-380V MTR-1",
            tags=[{"tag": "PP-380V", "type": "분전반", "confidence": 0.92, "src": "rule"},
                  {"tag": "MTR-1", "confidence": 0.9, "src": "rule"}])
    s.add_sheet_source({"link_id": "lnk_1", "sheet_key": sk, "rev": "A", "project_name": "P",
                        "pdf_file_id": "PF", "sheet_id": "PF_s0",
                        "dwg_links": [{"dwg_file_id": "DF"}], "is_current": True, "created_at": "t1"})
    view = sheet_merge.merge_current(s, "P", sk)
    assert view["source_kind"] == "merged"
    assert set(view["sources"]) == {"pdf", "dxf"}
    names = {t["tag"] for t in view["tags"]}
    assert names == {"PP-380V", "CABLE-1", "MTR-1"}   # PP-38OV는 DXF에 흡수
    assert len(view["conflicts"]) == 1 and view["conflicts"][0]["resolved"] == "PP-380V"
    assert "PP-380V" in view["text_index"] and "PP-38OV" in view["text_index"]  # 본문 둘 다 보존


def test_merge_current_ignores_noncurrent_link(tmp_path, monkeypatch):
    _, s = _fresh_store(tmp_path, monkeypatch)
    sk = s.issue_sheet_key(project_name="P", version_set_id="PF", sheet_number="EE-01-000")
    _upsert(s, sheet_key=sk, file_id="PF", sheet_id="PF_s0", kind="pdf",
            text="x", tags=[{"tag": "A-1", "confidence": 0.6, "src": "rule"}])
    dwg_sk = s.issue_sheet_key(project_name="P", version_set_id="DF", sheet_number="EE-01-000")
    _upsert(s, sheet_key=dwg_sk, file_id="DF", sheet_id="DF_s0", kind="dxf",
            text="y", tags=[{"tag": "B-1", "confidence": 0.9, "src": "rule"}])
    s.add_sheet_source({"link_id": "lnk_old", "sheet_key": sk, "rev": "A", "project_name": "P",
                        "pdf_file_id": "PF", "sheet_id": "PF_s0",
                        "dwg_links": [{"dwg_file_id": "DF"}], "is_current": False, "created_at": "t0"})
    view = sheet_merge.merge_current(s, "P", sk)
    assert view["source_kind"] == "pdf"          # is_current=False 링크는 무시 → passthrough
    assert [t["tag"] for t in view["tags"]] == ["A-1"]


def test_merge_current_none_when_no_meta(tmp_path, monkeypatch):
    _, s = _fresh_store(tmp_path, monkeypatch)
    assert sheet_merge.merge_current(s, "P", "sk_ghost") is None


def test_merge_current_narrows_by_layout(tmp_path, monkeypatch):
    """렌즈1 MAJOR: 링크 layout_name으로 좁혀, DWG의 무관 layout 태그가 과병합되지 않는다."""
    _, s = _fresh_store(tmp_path, monkeypatch)
    # 2개 layout(L1·L2)을 가진 DWG. 각 layout이 자기 시트로 dxf meta 적재.
    s.add_drawing({"file_id": "DF", "filename": "DF.dxf", "file_path": str(tmp_path / "DF"),
                   "file_format": "dxf", "project_name": "P", "conversion_status": "completed",
                   "sheets": [{"sheet_id": "DF_s0", "sheet_name": "L1", "sheet_index": 0},
                              {"sheet_id": "DF_s1", "sheet_name": "L2", "sheet_index": 1}]})
    dsk0 = s.issue_sheet_key(project_name="P", version_set_id="DF", sheet_number="", sheet_index=0)
    dsk1 = s.issue_sheet_key(project_name="P", version_set_id="DF", sheet_number="", sheet_index=1)
    _upsert(s, sheet_key=dsk0, file_id="DF", sheet_id="DF_s0", kind="dxf", text="L1",
            tags=[{"tag": "IN-L1", "confidence": 0.9, "src": "rule"}])
    _upsert(s, sheet_key=dsk1, file_id="DF", sheet_id="DF_s1", kind="dxf", text="L2",
            tags=[{"tag": "IN-L2", "confidence": 0.9, "src": "rule"}])
    sk = s.issue_sheet_key(project_name="P", version_set_id="PF", sheet_number="EE-01-000")
    _upsert(s, sheet_key=sk, file_id="PF", sheet_id="PF_s0", kind="pdf", text="pdf",
            tags=[{"tag": "P-ONLY", "confidence": 0.6, "src": "rule"}])
    # PDF 시트는 L1에만 링크.
    s.add_sheet_source({"link_id": "lnk_1", "sheet_key": sk, "rev": "A", "project_name": "P",
                        "pdf_file_id": "PF", "sheet_id": "PF_s0",
                        "dwg_links": [{"dwg_file_id": "DF", "layout_name": "L1"}],
                        "is_current": True, "created_at": "t1"})
    view = sheet_merge.merge_current(s, "P", sk)
    names = {t["tag"] for t in view["tags"]}
    assert names == {"IN-L1", "P-ONLY"}   # L2(IN-L2)는 병합에서 제외됨
    assert "IN-L2" not in names


def test_publish_label_unifies_key_for_numberless_sheet(tmp_path, monkeypatch):
    """렌즈1 MAJOR: 번호 없는 시트에서 색인(빈 sheet_number)과 publish가 같은 키를 계승(이중발급 방지)."""
    rp = _reload_routes(tmp_path, monkeypatch)
    s = rp.get_store()
    # PDF 시트: sheet_number 비어있고 sheet_name만 있음(타이틀블록 번호추출 실패 케이스).
    s.add_drawing({"file_id": "PF", "filename": "PF.pdf", "file_path": str(tmp_path / "PF"),
                   "file_format": "pdf", "project_name": "P", "conversion_status": "completed",
                   "sheets": [{"sheet_id": "PF_sheet_000", "sheet_name": "p0", "sheet_index": 0,
                               "source": "pdf-page", "sheet_number": "", "sheet_title": "무번호"}]})
    s.add_drawing(_dwg_drawing(tmp_path, "DF"))
    # 색인이 발급했을 레지스트리 키(빈 번호 → 위치 라벨).
    sk_pre = s.issue_sheet_key(project_name="P", version_set_id="PF",
                               sheet_number="", sheet_index=0)
    pid = asyncio.run(rp.create_package(rp.PackageCreate(project_name="P")))["package_id"]
    asyncio.run(rp.add_package_files(pid, rp.PackageFiles(dwg_file_ids=["DF"], pdf_file_ids=["PF"])))
    # 프론트가 sheet_name 폴백("p0")을 sheet_number로 넘겨도, publish는 권위 레코드의 빈 번호를 써야 한다.
    asyncio.run(rp.save_mapping(pid, rp.MappingSave(mapping={
        "PF_sheet_000": rp.MappingEntry(
            sheet_id="PF_sheet_000", pdf_file_id="PF", sheet_number="p0",
            dwg_links=[rp.DwgLink(dwg_file_id="DF", layout_name="EE-01-000")])})))
    res = asyncio.run(rp.publish_package(pid))
    assert res["links"][0]["sheet_key"] == sk_pre   # 새 키 발급 아님 = 이중발급 방지
    assert len(s.list_sheet_keys(project_name="P")) == 1   # 레지스트리에 키는 여전히 1개


# ── D5 통합: publish가 레지스트리 sheet_key를 계승(인라인 uuid 아님) ──

def _pdf_drawing(tmp_path, file_id, project="P"):
    return {
        "file_id": file_id, "filename": f"{file_id}.pdf",
        "file_path": str(tmp_path / file_id / "o.pdf"), "file_format": "pdf",
        "file_size": 100, "upload_date": "2026-07-08T00:00:01", "project_name": project,
        "version": "1", "conversion_status": "completed",
        "sheets": [{"sheet_id": f"{file_id}_sheet_000", "sheet_name": "p0", "sheet_index": 0,
                    "source": "pdf-page", "sheet_number": "EE-01-000", "sheet_title": "단선도"}],
    }


def _dwg_drawing(tmp_path, file_id, project="P"):
    return {
        "file_id": file_id, "filename": f"{file_id}.dxf",
        "file_path": str(tmp_path / file_id / "o.dxf"), "file_format": "dxf",
        "file_size": 200, "upload_date": "2026-07-08T00:00:02", "project_name": project,
        "version": "1", "conversion_status": "completed",
        "sheets": [{"sheet_id": f"{file_id}_sheet_000", "sheet_name": "EE-01-000",
                    "sheet_index": 0, "source": "paperspace"}],
    }


def test_publish_inherits_registry_sheet_key(tmp_path, monkeypatch):
    """publish는 인라인 uuid를 만들지 않고, PDF 시트의 레지스트리 정체성 키를 계승한다."""
    rp = _reload_routes(tmp_path, monkeypatch)
    s = rp.get_store()
    s.add_drawing(_pdf_drawing(tmp_path, "PF"))
    s.add_drawing(_dwg_drawing(tmp_path, "DF"))
    # 변환 색인이 이미 발급해 둔 레지스트리 키(단일 권위) — publish는 이걸 계승해야 한다.
    sk_pre = s.issue_sheet_key(project_name="P", version_set_id="PF",
                               sheet_number="EE-01-000", sheet_index=0)
    pid = asyncio.run(rp.create_package(rp.PackageCreate(project_name="P")))["package_id"]
    asyncio.run(rp.add_package_files(pid, rp.PackageFiles(dwg_file_ids=["DF"], pdf_file_ids=["PF"])))
    asyncio.run(rp.save_mapping(pid, rp.MappingSave(mapping={
        "PF_sheet_000": rp.MappingEntry(
            sheet_id="PF_sheet_000", pdf_file_id="PF", sheet_number="EE-01-000",
            dwg_links=[rp.DwgLink(dwg_file_id="DF", layout_name="EE-01-000")])})))
    res = asyncio.run(rp.publish_package(pid))
    link = res["links"][0]
    assert link["sheet_key"] == sk_pre               # 새 uuid가 아니라 레지스트리 키 계승
    assert link["sheet_key"] in s.list_sheet_keys(project_name="P")  # 유일 권위에 존재


def test_publish_issues_registry_key_when_absent(tmp_path, monkeypatch):
    """색인 전이라 키가 없으면 발급하되 레지스트리에 남겨 단일 권위를 유지한다."""
    rp = _reload_routes(tmp_path, monkeypatch)
    s = rp.get_store()
    s.add_drawing(_pdf_drawing(tmp_path, "PF"))
    s.add_drawing(_dwg_drawing(tmp_path, "DF"))
    pid = asyncio.run(rp.create_package(rp.PackageCreate(project_name="P")))["package_id"]
    asyncio.run(rp.add_package_files(pid, rp.PackageFiles(dwg_file_ids=["DF"], pdf_file_ids=["PF"])))
    asyncio.run(rp.save_mapping(pid, rp.MappingSave(mapping={
        "PF_sheet_000": rp.MappingEntry(
            sheet_id="PF_sheet_000", pdf_file_id="PF", sheet_number="EE-01-000",
            dwg_links=[rp.DwgLink(dwg_file_id="DF", layout_name="EE-01-000")])})))
    res = asyncio.run(rp.publish_package(pid))
    sk = res["links"][0]["sheet_key"]
    assert sk in s.list_sheet_keys(project_name="P")   # 인라인 uuid가 아니라 레지스트리 발급
    # 그리고 그 키로 병합 뷰가 도달 가능(링크가 sheet_key로 조회됨)
    assert s.list_sheet_sources(sheet_key=sk, project_name="P")
