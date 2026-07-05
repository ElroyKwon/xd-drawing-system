# 대화형 에이전트 액션 (P1+P2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AI 챗이 이슈 생성·이슈 상태변경·작업 생성을 대화로 **제안**하고, 사용자가 확인 카드 [실행]을 눌러야 프론트가 기존 8000 라우트로 실행한다.

**Architecture:** 사이드카(8001)는 `propose_*` 툴로 정규화된 액션 스펙을 반환할 뿐 8000을 mutate하지 않는다(격리 불변식 유지). 확인 실행은 ChatDrawer가 기존 `src/api`의 `createIssue`/`updateIssue`/`createTask`를 호출한다. 확인된 액션은 8000 액션 감사로그에 origin=ai_chat로 기록된다.

**Tech Stack:** FastAPI(8000/8001), OpenAI function-calling(gpt-5.5), React+TS(Vite), pytest, vitest.

**설계 SoT:** `docs/superpowers/specs/2026-07-06-conversational-actions-mcp-roadmap-design.md`

**재기동(구현/검증 전제):**
- 8000: `XD_STORE=json backend/.venv/Scripts/python.exe -m uvicorn main:app --app-dir backend --port 8000` (TypeDB 원하면 `XD_STORE=typedb`, 컨테이너 1729)
- 8001: `cd backend/ai && .venv/Scripts/python.exe -m uvicorn main_ai:app --port 8001` (`.env`에 OPENAI_API_KEY)
- 프론트: `npm run dev` (5173). ⚠️ vitest는 8000 내리고 실행. 사이드카 라우트 변경 후 8001 수동 재기동.

---

## File Structure

| 파일 | 종류 | 책임 |
|---|---|---|
| `backend/ai/actions.py` | 신규 | `propose_*` 3종의 스키마 + 참조 해소(라벨→sheet_id/issue_id, **read 전용**) + pending_action 빌더. |
| `backend/ai/agent.py` | 수정 | 액션 툴을 TOOLS_SCHEMA에 합치고, 호출 시 실행 대신 `pending_actions` 수집. |
| `backend/ai/routes_chat.py` | 수정 | 응답에 `pending_actions` 추가. |
| `backend/ai/tests/test_actions.py` | 신규 | 제안 툴이 올바른 pending_action 생성 · 8000 write 미발생(격리). |
| `backend/routes_audit.py` | 신규 | 액션 감사 기록/조회(`/api/audit/actions`). |
| `backend/store.py` | 수정 | `add_action_audit`/`list_action_audit`(JSON `_action_audit.json`). |
| `backend/routes_issue.py`·`routes_task.py` | 수정 | create/patch가 optional `origin`·`conversation_id` 수신 → 감사 기록. |
| `backend/tests/test_action_audit.py` | 신규 | 감사 기록·조회·origin. |
| `src/ai/aiClient.ts` | 수정 | `PendingAction` 타입 + `ChatResponse.pending_actions`. |
| `src/ai/ActionCard.tsx` | 신규 | 카드 UI + [실행]/[취소] + 실행 핸들러. |
| `src/ai/ActionCard.test.tsx` | 신규 | 렌더·실행·취소·뷰어 disabled. |
| `src/ai/ChatDrawer.tsx` | 수정 | pending_actions 렌더 + canEdit. |
| `src/BuildSheetsView.tsx` | 수정 | `<ChatDrawer project canEdit={canEdit} />`. |

**pending_action 형태(모든 계층 공통):**
```json
{
  "action_id": "uuid",
  "type": "create_issue | change_issue_status | create_task",
  "summary": "사람이 읽는 한 줄 요약",
  "params": { "...정규화 필드..." },
  "target_label": "EE-01-001"
}
```

---

## Task 1: 사이드카 — 액션 제안 툴 + 참조 해소 (`actions.py`)

**Files:**
- Create: `backend/ai/actions.py`
- Test: `backend/ai/tests/test_actions.py`

- [ ] **Step 1: 실패 테스트 작성**

