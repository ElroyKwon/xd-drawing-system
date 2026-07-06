# PLAN — 실동작 빌드아웃 마일스톤 로드맵

> `LOOP.md` 다음으로 읽는다. ACC 실기능을 **수직 슬라이스(end-to-end로 작동하는 단위)** 로 분해한다. 외관(appearance-loop)은 전부 완성돼 있으므로, 각 슬라이스는 "이미 있는 외관 + 새로 붙이는 실동작"이다.

## 분해 원칙

- **수직 우선**: 한 슬라이스는 UI→API→변환/연산→영속→화면반영까지 한 줄로 동작해야 한다(가로 레이어 일괄 금지).
- **가치 순서**: 사용자가 첫 슬라이스로 `업로드→변환→뷰어`(S1)를 확정. 이후는 "도면이 떠야 의미 있는" 기능(시트·측정·비교·이슈) → "운영 기반"(파일관리·인증) → "XD 차별화"(온톨로지) 순.
- **각 마일스톤 = 메타프롬프트 1개 freeze + 구현 + 별도 검증팀 채점 + 체크인 정지.**

## 마일스톤

### S1 — 업로드→변환→뷰어 (첫 수직 슬라이스) ★ 다음 작업
**목표**: 실제 dwg/pdf를 xd 화면에서 업로드 → xd 소유 로컬 백엔드가 변환 → 시트 추출 → 2D 뷰어에 실제 도면 표시. end-to-end 1줄 동작.
- **S1-a 백엔드 부트스트랩(S0 흡수)**: xd 레포에 `backend/`(FastAPI) 신설. TypeDB 로컬 기동, 로컬 파일스토리지, 헬스체크, CORS, 에러계약. Study_TypeDB `drawing.py`·`drawing_service.py`·`04-drawings.tql` **이식**(런타임 비의존).
- **S1-b 업로드**: 파일(`FilesView`)/시트 업로드 모달을 실제 `<input type=file>`+멀티파트로 동작. `POST /drawings` → 저장 + `conversion_status=pending`.
- **S1-c 변환**: 백그라운드 변환(ezdxf, 필요 시 ODA File Converter). DWG→DXF 스캔, 시트 추출, 시트별 PNG 생성(`png_path`). `drawing_sheet` 적재.
- **S1-d 뷰어 표시 + 렌더 bake-off**: `SheetViewerShell` 중앙 캔버스에 실제 도면 렌더. **3-way 비교 트랙**: ①하이브리드(pdf.js/PNG) ②오픈소스(DXF→three.js/canvas) ③APS(격리 평가). 동일 도면으로 퀄리티·공수·종속성 비교표 산출 → 채택 게이트.
- **Done**: 테스트 도면 업로드 시 뷰어에 실제로 보인다. 콘솔 0. 백엔드/프론트 테스트 PASS. 렌더 bake-off 비교표 작성.

### S2 — 시트 레지스터 (PDF 페이지 분할 경로)
**목표**: FR-DUC-012 두 번째 인테이크 경로. PDF 도면(예: 청주 전기 단선도)을 페이지 분할 → `시트` 목록에 실데이터 등록(번호·썸네일·공종·버전). DWG 경로(S1)와 분리된 sheet-register 경로.
- PyMuPDF(fitz) 페이지 분할, 시트 메타 추출, 버전세트.
- `buildSheetsData` 정적 시드 → 실데이터 교체. 검색/필터/정렬 실동작.

### S3 — 파일/폴더 관리 + 버전 + 권한
**목표**: ACC Files(카탈로그 I) 실동작. `buildFilesData` 11폴더 정적 시드 → 실 폴더트리 CRUD + 업로드 + 버전 히스토리 + 다운로드/삭제 + 폴더 권한.

### S2.5 — 멀티페이지 스케일 강건화 (실측 도출, S4보다 우선) ★ 다음 작업
**목표**: 전기도면 등 수백 장 멀티페이지 PDF 대응. 2026-06-29 68p/94MB 실측으로 도출 — 병목은 성능이 아니라 (P1) 타이틀블록 메타 추출 100% 폴백(양식 종속), (P2) 목록 페이지네이션 장식(전체 일괄 렌더), (P3) 도면당 119MB 용량 비가시.
- **P1 메타 추출**: 좌표 기반 라벨 앵커(`DWG NO`/`DWG TITLE` 인접·우측·하단 값 페어링) + 정규식 보강 + 멀티페이지 페이지별 제목. 폴백 체인 유지·청주 회귀 0.
- **P2 목록 스케일**: 클라이언트 페이지네이션 실동작(페이지당 50, 필터·정렬 결합). 신규 의존성 0.
- **P3 용량 가시화**: 도면별 저장 용량 stat 노출·표시(압축/정책은 후속).
- 메타프롬프트 `prompts/06-s2_5-multipage-scale.md`.

