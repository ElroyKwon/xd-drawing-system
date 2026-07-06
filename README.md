# xd-drawing-system

XD 제품군에 포함될 도면관리 시스템 개발 프로젝트.

Autodesk Construction Cloud Build를 벤치마크로 삼아, 도면관리 화면과 워크플로우를 메뉴 단위로 재현하고 XD 고유의 설비 엔티티 바인딩과 지식 연동을 붙여가는 실험/개발 공간이다.

## 서버 기동 (Quick Start)

```powershell
# 1) 백엔드 (FastAPI, 127.0.0.1:8000) — JSON 폴백 스토어. 청주 실데이터 시연은 XD_STORE='typedb'
cd "D:\_Project\xd-drawing-system\backend"; $env:XD_STORE='json'; .\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000

# 2) AI 어시스턴트 사이드카 (FastAPI, 127.0.0.1:8001) — 별도 프로세스·기존 8000 무수정. 실 gpt-5.5
cd "D:\_Project\xd-drawing-system\backend\ai"; .\.venv\Scripts\python.exe -m uvicorn main_ai:app --host 127.0.0.1 --port 8001   # 또는 .\run.ps1

# 3) 프론트엔드 (Vite, 127.0.0.1:5173) — 별도 터미널, 프로젝트 루트에서
cd "D:\_Project\xd-drawing-system"; npm run dev -- --host 127.0.0.1 --port 5173
```

- 접속: http://127.0.0.1:5173 · 백엔드 헬스체크: http://127.0.0.1:8000/health · AI 사이드카 헬스체크: http://127.0.0.1:8001/health
- AI 사이드카는 `backend/ai/.env`에 `OPENAI_API_KEY`·`XD_AI_MODEL=gpt-5.5`·`XD_AI_EFFORT=low` 필요(gitignore). 키 없으면 MockProvider(egress 0)로 동작. 프론트 킬스위치 `VITE_AI_ENABLED`.
- ⚠️ 프론트 Vitest(`npm test`)는 8000 백엔드를 내리고 실행한다(라이브 백엔드면 템플릿 fixture 테스트 오염).
- TypeDB가 필요하면 `docker ps`로 `typedb-server`(1729) 확인 후 `XD_STORE=typedb`(강제, 폴백 없음) 또는 `XD_STORE=auto`, 없으면 `XD_STORE=json` 폴백.

## Current State

- 앱은 **3개 프로세스**로 구성된다: Vite + React + TypeScript 프론트엔드(5173) · `backend/` FastAPI 본체(8000) · `backend/ai/` 격리형 AI 어시스턴트 사이드카(8001, 기존 8000 무수정).
- 외관 루프(`docs/appearance-loop/PROGRESS.md`)는 M5까지 완료. **빌드아웃 루프(`docs/buildout-loop/PROGRESS.md`)는 S1~S13 전부 DONE**(세션17에 push 완료). ⚠️ README 진입점은 항상 `docs/buildout-loop/PROGRESS.md` 최신 세션 블록을 신뢰한다.
- **세션18(2026-07-06)에 데모 데이터를 실제 청주 데이터로 전면 교체했다.** 프로젝트 `Study_Project → "LS 청주사업장"`(id `project-study` 유지). `청주사업장신축/전기도면` **실 PDF 40장**(EE-00-001~EE-05-005) 업로드→변환 40/40, 시트번호 100% 추출·전부 공종 E, TypeDB 실적재 40건. 온톨로지 설비 **15종·바인딩 33**(`scripts/seed_ontology.py`, 청주 실계통 재큐레이트). 데모 재시드 = 이슈 10·작업 6·양식 4·사진 4. AI(실 gpt-5.5) 그라운딩·온톨로지·환각 probe 검증 PASS.
  - ⚠️ 도면/이슈/온톨로지 **데이터는 gitignore된 `backend/uploads/`·`_ai_data/`에만 있다**(git에 커밋되는 코드 변경은 `seed_ontology.py`뿐). 재현은 실 PDF 업로드 + 시드 스크립트로 한다.