`backend/ai/tests/test_actions.py`:
```python
import respx
import httpx
import actions

BASE = "http://127.0.0.1:8000"

@respx.mock
def test_propose_create_issue_resolves_sheet():
    # list_sheets(그라운딩용 GET)로 라벨→sheet_id 해소.
    respx.get(f"{BASE}/api/drawings").mock(return_value=httpx.Response(200, json=[
        {"file_id": "F1", "conversion_status": "completed",
         "sheets": [{"sheet_id": "F1_sheet_001", "sheet_number": "EE-01-001", "title": "22.9kV 단선결선도"}]},
    ]))
    pa = actions.propose_create_issue(
        "청주사업장",
        {"title": "차단기 정격 확인", "category": "quality", "sheet_ref": "EE-01-001"},
    )
    assert pa["type"] == "create_issue"
    assert pa["params"]["title"] == "차단기 정격 확인"
    assert pa["params"]["sheet_id"] == "F1_sheet_001"
    assert pa["params"]["file_id"] == "F1"
    assert pa["target_label"] == "EE-01-001"
    assert "action_id" in pa

@respx.mock
def test_propose_create_issue_no_side_effect():
    # 제안은 어떤 POST/PATCH도 하지 않는다(격리).
    post = respx.post(f"{BASE}/api/issues")
    respx.get(f"{BASE}/api/drawings").mock(return_value=httpx.Response(200, json=[]))
    actions.propose_create_issue("청주사업장", {"title": "전역 이슈"})
    assert not post.called
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend/ai && .venv/Scripts/python.exe -m pytest tests/test_actions.py -v`
Expected: FAIL (`No module named 'actions'`)

- [ ] **Step 3: `actions.py` 구현**

`backend/ai/actions.py`:
```python
"""액션 제안(propose_*) — 대화형 write의 '제안' 단계. 8000을 mutate하지 않는다.

라벨(시트번호·이슈제목)→id 해소는 tools.py의 READ 경로(HTTP GET)만 쓴다. 여기서
반환하는 pending_action은 프론트 확인 카드용 스펙일 뿐 실행이 아니다(휴먼인더루프).
"""
from __future__ import annotations

import uuid

import tools

VALID_STATUSES = {"열림", "진행중", "답변됨", "닫힘"}


def _new_id() -> str:
    return uuid.uuid4().hex[:12]


def propose_create_issue(project: str, args: dict) -> dict:
    title = (args.get("title") or "").strip()
    sheet_ref = (args.get("sheet_ref") or "").strip()
    file_id = sheet_id = None
    target_label = None
    if sheet_ref:
        # list_sheets(READ)에서 번호/제목 부분일치로 시트 해소.
        res = tools.list_sheets(project)
        for s in res.get("sheets") or []:
            hay = f"{s.get('number','')} {s.get('title','')}"
            if sheet_ref.lower() in hay.lower():
                sheet_id = s.get("sheet_id")
                file_id = s.get("file_id")
                target_label = s.get("number") or s.get("title")
                break
    return {
        "action_id": _new_id(),
        "type": "create_issue",
        "summary": f"이슈 생성: {title}" + (f" · {target_label}" if target_label else " · (전역)"),
        "params": {
            "title": title,
            "type": args.get("type") or "설계 검토",
            "category": args.get("category") or "",
            "assignee": args.get("assignee") or "",
            "description": args.get("description") or "",
            "status": args.get("status") if args.get("status") in VALID_STATUSES else "열림",
            "file_id": file_id,
            "sheet_id": sheet_id,
        },
        "target_label": target_label,
    }


def propose_change_issue_status(project: str, args: dict) -> dict:
    ref = (args.get("issue_ref") or "").strip()
    to_status = args.get("to_status") if args.get("to_status") in VALID_STATUSES else None
    issue_id = None
    issue_title = None
    res = tools.list_issues(project)
    for it in res.get("issues") or []:
        if ref and (ref == it.get("issue_id") or ref.lower() in (it.get("title") or "").lower()):
            issue_id = it.get("issue_id")
            issue_title = it.get("title")
            break
    return {
        "action_id": _new_id(),
        "type": "change_issue_status",
        "summary": f"이슈 상태변경: {issue_title or ref} → {to_status or '(상태 미지정)'}",
        "params": {"issue_id": issue_id, "issue_title": issue_title, "to_status": to_status},
        "target_label": issue_title,
    }


def propose_create_task(project: str, args: dict) -> dict:
    title = (args.get("title") or "").strip()
    return {
        "action_id": _new_id(),
        "type": "create_task",
        "summary": f"작업 생성: {title}",
        "params": {
            "title": title,
            "assignee": args.get("assignee") or "",
            "status": args.get("status") or "할 일",
            "priority": args.get("priority") or "보통",
            "due_date": args.get("due_date") or "",
            "description": args.get("description") or "",
        },
        "target_label": None,
    }
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend/ai && .venv/Scripts/python.exe -m pytest tests/test_actions.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: 커밋**

```bash
git add backend/ai/actions.py backend/ai/tests/test_actions.py
git commit -m "feat(P1): 액션 제안(propose_*) 모듈 — read 전용 참조해소, 8000 write 0"
```

---

## Task 2: 사이드카 — 액션 툴을 agent 루프에 등록 + pending_actions 반환

**Files:**
- Modify: `backend/ai/agent.py`
- Modify: `backend/ai/routes_chat.py:90-96`
- Test: `backend/ai/tests/test_actions.py` (추가)

- [ ] **Step 1: 실패 테스트 추가**

`backend/ai/tests/test_actions.py`에 추가:
```python
from provider import LLMProvider
import agent

