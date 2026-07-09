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
