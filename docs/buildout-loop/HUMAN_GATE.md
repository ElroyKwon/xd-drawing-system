# HUMAN_GATE — 자율 진행 금지·사용자 결정 대기 항목

> LOOP.md §Stop conditions / §Human gates 계약. NARROWED/UNMET Done-When·스코프 변경·AI egress 등은 여기 기록하고 정지·보고한다. 각 항목은 사용자 결정 전까지 미해결(OPEN)이며, DONE 선언을 차단한다.

## 2026-07-01 — S8 설계 4렌즈 검수에서 발생한 게이트

세션 11 설계 검수(독립 4렌즈)가 다음 3건을 적발. **S8.0 부트스트랩 착수는 이들에 절연되어 병행 가능**하나, S8을 DONE 선언하려면 GATE-1 해소 필수, S8.3/S8.1 FROZEN 전 GATE-2/3 해소 필수.

### GATE-1 [BLOCKER·즉시 결정 필요] — 온톨로지 바인딩 product Done-When의 처분
- **문제**: `LOOP.md` L34 "**XD 고유(온톨로지)**: 도면 entity TypeDB 적재 + `equipmentEntityId` 바인딩(Study_TypeDB `analysis_result` 계승)"은 독립 product Done-When이자 `PLAN.md` L48에서 **"XD 차별화의 핵심"**. S8 v2 사이드카 재설계("8000 완전 무수정, 신규 라우트 0")로 이 **적재/바인딩 산출물이 S8.0~S8.5 어느 스테이지에도 없다**.
- **왜 게이트**: OPEN-1(a) 승인이 덮은 것은 "장비-그래프 **Q&A**는 v1 밖 + 8000 무수정"뿐. "온톨로지 **적재/바인딩 산출물을 loop에서 제거**"는 **별개 결정인데 승인받지 않았다**. LOOP.md L36(NARROWED/UNMET→HUMAN_GATE)을 위반한 채 조용히 사라짐 = 프로세스 계약 위반.
- **사용자 결정 필요(3지 택1, freeze)**:
  - **(i) 공식 폐기** — 온톨로지 바인딩을 loop 산출물에서 제거. → `LOOP.md` L34·`PLAN.md` L48 개정 + 사유 기록.
  - **(ii) 후속 스테이지로 연기** — 예: **S10 온톨로지**. → LOOP Done-When에 NARROWED+연기처+등급 기록.
  - **(iii) S8로 재편입** — S8.0~S8.5에 온톨로지 적재/바인딩 스테이지 추가(사이드카는 읽기 그라운딩용 온톨로지 read API 필요 → OPEN-1 (b) 재검토 연동).
- **상태**: **RESOLVED (2026-07-02, 결정 (ii) S10 연기).** 온톨로지 적재/바인딩을 신설 **S10 온톨로지** 스테이지로 연기. `LOOP.md` Done-When 해당 항목 NARROWED+연기처(S10) 표기, `PLAN.md` S8→사이드카 AI 챗으로 재정의 + S10 신설. S8 DONE 전제에서 온톨로지 제외 확정.

### GATE-2 [MAJOR·S8.3 FROZEN 전] — 프론트 격리 아키텍처 재설계 (BuildShell 허상)
- **문제**: S8 설계가 "유일 접점"으로 못박은 `BuildShell.tsx`가 **존재하지 않음**. 실제 셸=`App.tsx`(6개 activeView), Build 뷰=`BuildSheetsView.tsx`(네비 상태 `openSheet`/`searchOpenIssue`/`searchOpenFolder`가 그 안 private useState). 딥링크는 두 컴포넌트의 사적 상태를 건드려야 함 → 설계의 "무수정·단일 접점·어느 화면에서든" **3자 모순**. (참고: `GlobalSearch`가 이미 props로 딥링크 패턴 구현 → 재사용 후보.)
- **추가**: 프론트 격리 불변식("flag off → 100% 동일")에 **채점 항목 없음**(백엔드 diff=0/import 0만 있음). S8.3에 프론트 스냅샷 무변화 테스트 + `src/build/**`가 `src/ai/**` import 0 정적 검사(K6의 프론트 미러) 필요.
- **사용자 결정 필요**: v1 드로어 범위 = **Build 내부 한정**(단일 접점 모델 유지) vs **전역(어느 화면에서든)**(App 상태 리프트=2번째 접점 문서화). 어느 쪽이든 딥링크 접점을 실제 파일(`BuildSheetsView.tsx`/`App.tsx`)로 재기술.
- **상태**: **RESOLVED (2026-07-03, 세션14 — Build 스코프 드로어).** v1 드로어를 **Build 내부 한정·단일 접점**으로 구현(`src/ai/ChatDrawer`를 `BuildSheetsView.tsx` 1곳에서만 마운트, `src/ai/**`는 앱 모듈 미의존). 프론트 격리 불변식은 grep로 확인(src/ai→앱 import 0, src/build→src/ai 단일 접점). 딥링크 브리지(xd:navigate)는 S8.3-폴리시로 이월. 전역 리프트는 후속 여지.

