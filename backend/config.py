"""S1 백엔드 설정. 환경변수로 오버라이드 가능."""
import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
UPLOADS_DIR = BACKEND_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

# ODA File Converter (DWG→DXF). 설치 경로.
ODA_EXE = os.environ.get(
    "ODA_EXE",
    r"C:\Program Files\ODA\ODAFileConverter 27.1.0\ODAFileConverter.exe",
)

# TypeDB (Docker typedb/typedb:3.7.3). 미기동 시 JSON store로 폴백.
TYPEDB_ADDR = os.environ.get("TYPEDB_ADDR", "127.0.0.1:1729")
TYPEDB_DB = os.environ.get("TYPEDB_DB", "xd_drawings")

# 적재 백엔드: "auto"(typedb 시도→실패시 json) | "json" | "typedb"
STORE_BACKEND = os.environ.get("XD_STORE", "auto")

# 렌더 DPI
RENDER_DPI = int(os.environ.get("XD_RENDER_DPI", "150"))

# CORS (vite dev 5173/5174)
CORS_ORIGINS = [
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://localhost:5173",
    "http://localhost:5174",
]
