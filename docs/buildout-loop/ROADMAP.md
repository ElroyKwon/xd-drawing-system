# ROADMAP & 검수 — 빌드아웃 루프 (세션14 정리, 다음 세션 ai-loop 진입점)

> ⚠️ **STALE (세션14에서 멈춤).** S8.4/S8.5/S10 시절 계획으로, 세션18~29의 대화형 액션·지식그래프 트랙 미반영. **최신 진행·남은 일 SoT = 제안 vault `_개발-브릿지.md` §2(🗺️ 지식그래프 로드맵) + 이 폴더 `PROGRESS.md`(세션별 로그) + `docs/superpowers/specs·plans/`.** 다음 작업 판단은 그쪽을 볼 것.

> 작성 2026-07-03(세션14). **다음 세션은 `ai-loop` 스킬을 장착하고 `LOOP.md → PLAN.md → PROGRESS.md → 이 파일` 순으로 읽어 이어받는다.** 이 문서는 (1) 현재까지 검수(review), (2) 남은 스테이지 로드맵, (3) 다음 세션 진입 절차를 담는다. 실행 대상이 아니라 계획·검수 정리다.

---

## 0. 확정 방향 (2026-07-08, 세션21) — ★ 매 세션 §1보다 먼저 읽는다 ★

> 사용자 확정. 이 블록의 방향·원칙은 **잊거나 조용히 바꾸지 않는다**. 변경은 사용자 결정(휴먼 게이트). 세션 간 표류를 막기 위한 SoT. 요약은 memory [[project_workflow_backbone_direction]]에도 박음.

### A. 다음 주력 방향 = **백본1: 업로드 지능화 (= S15)** ★ 메타프롬프트 FROZEN
- **현재 실태(2026-07-08 코드 조사 확정)**: 업로드 시 메타데이터 추출은 **100% 규칙기반 휴리스틱**이고 AI/LLM은 업로드 경로에서 **전혀 호출되지 않는다**. PDF=타이틀블록 텍스트 휴리스틱, DWG=파일명/레이아웃명 기반(더 약함). 설비 온톨로지는 `seed_ontology.py` **수동 시드**.
- **핵심 통찰**: AI가 근거로 삼는 시트 정보는 5필드뿐(`ai/tools.py:43-50`). **업로드 추출이 만드는 "질의 가능한 표면"이 곧 AI 답변의 천장**이다. 새 도면을 올려도 AI는 그 내용을 모른다 → 백본1 없이는 AI 어시스턴트가 확장되지 않는다.
- **목표**: 업로드 시 **본문 색인 + 설비 태그 자동 추출**(PDF+DWG) → `sheet_key`(버전 가로지르는 영속 시트 정체성)에 매달아 생명주기 관리 → **8000 read API로 AI 그라운딩**. 연결된 TypeDB 있으면 동기, 없으면 내부 메타만.
- **메타프롬프트 FROZEN**: `prompts/20-s15-upload-intelligence.md` (2026-07-08, 공동설계 8결정 D1~D8, 합격기준 **O1~O15**).
  - D1 범위=본문색인+설비태그 / D2 엔진=규칙·LLM 2트랙+정규화(LLM 기본 off) / D3 AI소비=기존툴 강화+신규툴 / D4 신뢰도 표기+AI 불확실성 명시 / D5 **모든 시트에 sheet_key 발급**+소급 마이그레이션 / D6 버전별 메타 전부 보존·AI는 is_current만 / D7 **DWG(DXF) 우선+PDF 보강**·충돌 기록 / D8 **LLM은 별도 추출 사이드카 8002**(8000 egress 0 유지, 8002 꺼도 동작).
  - ⚠️ **HUMAN_GATE-7**: `XD_EXTRACT_LLM=1`로 실 고객 도면을 외부 LLM에 대량 전송하는 것은 게이트. 기본 off로 구현만.
- **부수 효과**: `sheet_key` + 버전별 메타 이력이 **백본3(supersede diff·이슈연결)의 토대**를 그대로 깐다. 백본1을 제대로 하면 백본3이 거의 따라온다.
- 이 트랙은 §3/§6의 S8.4·S8.5·S10·이메일·인증 로드맵과 **별개의 신규 주력 슬라이스**다.

