"""LLM 추출 provider 추상화 (S15 D8) — 8002 사이드카 전용, backend import 0.

- MockExtractProvider: 외부 전송 0(egress 0). 넘겨받은 text_index 를 결정적 규칙으로
  재읽어 설비 태그 후보 + 요약을 만든다(키 없이·오프라인 동작, 기본값).
- OpenAIExtractProvider: 실 LLM 독립 읽기. **HUMAN_GATE-7** — `XD_EXTRACT_LLM=1` +
  키가 있어야만 생성되고, 실 고객 도면을 외부로 대량 전송한다. 기본 off.

두 provider 동일 계약:
    read(text_index: str, source_kind: str) -> {"llm_tags": [...], "summary": str|None}
    analyze(equipment: list, sheets: list) -> {"relations": [...], "notes": [...]}
      · mock  = 같은 시트 공출현 설비쌍을 결정적 relates_to 로(egress 0).
      · openai= 실 LLM 관계·지식노트 추출(HUMAN_GATE-7).
"""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Optional

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "gpt-5.5"

# 설비 태그 후보 패턴: 영문 대문자 접두 + 하이픈/숫자 (PP-380V, MTR-1, VCB, TR-3204 …).
_TAG_RE = re.compile(r"\b[A-Z]{2,}[A-Z0-9]*(?:-[A-Z0-9]+)*\b")
_STOP = {"THE", "AND", "FOR", "PANEL", "BOARD", "DWG", "REV", "SHEET", "NO",
         "TO", "OF", "IN", "ON", "AT", "BY", "OR", "IS", "AS", "FROM", "WITH", "FEEDS"}
# mock LLM 은 사전 검증이 아닌 독립 읽기 → prefix추론 수준의 "미검증" 신뢰(0.65).
# O9 정직성 임계값(<0.7=미검증)과 정합: rule 사전확정(0.92)과 병합되면 max로 상승.
_MOCK_CONF = 0.65


class ExtractProviderError(Exception):
    """provider 구성/호출 실패."""


class ExtractProvider:
    name = "base"

    def read(self, text_index: str, source_kind: str) -> dict:
        raise NotImplementedError

    def analyze(self, equipment: list, sheets: list) -> dict:
        raise NotImplementedError


class MockExtractProvider(ExtractProvider):
    """egress 0. text_index 에서 설비 태그 후보를 결정적으로 뽑고 짧은 요약을 만든다.

    실 LLM 을 흉내 낸 오프라인 트랙 — 규칙 트랙과 독립적으로 한 번 더 읽어(병합 시
    src=merged 로 신뢰 상승), 규칙이 놓친 후보를 보강한다. 확신은 미검증 수준(_MOCK_CONF=0.65,
    O9 정합: <0.7 이면 AI 가 '자동추출(미검증)'으로 명시).
    """

    name = "mock"

    def read(self, text_index: str, source_kind: str) -> dict:
        text = text_index or ""
        cands: dict[str, int] = {}
        for m in _TAG_RE.findall(text):
            if m in _STOP or len(m) < 2:
                continue
            cands[m] = cands.get(m, 0) + 1
        llm_tags = [
            {"tag": tag, "type": "", "confidence": _MOCK_CONF, "src": "llm",
             "evidence": f"LLM(mock) 재읽기 {source_kind}: {cnt}회 등장"}
            for tag, cnt in sorted(cands.items(), key=lambda kv: (-kv[1], kv[0]))
        ]
        summary = None
        if llm_tags:
            head = ", ".join(t["tag"] for t in llm_tags[:5])
            summary = f"[mock] 설비 후보 {len(llm_tags)}종(예: {head})"
        return {"llm_tags": llm_tags, "summary": summary}

    def analyze(self, equipment: list, sheets: list) -> dict:
        """결정적 공출현 관계(egress 0). 같은 시트에 함께 나온 설비쌍 → relates_to.
        실 LLM 없이도 그래프를 채워 시각화·테스트가 되게 하는 오프라인 기본값.
        `equipment` 는 무시한다(관계는 시트 공출현에서만 유도) — 공유 시그니처 유지용."""
        pair_sheets: dict = {}
        for s in sheets:
            tags = sorted({t.get("tag", "") for t in (s.get("tags") or []) if t.get("tag")})
            for i in range(len(tags)):
                for j in range(i + 1, len(tags)):
                    pair_sheets.setdefault((tags[i], tags[j]), []).append(s.get("sheet_id"))
        relations = [{
            "src_tag": a, "dst_tag": b, "relation": "relates_to",
            "confidence": round(min(0.3 + 0.2 * len(sids), 0.7), 2),
            "evidence": f"같은 시트 공출현: {', '.join(str(x) for x in sids[:3])}",
        } for (a, b), sids in sorted(pair_sheets.items())]
        return {"relations": relations, "notes": []}