### S4 — 마크업·측정·비교 실연산 + 영속
**목표**: 뷰어 affordance를 실동작화. 마크업 그리기/저장(영속), 측정(픽셀↔실척 캘리브레이션 연산), 시트 비교(두 버전 실제 오버레이/diff). `viewerData` 정적 → 영속.

### S5 — 이슈 영속 + 뷰어 핀 연계
**목표**: 이슈 생성/조회/상태변경 영속. 뷰어 핀 좌표 ↔ 시트 연계. `IssuesView`·`IssueAddPanel` 실동작.

### S6 — Build 홈 위젯 실데이터 + 전역 검색
**목표**: `BuildHomeView` 개요/종합 위젯(진행률·작업·Bridge·최근활동·분석차트)을 실데이터 집계로. 프로젝트 전역 검색.

### S7 — 인증/RBAC + 프로젝트/구성원 영속
**목표**: 로컬 인증 + 역할(관리자·편집자·뷰어). `projectAdminData` 정적 → 영속. 프로젝트 생성/구성원 접근이 권한 반영. (프로덕션 auth는 HUMAN_GATE — 로컬 범위로.)

### S8 — 사이드카 AI 챗 어시스턴트 (하위 스테이지 S8.0~S8.5)
**목표**: 8000 무수정·신규 라우트 0의 사이드카(8001) AI 챗. 읽기 그라운딩 기반 Q&A. LLM egress=사용자 승인(OpenAI gpt-5.5). (온톨로지 바인딩은 S10 연기.)
- **S8.0 DONE**(`e6309c1`): 격리 8001 부트스트랩 + 8000 HTTP 데이터경로 + 격리 불변식(import0·diff0). `prompts/10` FROZEN.
- **S8.1 DONE**(`beb56c9`+`12096f1`): provider(OpenAI **Responses API**+Mock)·tool-use 루프·대화영속. **LLM=gpt-5.5·effort low** 확정. 실 GPT 라이브 실증.
- **S8.2 DONE**(`c39d6bf`): 전체 툴 카탈로그(`get_project_summary`·`get_sheet`·`list_issues`·`get_issue`·`list_files`) + 그라운딩 골든 이밸 + 환각 적대 테스트. 골든 이밸 15/15, 사이드카 pytest 22.
- **S8.3 DONE**(`d6e8b8b`): 앱 챗 드로어 UI(`src/ai/` 격리·Build 단일 마운트·킬스위치). GATE-2=Build 스코프로 처분.
  - **S8.3-폴리시 DONE**: 답변 마크다운 렌더(`cc510c8`)·드로어 폭 리사이즈(`8dba37b`)·대화 목록/이력 UI(`9b0ebc7`)·딥링크 브리지(`086c331`, xd:navigate — 답의 sheet_id/issue_id로 시트/이슈 열기, `test_references.py`) 전부 로컬 커밋 완료. device 검증 콘솔0.
- **S8.4 TODO**: 클라우드 provider egress **감사로그 + 게이트 정식화**(openai 동작하나 감사·킬스위치·게이트 분리 미완). API 키 관리.
- **S8.5 TODO**: 3렌즈 독립 검수 + 격리 불변식(백엔드 import0/diff0 · 프론트 src/ai 미의존) 재확인 + Done-When reconcile.

### S10 — XD 고유: 온톨로지 바인딩 (S8에서 연기)
**목표**: 도면 entity TypeDB 적재 + `equipmentEntityId` 바인딩 동작(Study_TypeDB `analysis_result`·multi-agent 계승). 장비 온톨로지 해석. **GATE-1 RESOLVED(2026-07-02): 당초 S8 전제였으나 S10으로 연기**.

### S14 — PDF 시트 ↔ DWG 소스 매칭 + 버전 기반 (Phase 1: 토대)
**목표**: 실제 도면관리 왕복(이슈→수정→리턴 DWG→버전관리→신규 PDF로 시트 갱신)의 **1차 토대**. 현행 시스템은 PDF↔DWG 링크·supersede·이슈연결이 전무 → deep-interview(2026-07-06)로 현장 절차 확정. **세트 제출(DWG+PDF) 기본·수동 매핑·시트별 rev+발행분 이중버전·검증게이트**를 freeze. Phase 1 = ①Package/Transmittal 엔티티 ②`sheet_key`(버전 가로지르는 영속 시트 정체성, 시트번호는 라벨) ③sheet_source 링크(N:M 수동 매핑) + 세트 업로드·매핑 UI + 시트→소스 DWG 벡터 뷰어 열기. `prompts/19` FROZEN(2026-07-06), N1~N9 채점. **자동변환·supersede·이슈연결은 Phase 2**(Out of scope). 기존 drawing/sheet/folder/version_set 무변경 + 새 JSON 2개(`_packages.json`·`_sheet_sources.json`) 외부 조인.