class _ScriptProvider(LLMProvider):
    """propose_create_task 한 번 호출 후 마무리하는 가짜 provider."""
    name = "mock"
    def __init__(self): self._step = 0
    def complete(self, messages, tools_schema):
        self._step += 1
        if self._step == 1:
            return {"content": None, "tool_calls": [
                {"id": "c1", "name": "propose_create_task",
                 "arguments": '{"title": "접지저항 측정 제출"}'}]}
        return {"content": "작업 생성을 제안했습니다. 카드에서 확인해 주세요.", "tool_calls": []}

def test_run_chat_returns_pending_action():
    out = agent.run_chat("청주사업장", "접지저항 측정 작업 만들어줘",
                         provider=_ScriptProvider())
    assert len(out["pending_actions"]) == 1
    pa = out["pending_actions"][0]
    assert pa["type"] == "create_task"
    assert pa["params"]["title"] == "접지저항 측정 제출"
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend/ai && .venv/Scripts/python.exe -m pytest tests/test_actions.py::test_run_chat_returns_pending_action -v`
Expected: FAIL (`KeyError: 'pending_actions'`)

- [ ] **Step 3: `agent.py` 수정**

3a. import 추가(파일 상단 `import tools` 아래):
```python
import actions
```

3b. `TOOLS_SCHEMA` 리스트 끝(`]` 직전)에 액션 툴 3종 추가:
```python
    {
        "type": "function",
        "function": {
            "name": "propose_create_issue",
            "description": "이슈 생성을 '제안'한다(즉시 실행 아님 — 사용자 확인 카드가 뜬다). 사용자가 이슈를 남겨달라고 할 때 쓴다. sheet_ref에 시트번호(예: EE-01-001)나 도면명을 주면 해당 시트에 연결한다. 제목이 없으면 먼저 되물어라.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "이슈 제목."},
                    "category": {"type": "string", "description": "분류: clash=간섭, quality=품질, coordination=협의."},
                    "assignee": {"type": "string", "description": "담당(선택)."},
                    "description": {"type": "string", "description": "상세 설명(선택)."},
                    "status": {"type": "string", "description": "상태(열림/진행중/답변됨/닫힘). 생략 시 열림."},
                    "sheet_ref": {"type": "string", "description": "연결할 시트번호/도면명(선택)."},
                },
                "required": ["title"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "propose_change_issue_status",
            "description": "이슈 상태변경을 '제안'한다(확인 카드). issue_ref는 이슈 제목 일부나 issue_id. to_status는 열림/진행중/답변됨/닫힘.",
            "parameters": {
                "type": "object",
                "properties": {
                    "issue_ref": {"type": "string", "description": "대상 이슈(제목 일부 또는 ID)."},
                    "to_status": {"type": "string", "description": "바꿀 상태(열림/진행중/답변됨/닫힘)."},
                },
                "required": ["issue_ref", "to_status"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "propose_create_task",
            "description": "작업(Task) 생성을 '제안'한다(확인 카드). 시공/설계 작업 항목을 만들 때 쓴다.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "작업 제목."},
                    "assignee": {"type": "string", "description": "담당(선택)."},
                    "priority": {"type": "string", "description": "우선순위(높음/보통/낮음). 생략 시 보통."},
                    "due_date": {"type": "string", "description": "기한 YYYY-MM-DD(선택)."},
                    "description": {"type": "string", "description": "설명(선택)."},
                },
                "required": ["title"],
            },
        },
    },
