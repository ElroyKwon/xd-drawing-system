# S8.4 — egress 감사/게이트 정식화  [STATUS: FROZEN 2026-07-03 · 3결정 공동설계]

> ai-loop 스테이지 계약. `prompts/10-s8_0-sidecar-bootstrap.md`·`11-s8_2-tool-catalog-eval.md`(FROZEN)와 S8.1(챗 두뇌·provider 추상화·영속) 결과를 상속한다. 구현 에이전트가 이 텍스트를 그대로 입력받아 자율 실행하고, **별도 검증팀이 아래 Acceptance checklist(M1~M10)로 항목별 채점**한다. 합격을 위해 기준을 도중에 고치지 않는다(기준 변경 = 스코프 변경 = HUMAN_GATE).

## Stage goal / Done-When

실 gpt-5.5 egress는 이미 동작한다(HUMAN_GATE 승인분). S8.4는 그 위에 **운영 안전장치**만 얹는다 — egress가 **무엇이·언제·어느 provider로** 나갔는지 추적하는 감사로그, 재기동 없이 즉시 외부 전송을 끊는 런타임 킬스위치, 감사/로그로 API 키가 새지 않도록 하는 마스킹·상태 노출. 이 스테이지가 닫는 부채는 **R4(egress 감사로그·킬스위치 없음 — 승인은 됐으나 추적 불가)**이며, 동시에 후속 S11 이메일 발송(외부 egress)이 재사용할 토대다.

**완료 정의(S8.4)**:
- (a) **egress 감사로그**: 챗 한 턴이 끝날 때마다 **메타데이터 1건**을 append-only JSONL(`_ai_data/` 하위, gitignore)에 기록. 필드: `ts`·`provider`·`model`·`conversation_id`·`project`·`tool_names[]`·`token_estimate`·`egress`(bool, 실 외부 전송 여부)·`ok`(성공/실패)·`error`(실패 시 요약). **프롬프트/응답 본문·API 키는 절대 기록 안 함**(메타데이터만).
- (b) **런타임 킬스위치**: 프로세스 메모리 mode 플래그. `POST /api/egress/mode {"mode":"mock"|"openai"}`로 즉시 토글, **재기동 불필요**. mode=`mock`(차단)이면 `POST /api/chat`이 요청/기본 provider와 무관하게 **mock를 강제**(실 외부 전송 0). 기본값은 env `XD_AI_PROVIDER`(기본 openai), 재기동 시 기본값 복귀(런타임 토글은 비영속 — 공동설계 확정).
- (c) **키 마스킹·상태**: `.env` 평문 키는 유지(R8=로컬 개발 수용). 단 (1) 부팅 시 키 존재·형식을 검증하고 **마스킹된 형태로만** 로깅, (2) 감사로그·API 응답·로그 어디에도 **원문 키 미노출**(마스킹 가드 헬퍼), (3) `GET /api/egress/status`는 키 **존재여부+마스킹 미리보기**(`sk-…abcd`)만 노출(값 미노출)·기본 provider·현재 mode·모델을 반환.
- (d) 신규 라우트 `routes_egress.py`: `POST /api/egress/mode`·`GET /api/egress/status`·`GET /api/egress/audit?limit=`(최신순 read-only). `main_ai`에 등록.
- (e) 격리 불변식 유지(backend 모듈 import 0·기존 tracked 8000 코드 diff 0) + 회귀 0(build·vitest·backend pytest·사이드카 pytest).

## Co-design log (2026-07-03 사용자 확정 — AskUserQuestion 3결정 freeze)