### B. TypeDB 아키텍처 원칙 (LOCKED — 바꾸지 말 것)
- **TypeDB는 선택적이고 외부다.** 제공 주체는 XD가 아니라 **데이터지식관리 시스템(Data_Knowledge_Studio / DKS)**. XD는 **연결 대상을 설정**해 두고, **있으면 연결·없으면 내부 메타 분석 정보만으로 동작**한다. "있을 수도 없을 수도 있다"가 **정상이자 설계 의도**이며, 고쳐야 할 결함이 아니다.
- 따라서 TypeDB 없이 100% 도는 현재 **JSON 미러 이중화 구조는 유지·강화**한다. TypeDB를 XD 내부 필수 의존으로 끌어들이지 않는다.
- **이슈 추적·검색·링크 이동은 알고리즘(내부 메타) 기반으로 계속 제공**한다(현재 방식 유지). TypeDB 의존 아님.

### C. 나머지 트랙 (사용자가 모두 "중요"로 확인, 순서는 아래)
1. **백본1 업로드 지능화** ← 첫 주력 (위 A)
2. **백본3 = 이슈↔도면수정 루프 Phase 2**(supersede diff·이슈↔해결버전 연결·종결 검증게이트) — S14 Phase 2. 단, 이슈 추적/링크 자체는 현행 알고리즘 유지(B).
3. **A. 일하는 AI(P1+P2)** — AI 제안→사람 [실행] write 액션. 계획 freeze 완료(`docs/superpowers/plans/2026-07-06-conversational-actions-p1p2.md`).
4. **C. 이메일 발송·이슈 알림** — mock만 구현. 실 발송=egress 게이트(GATE-5).
5. **D. 실 로그인/인증** — 로컬 모의만. 실 인증=프로덕션 게이트(GATE-6).
- 진행 중이던 루프 잔여(S8.4 egress 감사·S8.5 3렌즈→S8 DONE·S10 온톨로지 적재)는 §6 순서 유지. **첫 착수는 백본1**로 사용자 확정.

---

## 1. 현황 한 눈에  (세션16 갱신)

빌드아웃 루프 **S1~S7 DONE + S8.0~S8.3 DONE(S8.2 이밸100%, S8.3-폴리시 4종 커밋)**. AI 챗이 앱에서 **실 gpt-5.5 + TypeDB 그라운딩 + 마크다운·리사이즈·대화목록·딥링크**까지 실동작. 로컬 `main` origin 대비 **7커밋 ahead(미푸시)**.

| 스테이지 | 상태 | 커밋 | 검증 근거 |
|---|---|---|---|
| S1~S6 | ✅ DONE | (세션1~8) | 각 acceptance MET, 3렌즈+e2e |
| S7 인증/RBAC | ✅ DONE | (세션9~10) | J1~J12 MET |
| S8.0 사이드카 부트스트랩 | ✅ DONE | `e6309c1` | K1~K10 MET |
| S8.1 챗 두뇌(provider·루프·영속) | ✅ DONE | `beb56c9`·`12096f1` | 실 GPT 라이브 |
| S8.2 툴 카탈로그+골든 이밸 | ✅ DONE | `c39d6bf` | **L1~L10 MET·이밸 15/15=100%**, 독립검증자 PASS, `evidence/s8_2-golden-eval.md` |
| S8.3 앱 챗 드로어 UI | ✅ DONE | `d6e8b8b` | device e2e 콘솔0 |
| S8.3-폴리시 마크다운 렌더 | ✅ DONE | `cc510c8` | vitest+5, device raw** 제거 |
| S8.3-폴리시 드로어 리사이즈 | ✅ DONE | `8dba37b` | device 400→클램프 |
| S8.3-폴리시 대화 목록 UI | ✅ DONE | `9b0ebc7` | device 65건·복원·새대화 |
| S8.3-폴리시 딥링크(xd:navigate) | ✅ DONE | `086c331` | device ⚠이슈뷰·📄뷰어, `evidence/s8_3-deeplink-*.png` |
| **S8.4 egress 감사/게이트** | ⬜ TODO | — | **다음 세션 1순위** |
| **S8.5 3렌즈 검수+reconcile→S8 DONE** | ⬜ TODO | — | 다음 세션(S8.1/8.3 독립검증 이월분 포함) |
| **S10 온톨로지 적재+바인딩** | ⬜ TODO | — | TypeDB 기동됨 → 착수 가능 |

**게이트**: GATE-1~4 전부 RESOLVED. **S8 DONE 선언은 S8.4·S8.5 + Done-When reconcile 후**(S8.2는 DONE).

**신규 백로그(세션16 사용자 요청, ACC 범위 밖 신규 스코프)**: ① 관계자 이메일 발송(미구현·egress 게이트) ② 이슈 라이프사이클 이메일 알림(미구현·①의존) ③ 실 로그인+매직링크 초대+외부 업로드(버전추적은 S3 구현됨·실인증은 프로덕션 게이트). 상세·순서는 §6.

---