### GATE-3 [MAJOR·S8.1 FROZEN 전] — 대화 owner-scoping 프라이버시 한계
- **문제**: 설계가 "사용자 A는 B의 대화를 못 본다(scope 강제)"라 했으나, S7 `current_user`는 **세션 없는 서버 전역 가변** 사용자(`PUT /api/auth/me`로 누구나 아무 member로 전환). → 보안 경계 아님 + 교차 프로세스 레이스(전환이 8001 owner 귀속 중 끼어들면 오귀속).
- **사용자 결정/보강**: 설계 문구를 "owner=표시용, S7 로컬 모의 한계상 프라이버시 보장 아님"으로 하향(§8 "실제 인증=S7 로컬 모의 유지"와 일관). S8.1에 owner를 **메시지 전송 시점 요청 컨텍스트에서 고정**(별도 `/auth/me` 재조회 아님) + 전환-중-전송 레이스 테스트 추가.
- **상태**: **RESOLVED (2026-07-03, 세션14 — owner=표시용 하향).** `ai_store` owner를 전송 시점 `get_me().member_id`로 고정(`routes_chat._current_owner`), 프라이버시 경계 아님을 문서화(`ai_store.py` 독스트링). 프로젝트 스코프 격리만 강제(대화의 project≠요청 project=400). 전환-중-전송 레이스 정식 테스트는 S8.5 검수로 이월.

### GATE-4 [egress·S8.1 실 provider 前] — LLM 외부 전송 (RESOLVED)
- **문제**: 실 LLM(클라우드) 사용 시 프로젝트 도면/이슈 텍스트가 외부(OpenAI)로 전송됨.
- **상태**: **RESOLVED (2026-07-03, 세션14 — 사용자 승인).** 사용자가 **OpenAI gpt-5.5 API**를 명시 선택 → egress 승인. 키=`backend/ai/.env`(gitignore). `provider=mock`이면 egress 0(폴백·테스트). **미완=S8.4**: egress 감사로그·킬스위치·게이트 정식화(승인은 됐으나 운영 감사 인프라 미구축).

---
> 갱신 규칙: 결정되면 해당 항목에 "RESOLVED (날짜·결정)"를 달고 관련 LOOP/PLAN/설계/EVIDENCE를 개정한다.
> **세션14 기준 GATE-1~4 전부 RESOLVED.** S8 DONE 선언은 S8.2·S8.4·S8.5 완료 + Done-When reconcile 후.

---

### GATE-5 [신규·S11 이메일 실 egress] — 실제 이메일 발송 (미해결)
- **문제**: S11에서 이메일 발송 인프라(provider 추상화·템플릿·감사·킬스위치)를 구현했으나, **실제 외부 메일 전송은 외부 egress**라 자율 진행 금지. 어느 SMTP/메일 서비스·발신 자격증명·발신 주소를 쓸지는 사용자 결정.
- **현 상태(자율 구현분)**: 기본 `mock` provider(발송 0, `_email_outbox.json`에 기록). 실 `SmtpEmailProvider`는 `XD_SMTP_HOST` 등 자격증명 **미구성 시 발송 안 함**(mock 폴백). 즉 기본 동작으로 **외부 메일 0**.
- **사용자 결정 필요**: ① 메일 서비스(자체 SMTP / SendGrid·SES·Postmark 등 / 사내 릴레이) ② 발신 자격증명·발신 주소(예: no-reply@…) ③ egress 승인(도면/이슈 정보가 이메일 본문으로 외부 전송). 결정 시 `.env`에 `XD_SMTP_*` 구성 + `XD_EMAIL_PROVIDER=smtp` + 킬스위치 운영.
- **의존**: S12(이슈 이메일 알림)는 이 인프라 위. mock 수준까지는 S12에서 자율 구현하되, 실 발송은 본 게이트 해소 후.
