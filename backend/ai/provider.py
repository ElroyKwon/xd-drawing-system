"""LLM provider 추상화 (S8.1).

- OpenAIProvider: 실 LLM(OpenAI chat.completions + function-calling). 대화·툴 결과를
  OpenAI로 전송한다 = **외부 egress(HUMAN_GATE — 사용자 승인 2026-07-03: GPT API).**
  모델은 환경변수 `XD_AI_MODEL`(기본 "gpt-5.5-fast"), 키는 `OPENAI_API_KEY`.
- MockProvider: 외부 전송 0. 결정적 규칙으로 툴을 고른다(오프라인 테스트·키 부재 폴백).

두 provider 모두 동일 계약:
    complete(messages, tools) -> {"content": str|None, "tool_calls": [{"id","name","arguments"}]}
messages/tools는 OpenAI 포맷을 그대로 쓴다(어댑터 단순화).
"""
from __future__ import annotations

import json
import os
from typing import Any, Optional

DEFAULT_MODEL = "gpt-5.5-fast"


class ProviderError(Exception):
    """provider 구성/호출 실패."""


class LLMProvider:
    name = "base"

    def complete(self, messages: list[dict], tools: list[dict]) -> dict:
        raise NotImplementedError


class MockProvider(LLMProvider):
    """키 없이 동작하는 결정적 provider. 마지막 사용자 메시지로 툴을 고른다.

    - '시트'/'도면'/'몇 장' → list_sheets
    - 그 외 → search(마지막 사용자 메시지에서 키워드 추출)
    - 툴 결과가 이미 대화에 있으면(=tool 메시지 존재) 최종 답을 합성.
    """

    name = "mock"

    def complete(self, messages: list[dict], tools: list[dict]) -> dict:
        has_tool_result = any(m.get("role") == "tool" for m in messages)
        last_user = next(
            (m["content"] for m in reversed(messages) if m.get("role") == "user"),
            "",
        )
        if has_tool_result:
            # 최종 합성: 마지막 tool 결과 요약.
            last_tool = next(m for m in reversed(messages) if m.get("role") == "tool")
            return {
                "content": f"[mock] 툴 결과 기반 답변: {last_tool['content'][:200]}",
                "tool_calls": [],
            }
        wants_sheets = any(k in last_user for k in ("시트", "도면", "몇 장", "몇장", "공종"))
        if wants_sheets:
            args = {}
            return {"content": None, "tool_calls": [
                {"id": "mock-1", "name": "list_sheets", "arguments": json.dumps(args)}]}
        # search: 조사/공백 제거한 첫 유의어
        kw = last_user.strip().split()[0] if last_user.strip() else ""
        return {"content": None, "tool_calls": [
            {"id": "mock-1", "name": "search", "arguments": json.dumps({"query": kw})}]}


class OpenAIProvider(LLMProvider):
    """실 LLM — OpenAI chat.completions. egress(HUMAN_GATE 승인)."""

    name = "openai"

    def __init__(self, model: Optional[str] = None, api_key: Optional[str] = None):
        key = api_key or os.environ.get("OPENAI_API_KEY")
        if not key:
            raise ProviderError("OPENAI_API_KEY 미설정 — 실 LLM 사용 불가")
        try:
            from openai import OpenAI  # lazy
        except ImportError as e:
            raise ProviderError(f"openai 패키지 미설치: {e}") from e
        self._client = OpenAI(api_key=key)
        self._model = model or os.environ.get("XD_AI_MODEL", DEFAULT_MODEL)

    def complete(self, messages: list[dict], tools: list[dict]) -> dict:
        try:
            resp = self._client.chat.completions.create(
                model=self._model,
                messages=messages,
                tools=tools or None,
                tool_choice="auto" if tools else None,
            )
        except Exception as e:  # openai 예외 계층 광범위 → 구조화
            raise ProviderError(f"OpenAI 호출 실패: {e}") from e
        msg = resp.choices[0].message
        calls = []
        for tc in (msg.tool_calls or []):
            calls.append({
                "id": tc.id,
                "name": tc.function.name,
                "arguments": tc.function.arguments or "{}",
            })
        return {"content": msg.content, "tool_calls": calls}


def make_provider(prefer: Optional[str] = None) -> LLMProvider:
    """provider 선택. prefer 또는 env `XD_AI_PROVIDER`(openai|mock). 기본 openai,
    키 부재 시 mock로 우아 폴백.
    """
    choice = (prefer or os.environ.get("XD_AI_PROVIDER") or "openai").lower()
    if choice == "mock":
        return MockProvider()
    try:
        return OpenAIProvider()
    except ProviderError:
        # 키 없으면 오프라인 mock (라이브 실행 전 개발/테스트용).
        return MockProvider()
