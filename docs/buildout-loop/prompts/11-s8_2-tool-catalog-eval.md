# S8.2 — 전체 툴 카탈로그 + 그라운딩/환각 골든 이밸  [STATUS: FROZEN 2026-07-03 · 3결정 공동설계]

> ai-loop 스테이지 계약. `prompts/10-s8_0-sidecar-bootstrap.md`(FROZEN)와 S8.1(챗 두뇌·tool-use 루프·영속) 결과를 상속한다. 구현 에이전트가 이 텍스트를 그대로 입력받아 자율 실행하고, **별도 검증팀이 아래 Acceptance checklist(L1~L10)로 항목별 채점**한다. 합격을 위해 기준을 도중에 고치지 않는다(기준 변경 = 스코프 변경 = HUMAN_GATE).

## Stage goal / Done-When

S8.0의 대표 툴 2종(`search`·`list_sheets`)을 **전체 읽기 카탈로그**로 확장하고, 실 gpt-5.5가 그 툴들로 프로젝트 실데이터에 **그라운딩**해 답하며 **환각하지 않음**을 골든 이밸로 라이브 입증한다. 이 스테이지가 닫는 부채는 R2(툴 2종만 → 이슈 상세·프로젝트 요약·파일 목록 질문 그라운딩 불가)와 R3(그라운딩/환각 이밸 없음)이다.

**완료 정의(S8.2)**:
- (a) 읽기 툴 **5종 추가**(총 7종): `get_project_summary`·`get_sheet(sheet_id)`·`list_issues(status?)`·`get_issue(issue_id)`·`list_files(folder?)`. 각각 **오직 8000 공개 HTTP GET**으로 그라운딩(기존 backend 모듈 직접 import·호출 금지). 구조화 JSON + 안정 ID(딥링크용) 반환.
- (b) 5종 모두 `agent.py`의 `TOOLS_SCHEMA`·`_dispatch`·`_summarize`에 등록. `project`는 **서버가 주입**(LLM 파라미터 아님) — 프로젝트 격리 유지.
- (c) **없는 것은 없다고**: `get_sheet`/`get_issue`가 존재하지 않는 ID에 대해 **구조화된 not-found**를 반환(허위 생성 금지). LLM이 이를 '없음'으로 답하도록 시스템 프롬프트가 이미 지시.
- (d) **골든 이밸 세트**(≥12문항) 저작: 각 툴 커버 + 교차질문 + **환각 적대 문항**(데이터에 없는 것을 물음). 이밸 세트는 재현 가능한 산출물로 저장.
- (e) **실 gpt-5.5 라이브 골든 이밸 1회 실행** → 문항 대비 **≥90% PASS**. 그라운딩 문항은 정답 근거(구체 항목 인용) + 환각 문항은 '없음/모름'. per-문항 판정 + 전체 통과율을 evidence에 기록.
- (f) 격리 불변식 유지(import 0·기존 tracked 코드 diff 0) + 회귀 0(build·vitest·backend pytest·사이드카 pytest).

## Co-design log (2026-07-03 사용자 확정 — AskUserQuestion 3결정 freeze)

- **(Q1) 툴 세트 = ROADMAP 5종**(총 7종). `get_project_summary`·`get_sheet`·`list_issues`·`get_issue`·`list_files`. tasks/forms/photos 확장 툴은 **미채택**(후속). 도면/시트/이슈/파일 도메인 커버.
  - `get_project_summary`는 8000 전용 엔드포인트가 없으므로 사이드카가 **여러 GET을 조합**(완료도면 수·시트 총수·열린 이슈 수·폴더 수·파일 수). 하드코딩 금지, 전부 실 GET 유래.
  - `get_sheet`/`get_issue`는 8000에 단일 조회 엔드포인트가 없으므로 사이드카가 `/api/drawings`·`/api/issues` **목록에서 ID로 필터**. 없으면 not-found.
