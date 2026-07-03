"""AI 챗 사이드카 — 독립 FastAPI 프로세스(8001) (S8.0 부트스트랩).

기존 8000 앱과 완전 격리: backend 모듈 import 0(격리 불변식 K6),
8000 공개 HTTP API만 소비(순수 클라이언트, OPEN-1 (a)).
CORS origin은 자체 상수 — backend.config import 금지(격리 불변식, 검수 교정 ④).
"""
from __future__ import annotations

import logging
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

logger = logging.getLogger(__name__)


def _load_dotenv() -> None:
    """backend/ai/.env(gitignore)에서 KEY=VALUE를 os.environ에 주입(미존재 시 무시).

    OPENAI_API_KEY·XD_AI_MODEL·XD_AI_PROVIDER를 여기로 공급. 새 의존성 없이 최소 파싱.
    """
    env = Path(__file__).resolve().parent / ".env"
    if not env.exists():
        return
    for line in env.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_dotenv()

import egress  # noqa: E402  (dotenv 주입 후 import — 부팅 키 검증에 env 필요)
from health import router as health_router  # noqa: E402
from routes_chat import router as chat_router  # noqa: E402
from routes_egress import router as egress_router  # noqa: E402


def _validate_key_at_boot() -> None:
    """부팅 시 키 존재/형식을 검증하고 **마스킹된 형태로만** 로깅(원문 0)."""
    st = egress.status()
    if not st["key_present"]:
        logger.warning("OPENAI_API_KEY 미설정 — 실 LLM 불가, mock 폴백(mode=%s)", st["current_mode"])
    else:
        logger.info("egress 준비: key=%s provider_default=%s mode=%s model=%s",
                    st["key_masked"], st["provider_default"], st["current_mode"], st["model"])


_validate_key_at_boot()

# 프론트 dev origin만 자체 상수로 허용(실사용 CORS/소비자는 S8.3).
_CORS_ORIGINS = [
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://localhost:5173",
    "http://localhost:5174",
]

app = FastAPI(title="XD AI 사이드카", version="0.1.0 (S8.0)")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
app.include_router(health_router)
app.include_router(chat_router)
app.include_router(egress_router)


@app.get("/")
async def root():
    return {"service": "xd-ai-sidecar", "stage": "S8.0", "docs": "/docs"}