```

3c. `SYSTEM_PROMPT` 문자열 끝에 지침 추가:
```python
    " 사용자가 이슈/작업을 남기거나 상태를 바꿔달라고 하면 propose_* 툴로 '제안'하라. "
    "제안은 즉시 실행이 아니라 사용자에게 확인 카드를 띄우는 것이다. 필수 정보(제목 등)가 "
    "없으면 추측하지 말고 되물어라. 한 턴에 액션 하나만 제안하라."
```

3d. `_ACTION_TOOLS` 집합과 dispatch를 `_dispatch` 위에 추가:
```python
_ACTION_TOOLS = {"propose_create_issue", "propose_change_issue_status", "propose_create_task"}

def _dispatch_action(name: str, args: dict, project: str) -> dict:
    if name == "propose_create_issue":
        return actions.propose_create_issue(project, args)
    if name == "propose_change_issue_status":
        return actions.propose_change_issue_status(project, args)
    if name == "propose_create_task":
        return actions.propose_create_task(project, args)
    return {"error": f"알 수 없는 액션: {name}"}
```

3e. `run_chat`에서 pending_actions 수집. `ref_issues: dict = {}` 아래에 추가:
```python
    pending_actions: list[dict] = []
```
루프 안 `for c in calls:` 블록의 `result = _dispatch(...)` 줄을 다음으로 교체:
```python
            if c["name"] in _ACTION_TOOLS:
                pa = _dispatch_action(c["name"], args, project)
                pending_actions.append(pa)
                # LLM에는 '제안됨'만 알려 실행으로 오인하지 않게 한다.
                result = {"proposed": True, "action_id": pa["action_id"],
                          "summary": pa["summary"]}
            else:
                result = _dispatch(c["name"], args, project)
```
그리고 세 군데 `return {...}`(툴 없을 때·정상·스텝초과) 각각에 `"pending_actions": pending_actions,`를 추가한다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend/ai && .venv/Scripts/python.exe -m pytest tests/test_actions.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: `routes_chat.py` 응답에 pending_actions 추가**

`routes_chat.py`의 최종 `return {...}`(약 90행)에 추가:
```python
        "pending_actions": result.get("pending_actions", []),
```

- [ ] **Step 6: 사이드카 전체 회귀 + 커밋**

Run: `cd backend/ai && .venv/Scripts/python.exe -m pytest -q`
Expected: PASS (기존 39 + 신규 = 회귀 0)

```bash
git add backend/ai/agent.py backend/ai/routes_chat.py backend/ai/tests/test_actions.py
git commit -m "feat(P1): 액션 제안 툴을 챗 루프에 등록, pending_actions 응답 배선"
```

---

## Task 3: 격리 불변식 — 사이드카 write 0 정적 검사

**Files:**
- Test: `backend/ai/tests/test_isolation_actions.py` (신규)

- [ ] **Step 1: 실패 테스트 작성**

`backend/ai/tests/test_isolation_actions.py`:
```python
"""actions.py는 8000을 mutate하지 않는다(POST/PATCH/PUT/DELETE 호출 0)."""
import ast
from pathlib import Path

def test_actions_module_has_no_write_calls():
    src = (Path(__file__).resolve().parents[1] / "actions.py").read_text(encoding="utf-8")
    tree = ast.parse(src)
    bad = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Attribute) and node.attr in {"post", "patch", "put", "delete"}:
            bad.append(node.attr)
    assert not bad, f"actions.py에 write 호출 발견: {bad}"

def test_actions_only_uses_read_tools():
    src = (Path(__file__).resolve().parents[1] / "actions.py").read_text(encoding="utf-8")
    # tools.py의 READ 함수만 참조(write 함수는 존재하지 않아야 함).
    for w in ("create_", "update_", "delete_", "patch_"):
        assert f"tools.{w}" not in src
