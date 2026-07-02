"""S9.1: 양식(Forms) 영속 CRUD + 완료율 + 라우트 + 검증 + 집계."""
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


def _form(form_id, title, status="미시작", form_type="점검", items=None, project_name="P", created="2026-06-29T00:00:01"):
    return {
        "form_id": form_id, "title": title, "form_type": form_type, "status": status,
        "assignee": "", "due_date": "", "items": items or [], "project_name": project_name,
        "created_at": created, "updated_at": created,
    }


# --- store ---

def test_form_crud_and_filters(tmp_path, monkeypatch):
    _, s = _fresh_store(tmp_path, monkeypatch)
    s.add_form(_form("f1", "수배전반 점검", status="진행중", form_type="검사", created="t1"))
    s.add_form(_form("f2", "접지 점검", status="완료", form_type="점검", created="t2"))
    s.add_form(_form("f3", "다른 프로젝트", project_name="Q", created="t3"))
    ids = [r["form_id"] for r in s.list_forms(project_name="P")]
    assert set(ids) == {"f1", "f2"}
    # 완료(f2)는 미완료(f1) 뒤로 정렬
    assert ids[-1] == "f2"
    assert [r["form_id"] for r in s.list_forms(form_type="검사")] == ["f1"]
    # items 업데이트(체크 토글)
    upd = s.update_form("f1", items=[{"label": "a", "checked": True}])
    assert upd["items"][0]["checked"] is True
    assert s.delete_form("f1") is True
    assert s.get_form("f1") is None
    assert s.delete_form("ghost") is False


# --- routes ---

def _reload_routes(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "UPLOADS_DIR", tmp_path)
    monkeypatch.setattr(config, "STORE_BACKEND", "json")
    import store as store_mod
    importlib.reload(store_mod)
    import routes_form as rf
    importlib.reload(rf)
    return rf


def test_form_route_create_completion_patch(tmp_path, monkeypatch):
    rf = _reload_routes(tmp_path, monkeypatch)
    created = asyncio.run(rf.create_form(rf.FormCreate(
        title="수배전반 인수 점검표", form_type="검사", status="진행중", assignee="전기 감리",
        items=[rf.FormItem(label="외관", checked=True), rf.FormItem(label="절연저항", checked=True),
               rf.FormItem(label="결선", checked=False), rf.FormItem(label="명판", checked=False)])))
    fid = created["form_id"]
    assert created["completion"] == 50  # 2/4
    # 항목 전체 체크 → 완료율 100
    patched = asyncio.run(rf.patch_form(fid, rf.FormPatch(
        items=[rf.FormItem(label="x", checked=True), rf.FormItem(label="y", checked=True)])))
    assert patched["completion"] == 100
    # summary
    summary = asyncio.run(rf.form_summary(project_name="Study_Project"))
    assert summary["total"] == 1 and summary["avg_completion"] == 100
    # 삭제
    assert asyncio.run(rf.delete_form(fid))["deleted"] == fid
    assert asyncio.run(rf.list_forms(project_name="Study_Project")) == []


def test_form_route_validation(tmp_path, monkeypatch):
    rf = _reload_routes(tmp_path, monkeypatch)
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as e1:
        asyncio.run(rf.create_form(rf.FormCreate(title="   ")))
    assert e1.value.status_code == 400
    with pytest.raises(HTTPException) as e2:
        asyncio.run(rf.create_form(rf.FormCreate(title="t", form_type="외계")))
    assert e2.value.status_code == 400
    with pytest.raises(HTTPException) as e3:
        asyncio.run(rf.create_form(rf.FormCreate(title="t", status="완결")))
    assert e3.value.status_code == 400
    with pytest.raises(HTTPException) as e4:
        asyncio.run(rf.patch_form("ghost", rf.FormPatch(status="완료")))
    assert e4.value.status_code == 404
    with pytest.raises(HTTPException) as e5:
        asyncio.run(rf.delete_form("ghost"))
    assert e5.value.status_code == 404


def test_form_completion_empty_items(tmp_path, monkeypatch):
    rf = _reload_routes(tmp_path, monkeypatch)
    created = asyncio.run(rf.create_form(rf.FormCreate(title="항목 없는 양식")))
    assert created["completion"] == 0
