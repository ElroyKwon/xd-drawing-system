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
    "가능하면 시트 번호·이슈 제목 등 구체 항목을 인용하세요. "
    "툴 선택 지침: 특정 도면/파일 이름(예: '제주 BESS', '단선결선도')으로 물으면 "
    "list_sheets의 discipline 필터가 아니라 list_files로 파일 목록을 받아 파일명을 부분일치로 찾으세요"
    "(파일별 sheet_count가 '몇 페이지'입니다). search가 0건이어도 곧바로 없다고 하지 말고 list_files로 확인하세요. "
    "discipline 필터는 공종 코드(E=전기, M=기계, G=기타 등)로 물을 때만 씁니다. "
    "특정 분류(간섭/품질/협의)의 이슈 전부를 물으면 list_issues의 category 필터를 쓰세요."
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
    {
        "type": "function",
        "function": {
            "name": "get_project_summary",
            "description": "프로젝트 요약 통계를 반환한다(파일 수·완료 도면 수·시트 총수·열린 이슈 수·폴더 수).",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_issues",
            "description": "프로젝트의 이슈 목록을 반환한다(상태·분류로 선택 필터). 각 이슈의 제목·상태·분류·시트/파일 연계 ID 포함. 특정 분류(간섭/품질/협의)의 이슈 전부를 물으면 category 필터를 쓴다.",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {
                        "type": "string",
                        "description": "상태 필터(예: 열림, 답변됨, 진행중, 닫힘). 생략 시 삭제됨 제외 전체.",
                    },
                    "category": {
                        "type": "string",
                        "description": "분류 필터. clash=간섭, quality=품질, coordination=협의. 생략 시 전체.",
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_issue",
            "description": "이슈 ID로 단일 이슈의 상세를 반환한다. 없으면 found=false.",
            "parameters": {
                "type": "object",
                "properties": {
                    "issue_id": {"type": "string", "description": "조회할 이슈 ID."},
                },
                "required": ["issue_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_sheet",
            "description": "시트 ID로 단일 시트의 상세(번호·제목·공종·부모 파일)를 반환한다. 없으면 found=false.",
            "parameters": {
                "type": "object",
                "properties": {
                    "sheet_id": {"type": "string", "description": "조회할 시트 ID."},
                },
                "required": ["sheet_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_files",
            "description": "프로젝트의 폴더 목록과 파일 목록을 반환한다(각 파일의 이름·변환상태·시트 수 포함, 폴더 ID로 선택 필터). 특정 도면 파일이 '몇 페이지/몇 장'인지 물으면 이 툴로 파일명을 찾아 sheet_count를 확인한다.",
            "parameters": {
                "type": "object",
                "properties": {
                    "folder": {
                        "type": "string",
                        "description": "폴더 ID 필터. 생략 시 전체 파일.",
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_equipment",
            "description": "TypeDB 온톨로지에서 프로젝트(또는 특정 시트)의 장비 목록을 반환한다(각 장비의 tag·name·type·status와 바인딩된 시트 수). '이 프로젝트/도면에 어떤 장비/설비가 있나', '변압기/배터리/차단기 등 장비 알려줘' 같은 질문에 이 툴을 쓴다. 온톨로지에 없으면 count=0.",
            "parameters": {
                "type": "object",
                "properties": {
                    "sheet_id": {
                        "type": "string",
                        "description": "특정 시트에 바인딩된 장비만 필터. 생략 시 프로젝트 전체.",
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_equipment",
            "description": "장비 ID로 단건 조회(tag·name·type·status·바인딩 시트). 없으면 found=false.",
            "parameters": {
                "type": "object",
                "properties": {
                    "equipment_id": {"type": "string", "description": "장비 ID(예: EQ-TR-01)."},
                },
                "required": ["equipment_id"],
            },
        },
    },
]


def _collect_refs(name: str, result: dict, sheets: dict, issues: dict) -> None:
    """툴 결과에서 딥링크용 참조(시트·이슈 id→라벨)를 수집한다. 프론트가 '열기'로 사용."""
    if not isinstance(result, dict):
        return
    if name == "list_sheets":
        for s in result.get("sheets") or []:
            if s.get("sheet_id"):
                sheets[s["sheet_id"]] = s.get("number") or s.get("title") or s["sheet_id"]
    elif name == "get_sheet" and result.get("found"):
        sheets[result["sheet_id"]] = result.get("number") or result.get("title") or result["sheet_id"]
    elif name == "list_issues":
        for it in result.get("issues") or []:
            if it.get("issue_id"):
                issues[it["issue_id"]] = it.get("title") or it["issue_id"]
    elif name == "get_issue" and result.get("found"):
        issues[result["issue_id"]] = result.get("title") or result["issue_id"]
    elif name == "search":
        for s in result.get("sheets") or []:
            if s.get("sheet_id"):
                sheets[s["sheet_id"]] = s.get("number") or s.get("title") or s["sheet_id"]
        for it in result.get("issues") or []:
            if it.get("issue_id"):
                issues[it["issue_id"]] = it.get("title") or it["issue_id"]


def _build_references(sheets: dict, issues: dict, cap: int = 6) -> list[dict]:
    return (
        [{"type": "sheet", "id": k, "label": v} for k, v in list(sheets.items())[:cap]]
        + [{"type": "issue", "id": k, "label": v} for k, v in list(issues.items())[:cap]]
    )


def _dispatch(name: str, args: dict, project: str) -> dict:
    """툴 이름 → S8.0 툴 실행(project 주입)."""
    if name == "search":
        return tools.search(project, args.get("query", ""))
    if name == "list_sheets":
        return tools.list_sheets(project, args.get("discipline"))
    if name == "get_project_summary":
        return tools.get_project_summary(project)
    if name == "list_issues":
        return tools.list_issues(project, args.get("status"), args.get("category"))
    if name == "get_issue":
        return tools.get_issue(project, args.get("issue_id", ""))
    if name == "get_sheet":
        return tools.get_sheet(project, args.get("sheet_id", ""))
    if name == "list_files":
        return tools.list_files(project, args.get("folder"))
    if name == "list_equipment":
        return tools.list_equipment(project, args.get("sheet_id"))
    if name == "get_equipment":
        return tools.get_equipment(project, args.get("equipment_id", ""))
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
    ref_sheets: dict = {}
    ref_issues: dict = {}
    for _ in range(_MAX_STEPS):
        out = provider.complete(messages, TOOLS_SCHEMA)
        calls = out.get("tool_calls") or []
        if not calls:
            return {
                "answer": out.get("content") or "",
                "tool_calls": trace,
                "references": _build_references(ref_sheets, ref_issues),
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
            _collect_refs(c["name"], result, ref_sheets, ref_issues)
            trace.append({"name": c["name"], "arguments": args,
                          "result_summary": _summarize(c["name"], result)})
            messages.append({
                "role": "tool",
                "tool_call_id": c["id"],
                "content": json.dumps(result, ensure_ascii=False),
            })
    # 스텝 초과 — 마지막 응답 유도(툴 없이).
    out = provider.complete(messages, [])
    return {"answer": out.get("content") or "", "tool_calls": trace,
            "references": _build_references(ref_sheets, ref_issues), "provider": provider.name}


def _summarize(name: str, result: dict) -> str:
    if name == "list_sheets":
        return f"count={result.get('count')}"
    if name == "search":
        return (f"sheets={len(result.get('sheets', []))} "
                f"issues={len(result.get('issues', []))} "
                f"files={len(result.get('files', []))}")
    if name == "list_issues":
        return f"count={result.get('count')}"
    if name == "get_issue":
        return f"found={result.get('found')}"
    if name == "get_sheet":
        return f"found={result.get('found')}"
    if name == "list_files":
        return f"files={result.get('file_count')} folders={result.get('folder_count')}"
    if name == "get_project_summary":
        return (f"sheets={result.get('sheets')} open_issues={result.get('open_issues')} "
                f"files={result.get('files')}")
    if name == "list_equipment":
        return f"count={result.get('count')}"
    if name == "get_equipment":
        return f"found={result.get('found')}"
    return "ok"