```

- [ ] **Step 2: 테스트 실행(즉시 통과 예상 — 방어 테스트)**

Run: `cd backend/ai && .venv/Scripts/python.exe -m pytest tests/test_isolation_actions.py -v`
Expected: PASS (2 passed) — actions.py는 read만 쓰므로 통과. 실패하면 write가 섞인 것.

- [ ] **Step 3: 커밋**

```bash
git add backend/ai/tests/test_isolation_actions.py
git commit -m "test(P1): 사이드카 액션 격리 불변식(write 0) 정적 검사"
```

---

## Task 4: 8000 — 액션 감사로그 (store + routes)

**Files:**
- Modify: `backend/store.py` (JsonDrawingStore)
- Create: `backend/routes_audit.py`
- Modify: `backend/main.py` (라우터 등록)
- Test: `backend/tests/test_action_audit.py` (신규)

- [ ] **Step 1: 실패 테스트 작성**

`backend/tests/test_action_audit.py`:
```python
from fastapi.testclient import TestClient
import importlib, main
client = TestClient(importlib.reload(main).app)

def test_action_audit_record_and_list():
    r = client.post("/api/audit/action", json={
        "actor": "member-owner", "action_type": "create_issue",
        "target_id": "ISS-1", "origin": "ai_chat", "conversation_id": "conv-1"})
    assert r.status_code == 200
    rows = client.get("/api/audit/actions").json()
    assert any(a["target_id"] == "ISS-1" and a["origin"] == "ai_chat" for a in rows)
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `backend/.venv/Scripts/python.exe -m pytest backend/tests/test_action_audit.py -v`
Expected: FAIL (404)

- [ ] **Step 3: store에 감사 API 추가**

`store.py` `JsonDrawingStore.__init__`의 경로 정의부에 추가:
```python
        self._action_audit_path = Path(config.UPLOADS_DIR) / "_action_audit.json"
```
클래스에 메서드 추가(기존 list_* 근처):
```python
    def add_action_audit(self, rec: dict) -> dict:
        with _STORE_LOCK:
            data = self._read(self._action_audit_path) or []
            data.append(rec)
            self._write(self._action_audit_path, data)
        return rec

    def list_action_audit(self, project_name=None) -> list:
        data = self._read(self._action_audit_path) or []
        if project_name:
            data = [r for r in data if r.get("project_name") == project_name]
        return data
```
> `_read`/`_write`/`_STORE_LOCK`는 기존 JsonDrawingStore 헬퍼. 없으면 기존 `_load`/`_save`·락 이름에 맞춰라(store.py에서 `_index.json` 저장 방식과 동일 패턴 사용).
`TypeDBDrawingStore`에도 위임 추가:
```python
    def add_action_audit(self, rec): return _MIRROR.add_action_audit(rec)
    def list_action_audit(self, project_name=None): return _MIRROR.list_action_audit(project_name)
```

- [ ] **Step 4: `routes_audit.py` 작성**

`backend/routes_audit.py`:
```python
"""액션 감사 — 확인된 대화형 액션(origin=ai_chat 등)의 메타데이터 기록/조회."""
from __future__ import annotations
from datetime import datetime
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

from store import get_store

router = APIRouter(prefix="/api/audit", tags=["audit"])

class ActionAudit(BaseModel):
    actor: str = ""
    action_type: str
    target_id: str = ""
    origin: str = "ai_chat"
    conversation_id: str = ""
    project_name: str = ""

@router.post("/action")
async def record_action(body: ActionAudit):
    rec = body.model_dump()
    rec["ts"] = datetime.now().isoformat()
    return get_store().add_action_audit(rec)

@router.get("/actions")
async def list_actions(project_name: Optional[str] = None):
    return get_store().list_action_audit(project_name)
```

- [ ] **Step 5: `main.py`에 라우터 등록**

`main.py`의 다른 `include_router` 옆에:
```python
from routes_audit import router as audit_router
app.include_router(audit_router)
```

- [ ] **Step 6: 테스트 통과 + 백엔드 회귀 + 커밋**

