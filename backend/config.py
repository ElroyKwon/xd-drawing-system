"""S1 백엔드 설정. 환경변수로 오버라이드 가능."""
import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
REPO_ROOT = BACKEND_DIR.parent
# 기본은 backend/uploads. 격리 테스트/데모는 XD_UPLOADS_DIR로 별도 디렉터리 지정(실 데이터 격리).
UPLOADS_DIR = Path(os.environ.get("XD_UPLOADS_DIR", str(BACKEND_DIR / "uploads")))
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# 프론트 정적 빌드(dist). 단일 오리진 배포(설치형 exe) 시 백엔드가 직접 서빙.
# 없으면 미마운트 — 개발은 Vite dev 서버(5173)가 별도로 뜬다.
FRONTEND_DIST = Path(os.environ.get("XD_FRONTEND_DIST", str(REPO_ROOT / "dist")))

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

# S15 D8 — LLM 추출 사이드카(8002) 킬스위치. "1"이면 규칙 추출 후 8002에 병합 요청.
# 기본 "0": 8000은 8002를 호출하지 않고 규칙기반 결과만 저장(egress 0·8002 없이 정상).
EXTRACT_LLM = os.environ.get("XD_EXTRACT_LLM", "0") == "1"
EXTRACT_ADDR = os.environ.get("XD_EXTRACT_ADDR", "127.0.0.1:8002")
# 8002가 원본 파일을 되받을 수 있도록 8000이 자신을 가리키는 베이스 URL(사이드카 GET용).
SELF_BASE_URL = os.environ.get("XD_SELF_BASE_URL", "http://127.0.0.1:8000")

# CORS (vite dev 5173/5174)
CORS_ORIGINS = [
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://localhost:5173",
    "http://localhost:5174",
]