class OpenAIExtractProvider(ExtractProvider):
    """실 LLM 독립 읽기 — HUMAN_GATE-7(대량 egress). 키·게이트 없으면 생성 실패."""

    name = "openai"

    def __init__(self, model: Optional[str] = None, api_key: Optional[str] = None):
        key = api_key or os.environ.get("OPENAI_API_KEY")
        if not key:
            raise ExtractProviderError("OPENAI_API_KEY 미설정 — 실 LLM 추출 불가")
        try:
            from openai import OpenAI  # lazy
        except ImportError as e:
            raise ExtractProviderError(f"openai 패키지 미설치: {e}") from e
        self._client = OpenAI(api_key=key)
        self._model = model or os.environ.get("XD_EXTRACT_MODEL", DEFAULT_MODEL)

    def _complete(self, prompt: str) -> str:
        """실 LLM 호출 공통 경로 — 원문 텍스트만 반환. 호출 실패는 ExtractProviderError."""
        try:
            resp = self._client.responses.create(model=self._model, input=prompt)
            return getattr(resp, "output_text", "") or "{}"
        except Exception as e:  # noqa: BLE001
            raise ExtractProviderError(f"OpenAI 호출 실패: {e}") from e

    def read(self, text_index: str, source_kind: str) -> dict:
        prompt = (
            "다음 도면 시트 텍스트에서 설비 태그(분전반·모터·차단기 등)만 뽑아라. "
            "JSON {\"tags\":[{\"tag\":..,\"type\":..}],\"summary\":..} 로만 답하라.\n\n"
            f"[{source_kind}]\n{text_index[:4000]}"
        )
        raw = self._complete(prompt)
        try:
            data = json.loads(raw)
        except Exception as e:  # noqa: BLE001
            raise ExtractProviderError(f"OpenAI 추출 호출 실패: {e}") from e
        tags = [
            {"tag": t.get("tag", ""), "type": t.get("type", ""),
             "confidence": 0.75, "src": "llm", "evidence": "LLM 독립 읽기"}
            for t in (data.get("tags") or []) if t.get("tag")
        ]
        return {"llm_tags": tags, "summary": data.get("summary")}

    def analyze(self, equipment: list, sheets: list) -> dict:
        """실 LLM 관계·지식 추출 — HUMAN_GATE-7 (실 고객 도면을 외부 전송).
        프롬프트: 설비 목록·시트 태그·본문 발췌를 주고 전원계통 상위/하위 relates_to 와
        wiki 지식노트를 JSON 으로 요청. provenance 는 배치 단위로 `analyzer.llm_model`
        에 담기며(provider 출력엔 track 필드 없음), track=llm 표기는 하류 build 단계가 찍는다."""
        prompt = (
            "다음 설비·시트에서 설비 간 전원계통/상하위 관계(relates_to)와 "
            "지식노트(notes)를 JSON 으로 추출. "
            "형식: {\"relations\":[{\"src_tag\",\"dst_tag\",\"relation\":\"relates_to\","
            "\"confidence\":0~1,\"evidence\"}],\"notes\":[{\"about_tag\",\"text\",\"confidence\"}]}\n"
            f"설비: {json.dumps(equipment, ensure_ascii=False)[:2000]}\n"
            f"시트: {json.dumps(sheets, ensure_ascii=False)[:6000]}"
        )
        raw = self._complete(prompt)  # 기존 실 LLM 호출 경로 재사용
        try:
            data = json.loads(raw)
        except (json.JSONDecodeError, AttributeError, TypeError):
            logger.warning("analyze: 모델 비정형 반환 → 빈 결과")
            return {"relations": [], "notes": []}
        return {"relations": data.get("relations", []), "notes": data.get("notes", [])}


def make_extract_provider(prefer: Optional[str] = None) -> ExtractProvider:
    """provider 선택. XD_EXTRACT_LLM=0(기본)이면 항상 mock(egress 0).

    XD_EXTRACT_LLM=1 이고 XD_EXTRACT_PROVIDER=openai 일 때만 실 LLM 시도(HUMAN_GATE-7).
    키 부재 시 mock 으로 우아 폴백.
    """
    if os.environ.get("XD_EXTRACT_LLM", "0") != "1":
        return MockExtractProvider()
    choice = (prefer or os.environ.get("XD_EXTRACT_PROVIDER") or "mock").lower()
    if choice == "openai":
        try:
            return OpenAIExtractProvider()
        except ExtractProviderError:
            return MockExtractProvider()
    return MockExtractProvider()