## 2. 검수 (review) — 세션14 산출물

### 잘 선 것 (검증됨)
- **격리 불변식이 실측으로 유지됨**: 백엔드 `backend/ai/`가 기존 8000 모듈 import 0(AST 테스트), 기존 tracked 코드 diff 0(K7). 프론트 `src/ai/**`가 앱 모듈 미의존, `src/build`→`src/ai` 단일 접점(grep 확인). "별개 동작" 계약이 채점 가능한 형태로 지켜짐.
- **실 LLM 그라운딩이 진짜다**: gpt-5.5가 질문마다 스스로 툴 선택(공종 질문→`list_sheets(discipline=E)`), 8000(TypeDB) 실 결과에만 근거해 답, 환각 없음. 다중 턴 컨텍스트 유지. 5턴 대화 영속·재로드 확인.
- **provider 추상화가 egress를 분리**: `provider=mock`이면 외부 전송 0(테스트·오프라인). 실 provider는 명시 승인 하에만.
- **회귀 0 유지**: 매 커밋 `npm build`·`vitest 111`·backend `pytest 97`·사이드카 `pytest 12` GREEN.

### 리스크 / 부채 (다음 세션에서 닫아야)
| # | 항목 | 등급 | 처분 |
|---|---|---|---|
| R1 | **S8.1/S8.3 독립 3렌즈 미실시** — 구현+자체검증만. ai-loop full 루프는 별도 검증팀 필수 | MAJOR(프로세스) | **S8.5**에서 3렌즈+reconcile |
| R2 | **툴 2종만**(search·list_sheets) — 이슈 상세·프로젝트 요약·파일 목록 질문은 그라운딩 불가 | MAJOR | **S8.2** |
| R3 | **환각/그라운딩 골든 이밸 없음** — "데이터에 없으면 없다고" 가드가 실측 안 됨 | MAJOR | **S8.2** |
| R4 | **egress 감사로그·킬스위치 없음** — 승인은 됐으나 무엇이 언제 나갔는지 추적 불가 | MAJOR | **S8.4** |
| R5 | 챗 답변 마크다운 `**` raw 노출 — UI 폴리시 | MINOR | S8.3-폴리시 |
| R6 | 딥링크 브리지(xd:navigate) 미구현 — 답의 sheet_id/issue_id로 시트 이동 안 됨 | MINOR | S8.3-폴리시 |
| R7 | owner 전환-중-전송 레이스 정식 테스트 없음(GATE-3 하향으로 치명도↓) | MINOR | S8.5 |
| R8 | `.env` 키 로컬 평문 — 개발 로컬 범위이므로 수용, 배포 시 게이트 | INFO | 배포 게이트 |

### 정직한 상태 표시
- S8.0은 **DONE(K1~K10 독립 채점 기준 충족)**. S8.1/S8.3은 **구현+자체 device e2e는 통과했으나 독립 3렌즈 미실시** → ai-loop 기준 "완료된 full 스테이지"가 아니라 **"구현 DONE·독립검증 이월"**. S8.5가 이 부채를 닫는 스테이지다. (프로세스 부채를 product DONE으로 반올림하지 않음.)

---

## 3. 로드맵 — 남은 스테이지 (권장 순서)

각 스테이지는 착수 시 **메타프롬프트를 공동설계(AskUserQuestion)→freeze→`prompts/<stage>.md`** 후 구현, 별도 검증팀이 같은 checklist로 채점(ai-loop 계약).

1. **S8.2 — 전체 툴 카탈로그 + 그라운딩 이밸** *(R2·R3 해소)*
   - 툴 추가: `get_project_summary`·`get_sheet(sheet_id)`·`list_issues`·`get_issue(issue_id)`·`list_files`(→ 8000 `/api/drawings`·`/api/issues`·`/api/folders`, 오직 HTTP).
   - 그라운딩 골든 이밸(정답셋 대비) + 환각 적대 테스트("없는 것 물으면 없다고").
   - 메타프롬프트 공동설계 포인트: 툴 세트 범위·이밸 합격선·환각 판정 기준.
2. **S8.3-폴리시 — 챗 UX 완성** *(R5·R6 해소)*
   - 답변 마크다운 렌더(안전 렌더러, 신규 의존성 판단), 대화 목록/이력 UI(`GET /api/chat/conversations` 이미 있음), 딥링크 브리지(xd:navigate — 답의 sheet_id→BuildSheetsView 시트 열기; `GlobalSearch` 딥링크 패턴 재사용).
3. **S8.4 — egress 감사/게이트 정식화** *(R4 해소)*
   - egress 감사로그(무엇이·언제·어느 provider로), 런타임 킬스위치(mock 강제 전환), API 키 관리 정리. 이미 openai 동작 → 운영 안전장치만.