Run: `backend/.venv/Scripts/python.exe -m pytest backend/tests/test_action_audit.py -v`
Expected: PASS
Run: `backend/.venv/Scripts/python.exe -m pytest backend/ -q`
Expected: PASS (기존 109 + 신규 = 회귀 0)

```bash
git add backend/store.py backend/routes_audit.py backend/main.py backend/tests/test_action_audit.py
git commit -m "feat(P2): 액션 감사로그(8000) — origin=ai_chat 메타데이터 기록/조회"
```

---

## Task 5: 프론트 — aiClient 타입

**Files:**
- Modify: `src/ai/aiClient.ts:19-25`

- [ ] **Step 1: 타입 추가**

`aiClient.ts`의 `ChatResponse` 위에 추가:
```typescript
export interface PendingAction {
  action_id: string;
  type: "create_issue" | "change_issue_status" | "create_task";
  summary: string;
  params: Record<string, unknown>;
  target_label?: string | null;
}
```
`ChatResponse`에 필드 추가:
```typescript
  pending_actions: PendingAction[];
```

- [ ] **Step 2: 타입체크 + 커밋**

Run: `npx tsc --noEmit`
Expected: 통과(에러 0)

```bash
git add src/ai/aiClient.ts
git commit -m "feat(P1): aiClient PendingAction 타입"
```

---

## Task 6: 프론트 — ActionCard 컴포넌트

**Files:**
- Create: `src/ai/ActionCard.tsx`
- Test: `src/ai/ActionCard.test.tsx`

- [ ] **Step 1: 실패 테스트 작성**

`src/ai/ActionCard.test.tsx`:
```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import ActionCard from "./ActionCard";

vi.mock("../api/drawings", () => ({
  createIssue: vi.fn().mockResolvedValue({ issue_id: "ISS-9", title: "T" }),
}));

const base = {
  action_id: "a1", type: "create_issue" as const,
  summary: "이슈 생성: 차단기 정격", params: { title: "차단기 정격", status: "열림" },
  target_label: "EE-01-001",
};

test("뷰어는 실행 버튼 비활성", () => {
  render(<ActionCard action={base} project="P" canEdit={false} onDone={() => {}} />);
  expect(screen.getByRole("button", { name: /실행/ })).toBeDisabled();
});

test("실행 시 createIssue 호출 + onDone", async () => {
  const onDone = vi.fn();
  const { createIssue } = await import("../api/drawings");
  render(<ActionCard action={base} project="P" canEdit={true} onDone={onDone} />);
  fireEvent.click(screen.getByRole("button", { name: /실행/ }));
  await waitFor(() => expect(createIssue).toHaveBeenCalled());
  await waitFor(() => expect(onDone).toHaveBeenCalled());
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/ai/ActionCard.test.tsx`
Expected: FAIL (모듈 없음)

- [ ] **Step 3: `ActionCard.tsx` 구현**

