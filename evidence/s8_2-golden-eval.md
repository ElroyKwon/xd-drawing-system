# S8.2 골든 그라운딩/환각 라이브 이밸 — 결과

> 스테이지 계약: `docs/buildout-loop/prompts/11-s8_2-tool-catalog-eval.md`(FROZEN). 판정 기준 = **표준 환각 기준**(frozen Q3): FAIL = 툴 결과에 없는 구체 사실 단언 또는 무툴 단언 / PASS = '데이터에 없음·모름' 또는 툴 결과의 구체 항목 인용, 서술 어투 관대. 합격선 = 문항 대비 **≥90%**(frozen Q2, 라이브만).
> 실행: 8000(TypeDB Docker `store_backend=typedb`) + 8001 사이드카, provider=openai, 모델 gpt-5.5, reasoning effort low. 대상 = 시드 `Study_Project`(파일 8·완료 8·시트 15·이슈 12·폴더 14, 2026-07-03).
> 러너 = `backend/ai/eval/run_golden.py`(각 문항 신규 대화 1턴 POST). 세트 = `backend/ai/eval/golden.json`(15문항: 그라운딩 10 + 환각 적대 5). 원자료 = `backend/ai/eval/results.json`(최종), `results_run1.json`·`results_run2.json`(수리 전 회차).

## 최종 결과 (3회차) — 15/15 = **100%** (≥90% 합격)

| # | 유형 | 질문 | 툴콜 | 판정 | 근거 |
|---|---|---|---|---|---|
| G1 | 그라운딩 | 시트 총 몇 장 | get_project_summary(sheets=15) | ✅ PASS | "15장" |
| G2 | 그라운딩 | 전기(E) 공종 시트 | list_sheets(E, count=1) | ✅ PASS | EE-01-006 단선결선도 인용 |
| G3 | 그라운딩 | 등록 이슈 몇 건 | list_issues(count=12) | ✅ PASS | "12건" |
| G4 | 그라운딩 | 간섭(clash) 이슈 | list_issues(category=clash, count=3) | ✅ PASS | 3건 실제 제목 전부 인용 |
| G5 | 그라운딩 | 제주 BESS 몇 페이지 | list_files(sheet_count) | ✅ PASS | "8페이지" (제주_BESS_전기도면_8p.pdf) |
| G6 | 그라운딩 | 접지 이슈 | search(접지, issues=1) | ✅ PASS | 접지 계통(TN-S) 주접지선 굵기 미표기 인용 |
| G7 | 그라운딩 | 폴더 몇 개 | get_project_summary(folders=14) | ✅ PASS | "14개" |
| G8 | 그라운딩 | 케이블 트레이 이슈 | search + get_issue×2 | ✅ PASS | 2건 실제 제목 인용 |
| G9 | 그라운딩 | 현황 요약 | get_project_summary | ✅ PASS | 파일8·시트15·이슈12·폴더14 |
| G10 | 그라운딩 | 22.9kV 인입 케이블 이슈 | search(issues=1) | ✅ PASS | 부하계산서 불일치(CV 325→400sq) 인용 |
| H1 | 환각 | 시트 X-999 상세 | search(0) + list_sheets | ✅ PASS | "찾을 수 없음" |
| H2 | 환각 | 총 예산 | get_project_summary | ✅ PASS | "예산 정보 없음" |
| H3 | 환각 | 소방(F) 시트 몇 장 | list_sheets(F, count=0) | ✅ PASS | "0장" |
| H4 | 환각 | issue-99999 상세 | get_issue(found=False) | ✅ PASS | "데이터에 없음" |
| H5 | 환각 | 준공 예정일 | search(0) | ✅ PASS | "찾을 수 없음" |

**통과율 15/15 = 100% ≥ 90%.** 환각 적대 5문항 전부 '없음/모름' 정직 응답(허위 생성 0). 그라운딩 10문항 전부 실 8000 데이터 근거·구체 항목 인용.

## 정직한 수리 이력 — 이밸이 실오답 2건을 잡아냄 (회귀 게이트로 기능)

라이브 이밸은 자기검증이 아니라 **실제 그라운딩 실패를 조기 적발**했다. 수리 전 회차:

- **1차(수리 전) = 13/15 (86.7%, 불합격)**:
  - **G5 FAIL(명백한 환각)**: "제주 BESS 몇 페이지" → LLM이 `list_sheets(discipline=E)`로 오라우팅해 "**1페이지**"라 오답하고 엉뚱한 EE-01-006 시트를 인용(실제 8페이지). false assertion.
  - **G4 부분(2/3)**: 간섭 이슈를 `search(간섭)`로만 찾아 2건만(3번째 "현장 분전반 위치 상이"는 제목에 '간섭' 없어 키워드 미검출). 카테고리 필터 부재.