4. **S8.5 — 독립 3렌즈 검수 + reconcile** *(R1·R7 해소, S8 DONE 게이트)*
   - 렌즈1 백엔드 적대(격리 import0/diff0·툴 경로·프롬프트 인젝션)·렌즈2 프론트/a11y(드로어 격리·킬스위치·live region)·렌즈3 Done-When 비평. 발견 수리+회귀. Done-When reconcile(MET/NARROWED/UNMET+증거등급). **통과 시 S8 DONE.**
5. **S10 — XD 온톨로지 적재 + 바인딩** *(GATE-1 연기분, 차별화 핵심)*
   - 도면 entity TypeDB 실적재 + `equipmentEntityId` 바인딩(Study_TypeDB `analysis_result` 계승). TypeDB 3.7.3 기동됨(`store_backend=typedb`). 사이드카 그라운딩에 온톨로지 read 툴 추가 여부는 공동설계(OPEN-1 재검토 연동).

> 조정 여지: S8.2와 S8.3-폴리시는 독립적이라 순서 교체/병행 가능. S8.5는 S8.2~S8.4 뒤(검수 대상이 모여야). S10은 S8 DONE 후 또는 병행.

---

## 4. 다음 세션 ai-loop 진입 절차 (그대로 따라 하면 이어짐)

1. **읽기**: `LOOP.md`(감독 계약) → `PLAN.md`(마일스톤) → `PROGRESS.md` 세션14 블록 → 이 `ROADMAP.md`.
2. **서버 기동**(재기동법):
   - 8000: `XD_STORE=auto backend/.venv/Scripts/python.exe -m uvicorn main:app --app-dir backend --port 8000`(TypeDB Docker 필요 — `docker ps`로 `typedb-server` 확인, 없으면 json 폴백).
   - 8001: `cd backend/ai && .venv/Scripts/python.exe -m uvicorn main_ai:app --port 8001`(또는 `./run.ps1`). `.env`에 `OPENAI_API_KEY`·`XD_AI_MODEL=gpt-5.5`·`XD_AI_EFFORT=low` 존재 확인.
   - 프론트: `npm run dev`(5173). 챗 드로어는 Build 진입 시 우하단 "AI 어시스턴트" FAB.
   - ⚠️ **vitest는 8000 내리고 실행**(라이브 백엔드면 App 템플릿 테스트가 시드 로드로 실패).
   - ⚠️ 사이드카 라우트 추가 후 **8001 수동 재기동**(uvicorn --reload 미사용).
3. **첫 스테이지 = S8.2**(권장): 메타프롬프트 `prompts/11-s8_2-tool-catalog-eval.md`를 공동설계(AskUserQuestion: 툴 세트·이밸 합격선·환각 기준)→freeze→구현→검증팀 채점.
4. **검증 게이트**: 매 스테이지 `npm build`·`vitest`(현 111)·backend `pytest`(현 97)·사이드카 `pytest`(현 12) 회귀0 + 격리 불변식(import0·diff0·프론트 미의존) 유지.

## 5. 파일 지도 (AI 챗 관련)
- 백엔드 사이드카: `backend/ai/`(`main_ai`·`client`·`tools`·`agent`·`provider`·`ai_store`·`routes_chat`·`health`·`eval/`·`tests/`). 키=`.env`(gitignore). 데이터=`_ai_data/`(gitignore).
- 프론트: `src/ai/`(`aiClient`·`ChatDrawer`·`markdown`·`chat.css`), 마운트=`src/BuildSheetsView.tsx`(딥링크 `xd:navigate` 수신도 여기).
- 증거: `evidence/s8_2-golden-eval.md`·`s8_2-chat-typedb-live.png`·`s8_3-*.png`·`EVIDENCE.md` S8.0 블록.
- 게이트: `HUMAN_GATE.md`(GATE-1~4 전부 RESOLVED).

---

## 6. 다음 세션 추천 루프 순서 (세션16 확정 — "루프 먼저, 신규 나중")

> 사용자 질문: 신규 연결기능(이메일·알림·실인증)을 **루프 다음에 할지 먼저 할지**. **결론: 굴러가던 S8 루프를 먼저 닫고(S8.4→S8.5), S10까지 간 뒤, 신규 3종을 각자 하나의 루프 스테이지로**. 이유는 아래 판단근거.

