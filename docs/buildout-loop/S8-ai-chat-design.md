# S8 — XD 도면 어시스턴트 (AI 챗) 설계 + 로드맵  [STATUS: DRAFT — 다음 세션 검수 대기]

> buildout-loop의 AI 단계(S8) 설계 초안. LOOP.md Done-When "XD 고유(온톨로지) + AI 분석"의 구체화.
> **AI(LLM) = HUMAN_GATE** 항목이므로 사용자 공동설계로 4개 핵심 결정을 확정한 뒤 작성(아래 §0). 이 문서는 **초안**이며, 다음 세션 검수·승인 후에야 per-milestone 메타프롬프트(`prompts/10~`)를 FROZEN하고 구현에 들어간다.

## 0. 확정된 4개 결정 (2026-07-01 AskUserQuestion 공동설계)

1. **그라운딩 = Tool-use(함수 호출).** LLM이 큐레이션된 **읽기 전용** 쿼리 함수를 호출해 실데이터(시트·이슈·파일·장비)로 답한다. 환각 없이 프로젝트 실데이터에 그라운딩. (RAG·Text-to-TypeQL 배제 — 구조화 그래프엔 tool-use가 최적, TypeQL 자동생성 위험 회피.)
2. **제공자 = 둘 다(기본 로컬 전환).** provider 추상화로 로컬 LLM(Ollama)과 클라우드(GPT·Gemini·Claude) 모두 지원. **기본 = 로컬(데이터 반출 0)**, 클라우드는 **대화별 opt-in**이며 도면 데이터 외부 전송에 대한 **egress 동의 게이트**를 통과해야 한다(HUMAN_GATE).
3. **대화 저장 = 프로젝트별 + 사용자별.** 각 대화는 `(현재 사용자, 현재 프로젝트)`에 귀속. 우측 패널 = 현재 프로젝트의 내 대화 목록. S7 `current_user`·project 계승.
4. **v1 범위 = 읽기 Q&A + 딥링크.** 조회·검색·요약 + 답변 속 UI 딥링크(S6 인프라 재사용). **쓰기/액션(이슈 생성·마크업 등)은 후속 단계**(S9, S7 RBAC 강제 필요).

## 1. 목표 / Done-When

우측 도킹형 대화 어시스턴트로, 어느 화면에서든 열려 **프로젝트 실데이터(TypeDB 온톨로지 + DrawingStore)에 그라운딩된** 자연어 Q&A를 제공한다. 기존 대화를 이어가거나 새 대화를 시작할 수 있고, 대화는 사용자·프로젝트별로 영속한다.

**완료 정의(v1)**: (a) 우측 패널을 열면 현재 프로젝트의 내 대화 목록이 뜨고, 선택해 이어가거나 "새 대화"를 시작한다. (b) "이 프로젝트에 전기 도면 몇 장이야?" / "EE-01-006 이슈 보여줘" / "변전실 관련 장비" 같은 질문에 **실데이터 기반**으로 답하고, 답변 속 시트/이슈/파일이 **딥링크**로 클릭 이동한다. (c) 기본은 로컬 LLM(반출 0). 클라우드 선택 시 egress 동의 후 동작. (d) 대화·메시지가 새로고침에도 복원. 콘솔 0.

## 2. 아키텍처 — 4계층 + 재사용

```
[④ ChatDrawer UI (우측 도킹, 전 화면)]  ── src/build/chat/*, src/api/chat.ts
        │  SSE 스트리밍 · 딥링크 칩
        ▼
[③ AI 오케스트레이션 (tool-use 루프)]    ── backend/chat.py, routes_chat.py
        │  system prompt + 툴 정의 → 제공자 호출 → 툴 실행 → 반복 → 최종답
        ├───────────────► [② 대화 영속]  ── store.py (conversation/message), _conversations.json/_messages.json (+TypeDB 미러)
        ├───────────────► [툴 카탈로그] ── DrawingStore(JSON SoT, 완전) + TypeDB(온톨로지 관계)
        └───────────────► [① 제공자 추상화] ── backend/providers/{ollama,openai,gemini,claude}.py
```