- 로컬 백엔드(8000)는 파일 업로드, PDF 분할·PNG 렌더, DWG/DXF 변환·벡터 추출, 시트 레지스터, 폴더/버전 세트, 마크업·측정·시트비교, 이슈/핀, 작업, 양식, 사진, 전역 검색, 구성원/RBAC(관리자·편집자·뷰어 3역할, UI 게이팅 + 서버 403 이중 방어), 이메일 알림(mock), 온톨로지(TypeDB)를 다룬다.
- AI 사이드카(8001)는 실 gpt-5.5(Responses API)가 8000의 공개 HTTP GET 툴 7종(`get_project_summary`·`list_sheets`·`get_sheet`·`search`·`list_issues`·`get_issue`·`list_files`)과 온톨로지 조회(`list_equipment`)를 스스로 골라 호출해 **시스템 실데이터에만 근거해 답한다**(환각 골든 이밸 15/15). egress 감사·킬스위치·키 보호 포함.
- TypeDB는 `docker ps`로 `typedb-server`(1729) 확인 후 `XD_STORE=typedb`(강제) 또는 `auto`, 없으면 `json` 폴백. 드라이버 패닉은 컨테이너 재시작으로 해소.
- 실 계정 로그인/SSO, 이메일 실 발송, 운영 배포, Autodesk cloud/API 연동, paid SDK, 고객 실도면 반입/저장 정책, AI 앱내 쓰기 액션(P1+P2 이후)은 아직 HUMAN_GATE 범위다.
- 루트 Markdown은 `README.md`, `AGENTS.md`, `CLAUDE.md`, `HISTORY.md`, `ROADMAP.md`만 유지한다.

### 제품 문서 / 보고서 (docs/product/)

- `docs/product/기능설명서.md` · `docs/product/사용자매뉴얼.md` — 모듈별 구현 명세·작업별 안내.
- `docs/product/screenshots/` — 최신 화면 캡처 **18종**(01~18, 청주 실데이터, 2560×1362). 구버전은 `이전버전_2026-07-02/·07-03/·07-06/`로 보관.
- **`docs/product/보고서_2026-07-06/`** — 자기완결형 보고서 세트. `기능소개.md`(18화면 설명 + 청주 실데이터 대표 수치) + `screenshots/` 18장. 이 폴더만 있으면 다른 곳에서 보고서/제안서를 작성할 수 있도록 정리됨(vault 제안서 v4의 소스).

## Implemented Local Slices

- **허브·프로젝트**: 프로젝트 목록/작성 모달/삭제, `My Home`, 프로젝트 템플릿(백엔드 영속 + 생성 시 폴더·구성원 자동 시드), Project Admin.
- **시트 레지스터(S2·S2.5)**: PDF 페이지 분할 + DWG/DXF 모델·페이퍼 스페이스 분리, 타이틀블록 휴리스틱(시트번호·제목·공종 A/E/M/P/G), 검색·공종 필터·자연정렬, 50개 페이지네이션, 도면별 저장 용량.
- **파일·폴더·버전(S3)**: 기본 폴더 seed, 폴더 CRUD, 폴더 대상 업로드, 명시적 버전 세트(보관·이력·최신 1행), 다운로드, 공유 메타.
- **2D 뷰어·마크업·측정·비교(S4)**: canvas2D 벡터 렌더(DXF world 좌표) + PDF 이미지 렌더(정규화 좌표) 이중 트랙, 마크업 10종 영속, DXF 실척 측정(`$INSUNITS`), 버전 색상 오버레이 + 백엔드 픽셀 diff.
- **이슈·핀(S5)**: 독립 Issue 엔티티, 상태머신(열림→진행중→답변됨→닫힘), 도면 좌표 핀, 목록↔뷰어 양방향 딥링크.
- **홈·검색(S6)**: 실데이터 집계 대시보드(진행률·KPI·이슈 차트, 인라인 SVG/CSS), 정직한 빈 상태, 전역 검색(시트·이슈·파일·폴더 교차 + 딥링크).
- **인증·RBAC(S7)**: 로컬 모의 사용자 전환, 관리자·편집자·뷰어 3역할, UI 게이팅 + 서버 403 이중 방어, 마지막 관리자 락아웃 방지.
- **작업·양식·사진(S9)**: Task 보드(담당·상태·우선순위·기한), 점검 양식 체크리스트(완료율 자동 산출), 사진 갤러리(시트 연결·라이트박스).
- **AI 챗 사이드카(S8)**: 격리형 8001, 실 gpt-5.5(Responses API) tool-use, 8000 GET 툴 7종 그라운딩, 대화 영속, 마크다운 렌더·드로어 리사이즈·대화 목록·딥링크 `xd:navigate`, 골든 이밸 15/15.
- **온톨로지(S10)**: TypeDB 설비 지식그래프 적재 + 시트 바인딩, AI `list_equipment` 조회(설비↔도면 그래프 질의).
- **이메일 알림·인증 설계(S11~S13)**: 발송 인프라(mock + 실 SMTP egress 게이트), 이슈 라이프사이클 알림, 실 인증 설계(게이트).
- 로컬 FastAPI `backend/`(라우트 `routes_*` 12종) + `backend/ai/` 사이드카 + 파일 스토리지 + `/health`.