`src/ai/ActionCard.tsx`:
```tsx
import { useState } from "react";
import { createIssue, updateIssue, type IssueStatus } from "../api/drawings";
import { createTask } from "../api/tasks";
import type { PendingAction } from "./aiClient";

const AUDIT_BASE =
  (import.meta.env?.VITE_BACKEND_BASE as string | undefined) ?? "http://127.0.0.1:8000";

interface Props {
  action: PendingAction;
  project: string;
  canEdit: boolean;
  conversationId?: string;
  onDone: (msg: string, ref?: { type: "issue"; id: string }) => void;
}

async function audit(a: PendingAction, project: string, targetId: string, cid?: string) {
  try {
    await fetch(`${AUDIT_BASE}/api/audit/action`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action_type: a.type, target_id: targetId, origin: "ai_chat",
        conversation_id: cid ?? "", project_name: project,
      }),
    });
  } catch { /* 감사 실패는 액션을 막지 않음 */ }
}

export default function ActionCard({ action, project, canEdit, conversationId, onDone }: Props) {
  const [state, setState] = useState<"pending" | "running" | "done" | "cancelled" | "error">("pending");
  const [err, setErr] = useState("");
  const p = action.params as Record<string, string | null>;

  async function run() {
    setState("running");
    try {
      if (action.type === "create_issue") {
        const iss = await createIssue({
          title: String(p.title ?? ""), type: p.type ?? undefined, category: p.category ?? undefined,
          assignee: p.assignee ?? undefined, description: p.description ?? undefined,
          status: (p.status as IssueStatus) ?? undefined, projectName: project,
          fileId: p.file_id ?? null, sheetId: p.sheet_id ?? null,
        });
        await audit(action, project, iss.issue_id, conversationId);
        setState("done");
        onDone(`✓ 이슈 생성됨: ${iss.title}`, { type: "issue", id: iss.issue_id });
      } else if (action.type === "change_issue_status") {
        const id = String(p.issue_id ?? "");
        await updateIssue(id, { status: p.to_status as IssueStatus });
        await audit(action, project, id, conversationId);
        setState("done");
        onDone(`✓ 상태변경됨: ${action.target_label} → ${p.to_status}`, { type: "issue", id });
      } else {
        const t = await createTask({
          title: String(p.title ?? ""), assignee: p.assignee ?? undefined,
          priority: (p.priority as string) ?? undefined, due_date: p.due_date ?? undefined,
          description: p.description ?? undefined, projectName: project,
        });
        await audit(action, project, t.task_id, conversationId);
        setState("done");
        onDone(`✓ 작업 생성됨: ${t.title}`);
      }
    } catch (e) {
      setState("error");
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  if (state === "done" || state === "cancelled") return null;

  return (
    <div className="ai-action-card" role="group" aria-label="AI 제안 액션">
      <div className="ai-action-summary">{action.summary}</div>
      <ul className="ai-action-fields">
        {Object.entries(p).filter(([, v]) => v).map(([k, v]) => (
          <li key={k}><span>{k}</span>: {String(v)}</li>
        ))}
      </ul>
      {state === "error" ? <div className="ai-action-error">실패: {err}</div> : null}
      <div className="ai-action-btns">
        <button type="button" disabled={!canEdit || state === "running"} onClick={run}>
          {state === "running" ? "실행 중…" : "실행"}
        </button>
        <button type="button" onClick={() => setState("cancelled")}>취소</button>
      </div>
      {!canEdit ? <div className="ai-action-hint">뷰어 권한은 실행할 수 없습니다.</div> : null}
    </div>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/ai/ActionCard.test.tsx`
Expected: PASS (2 passed)

- [ ] **Step 5: 커밋**

```bash
git add src/ai/ActionCard.tsx src/ai/ActionCard.test.tsx
git commit -m "feat(P1/P2): ActionCard — 확인 카드, 실행=기존 8000 API, 뷰어 disabled, 감사"
```

---

## Task 7: 프론트 — ChatDrawer 배선 + canEdit

**Files:**
- Modify: `src/ai/ChatDrawer.tsx`
- Modify: `src/BuildSheetsView.tsx:255`

- [ ] **Step 1: ChatDrawer Props에 canEdit 추가**

`ChatDrawer.tsx`의 `interface Props`에:
```typescript
  canEdit?: boolean;
```
함수 시그니처: `export default function ChatDrawer({ project, canEdit = false }: Props) {`

- [ ] **Step 2: Msg 타입에 pending_actions + 응답 반영**

`Msg` 타입에 필드 추가:
```typescript
  actions?: import("./aiClient").PendingAction[];
```
`sendChat` 성공 블록의 assistant 메시지 push를 다음으로 교체:
```typescript
      setMessages((m) => [
        ...m,
        { role: "assistant", content: res.answer, tools: res.tool_calls,
          refs: res.references, actions: res.pending_actions },
      ]);
      setConversationId(res.conversation_id);
```

- [ ] **Step 3: 실행 완료 콜백 + 카드 렌더**

메시지 렌더에서 assistant 버블 아래에 카드 렌더(assistant 본문 렌더 뒤):
```tsx
      {m.role === "assistant" && m.actions?.length
        ? m.actions.map((a) => (
            <ActionCard
              key={a.action_id}
              action={a}
              project={project}
              canEdit={canEdit}
              conversationId={conversationId}
              onDone={(msg, ref) => {
                setMessages((mm) => [...mm, { role: "assistant", content: msg, refs: ref ? [{ type: ref.type, id: ref.id, label: msg }] : undefined }]);
              }}
            />
          ))
        : null}
```
상단 import 추가:
```typescript
import ActionCard from "./ActionCard";
```