### 계층 ① 제공자 추상화 (`backend/providers/`)
- 통합 인터페이스: `chat(messages, tools, model_cfg) -> stream[{delta|tool_call|usage}]`. 툴 호출 포맷을 제공자별 API로 매핑.
- 어댑터: `OllamaProvider`(로컬 기본), `OpenAIProvider`(GPT), `GeminiProvider`, `ClaudeProvider`. 모델 레지스트리(provider→model_id·capabilities·needs_key·egress).
- **egress 게이트**: 클라우드 provider 선택 = 도면 데이터 외부 전송 → 대화별 1회 동의 + API 키 필요. 미동의/키 없음 → 차단·안내. 로컬은 무조건 허용.
- 모델 ID는 구현 시점에 레지스트리로 핀(예: 로컬 `llama3.x`, 클라우드 GPT·Gemini·Claude 최신) — 추상화 덕에 교체 자유.

### 계층 ② 대화 영속 (DrawingStore 확장, S1~S7 패턴 계승)
- `conversation`: `conversation_id, project_name, member_id(owner), title, provider, model_id, created_at, updated_at`.
- `message`: `message_id, conversation_id, role[user|assistant|tool|system], content, tool_calls?, tool_results?, usage?, created_at`.
- JSON SoT(`_conversations.json`/`_messages.json`) + TypeDB 미러. 목록 필터 = `(project_name, member_id)`. 제목 = 첫 사용자 메시지 요약(또는 LLM 짧은 제목).
- **격리 불변식**: 사용자 A는 B의 대화를 못 본다(scope 강제). S7 current_user로 owner 판정.

### 계층 ③ AI 오케스트레이션 (`backend/chat.py`)
- Tool-use 루프: (1) 히스토리+시스템프롬프트+툴정의 로드 → (2) provider.chat 스트리밍 → (3) 툴 호출 요청 시 **읽기전용** 실행→결과 주입→반복(최대 N=5) → (4) 최종 답 스트림·영속.
- 시스템 프롬프트: "너는 XD 도면관리 어시스턴트. 답은 반드시 툴 결과에 근거하고, 시트/이슈/파일은 `[[type:id]]` 형태로 인용해 딥링크되게 하라. 모르면 모른다고 하라."
- **툴 카탈로그(v1, 읽기 전용)** — 기존 store/route 메서드를 그대로 호출(새 데이터 경로 0):
  - `get_project_summary(project)` — 시트/이슈/파일/폴더/용량 집계(homeStats 재사용).
  - `search(project, query)` — 시트·이슈·파일 교차 검색(S6 `/api/search` 재사용).
  - `list_sheets(project, discipline?)` · `get_sheet(sheet_id)` — 시트/타이틀블록/공종.
  - `list_issues(project, status?, category?)` · `get_issue(issue_id)` — 이슈·상태·핀.
  - `list_files(project, folder?)` — 파일/폴더/버전.
  - `query_ontology(...)` — TypeDB 엔티티/관계(`equipmentEntityId` 바인딩) 질의 **— 적재된 범위에서**(§5 위험).
  - 각 툴은 구조화 JSON + 안정 ID(딥링크용) 반환.

### 계층 ④ 챗 UI (`src/build/chat/`, 우측 도킹)
- `ChatDrawer` — 우측 도킹·토글·전 화면(BuildShell 레벨 마운트로 "어디든"). 접기/펼치기.
- `ConversationList` — 현재 프로젝트의 내 대화 목록·선택·"새 대화".
- `ChatThread` — 메시지 스트림(markdown·스트리밍·툴 진행 표시 "도면 조회 중…")·**딥링크 칩**(클릭→기존 `openSheet`/`searchOpenIssue`/`searchOpenFolder` 호출).
- `ChatComposer` — 입력·**제공자/모델 선택기**(클라우드엔 egress 배지)·전송.
- `src/api/chat.ts` — 대화/메시지/스트림 API.

### 재사용 (새로 만들지 않는 것)
- DrawingStore + 기존 라우트(툴이 그대로 호출). S6 검색·딥링크 핸들러. S7 current_user(대화 owner). v1은 읽기전용이라 RBAC mutation 게이트 불요; 후속 액션 단계에서 `require_role` 재사용.

## 3. 데이터 흐름
사용자 입력 → `POST /api/conversations/{id}/messages`(SSE) → 오케스트레이터가 히스토리+시스템+툴 로드 → provider 스트리밍 → 툴 호출을 store/TypeDB(읽기)로 실행 → 최종 답 스트림→UI, 영속 → 딥링크 칩 렌더.

