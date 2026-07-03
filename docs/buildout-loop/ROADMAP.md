# ROADMAP & 검수 — 빌드아웃 루프 (세션14 정리, 다음 세션 ai-loop 진입점)

> 작성 2026-07-03(세션14). **다음 세션은 `ai-loop` 스킬을 장착하고 `LOOP.md → PLAN.md → PROGRESS.md → 이 파일` 순으로 읽어 이어받는다.** 이 문서는 (1) 현재까지 검수(review), (2) 남은 스테이지 로드맵, (3) 다음 세션 진입 절차를 담는다. 실행 대상이 아니라 계획·검수 정리다.

---

## 1. 현황 한 눈에

빌드아웃 루프 **S1~S7 DONE + S8.0/S8.1/S8.3 DONE**. AI 챗 어시스턴트가 앱에서 **실 GPT-5.5로 실동작**(격리 사이드카 8001 → tool-use → 8000/TypeDB 그라운딩 → 앱 드로어 UI).

| 스테이지 | 상태 | 커밋 | 검증 근거 |
|---|---|---|---|
| S1~S6 | ✅ DONE | (세션1~8) | 각 acceptance MET, 3렌즈+e2e |
| S7 인증/RBAC | ✅ DONE | (세션9~10) | J1~J12 MET |
| S8.0 사이드카 부트스트랩 | ✅ DONE | `e6309c1` | K1~K10 MET, `EVIDENCE.md` S8.0 |
| S8.1 챗 두뇌(provider·루프·영속) | ✅ DONE | `beb56c9`·`12096f1` | pytest12, 실 GPT 라이브 `evidence/s8_1-real-gpt-transcript.md` |
| S8.3 앱 챗 드로어 UI | ✅ DONE | `d6e8b8b` | device e2e 콘솔0, `evidence/s8_3-chat-drawer.png` |
| UI 정리(배너/제품 숨김·스크린샷) | ✅ | `0060c44` | 스크린샷 10장 재촬영 |
| **S8.2 툴 카탈로그+이밸** | ⬜ TODO | — | 다음 세션 |
| **S8.3-폴리시**(마크다운·이력·딥링크) | ⬜ TODO | — | 다음 세션 |
| **S8.4 egress 감사/게이트** | ⬜ TODO | — | 다음 세션 |
| **S8.5 3렌즈 검수+reconcile** | ⬜ TODO | — | 다음 세션 |
| **S10 온톨로지 적재+바인딩** | ⬜ TODO | — | TypeDB 기동됨 → 착수 가능 |

**게이트**: GATE-1~4 전부 RESOLVED(`HUMAN_GATE.md`). **S8 DONE 선언은 S8.2·S8.4·S8.5 + Done-When reconcile 후.**

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
- 백엔드 사이드카: `backend/ai/`(`main_ai`·`client`·`tools`·`agent`·`provider`·`ai_store`·`routes_chat`·`health`·`tests/`). 키=`.env`(gitignore). 데이터=`_ai_data/`(gitignore).
- 프론트: `src/ai/`(`aiClient`·`ChatDrawer`·`chat.css`), 마운트=`src/BuildSheetsView.tsx`.
- 증거: `evidence/s8_1-real-gpt-transcript.md`·`evidence/s8_3-chat-drawer.png`·`EVIDENCE.md` S8.0 블록.
- 게이트: `HUMAN_GATE.md`(GATE-1~4 전부 RESOLVED).
