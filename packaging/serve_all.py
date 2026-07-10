"""XD Drawing System — 단일 프로세스 supervisor (설치형 exe 엔트리).

백엔드(8000, 프론트 dist 단일 오리진 서빙) + AI 사이드카(8001)를 각각 스레드로 기동하고
기본 브라우저를 연다. PyInstaller frozen / from-source 양쪽에서 동작.

- 데이터(업로드·JSON store)는 쓰기 가능 경로에 둔다:
  frozen  → %LOCALAPPDATA%\\XD-Drawing\\data\\uploads
  source  → backend/uploads (config 기본)
- 프론트 dist:
  frozen  → onedir 동봉 위치(_MEIPASS/frontend 또는 exe-인접 frontend)
  source  → repo/dist (config 기본)
- TypeDB 제외 기준: XD_STORE=json 고정.
"""
from __future__ import annotations

import os
import sys
import threading
import time
import webbrowser
from pathlib import Path


def _frozen() -> bool:
    return getattr(sys, "frozen", False)


def _meipass() -> Path:
    # PyInstaller onedir/onefile 런타임 리소스 루트
    return Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))


def _exe_dir() -> Path:
    return Path(sys.executable).resolve().parent if _frozen() else Path(__file__).resolve().parent.parent


def _configure_env() -> None:
    os.environ.setdefault("XD_STORE", "json")  # TypeDB 제외 기준선
    if _frozen():
        # 데이터는 사용자별 쓰기 가능 경로(영속·업그레이드 생존)
        appdata = os.environ.get("LOCALAPPDATA") or str(Path.home())
        data = Path(appdata) / "XD-Drawing" / "data" / "uploads"
        data.mkdir(parents=True, exist_ok=True)
        os.environ.setdefault("XD_UPLOADS_DIR", str(data))
        # 프론트 dist: onedir 동봉(frontend/) 우선, 없으면 exe-인접
        for cand in (_meipass() / "frontend", _exe_dir() / "frontend"):
            if cand.is_dir():
                os.environ.setdefault("XD_FRONTEND_DIST", str(cand))
                break
        # backend 소스가 onedir에 동봉된 경우 import 경로 추가
        for cand in (_meipass() / "backend", _exe_dir() / "backend"):
            if cand.is_dir():
                sys.path.insert(0, str(cand))
    else:
        # from-source: backend 모듈 경로만 추가(config 기본 경로 사용)
        sys.path.insert(0, str(_exe_dir() / "backend"))


def _run_backend() -> None:
    import uvicorn
    from main import app  # backend.main
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")


def _run_ai() -> None:
    import uvicorn
    try:
        ai_dir = None
        for cand in (_meipass() / "backend" / "ai", _exe_dir() / "backend" / "ai"):
            if cand.is_dir():
                ai_dir = cand
                break
        if ai_dir:
            sys.path.insert(0, str(ai_dir))
        from main_ai import app as ai_app
        uvicorn.run(ai_app, host="127.0.0.1", port=8001, log_level="warning")
    except Exception as e:  # noqa: BLE001 — AI 사이드카는 선택적(키 없으면 mock, 실패해도 본체 동작)
        print(f"[XD] AI 사이드카 미기동(무시): {e}")


def main() -> None:
    _configure_env()
    threading.Thread(target=_run_backend, daemon=True, name="xd-backend").start()
    threading.Thread(target=_run_ai, daemon=True, name="xd-ai").start()
    # 백엔드 부팅 대기 후 브라우저
    time.sleep(3)
    url = "http://127.0.0.1:8000/"
    print(f"[XD] XD Drawing System 실행 중 → {url}")
    print("[XD] 종료하려면 이 창을 닫으세요.")
    try:
        webbrowser.open(url)
    except Exception:  # noqa: BLE001
        pass
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("[XD] 종료.")


if __name__ == "__main__":
    main()
