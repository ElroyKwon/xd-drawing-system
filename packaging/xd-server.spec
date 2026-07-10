# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller onedir 스펙 — XD Drawing System 단일 exe(supervisor).

빌드(build-venv 에서, 모든 의존성 병합 설치 후):
    pyinstaller packaging/xd-server.spec
산출: dist/xd-server/xd-server.exe  (+ _internal/ onedir)

전제:
  1) 프론트 빌드 완료: `set VITE_BACKEND_BASE=` && `npm run build` → dist/  (상대경로 same-origin)
  2) build-venv: py -3.12 -m venv packaging/build-venv
     packaging/build-venv/Scripts/pip install -r backend/requirements.txt -r backend/ai/requirements.txt pyinstaller
"""
import os
from PyInstaller.utils.hooks import collect_all, collect_submodules

ROOT = os.path.abspath(os.getcwd())
BACKEND = os.path.join(ROOT, "backend")
AI = os.path.join(BACKEND, "ai")
DIST = os.path.join(ROOT, "dist")

datas = []
binaries = []
hiddenimports = []

# 무거운/데이터 의존 패키지: 데이터파일·서브모듈 전량 수집
for pkg in ("matplotlib", "fitz", "pymupdf", "ezdxf", "uvicorn"):
    try:
        d, b, h = collect_all(pkg)
        datas += d; binaries += b; hiddenimports += h
    except Exception:
        pass

hiddenimports += collect_submodules("uvicorn")
hiddenimports += [
    "uvicorn.logging", "uvicorn.loops.auto", "uvicorn.protocols.http.auto",
    "uvicorn.protocols.websockets.auto", "uvicorn.lifespan.on",
]

# 프론트 dist → onedir 안 frontend/ 로 동봉(런타임 XD_FRONTEND_DIST 가 여기를 가리킴)
if os.path.isdir(DIST):
    datas.append((DIST, "frontend"))

# 백엔드/AI 소스는 pathex 로 정적 분석되지만, 데이터로도 동봉해 런타임 경로 해석을 견고하게
datas.append((BACKEND, "backend"))

a = Analysis(
    ["packaging/serve_all.py"],
    pathex=[ROOT, BACKEND, AI],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=[],
    excludes=["tkinter", "pytest", "respx"],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz, a.scripts, [],
    exclude_binaries=True,
    name="xd-server",
    console=True,          # 서버 로그 창(닫으면 종료). GUI 무콘솔은 후속.
    icon=None,             # packaging/xd.ico 있으면 지정
)
coll = COLLECT(
    exe, a.binaries, a.datas,
    strip=False, upx=False,
    name="xd-server",
)
