"""챗 오케스트레이션 — tool-use 루프 (S8.1).

사용자 메시지 → LLM(툴 정의 제공) → LLM이 툴 호출 → 사이드카가 8000 HTTP로 실행 →
결과를 다시 LLM에 공급 → 그라운딩된 최종 답. 툴은 S8.0의 search·list_sheets(오직 HTTP).

project는 서버가 고정한다(LLM 파라미터 아님) — 프로젝트 격리.
"""
from __future__ import annotations

import json
from typing import Optional

import tools
from provider import LLMProvider, make_provider

_MAX_STEPS = 5

SYSTEM_PROMPT = (
    "당신은 XD 도면관리 시스템의 프로젝트 어시스턴트입니다. "
    "사용자의 질문에 답할 때는 반드시 제공된 툴로 실제 프로젝트 데이터를 조회해 "
    "그 결과에만 근거해 한국어로 간결히 답하세요. 추측하지 말고, 데이터에 없으면 없다고 하세요. "
    "가능하면 시트 번호·이슈 제목 등 구체 항목을 인용하세요."
)

# OpenAI function-calling 스키마. project는 서버가 주입하므로 파라미터에 없음.
TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "search",
            "description": "프로젝트에서 시트·이슈·파일·폴더를 부분일치로 교차 검색한다.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "검색어(예: 단선결선도, 케이블, 접지)"},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_sheets",
            "description": "프로젝트의 완료된 도면 시트 목록을 반환한다(공종 코드로 선택 필터).",
            "parameters": {
                "type": "object",
                "properties": {
                    "discipline": {
                        "type": "string",
                        "description": "공종 코드 필터(예: E=전기, G=기타). 생략 시 전체.",
                    },
                },
            },
        },
    },
]


def _dispatch(name: str, args: dict, project: str) -> dict:
    """툴 이름 → S8.0 툴 실행(project 주입)."""
    if name == "search":
        return tools.search(project, args.get("query", ""))
    if name == "list_sheets":
        return tools.list_sheets(project, args.get("discipline"))
    return {"error": f"알 수 없는 툴: {name}"}


def run_chat(
    project: str,
    message: str,
    history: Optional[list[dict]] = None,
    provider: Optional[LLMProvider] = None,
) -> dict:
    """한 턴 실행. 반환: {answer, tool_calls(추적), provider}.

    history는 [{role, content}] (이전 user/assistant 턴). tool 메시지는 내부 전용.
    """
    provider = provider or make_provider()
    messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]
    for h in history or []:
        if h.get("role") in ("user", "assistant") and h.get("content"):
            messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": message})

    trace: list[dict] = []
    for _ in range(_MAX_STEPS):
        out = provider.complete(messages, TOOLS_SCHEMA)
        calls = out.get("tool_calls") or []
        if not calls:
            return {
                "answer": out.get("content") or "",
                "tool_calls": trace,
                "provider": provider.name,
            }
        # assistant 툴콜 메시지(OpenAI 재공급 포맷).
        messages.append({
            "role": "assistant",
            "content": out.get("content"),
            "tool_calls": [
                {"id": c["id"], "type": "function",
                 "function": {"name": c["name"], "arguments": c["arguments"]}}
                for c in calls
            ],
        })
        for c in calls:
            try:
                args = json.loads(c["arguments"] or "{}")
            except json.JSONDecodeError:
                args = {}
            result = _dispatch(c["name"], args, project)
            trace.append({"name": c["name"], "arguments": args,
                          "result_summary": _summarize(c["name"], result)})
            messages.append({
                "role": "tool",
                "tool_call_id": c["id"],
                "content": json.dumps(result, ensure_ascii=False),
            })
    # 스텝 초과 — 마지막 응답 유도(툴 없이).
    out = provider.complete(messages, [])
    return {"answer": out.get("content") or "", "tool_calls": trace, "provider": provider.name}


def _summarize(name: str, result: dict) -> str:
    if name == "list_sheets":
        return f"count={result.get('count')}"
    if name == "search":
        return (f"sheets={len(result.get('sheets', []))} "
                f"issues={len(result.get('issues', []))} "
                f"files={len(result.get('files', []))}")
    return "ok"