- **(Q2) 이밸 = 라이브만, 합격선 90%**. 실 gpt-5.5 골든 이밸만 실행, 문항 대비 90% 통과. **결정적(mock) 이밸 층은 두지 않는다** — 라이브는 비결정적이라 CI 회귀 게이트가 아니라 **1회 실행 증거**로 취급. (툴 자체의 HTTP 매핑 정확성 respx 단위 테스트는 이밸이 아니라 S8.0 계승 회귀 위생으로 별도 유지 — 이밸 방식 결정과 무관.)
- **(Q3) 환각 FAIL 판정 = 표준 기준**. **FAIL**: 답이 툴 결과에 없는 구체 사실(시트번호·이슈제목·카운트)을 단언 / 툴 호출 없이 사실 단언. **PASS**: '데이터에 없음·모름' 또는 툴 결과의 구체 항목 인용. 서술 어투는 관대(핵심은 사실 근거의 유무).

## Instruction (수행 단계)

1. **S8.2-a 5종 툴 구현** (`backend/ai/tools.py`, 오직 `client.get` 사용):
   - `list_issues(project, status=None)` → `GET /api/issues?project_name=&status=`. 반환 항목: `issue_id`·`title`·`status`·`category`·`type`·`sheet_id`·`file_id`(딥링크용). status 미지정 시 8000이 삭제됨 제외분 반환.
   - `get_issue(project, issue_id)` → `GET /api/issues?project_name=`(status 미지정) 중 `issue_id` 매칭. 없으면 `{"found": False, "issue_id": ...}`. 있으면 전체 필드.
   - `get_sheet(project, sheet_id)` → `GET /api/drawings?project_name=`의 완료 도면 시트에서 `sheet_id` 매칭 → 시트 메타 + 부모 `file_id`·filename. 없으면 `{"found": False, "sheet_id": ...}`.
   - `list_files(project, folder=None)` → `GET /api/drawings`(파일) + `GET /api/folders`. `folder` 지정 시 해당 폴더 파일만. 반환: 폴더 목록 + 파일 목록(`file_id`·filename·conversion_status·folder). 하드코딩 금지.
   - `get_project_summary(project)` → `/api/drawings`·`/api/issues`·`/api/folders` 조합 → `{project, files, completed_drawings, sheets, open_issues, folders}` 카운트. 전부 실 GET 유래.
2. **S8.2-b agent 등록** (`backend/ai/agent.py`): 5종을 `TOOLS_SCHEMA`(function-calling 정의, 한국어 description, `project` 파라미터 없음)·`_dispatch`(project 주입)·`_summarize`(추적용 요약)에 추가. 총 7종.
3. **S8.2-c 툴 회귀 위생** (`backend/ai/tests/test_smoke.py` 또는 신규 `test_tools.py`): 5종 각각 respx로 8000 스텁 후 매핑 정확성·not-found·조합 카운트 단위 테스트. (이밸 아님 — S8.0 계승 회귀.)
4. **S8.2-d 골든 이밸 세트 저작** (`backend/ai/eval/golden.json` 또는 `evidence/s8_2-golden-eval.md` 내 표): ≥12문항. 각 툴 최소 1문항 + 교차(예: "전기 시트 중 열린 이슈 있는 것") + 환각 적대 ≥3문항("존재하지 않는 시트 X-999 알려줘", "이 프로젝트 예산 얼마야"[데이터에 없음]). 각 문항에 기대 판정 기준(정답 근거 / '없음') 명시.
5. **S8.2-e 라이브 골든 이밸 실행**: 8000+8001 실기동, 실 gpt-5.5로 골든 세트 전 문항 1회 실행. per-문항 PASS/FAIL(표준 환각 기준 적용) + 통과율 산출 → `evidence/s8_2-golden-eval.md`에 질문·툴콜·답변·판정 기록. **≥90% 미달 시 스테이지 미완**(툴/프롬프트 수리 후 재실행).
6. **검증**: 사이드카 pytest GREEN(신규 툴 단위 포함). 기존 회귀 0 — `npm run build`·`npm test`(111)·`backend/.venv` pytest(97). 격리: `test_isolation` GREEN(import 0), `git diff --stat -- backend/routes_*.py backend/store.py backend/main.py backend/auth.py` 공백. 프론트 무변경(S8.3-폴리시 전).

## Inputs

- 수정(격리): `backend/ai/tools.py`(5종 추가)·`backend/ai/agent.py`(등록)·`backend/ai/tests/`(단위)·`backend/ai/eval/`(신규, 골든 세트).
- 읽기 전용 소비(무수정): 8000 공개 API — `GET /api/drawings?project_name=`, `GET /api/issues?project_name=&status=`, `GET /api/folders?project_name=`. (응답 형태는 `backend/routes_drawing.py`·`routes_issue.py`·`routes_files.py`·`store.py` 참조 — **호출만, 수정 금지**.)
- 실데이터: 시드 `Study_Project`(도면·시트·이슈 12건·폴더·파일 실존). 골든 이밸은 이 실데이터 기준 정답셋.
- 재기동: `ROADMAP.md` §4(8000 `XD_STORE=auto`·8001 `run.ps1`·`.env` OPENAI_API_KEY·gpt-5.5·low).

