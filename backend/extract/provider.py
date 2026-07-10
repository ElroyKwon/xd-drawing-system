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

# 설비 공존 관계(Stage 1) 파라미터 — FROZEN 스펙 2026-07-10 §4.
_MAX_EQ_PER_SHEET = 12   # 시트당 설비 상한(폭발 가드, 현 데이터 무발동)
_MIN_SHARED_SHEETS = 1   # 최소 공유 시트(1=후보 주도, 큐레이트 위임)
_CO_BASE, _CO_STEP, _CO_CAP = 0.3, 0.1, 0.65  # confidence: 공유 수 스케일, CAP<0.7(항상 미검증)


def _loads_lenient(raw: str) -> dict:
    """모델이 ```json 펜스나 앞뒤 잡문을 붙여도 첫 { … 마지막 } 를 잘라 파싱. 실패 시 {}."""
    if not raw:
        return {}
    s = raw.strip()
    if s.startswith("```"):
        s = s.split("```", 2)[1] if s.count("```") >= 2 else s.strip("`")
        if s.startswith("json"):
            s = s[4:]
    i, j = s.find("{"), s.rfind("}")
    if i != -1 and j != -1 and j > i:
        s = s[i:j + 1]
    try:
        return json.loads(s)
    except Exception:  # noqa: BLE001
        return {}


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

    def analyze_visual(self, full_text: str, image_b64, equipment_context: list) -> dict:
        """멀티모달 단선결선도 심층 분석 — mock 은 egress 0 → 빈 결과(실 LLM 트랙만 채운다)."""
        return {"equipment": [], "relations": [], "notes": []}

    def analyze(self, equipment: list, sheets: list) -> dict:
        """설비 appears_on 공존 관계(egress 0). 같은 시트에 등장하는 설비쌍 → relates_to(track=llm 후보).

        어휘 벽 우회: 반환 src_tag/dst_tag = **설비 tag**(build tag_to_eq 와 동일 어휘).
        입력은 equipment[].sheet_ids(공존 소스). `sheets` 는 시그니처 유지용(Stage 1 미사용).
        필터: 시트당 설비 > MAX 스킵 · 공유 시트 < MIN 드롭. confidence CAP<0.7(항상 미검증).
        """
        sheet_to_tags: dict = {}
        for e in equipment:
            tag = e.get("tag")
            if not tag:
                continue
            for sid in (e.get("sheet_ids") or []):
                sheet_to_tags.setdefault(sid, set()).add(tag)
        pair_shared: dict = {}
        skipped_sheets = 0
        for sid, tags in sheet_to_tags.items():
            if len(tags) > _MAX_EQ_PER_SHEET:
                skipped_sheets += 1
                continue
            st = sorted(tags)
            for i in range(len(st)):
                for j in range(i + 1, len(st)):
                    pair_shared[(st[i], st[j])] = pair_shared.get((st[i], st[j]), 0) + 1
        relations = []
        dropped = 0
        for (a, b), shared in sorted(pair_shared.items()):
            if shared < _MIN_SHARED_SHEETS:
                dropped += 1
                continue
            conf = round(min(_CO_BASE + _CO_STEP * shared, _CO_CAP), 2)
            relations.append({
                "src_tag": a, "dst_tag": b, "relation": "relates_to",
                "confidence": conf,
                "evidence": f"설비 공존 시트 {shared}개",
            })
        # silent-cap 금지(스펙 §5): 규모를 로그로 명시.
        logger.info("analyze(설비공존): 후보 %d · 스킵시트 %d · 드롭 %d",
                    len(relations), skipped_sheets, dropped)
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
        """실 LLM 호출 공통 경로 — 원문 텍스트만 반환. 호출 실패는 ExtractProviderError.

        XD_EXTRACT_EFFORT 설정 시 reasoning effort 주입(예: normal). 미설정이면 모델 기본.
        """
        try:
            kwargs: dict = {"model": self._model, "input": prompt}
            effort = os.environ.get("XD_EXTRACT_EFFORT")
            if effort:
                kwargs["reasoning"] = {"effort": effort}
            resp = self._client.responses.create(**kwargs)
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

    def analyze_visual(self, full_text: str, image_b64, equipment_context: list) -> dict:
        """멀티모달(도면 텍스트 + 페이지 이미지) 단선결선도 심층 분석 — HUMAN_GATE-7.

        상한 없음(스펙: 입출력 캡 제거). 이미지에서 결선·심볼·정격을, 텍스트에서 라벨을 읽어
        설비(태그·종류·정격), 전원계통 관계(feeds/protects/relates_to), 지식노트를 JSON 으로.
        """
        prompt = (
            "너는 전기 단선결선도(SLD)·분전반 결선도 분석가다. 아래 도면의 텍스트와 이미지를 "
            "함께 보고, 도면에 실제로 그려진 대로 최대한 상세히 추출하라. 상한 없이 보이는 대로 모두. "
            "관계는 전원 흐름 상위→하위 방향으로(상위가 src, 하위가 dst) relation 은 feeds(급전)/"
            "protects(보호)/relates_to(관련) 중 택. 확실치 않으면 relates_to. "
            "JSON 만 출력: {\"equipment\":[{\"tag\",\"type\",\"rating\"}],"
            "\"relations\":[{\"src\",\"dst\",\"relation\",\"evidence\",\"confidence\"}],"
            "\"notes\":[{\"about\",\"text\",\"confidence\"}]}\n\n"
            f"[참고 등록설비] {json.dumps(equipment_context, ensure_ascii=False)}\n\n"
            f"[도면 텍스트]\n{full_text}"
        )
        content: list = [{"type": "input_text", "text": prompt}]
        if image_b64:
            content.append({"type": "input_image",
                            "image_url": f"data:image/png;base64,{image_b64}"})
        try:
            kwargs: dict = {"model": self._model, "input": [{"role": "user", "content": content}]}
            effort = os.environ.get("XD_EXTRACT_EFFORT")
            if effort:
                kwargs["reasoning"] = {"effort": effort}
            resp = self._client.responses.create(**kwargs)
            raw = getattr(resp, "output_text", "") or "{}"
        except Exception as e:  # noqa: BLE001
            raise ExtractProviderError(f"OpenAI 멀티모달 호출 실패: {e}") from e
        data = _loads_lenient(raw)
        return {"equipment": data.get("equipment", []),
                "relations": data.get("relations", []),
                "notes": data.get("notes", [])}


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