- **(Q1) 감사 범위 = 메타데이터만**. 시각·provider·모델·conversation_id·project·토큰수(추정)·성공여부·툴명·egress bool. **프롬프트/응답 본문은 미기록**(로컬 평문 저장 회피, 프라이버시). R4가 요구한 "무엇이·언제·어느 provider로"에 답하되 본문 아카이브는 아님. (본문 전체/해시 옵션 미채택.)
- **(Q2) 킬스위치 = 런타임 API 토글**. `POST /api/egress/mode` + 프로세스 메모리 플래그, 재기동 없이 즉시 mock 강제. 감사로그와 같은 라우트군(`/api/egress`). **재기동 시 기본값(openai) 복귀** — 파일 영속 옵션 미채택(단순성 우선, 킬스위치는 즉시성이 핵심이고 영속은 env 기본값으로 충분).
- **(Q3) 키 관리 = 마스킹+유출가드+상태**. `.env` 평문 유지(R8 수용). 마스킹 가드로 감사/로그/응답에 원문 키 유출 0 + 부팅 키 검증 + `/api/egress/status`는 존재여부·마스킹 미리보기만. **OS 자격증명 저장소 이전 미채택**(로컬 개발 범위 과잉, 배포 게이트 사항).

## Instruction (수행 단계)

1. **`backend/ai/egress.py` 신설**(순수 표준 라이브러리, backend 모듈 import 0):
   - `current_mode() -> str` / `set_mode(mode)`: 프로세스 메모리 mode(`"openai"|"mock"`), 기본값 `os.environ.get("XD_AI_PROVIDER","openai")`. `set_mode`는 유효값만 허용(그 외 `ValueError`).
   - `effective_provider(requested: str|None) -> str`: mode==`mock`이면 무조건 `"mock"`(킬스위치). 아니면 `requested or 기본`.
   - `mask_key(text) -> str` / `masked_preview(key) -> str`: api-key류 문자열을 `sk-…abcd`로 마스킹. 원문 키가 로그/감사/응답에 들어가지 않도록 하는 가드.
   - `record(event: dict) -> None` / `read(limit) -> list`: `_ai_data/egress_audit.jsonl`에 메타데이터 1줄 append(원자적), 최신순 read. 본문·키 필드 금지(입력 event를 화이트리스트 필드로만 직렬화).
   - `status() -> dict`: `{key_present, key_masked, provider_default, current_mode, model}`(원문 키 미노출).
2. **`routes_chat.py` 배선**: `make_provider(body.provider)` → `make_provider(egress.effective_provider(body.provider))`로 교체(킬스위치 반영). 턴 완료(성공/실패 모두) 후 `egress.record({...메타데이터...})` 1건 — `provider`·`model`(실제 사용)·`conversation_id`·`project`·`tool_names`(result의 tool_calls명)·`token_estimate`(대략 문자수/4 등 결정적 근사)·`egress`(실제 provider가 openai면 True)·`ok`·`error`. **본문·키 미포함**.
3. **`routes_egress.py` 신설**: `POST /api/egress/mode`(body `{mode}`, 유효성 400, 반환=새 status)·`GET /api/egress/status`·`GET /api/egress/audit?limit=50`(최신순, read-only). `main_ai.include_router`.
4. **부팅 키 검증**(`main_ai` 또는 `egress`): 기동 시 키 존재/형식 검증 → **마스킹된 형태로만** 로깅(원문 0). 미존재 시 명확한 경고 + mock 폴백 보존(기존 동작).
5. **사이드카 테스트**(`backend/ai/tests/test_egress.py` 신설): 
   - 킬스위치: `set_mode("mock")` 후 `effective_provider("openai")=="mock"`. `POST /api/egress/mode {mock}` 후 `POST /api/chat`(provider 미지정/openai)이 mock 사용(외부 전송 0) — respx로 openai 호출 0 단언 또는 provider.name=="mock" 확인.
   - 감사: 챗 1턴 후 audit 1줄 증가, 필드 정확, **본문·키 부재** 단언(레코드 직렬화에 message 문자열·`sk-` 미포함).
   - 마스킹: `mask_key`가 `sk-...` 원문을 마스킹, `status()`에 원문 키 부재.
   - 라우트: mode 토글 400(잘못된 값)·status 스키마·audit limit.
6. **검증**: 사이드카 pytest GREEN(신규 egress 포함). 기존 회귀 0 — `npm run build`·`npm test`(116, 8000 내리고)·`backend/.venv` pytest(97). 격리: `test_isolation` import 0, `git diff --stat -- backend/routes_*.py backend/store.py backend/main.py backend/auth.py` 공백. 프론트 무변경(S8.4는 백엔드 운영장치만).