## 4. API 계약 (신규 `routes_chat.py`)
- `GET /api/conversations?project_name=` — 현재 사용자·프로젝트 스코프 목록.
- `POST /api/conversations` — 신규(project+user).
- `GET /api/conversations/{id}` — 메시지.
- `POST /api/conversations/{id}/messages` — 전송(SSE 스트림 응답).
- `PATCH /api/conversations/{id}` — 제목·모델 변경. `DELETE` — 삭제.
- `GET /api/chat/models` — 가용 provider/model + needs_key·egress 플래그.

## 5. 위험 / 전제 (정직한 표기)
- **TypeDB 그래프 얕음 가능성(핵심)**: S3~S6이 "JSON SoT + TypeDB `_MIRROR` 위임"으로 진행 → TypeDB에 시트/이슈/장비 그래프가 **질의 가능하게 적재됐는지 미검증**. 그래서 v1 툴은 **JSON 스토어(완전한 SoT)를 1차 근거**로 삼고, `query_ontology`는 실제 적재분에 한정. **S8.0에서 적재 상태 점검·필요 시 보강.**
- **데이터 반출(HUMAN_GATE)**: 클라우드 provider = 도면 데이터 외부 전송. 기본 로컬로 완화하되, 클라우드 opt-in은 명시 동의.
- API 키 = 시크릿(로컬 `.env`, 커밋 금지). 스트리밍 중단 시 부분 영속. 툴 반복 상한. 로컬 LLM 미가동/키 없음 시 우아한 안내.

## 6. 테스트 전략
- 백엔드: 대화/메시지 CRUD·**목 provider로 오케스트레이션 루프**(결정적)·툴 실행 그라운딩·스코프 격리(A≠B)·provider 어댑터(목 HTTP)·egress 게이트.
- 프론트: ChatDrawer 렌더·목록/선택/새대화·메시지 전송(목)·**딥링크 칩→네비게이션**·모델 선택 egress 배지.
- e2e: 드로어 열기→새 대화→"시트 몇 장?"→집계 답변→딥링크 클릭 이동. 콘솔 0.

## 7. 로드맵 (phased milestones)

| 단계 | 내용 | 산출·검증 |
|---|---|---|
| **S8.0** | **온톨로지 적재 점검·보강**(전제). TypeDB에 도면/시트/이슈/장비 entity가 질의 가능하게 있는지 확인, `equipmentEntityId` 바인딩 상태 점검, 부족분 적재. | TypeDB 실질의 스모크. tool `query_ontology` 근거 확보 |
| **S8.1** | **대화 영속 + 제공자 추상화(로컬)**. DrawingStore conversation/message CRUD + 스키마 미러 + provider 인터페이스 + Ollama 어댑터 + **목 provider**로 오케스트레이션 골격. | pytest CRUD·격리·목 루프 |
| **S8.2** | **Tool-use 오케스트레이션 + 툴 카탈로그**. 읽기 툴 6~8종(store/S6 재사용) + tool-use 루프 + 그라운딩 시스템 프롬프트. | 실질의 답변·그라운딩 pytest |
| **S8.3** | **우측 챗 드로어 UI + SSE 스트리밍**. Drawer/List/Thread/Composer + 이어가기/새 대화 + 스트리밍. | 프론트 test·브라우저 e2e |
| **S8.4** | **딥링크 + 모델 선택 + 클라우드 게이트**. 답변 딥링크 칩(S6) + provider/model 선택 + **egress 동의 게이트** + GPT/Gemini/Claude 어댑터. | e2e 딥링크·egress 게이트 |
| **S8.5** | **검증/폴리시**. 독립 3렌즈 + reconcile + e2e. | S8 DONE |
| **(S9)** | **후속: 액션/에이전트**(챗에서 이슈 생성·마크업 등, S7 RBAC 강제 + 사용자 확인). | 별도 스테이지 |

각 S8.x 진입 시 `prompts/10~`에 per-stage 메타프롬프트를 공동설계·FROZEN하고 구현 → 별도 검증팀 채점(ai-loop 표준).

## 8. Out of scope (v1 의도적 제외)
- 쓰기/액션(이슈·마크업 생성) = S9. 다중 사용자 공유 대화·조직 SSO·클라우드 키 로테이션. 음성·도면 이미지 이해(멀티모달). 임베딩/벡터스토어(RAG 미채택 — 필요 시 특정 툴의 시맨틱 검색으로 후속). 실제 인증(S7 로컬 모의 유지).

---
> **다음 세션**: 이 설계 검수 → 승인 시 S8.0 점검부터, per-stage 메타프롬프트 FROZEN 후 구현. 미승인 항목은 수정 후 재검수.