## 마일스톤 체크리스트

- [x] S1 업로드→변환→뷰어 (+ 렌더 bake-off S1.5: 2-way 승자=②벡터, ③APS 전략상 배제)
- [x] S2 시트 레지스터(PDF 분할 + paperspace 분리 + 실데이터 교체 + 휴리스틱 메타)
- [x] S3 파일/폴더/버전/권한 (폴더 CRUD + 명시적 버전세트 + 권한 메타·표시·편집, 인증/RBAC=S7)
- [x] S2.5 멀티페이지 스케일 강건화 (라벨앵커 추출 0%→98% + 클라 페이지네이션 + 용량 가시화)
- [x] S4 마크업·측정·비교 실연산+영속 (벡터 world+PDF 정규화 이중트랙·DXF 실척 측정·클라 색상오버레이+백엔드 픽셀 diff, E1~E13 MET)
- [x] S5 이슈 영속+핀 연계 (독립 Issue 엔티티·ACC식 상태4종+메타·양방향 딥링크·핀 선택적[DXF world/PDF image], H1~H13 MET, 3렌즈+e2e[DWG·PDF·무핀]·MAJOR-1 수리)
- [x] S6 Build 홈 위젯 실데이터+검색 (홈 집계 실데이터+정직한 빈 상태+이슈 분석 차트[의존성0] + 백엔드 /api/search 4종 교차+상단 전역검색+딥링크, I1~I14 MET, 3렌즈+e2e·seed 부작용 수리)
- [x] S7 인증/RBAC+프로젝트/구성원 영속 (로컬 모의 인증·역할 강제 403·정규화 모델, J1~J12 MET, prompts/09 FROZEN, 세션10 검증 마무리)
- [x] S8.0 사이드카 부트스트랩 (격리 8001+8000 데이터경로, K1~K10 MET, prompts/10 FROZEN)
- [x] S8.1 챗 두뇌 (provider OpenAI[Responses API]+Mock·tool-use 루프·대화영속, 실 GPT-5.5 라이브 실증)
- [x] S8.3 앱 챗 드로어 UI (src/ai 격리·Build 단일 마운트·킬스위치, device e2e 콘솔0)
- [x] S8.2 전체 툴 카탈로그 + 골든 이밸/환각 적대
- [x] S8.3-폴리시 마크다운 렌더·리사이즈·대화이력 UI·딥링크 xd:navigate (4종 전부 로컬 커밋 완료 `cc510c8`·`8dba37b`·`9b0ebc7`·`086c331`)
- [ ] S8.4 egress 감사로그/게이트 정식화
- [ ] S8.5 3렌즈 검수 + 격리 불변식 reconcile
- [ ] S10 XD 온톨로지 적재 + equipmentEntityId 바인딩 (TypeDB 기동됨 → 착수 가능)
- [x] S14 PDF↔DWG 매칭 + 버전 토대 Phase 1 (Package·sheet_key·sheet_source + 세트 업로드·수동 매핑 UI[HTML5 DnD+a11y 버튼+계승 셀렉트] + 소스 DWG 벡터 왕래, prompts/19 FROZEN, **N1~N9 전항목 MET**, 세션20. 3렌즈 BLOCKER0·MAJOR1[프로젝트 스코프 계승]+MINOR9 전량 수리, 자체 실버그2[renderEngine stale·변환폴링] e2e 적발수리. pytest 125·vitest 128·build·diff clean. device e2e 콘솔0 `evidence/s14-01~08`)

## 순서 근거 / 조정 여지

- S1이 1순위인 이유: "도면이 실제로 보이는" end-to-end가 가장 큰 임팩트(사용자 확정). 백엔드 기반도 여기서 깔린다.
- S2~S6은 "뷰어가 동작한 뒤" 가치가 커지는 기능. S3(파일관리)을 더 앞당기길 원하면 S2와 교체 가능.
- S7(인증)은 단일 사용자 로컬 개발 동안 뒤로 미룸. 다중 사용자 필요 시 앞당김.
- S8(온톨로지)은 XD 차별화의 핵심이나 S1~S5 데이터 기반 위에 얹는 게 안전.
