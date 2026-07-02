"""S9.2: 사진(Photos) 영속 CRUD + 필터 + 업로드 라우트 + 시트 연결 + RBAC."""
import asyncio
import importlib
import os
import sys
from io import BytesIO

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # backend/

import config  # noqa: E402


def _fresh_store(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "UPLOADS_DIR", tmp_path)
    import store as store_mod
    importlib.reload(store_mod)
    return store_mod, store_mod.JsonDrawingStore()


def _photo(photo_id, title, sheet_id=None, project_name="P", created="2026-07-02T00:00:01"):
    return {
        "photo_id": photo_id, "filename": f"{title}.png", "file_path": "",
        "file_format": "png", "file_size": 10, "title": title, "caption": "",
        "sheet_id": sheet_id, "project_name": project_name,
        "uploaded_by": "업로드", "created_at": created, "updated_at": created,
    }


# --- store ---

def test_photo_crud_and_filters(tmp_path, monkeypatch):
    _, s = _fresh_store(tmp_path, monkeypatch)
    s.add_photo(_photo("p1", "수배전반", sheet_id="S1", created="t1"))
    s.add_photo(_photo("p2", "케이블 트레이", created="t2"))
    s.add_photo(_photo("p3", "다른 프로젝트", project_name="Q", created="t3"))
    ids = [r["photo_id"] for r in s.list_photos(project_name="P")]
    assert set(ids) == {"p1", "p2"}
    assert ids[0] == "p2"  # 최신 우선
    assert [r["photo_id"] for r in s.list_photos(sheet_id="S1")] == ["p1"]
    upd = s.update_photo("p2", caption="현장 반입", sheet_id="S2")
    assert upd["caption"] == "현장 반입" and upd["sheet_id"] == "S2"
    assert s.delete_photo("p1") is True
    assert s.get_photo("p1") is None
    assert s.delete_photo("ghost") is False


# --- routes ---

def _reload_routes(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "UPLOADS_DIR", tmp_path)
    monkeypatch.setattr(config, "STORE_BACKEND", "json")
    import store as store_mod
    importlib.reload(store_mod)
    import auth as auth_mod
    importlib.reload(auth_mod)
    import routes_drawing
    importlib.reload(routes_drawing)
    import routes_photo as rp
    importlib.reload(rp)
    return rp, store_mod


def _upload(filename="현장.png", data=b"\x89PNG\r\n\x1a\n binaryimage"):
    from fastapi import UploadFile
    return UploadFile(filename=filename, file=BytesIO(data))


def _do_upload(rp, file, project_name="Study_Project", title="", caption="", sheet_id="", uploaded_by="업로드"):
    """라우트를 직접 호출할 때 Form() 기본값(문자열 아님)을 명시 인자로 대체한다."""
    return asyncio.run(rp.upload_photo(file=file, project_name=project_name, title=title,
                                       caption=caption, sheet_id=sheet_id, uploaded_by=uploaded_by))


def test_photo_upload_list_url_and_summary(tmp_path, monkeypatch):
    rp, _ = _reload_routes(tmp_path, monkeypatch)
    created = _do_upload(rp, _upload(), title="수배전반 반입", caption="1층", sheet_id="S1")
    pid = created["photo_id"]
    assert created["title"] == "수배전반 반입" and created["sheet_id"] == "S1"
    # 절대 서버경로는 응답에서 제거, /files 상대 URL 제공
    assert "file_path" not in created
    assert created["photo_url"].startswith("/files/") and created["photo_url"].endswith(".png")
    # 파일이 실제로 저장됨
    assert (tmp_path / "Study_Project" / "photos" / pid / "original.png").exists()
    # 목록 + 시트 필터
    rows = asyncio.run(rp.list_photos(project_name="Study_Project"))
    assert len(rows) == 1
    assert [r["photo_id"] for r in asyncio.run(rp.list_photos(sheet_id="S1"))] == [pid]
    # summary(연결/미연결)
    _do_upload(rp, _upload("무연결.png"))
    summary = asyncio.run(rp.photo_summary(project_name="Study_Project"))
    assert summary == {"total": 2, "linked": 1, "unlinked": 1}


def test_photo_patch_and_delete_removes_file(tmp_path, monkeypatch):
    rp, _ = _reload_routes(tmp_path, monkeypatch)
    created = _do_upload(rp, _upload())
    pid = created["photo_id"]
    base = tmp_path / "Study_Project" / "photos" / pid
    assert base.exists()
    patched = asyncio.run(rp.patch_photo(pid, rp.PhotoPatch(caption="검수 완료", sheet_id="S9")))
    assert patched["caption"] == "검수 완료" and patched["sheet_id"] == "S9"
    # 삭제 → 메타 + 파일 디렉토리 제거
    assert asyncio.run(rp.delete_photo(pid))["deleted"] == pid
    assert not base.exists()
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as e:
        asyncio.run(rp.delete_photo(pid))
    assert e.value.status_code == 404


def test_photo_rejects_non_image(tmp_path, monkeypatch):
    rp, _ = _reload_routes(tmp_path, monkeypatch)
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as e:
        _do_upload(rp, _upload("도면.dwg"))
    assert e.value.status_code == 400


def test_photo_upload_requires_editor(tmp_path, monkeypatch):
    """S7 RBAC: 뷰어는 사진 업로드 403, 편집자 이상은 허용."""
    rp, store_mod = _reload_routes(tmp_path, monkeypatch)
    from fastapi import HTTPException
    s = rp.get_store()
    s.set_current_user("member-viewer")  # Study_Project 뷰어
    with pytest.raises(HTTPException) as e:
        _do_upload(rp, _upload())
    assert e.value.status_code == 403
    s.set_current_user("member-reviewer")  # 편집자
    created = _do_upload(rp, _upload())
    assert created["photo_id"]