## Inputs (참고 컨텍스트)

- 현 egress 지점: `backend/ai/provider.py` `OpenAIProvider.complete()`의 `responses.create()`가 유일 외부 전송. `make_provider(prefer)`가 `XD_AI_PROVIDER` env(openai|mock)로 선택, 키 부재 시 mock 폴백.
- 요청 경로: `routes_chat.py` `chat()` → `make_provider(body.provider)` → `run_chat(...provider=...)`(agent.py tool-use 루프, 턴당 provider.complete 여러 번 가능 — 감사는 **턴 단위 1건**).
- 영속: `ai_store.py`가 `_ai_data/`에 대화 저장(gitignore). audit도 같은 디렉터리.
- 격리 불변식(K6·검수 교정 ④): backend.* import 0, CORS/상수는 자체 정의, 8000 공개 HTTP GET만.

## Acceptance checklist (별도 검증팀이 항목별 채점 — freeze)

- **M1** — `egress.py`가 mode 플래그·`effective_provider`·`mask_key`/`masked_preview`·`record`/`read`·`status`를 제공하고 **backend.* import 0**(순수 표준 라이브러리 + 자체 모듈만).
- **M2** — `POST /api/egress/mode {mock|openai}`가 런타임 mode를 토글(재기동 없이), 잘못된 값은 **400**, `GET`이 현재 mode 반영.
- **M3** — mode=`mock`(킬스위치 ON)일 때 `POST /api/chat`가 요청/기본 provider가 openai여도 **실제로 mock 사용 → 외부 전송 0**(라이브 또는 respx로 openai 호출 0 입증).
- **M4** — 챗 한 턴마다 audit JSONL에 **정확히 1줄** append, 필드(ts·provider·model·conversation_id·project·tool_names·token_estimate·egress·ok) 정확, **프롬프트/응답 본문·원문 키 부재**(레코드 문자열에 사용자 메시지·`sk-` 미포함).
- **M5** — `GET /api/egress/audit?limit=`가 최신순 read-only로 레코드 반환(limit 반영).
- **M6** — `GET /api/egress/status`가 `key_present`·마스킹 미리보기·기본 provider·현재 mode·모델 반환, **원문 키는 어떤 응답에도 미노출**.
- **M7** — `mask_key` 마스킹 가드가 `sk-…` 원문 키를 마스킹(단위 테스트로 입증), 감사/로그/응답 경로에 적용.
- **M8** — 부팅 키 검증: 기동 시 키 존재/형식 검증 + **마스킹 로깅**(원문 0), 미존재 시 명확 경고 + mock 폴백 보존(기존 graceful 동작 회귀 0).
- **M9** — 격리 불변식: `test_isolation` import 0, 8000 tracked 파일(`routes_*`·`store.py`·`main.py`·`auth.py`) `git diff --stat` **공백**, 프론트 무변경.
- **M10** — 회귀 0: 사이드카 pytest GREEN(신규 egress), backend pytest **97**, vitest **116**(8000 내리고), `npm run build` 성공.

## Out of scope (의도적으로 하지 않음)

- **프론트 egress 표시/토글 UI** — S8.4는 백엔드 운영장치만(ROADMAP §3·§6). 프론트 킬스위치 인디케이터는 후속(원하면 별도 폴리시).
- **본문 아카이브·재생** — 메타데이터만(Q1). 프롬프트/응답 저장 안 함.
- **킬스위치 파일 영속** — 재기동 시 env 기본값 복귀(Q2). 영구 차단은 env `XD_AI_PROVIDER=mock`로.
- **OS 자격증명 저장소 이전·키 로테이션** — 배포 게이트(Q3). 로컬 `.env` 평문 유지.
- **egress 레이트리밋·비용 상한·알림** — 감사/킬스위치 범위 밖. 후속 운영 스테이지.
- **S11 이메일 egress** — 본 인프라를 재사용하는 별도 신규 스테이지.
