"""xd-drawing-system 로컬 백엔드 엔트리 (S1).

기동: uvicorn main:app --host 127.0.0.1 --port 8000 --reload
(또는 python -m uvicorn ...)
"""
import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import config
from routes_drawing import router as drawing_router
from routes_files import router as files_router
from routes_auth import router as auth_router
from routes_issue import router as issue_router
from routes_task import router as task_router
from routes_form import router as form_router
from routes_photo import router as photo_router
from routes_template import router as template_router
from routes_markup import router as markup_router
from routes_search import router as search_router
from routes_ontology import router as ontology_router
from store import get_store

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

app = FastAPI(title="XD Drawing System — Local Backend", version="S1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 시트 PNG/원본 정적 서빙
app.mount("/files", StaticFiles(directory=str(config.UPLOADS_DIR)), name="files")
app.include_router(drawing_router)
app.include_router(files_router)
app.include_router(markup_router)
app.include_router(issue_router)
app.include_router(task_router)
app.include_router(form_router)
app.include_router(photo_router)
app.include_router(template_router)
app.include_router(search_router)
app.include_router(ontology_router)
app.include_router(auth_router)


@app.get("/health")
async def health():
    store = get_store()
    return {
        "status": "ok",
        "store_backend": store.backend_name,
        "oda_available": os.path.exists(config.ODA_EXE),
        "uploads_dir": str(config.UPLOADS_DIR),
    }