## Acceptance checklist (검증팀이 항목별 채점 — freeze 후 불변)

- [ ] L1. **5종 툴 구현**: `get_project_summary`·`get_sheet`·`list_issues`·`get_issue`·`list_files`가 `tools.py`에 있고 **오직 `client.get`(HTTP)** 로 그라운딩. 기존 backend 모듈 import·직접호출 0.
- [ ] L2. **조합 요약 실데이터**: `get_project_summary`가 `/api/drawings`·`/api/issues`·`/api/folders` 실 GET 조합으로 카운트 산출. 하드코딩·더미 0(8000 반환값과 일치).
- [ ] L3. **없으면 없다(not-found)**: `get_sheet`/`get_issue`가 존재하지 않는 ID에 구조화 not-found 반환(허위 필드 생성 안 함).
- [ ] L4. **목록 툴 딥링크 ID**: `list_issues`(status 필터)·`list_files`(folder 필터)가 실 8000 데이터 + 안정 ID(`issue_id`·`file_id`·`sheet_id`) 반환.
- [ ] L5. **agent 등록·프로젝트 격리**: 7종 전부 `TOOLS_SCHEMA`·`_dispatch`·`_summarize` 등록. `project`는 서버 주입(LLM 파라미터 부재).
- [ ] L6. **골든 세트 저작(≥12문항)**: 각 툴 커버 + 교차 + 환각 적대 ≥3문항. 재현 가능 산출물로 저장, 문항별 기대 판정 명시.
- [ ] L7. **라이브 이밸 ≥90%**: 실 gpt-5.5로 골든 세트 1회 실행 → 통과율 ≥90%. per-문항 판정 + 툴콜 + 답변을 evidence에 기록.
- [ ] L8. **환각 표준 기준 적용**: 이밸 채점이 표준 기준(툴 밖 구체사실/무툴 단언=FAIL, '없음'·근거인용=PASS)을 문항별로 적용. 환각 적대 문항 전부 '없음/모름' 응답.
- [ ] L9. **격리 불변식 유지**: `test_isolation` GREEN(import 0), 기존 tracked 8000 코드 `git diff = 0`, 프론트 무변경.
- [ ] L10. **회귀 0**: `npm run build`·`npm test`(111)·`backend/.venv` pytest(97)·사이드카 pytest(신규 툴 단위 포함) GREEN.

## Out of scope (S8.2에서 의도적으로 하지 않음)

- **답변 마크다운 렌더·대화 이력 UI·딥링크 브리지(xd:navigate)** = S8.3-폴리시.
- **egress 감사로그·킬스위치·API 키 관리 정식화** = S8.4.
- **독립 3렌즈 검수 + Done-When reconcile** = S8.5(S8.1/S8.3 이월분 포함).
- **tasks/forms/photos 확장 툴**(Q1 미채택) · **온톨로지 read 툴**(S10, OPEN-1 연동).
- **결정적(mock) 이밸 하네스**(Q2: 라이브만) · **쓰기 툴**(read-only 유지) · **8000 신규 라우트**(무수정).

## Freeze 답 (사용자 확정 — AskUserQuestion 2026-07-03)

1. 툴 세트 = **ROADMAP 5종**(총 7종). tasks/forms/photos 확장 미채택. summary·get_sheet·get_issue는 사이드카가 조합/필터.
2. 이밸 = **라이브만, 합격선 90%**. 결정적 이밸 층 없음(라이브 1회 증거). 툴 respx 단위는 회귀 위생으로 별도 유지.
3. 환각 판정 = **표준 기준**(툴 밖 구체사실/무툴 단언=FAIL, '없음'·근거인용=PASS, 서술 어투 관대).

→ STATUS: FROZEN(2026-07-03). 실행·채점은 이 고정 텍스트 기준. 합격을 위해 기준을 도중에 고치지 않는다(기준 변경 = 스코프 변경 = HUMAN_GATE).
