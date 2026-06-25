"""S1 백엔드 회귀: JSON store roundtrip + PDF 렌더 파이프라인 (외부 파일 비의존)."""
import os
import sys

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
