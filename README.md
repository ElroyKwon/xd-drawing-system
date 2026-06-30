# xd-drawing-system

XD 제품군에 포함될 도면관리 시스템 개발 프로젝트.

Autodesk Construction Cloud Build를 벤치마크로 삼아, 도면관리 화면과 워크플로우를 메뉴 단위로 재현하고 XD 고유의 설비 엔티티 바인딩과 지식 연동을 붙여가는 실험/개발 공간이다.

## Current State

- 앱은 Vite + React + TypeScript + Vitest 기반 프론트엔드와 `backend/` FastAPI 로컬 백엔드로 구성된다.
- 현재 `docs/appearance-loop/PROGRESS.md` 기준 외관 루프는 M5까지 완료됐다.
- 현재 `docs/buildout-loop/PROGRESS.md` 기준 buildout 루프는 **S6 DONE + S7 구현완료(검증 이월)**이다(S1~S6 + S2.5 DONE, S7=로컬 모의 인증·RBAC 강제·구성원/프로젝트 영속, J1~J12 중 자동게이트+RBAC 라이브+핵심 UI e2e 입증·3렌즈/reconcile/일부 UI게이팅 이월).
- 로컬 백엔드는 `XD_STORE=json` 폴백으로 실제 파일 업로드, PDF 분할, DWG/DXF 변환 경로, 시트 목록, 폴더/버전 메타, 마크업·측정·시트비교·이슈/핀 영속을 다룬다.
- TypeDB 연결 경로는 코드와 과거 검증 근거가 있으나, 현재 재현은 Docker/TypeDB가 떠 있을 때만 `XD_STORE=auto`로 가능하다. TypeDB 직접 쿼리화는 후속 부채다.
- Auth, 운영 배포, Autodesk cloud/API 연동, paid SDK, 고객 실도면 반입/저장 정책은 아직 HUMAN_GATE 범위다.
- 루트 Markdown은 `README.md`, `AGENTS.md`, `CLAUDE.md`만 유지한다.

## Implemented Local Slices

- ACC #6 `프로젝트 목록`, ACC #1 `프로젝트 작성 모달`
- Hub `My Home`, `프로젝트`, `프로젝트 템플릿` local shells
- Project Admin local shells
- Build 홈, 시트, 파일, 이슈, 양식, 사진, 구성원, 브리지, 설정 shell
- 로컬 FastAPI `backend/` + 파일 스토리지 + `/health`, `/api/drawings`, `/api/folders`
- PDF 업로드/분할/PNG 렌더, DWG→DXF 변환/벡터 추출 경로
- 시트 레지스터: 실데이터 매핑, 검색/공종 필터/정렬, 50개 단위 페이지네이션, 도면별 저장 용량 표시
- Files: 기본 폴더 seed, 폴더 CRUD, 폴더 대상 업로드, 명시적 버전세트, 버전 이력, 다운로드, 공유 메타
- 2D 시트 뷰어 shell: 실제 시트 이미지 표시, 마크업/이슈/측정/비교 UI affordance

## Next Session

다음 개발 진입점은 `docs/buildout-loop/PROGRESS.md`의 **S7 검증 마무리**다(구현 완료·커밋·자동 게이트 GREEN, 잔여=독립 3렌즈·Done-When reconcile·J7 Build 콘텐츠 UI 게이팅·e2e 확장). 그 다음 **S8 온톨로지+AI**(AI=HUMAN_GATE). `docs/buildout-loop/prompts/09-s7-auth-rbac-members.md` FROZEN. 2026-06-29 사용자 범위 정정(**웹 DWG/PDF 원본 직접 수정 금지**, **실제 도면 이미지 기반 운영자 이슈 예시**)을 계승한다.

재시작 순서:

1. `AGENTS.md`와 이 `README.md`를 먼저 읽는다.
2. `docs/buildout-loop/LOOP.md`, `docs/buildout-loop/PLAN.md`, `docs/buildout-loop/PROGRESS.md`, `docs/buildout-loop/EVIDENCE.md`를 확인한다.
3. TypeDB가 필요하면 `docker ps`로 `typedb-server`를 확인하고, 없으면 JSON 폴백으로 범위를 명시한다.
4. 백엔드: `cd backend; $env:XD_STORE='json'; .\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000`
5. 프론트엔드: `npm run dev -- --host 127.0.0.1 --port 5173`
6. 작업 후 최소 검증은 `npm test`, `npm run build`, `backend\.venv\Scripts\python.exe -m pytest backend\tests`, `git diff --check`다.

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
