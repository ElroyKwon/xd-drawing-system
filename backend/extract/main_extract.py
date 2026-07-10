"""LLM 추출 사이드카 (S15 D8) — 포트 8002. 기존 8000 backend 와 완전 격리.

계약(prompts/20 §8002):
  POST /extract  body {file_url, source_kind, rule_tags[], text_index}
    → provider(독립 읽기) → 분류·정규화 → {tags[], summary, conflicts[]}
  GET  /health

격리 불변식(O12): backend 모듈 import 0. 8000 과는 HTTP 로만(도면 파일도 8000 GET).
킬스위치 XD_EXTRACT_LLM=0(기본) → provider=mock → egress 0.
CORS origin 은 자체 상수(backend.config import 금지, ai 사이드카와 동일 규율).
"""
from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from normalize import normalize
from provider import make_extract_provider

CORS_ORIGINS = [
    "http://127.0.0.1:5173", "http://127.0.0.1:5174",
    "http://localhost:5173", "http://localhost:5174",
]

app = FastAPI(title="XD 추출 사이드카 (8002)")
app.add_middleware(
    CORSMiddleware, allow_origins=CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"],
)


class ExtractRequest(BaseModel):
    file_url: str | None = None
    source_kind: str = "pdf"
    rule_tags: list[dict] = []
    text_index: str = ""


class AnalyzeRequest(BaseModel):
    equipment: list[dict] = []
    sheets: list[dict] = []


class SheetAnalyzeRequest(BaseModel):
    pdf_path: str
    equipment: list[dict] = []
    render_zoom: float = 2.2


def _read_pdf(path: str, zoom: float) -> tuple[str, str | None]:
    """fitz(pymupdf)로 1페이지 전체 텍스트 + 페이지 렌더 PNG(base64). 실패/미설치 시 (text, None)."""
    import base64
    try:
        import fitz  # lazy — ai/.venv 전용
    except ImportError:
        return "", None
    doc = fitz.open(path)
    page = doc[0]
    text = page.get_text()
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom))
    b64 = base64.b64encode(pix.tobytes("png")).decode()
    doc.close()
    return text, b64


@app.get("/health")
def health() -> dict:
    prov = make_extract_provider()
    return {
        "status": "ok",
        "provider": prov.name,
        "llm_enabled": os.environ.get("XD_EXTRACT_LLM", "0") == "1",
    }


@app.post("/extract")
def extract(req: ExtractRequest) -> dict:
    """규칙 트랙 결과(rule_tags·text_index)를 받아 독립 LLM 읽기 후 병합.

    스켈레톤 정직성: mock provider 는 8000 이 이미 추출해 넘긴 `text_index` 를
    권위로 재읽는다(파일 재파싱 없음). `file_url` 원본 재-GET 은 실 LLM 트랙의
    후속 과제(HUMAN_GATE-7). 계약 유지를 위해 필드는 받되 mock 은 사용하지 않는다.
    """
    provider = make_extract_provider()
    read = provider.read(req.text_index, req.source_kind)
    tags, conflicts = normalize(req.rule_tags, read.get("llm_tags", []))
    return {
        "tags": tags,
        "summary": read.get("summary"),
        "conflicts": conflicts,
        "extractor": {"rule_version": "1", "llm_model": provider.name},
    }


@app.post("/analyze")
def analyze(req: AnalyzeRequest) -> dict:
    """설비관계(relates_to)·지식노트 생성 — 외부 AI API 경유(provider).

    격리 유지: backend import 0, 코퍼스는 HTTP body 로 받는다(8000 이 build 스크립트에서
    수집해 POST). mock provider 는 공출현 결정적 관계(egress 0), 실 LLM 은 HUMAN_GATE-7.
    """
    provider = make_extract_provider()
    out = provider.analyze(req.equipment, req.sheets)
    return {
        "relations": out.get("relations", []),
        "notes": out.get("notes", []),
        "analyzer": {"llm_model": provider.name},
    }


@app.post("/analyze_sheet")
def analyze_sheet(req: SheetAnalyzeRequest) -> dict:
    """멀티모달 단선결선도 심층 분석 — 시트 PDF 1장에서 텍스트+이미지를 gpt 에 함께.

    HUMAN_GATE-7(대량 egress + 실 고객 도면 이미지 전송). mock 이면 egress 0(빈 결과).
    사이드카가 pdf_path 를 직접 읽는다(격리 유지: backend import 0, 파일 읽기만).
    """
    provider = make_extract_provider()
    full_text, image_b64 = _read_pdf(req.pdf_path, req.render_zoom)
    out = provider.analyze_visual(full_text, image_b64, req.equipment)
    return {
        "equipment": out.get("equipment", []),
        "relations": out.get("relations", []),
        "notes": out.get("notes", []),
        "analyzer": {"llm_model": provider.name, "has_image": image_b64 is not None,
                     "text_len": len(full_text)},
    }