### 판단 근거 (왜 루프 먼저인가)
1. **S8은 거의 끝났다** — S8.0~S8.3 전부 DONE. 남은 건 S8.4(egress 감사)·S8.5(3렌즈 검수)뿐. 여기서 멈추면 **S8.1/S8.3의 독립검증(프로세스 부채 R1)이 영영 미결**로 남는다. 시작한 걸 닫는 비용이 가장 싸고 확실하다.
2. **S8.4가 이메일의 토대다** — S8.4에서 만드는 **egress 감사로그·킬스위치·키 관리**는 이메일 발송(외부 egress)이 그대로 재사용할 인프라다. 즉 S8.4를 먼저 하면 신규 이메일 기능이 그 위에 얹힌다(순서 시너지).
3. **신규 3종은 게이트가 걸려 있다** — 이메일=외부 egress 결정(어느 SMTP/서비스), 실인증=프로덕션 인증(LOOP.md HUMAN_GATE). 조용히 착수 불가, **메타프롬프트 공동설계+게이트 확정**이 선행. 루프를 도는 동안 이 결정을 병행 논의하면 매끄럽다.
4. **S10은 차별화 핵심** — 온톨로지는 이 제품의 고유가치. TypeDB 기동돼 있어 바로 착수 가능.

### 추천 순서 (각 스테이지 = 기존 루프 규율: 메타프롬프트 공동설계→freeze `prompts/<n>.md`→구현→검증팀 채점→reconcile)

| 순서 | 스테이지 | 내용 | 게이트/선행 |
|---|---|---|---|
| **1** | **S8.4 egress 감사/게이트** | 감사로그(무엇이·언제·어느 provider), 런타임 킬스위치(mock 강제), API 키 관리 정식화 | 이미 openai 동작 → 운영 안전장치. **이메일의 토대** |
| **2** | **S8.5 3렌즈+reconcile → S8 DONE** | 렌즈1 백엔드적대·렌즈2 프론트/a11y·렌즈3 Done-When 비평. S8.1/8.3 독립검증 이월분 정산. 통과 시 **S8 DONE 선언** | 없음 |
| **3** | **S10 온톨로지 적재+바인딩** | 도면 entity TypeDB 실적재 + `equipmentEntityId` 바인딩(Study_TypeDB `analysis_result` 계승). 사이드카에 온톨로지 read 툴 추가 여부 공동설계 | 데이터 진실성 검증(세션15 순환성 이월)도 여기서 |
| **4** | **S11 이메일 발송 인프라(신규)** | 메일 provider 추상화(사이드카 provider 패턴 재사용)·발송 서비스·템플릿. S8.4 egress 감사/킬스위치 위에 구축 | **egress 게이트**: 어느 SMTP/서비스·자격증명. 공동설계 필수 |
| **5** | **S12 이슈 라이프사이클 이메일 알림(신규)** | 이슈 생성/상태변경 훅 → 구독자에게 발송. 알림 매트릭스(`notificationGroups` 목업)를 실동작화 | S11 의존. 구독 정책 공동설계 |
| **6** | **S13 실 로그인+매직링크+외부 업로드(신규)** | S7 로컬모의 → 실 자격증명/세션 + 초대 매직링크 + 링크 접속 업로드. **버전추적은 S3 이미 구현** → 실인증만 접붙임 | **프로덕션 인증 게이트**(LOOP.md). 도입 여부·방식 사용자 확정 필수 |

**조정 여지**: 관계자 데모/영업이 급하면 S11(이메일)을 S10보다 앞당길 수 있음 — **단 S8.4는 항상 먼저**(egress 토대). S8.5(검수)는 S8.4 뒤 고정(검수 대상이 모여야).

### 다음 세션 진입 (그대로 따라하면 이어짐)
1. **읽기**: `LOOP.md → PLAN.md → PROGRESS.md(세션16) → 이 ROADMAP §1·§6`.
2. **서버 기동**: 8000 `XD_STORE=typedb ...`(TypeDB Docker 확인, 폴백원하면 `XD_STORE=auto`) · 8001 `backend/ai` `run.ps1` · 프론트 `npm run dev`. ⚠️ vitest는 8000 내리고, 8001 라우트 변경 후 수동 재기동.
3. **첫 스테이지 = S8.4**: `prompts/12-s8_4-egress-audit.md` 공동설계(AskUserQuestion: 감사 범위·킬스위치 방식·키 관리)→freeze→구현→검증팀 채점.
4. **검증 게이트**: 매 스테이지 `npm build`·vitest(현 116)·backend pytest(현 97)·사이드카 pytest(현 26) 회귀0 + 격리 불변식 유지.
5. **push 결정**: 미푸시 7커밋(`bf6c055`~`02be4f3`) origin `main` push 여부 먼저 확인.
