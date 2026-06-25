"""S1 백엔드 회귀: JSON store roundtrip + PDF 렌더 + BLOCKER 회귀 방지."""
import importlib
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # backend/

import config  # noqa: E402
from conversion import render_pdf_sheets  # noqa: E402


def test_json_store_roundtrip(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "UPLOADS_DIR", tmp_path)
    import importlib
    import store as store_mod
    importlib.reload(store_mod)
    s = store_mod.JsonDrawingStore()

    meta = {
        "file_id": "f1",
        "filename": "a.dwg",
        "file_path": str(tmp_path / "a.dwg"),
        "file_format": "dwg",
        "file_size": 10,
        "upload_date": "2026-06-25T00:00:00",
        "project_name": "P",
        "version": "1.0",
        "conversion_status": "pending",
        "sheets": [],
    }
    s.add_drawing(meta)
    assert s.get_drawing("f1")["conversion_status"] == "pending"
    assert len(s.list_drawings("P")) == 1
    assert s.list_drawings("other") == []

    s.update_conversion("f1", "completed", sheets=[{"sheet_id": "x"}], scan={"pages": 1})
    row = s.get_drawing("f1")
    assert row["conversion_status"] == "completed"
    assert row["sheets"] == [{"sheet_id": "x"}]
    assert row["scan"] == {"pages": 1}


def test_pdf_render_pipeline(tmp_path):
    import fitz

    pdf = tmp_path / "t.pdf"
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), "XD TEST SHEET")
    doc.save(str(pdf))
    doc.close()

    sheets, scan = render_pdf_sheets(str(pdf), "fid", str(tmp_path), dpi=72)
    assert scan["pages"] == 1
    assert len(sheets) == 1
    assert sheets[0].source == "pdf-page"
    assert os.path.exists(sheets[0].png_path)
    assert os.path.getsize(sheets[0].png_path) > 0


def test_project_name_traversal_rejected():
    """BLOCKER-2 회귀: project_name이 uploads 밖을 벗어나면 400."""
    from fastapi import HTTPException
    import routes_drawing
    importlib.reload(routes_drawing)
    for bad in ["../x", "C:/x", "/etc/x", "a/b", "a\\b", "..", ""]:
        with pytest.raises(HTTPException):
            routes_drawing._validate_project_name(bad)
    # 정상(영문/한글/공백)은 통과
    routes_drawing._validate_project_name("Study_Project")
    routes_drawing._validate_project_name("청주 R-Center (1)")


def test_store_is_singleton(tmp_path, monkeypatch):
    """BLOCKER-1 회귀: get_store()는 단일 인스턴스를 공유해야 Lock이 유효하다."""
    monkeypatch.setattr(config, "UPLOADS_DIR", tmp_path)
    monkeypatch.setattr(config, "STORE_BACKEND", "json")
    import store as store_mod
    importlib.reload(store_mod)
    a = store_mod.get_store()
    b = store_mod.get_store()
    assert a is b
    assert a.backend_name == "json"