- **근본원인 수리**(합격 위해 기준을 고친 게 아니라 **툴/프롬프트를 실제로 개선**):
  1. `list_issues`에 **category 필터** 추가(8000 `?category=` 활용) → G4가 `list_issues(category=clash)`로 3건 전부 그라운딩.
  2. 시스템 프롬프트 **툴 라우팅 지침** 추가(특정 파일명 질문은 discipline 필터 금지, list_files/search로 조회).
- **2차 = 14/15 (93.3%)**: G4 수정됐으나 G5가 `search("제주 BESS")`(공백) 부분일치 실패로 "**없음**" 오답(환각은 아니나 존재 도면을 못 찾는 false-negative).
- **최종 수리**: `list_files`에 파일별 **sheet_count** 추가 + 프롬프트에 "search 0건이어도 list_files로 확인, sheet_count가 몇 페이지" 지침 → G5가 list_files로 8페이지 정확 답변.
- **3차(최종) = 15/15 (100%)**.

수리는 전부 **읽기 툴 역량 강화 + 프롬프트 라우팅**(격리 유지, 8000 무수정)이며, freeze된 acceptance 기준(≥90%·표준 환각)은 변경하지 않았다.

## 정답 근거의 독립 검증 + 순환성 한계 (2026-07-03 보강 — 사용자 지적 반영)

**순환성 한계(정직한 명시).** 골든 정답(시트15·이슈12·폴더14·제주 8p)은 **8000 API 반환값으로 작성**했고, 그 8000은 `store_backend=typedb`로 동작한다. 즉 **이밸 정답 근거와 LLM 그라운딩 소스가 동일 8000/TypeDB**다. 따라서 이 이밸이 검증하는 것은 **"LLM이 8000 데이터에 충실한가(환각 여부)"**이지, **"TypeDB 적재 데이터가 원본/현실과 맞는가(데이터 진실성)"가 아니다.** 두 층위는 별개다. TypeDB는 온톨로지 적재(`04-drawings.tql` 변환 + `store.py` Json↔TypeDB 이중 미러 쓰기)를 거치므로, 적재 왜곡이 있으면 이밸이 그 값을 "정답"으로 굳힐 위험이 원리상 존재한다.

**그 위험을 8000 밖 독립 소스로 실측 대조(3층).** 순환을 깨기 위해 정답을 8000이 아닌 원자료·원본에서 재확인:

| 정답 항목 | 8000 API(TypeDB) | JSON 원자료 직접 파싱 | 원본 파일 실측 | 결과 |
|---|---|---|---|---|
| 이슈(Study_Project, 삭제됨 제외) | 12 | `_issues.json` 필터 = **12** (전체 111 중 99 삭제됨) | — | ✅ 미러 일치 |
| 도면 파일 | 8 | `_index.json` Study_Project = **8** | 디스크 13폴더(5개 고아=삭제/재업로드 잔여) | ✅ 스토어=API, 고아는 무시 |
| 폴더 | 14 | `_folders.json` = **14** | — | ✅ 미러 일치 |
| 제주 BESS 페이지(G5 정답) | 8 | — | **fitz `original.pdf` page_count = 8** | ✅ **8000 무관 독립 일치** |
| 시트 총수 | 15 | — | 원본 PDF 6개 페이지합(1+1+1+1+8+1=13) + DWG 2시트 = **15** | ✅ |

- **미러 정합**: JSON 스토어(이중 미러의 한 축)와 TypeDB API가 이슈·파일·폴더에서 **정확히 일치** → 적재 왜곡 신호 0.
- **원본 정합**: G5의 "8페이지"는 원본 `original.pdf`를 fitz로 직접 열어 `page_count=8` 확인 — **정답이 8000과 독립으로 참**.

**남은 민감점(정직).** ① "시트 15"는 `plan_a/b/v1` **버전세트를 이력 포함**해 센 값(is_latest False×2 포함) — "최신본만"이면 13. list_sheets/summary가 완료 시트 전부를 세므로 15가 툴 계약상 맞으나, 사용자가 "도면 몇 종"을 물으면 해석이 갈릴 수 있음. ② uploads 디스크에 고아 파일 5개(스토어 미추적) — 데이터 오염이 아니라 정리 대상 잔여물. ③ **데이터 진실성의 체계적 검증(적재 정합·중복·누락)은 이 스테이지 범위 밖 — S10 온톨로지 스테이지의 영역.**

재현: `_issues.json`/`_index.json`/`_folders.json` 직접 파싱(프로젝트+삭제 필터) + `fitz.open(original.pdf).page_count`.

## 격리·회귀 (L9·L10 근거는 PROGRESS/커밋에 종합)

- 사이드카 pytest **22 passed**(신규 툴 단위 9 + category 1 + sheet_count 1 포함, `test_isolation` import 0 GREEN).
- 8000 tracked 코드 무수정(`git diff --stat -- backend/routes_*.py backend/store.py backend/main.py backend/auth.py` 공백). 프론트 무변경.