- [ ] **Step 4: BuildSheetsView에서 canEdit 전달**

`src/BuildSheetsView.tsx:255` 교체:
```tsx
      {AI_ENABLED ? <ChatDrawer project={project.name} canEdit={canEdit} /> : null}
```
> `canEdit`는 S7에서 BuildSheetsView가 이미 받는 prop. 없으면 상위(App)에서 내려오는 `canEdit`/`currentRole !== "뷰어"`를 확인해 전달.

- [ ] **Step 5: 프론트 회귀 + 커밋**

Run: `npx vitest run` (⚠️ 8000 내리고)
Expected: PASS (기존 116 + ActionCard 2 = 회귀 0)
Run: `npm run build`
Expected: 성공

```bash
git add src/ai/ChatDrawer.tsx src/BuildSheetsView.tsx
git commit -m "feat(P1): ChatDrawer가 제안 카드 렌더 + canEdit 게이팅"
```

---

## Task 8: 디바이스 e2e 검증 + Done-When reconcile

**Files:** (검증 전용 — 코드 변경 없음, 필요 시 수리)

- [ ] **Step 1: 서버 3종 기동**

8000(json 또는 typedb)·8001·`npm run dev`. `.env` OPENAI_API_KEY 확인. LS 청주사업장 데이터 로드 상태.

- [ ] **Step 2: chrome-devtools로 시나리오 검증(콘솔0)**

1. Build 진입 → AI FAB → "22.9kV 단선결선도에 차단기 정격 확인 이슈 남겨줘" → **카드 표시**, Issues 뷰 아직 변화 없음(확인 전 diff 0).
2. [실행] → "✓ 이슈 생성됨" + 딥링크 → Issues 뷰에 신규 이슈 존재.
3. "그 이슈 상태를 답변됨으로 바꿔줘" → 카드 → [실행] → 상태 반영.
4. "접지저항 측정 작업 만들어줘" → 카드 → [실행] → Tasks 뷰 반영.
5. 사용자 전환(뷰어) → 같은 요청 → 카드 [실행] **disabled**, 강제 실행 시 403.
6. `GET /api/audit/actions` → 위 액션들 origin=ai_chat 기록 확인.

- [ ] **Step 3: Done-When 체크(설계 B.6)**

1. 확인 전 서버 diff 0 ✓  2. 사이드카 write 0(Task 3 정적) ✓  3. 뷰어 차단 ✓
4. 감사 기록 ✓  5. 딥링크 열림 ✓  6. 회귀 0(vitest·backend·사이드카 pytest·build) ✓

- [ ] **Step 4: 최종 회귀 확인 + reconcile 기록**

Run(3종): `cd backend/ai && .venv/Scripts/python.exe -m pytest -q` · `backend/.venv/Scripts/python.exe -m pytest backend/ -q` · `npx vitest run` · `npm run build`
Expected: 전부 GREEN.

설계문서 하단에 Done-When MET/NARROWED reconcile 한 줄 기록 후:
```bash
git add docs/superpowers/
git commit -m "docs(P1/P2): 대화형 액션 Done-When reconcile — 전항목 MET"
```

---

## Self-Review (작성자 체크 결과)

- **스펙 커버리지:** B.2 컴포넌트 전부 태스크 매핑됨(actions.py=T1, agent/routes_chat=T2, 격리=T3, 감사=T4, aiClient=T5, ActionCard=T6, ChatDrawer/BuildSheetsView=T7, e2e/Done-When=T8).
- **타입 일관성:** `createIssue`(input.title/status/projectName/fileId/sheetId) · `updateIssue(id,{status})` · `createTask({title,priority,due_date,projectName})` — 실제 `src/api` 시그니처와 일치. `PendingAction`/`ChatResponse.pending_actions` 계층 일관.
- **플레이스홀더:** 없음(모든 코드 스텝에 실 코드). store `_read`/`_write` 헬퍼명만 구현자가 기존 패턴에 맞춰 확인(주석으로 명시).
- **범위:** P1+P2 단일 플랜(업로드·이메일·MCP·실인증 제외 — Out of Scope 명시).
```