## Next Session

다음 개발 진입점은 **`docs/buildout-loop/PROGRESS.md` 세션18 블록**이다. 빌드아웃 루프 S1~S13은 DONE. 다음 두 갈래:

1. **P1+P2 대화형 에이전트 액션 구현**(설계·계획 freeze 완료, 구현 미착수) — AI(8001)가 이슈 생성·상태 변경·작업 생성을 **제안만** 하고, 사용자 확인 카드 [실행] 시 프론트가 기존 8000 라우트를 실행(사이드카 격리 보존·RBAC·감사·휴먼인더루프). 설계 `docs/superpowers/specs/2026-07-06-conversational-actions-mcp-roadmap-design.md` · 계획(8태스크 TDD) `docs/superpowers/plans/2026-07-06-conversational-actions-p1p2.md`. subagent-driven-development 권장.
2. 미푸시 3커밋(gitignore·seed·설계·계획) push는 사용자 승인 대기.

이후 큰 로드맵 P3(읽기 MCP)·P4(실 인증 GATE-6)·P5(MCP write+이메일 실발송 GATE-5)는 게이트 확정 후 착수.

⚠️ 프론트 Vitest(`npm test`)는 8000 백엔드를 내리고 실행한다(라이브 백엔드면 App 템플릿 테스트가 시드 로드로 오염 — 백엔드 내리면 116 전부 통과). 검증 기준: 프론트 116 · 백엔드 109 · AI 사이드카 39 · AI 그라운딩 골든 15/15.

재시작 순서:

1. `AGENTS.md`와 이 `README.md`를 먼저 읽는다.
2. `docs/buildout-loop/LOOP.md`, `docs/buildout-loop/PLAN.md`, `docs/buildout-loop/PROGRESS.md`, `docs/buildout-loop/EVIDENCE.md`를 확인한다.
3. TypeDB가 필요하면 `docker ps`로 `typedb-server`를 확인하고, 없으면 JSON 폴백으로 범위를 명시한다.
4. 백엔드: `cd backend; $env:XD_STORE='json'; .\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000`
5. 프론트엔드: `npm run dev -- --host 127.0.0.1 --port 5173`
6. 작업 후 최소 검증은 `npm test`, `npm run build`, `backend\.venv\Scripts\python.exe -m pytest backend\tests`, `backend\ai\.venv\Scripts\python.exe -m pytest backend\ai\tests -q`, `git diff --check`다. 프론트 Vitest는 live backend 영속 데이터와 섞이면 템플릿 fixture 테스트가 흔들릴 수 있으므로, 실패 시 backend 상태/fixture 오염을 먼저 분리한다.

## Start

```powershell
cd "D:\_Project\xd-drawing-system"
codex
```

Read first:

1. `AGENTS.md`
2. `README.md`

## References

- `reference/acc-screenshots/`
- `reference/acc-analysis/`
- `reference/dks-design-docs/`
- `reference/old-prototypes/`

Treat `reference/` as read-only source material. Copy or summarize into active working docs only when needed.

## Verification

For product code changes, run at minimum:

```powershell
npm test
npm run build
git diff --check
```

For UI work, also verify browser behavior, console state, and screenshot evidence when relevant.
