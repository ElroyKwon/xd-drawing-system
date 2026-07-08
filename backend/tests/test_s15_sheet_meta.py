"""S15 단계4: 버전별 추출본(_sheet_meta.json) — 이력 보존·is_current·멱등·조인.

prompts/20 O6(새 버전 시 이전 rev 보존, is_current 최신 1개)·D6.
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
    return store_mod.JsonDrawingStore()


def _meta(s, sheet_key, content_hash, tags=(), text="idx", file_id="F1"):
    return s.upsert_sheet_meta(
        sheet_key=sheet_key, project_name="P", file_id=file_id, sheet_index=0,
        sheet_id=f"{file_id}_s0", source_kind="pdf", content_hash=content_hash,
        text_index=text, tags=list(tags))


def test_history_preserved_and_current_demoted(tmp_path, monkeypatch):
    s = _fresh_store(tmp_path, monkeypatch)
    v1 = _meta(s, "sk1", "sha256:aaa", text="rev A", file_id="F1")
    v2 = _meta(s, "sk1", "sha256:bbb", text="rev B", file_id="F2")   # 새 버전
    assert v1["is_current"] is True and v2["is_current"] is True     # 반환값은 발급 시점 스냅샷
    hist = s.list_sheet_meta(sheet_key="sk1")
    assert len(hist) == 2                                            # 이력 보존(O6)
    current = [r for r in hist if r["is_current"]]
    assert len(current) == 1 and current[0]["content_hash"] == "sha256:bbb"  # 최신만 current


def test_same_hash_is_idempotent_noop(tmp_path, monkeypatch):
    s = _fresh_store(tmp_path, monkeypatch)
    a = _meta(s, "sk1", "sha256:aaa")
    b = _meta(s, "sk1", "sha256:aaa")   # 동일 콘텐츠 재변환
    assert a["meta_id"] == b["meta_id"]
    assert len(s.list_sheet_meta(sheet_key="sk1")) == 1


def test_current_only_and_join_filters(tmp_path, monkeypatch):
    s = _fresh_store(tmp_path, monkeypatch)
    _meta(s, "sk1", "sha256:a", file_id="F1")
    _meta(s, "sk1", "sha256:b", file_id="F2")
    _meta(s, "sk2", "sha256:c", file_id="F3")
    assert len(s.list_sheet_meta(project_name="P")) == 3
    assert len(s.list_sheet_meta(current_only=True)) == 2     # sk1 최신 + sk2
    assert len(s.list_sheet_meta(file_id="F1")) == 1
    assert [r["sheet_key"] for r in s.list_sheet_meta(sheet_key="sk2")] == ["sk2"]


def test_tags_and_defaults_persisted(tmp_path, monkeypatch):
    s = _fresh_store(tmp_path, monkeypatch)
    r = _meta(s, "sk1", "sha256:a",
              tags=[{"tag": "PP-380V", "type": "panel", "confidence": 0.92, "src": "rule"}])
    assert r["tags"][0]["tag"] == "PP-380V"
    assert r["conflicts"] == [] and r["summary"] is None
    assert r["extractor"]["rule_version"] == "1" and r["extractor"]["llm_model"] is None


def test_conversion_wires_extraction(tmp_path, monkeypatch):
    # end-to-end: 실 PDF 변환 → sheet_key 발급 + 규칙 추출본 적재(O1+O4).
    import fitz  # PyMuPDF
    monkeypatch.setattr(config, "UPLOADS_DIR", tmp_path)
    monkeypatch.setattr(config, "STORE_BACKEND", "json")
    import store as store_mod
    importlib.reload(store_mod)
    import routes_drawing
    importlib.reload(routes_drawing)
    s = routes_drawing.get_store()

    pdf_path = tmp_path / "d.pdf"
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), "PANEL PP-380V FEEDER SCHEDULE EE-01-016")
    doc.save(str(pdf_path))
    doc.close()

    s.add_drawing({
        "file_id": "F1", "filename": "EE-01-016.pdf", "project_name": "P",
        "version_set_id": "F1", "file_path": str(pdf_path), "file_format": "pdf",
        "conversion_status": "completed",
        "sheets": [{"sheet_id": "F1_s0", "sheet_index": 0, "sheet_number": "EE-01-016"}],
    })
    routes_drawing._issue_sheet_keys(s, "F1")

    assert len(s.list_sheet_keys(project_name="P")) == 1
    metas = s.list_sheet_meta(file_id="F1")
    assert len(metas) == 1
    m = metas[0]
    assert "PP-380V" in m["text_index"]
    assert any(t["tag"] == "PP-380V" for t in m["tags"])   # 시드 없이 태그(O5)
    assert m["source_kind"] == "pdf" and m["content_hash"].startswith("sha256:")
