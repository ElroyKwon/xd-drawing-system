# Project Spec

## Goal

`xd-drawing-system`을 XD 제품군의 도면관리 시스템 개발 프로젝트로 준비하고, ACC Build 스크린샷/분석/상세설계/이전 프로토타입/AI 개발 루프 자료를 같은 폴더에서 참조할 수 있게 만든다.

## Current Product Baseline

Implemented locally:

- ACC #6 `프로젝트 목록`
- ACC #1 `프로젝트 작성 모달`
- Project Admin `구성원` access view for `Study_Project`
- Build shell + `시트` 목록 for `Study_Project`

Current limitations:

- All product data is local mock state only.
- Project Admin Task 6 browser evidence remains `BLOCKED_BROWSER_UNAVAILABLE`.
- Build shell + Sheets list has browser evidence, but that evidence does not close Project Admin Task 6.
- ACC #11 `2D sheet viewer` first slice is in document-loop kickoff only; no viewer implementation exists yet.
- No DB/API/Auth/RBAC enforcement, Autodesk API, paid SDK, customer drawing data, deployment, real 2D viewer engine, upload/publish, markup, or issues workflow is implemented.

## Project Setup Scope

In scope:

- 새 프로젝트 폴더 구조 생성
- ACC Build 스크린샷과 분석 문서 복사
- DKS 도면관리 상세설계와 Autodesk Cloud 조사자료 복사
- 이전 도면지식관리 프로토타입의 핵심 문서/데이터 복사
- AI 개발 루프 템플릿과 로컬 스킬 복사
- Codex/Claude/Gemini 진입 지침 생성
- 다음 세션 핸드오프 생성

Original setup out of scope:

- 실제 Next.js 앱 생성
- UI 컴포넌트 구현
- DB/API/인증 구현
- Autodesk API 연동
- 기존 프로토타입 원본 수정

## Selected First Product Slice

첫 구현 slice는 다음 두 화면으로 제한한다.

1. ACC #1 `프로젝트 작성 모달`
2. ACC #6 `프로젝트 목록`

Deferred candidates:

- Project Admin member access
- Build 앱 셸과 시트 목록

## Done When

- `D:\_Project\xd-drawing-system` 폴더가 존재한다.
- `reference/` 아래에 필요한 참고자료가 복사되어 있다.
- 프로젝트 루트에 `README.md`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `SPEC.md`, `PLAN.md`, `CHECKS.md`, `EVIDENCE.md`, `HUMAN_GATE.md`가 있다.
- `.agents/skills`와 `.claude/skills`에 AI 개발 루프 스킬 후보가 있다.
- `docs/sessions/NEXT_SESSION.md`가 다음 세션 진입점을 제공한다.
- 검증 결과가 `EVIDENCE.md`에 기록되어 있다.

## First Implementation Slice: Initial Setup

Selected scope:

- ACC #1 `프로젝트 작성 모달`
- ACC #6 `프로젝트 목록`

In scope:

- 허브 레벨 프로젝트 목록 화면
- `+ 프로젝트 만들기`에서 열리는 프로젝트 작성 모달
- 프로젝트 이름 필수 검증
- 프로젝트 번호, 프로젝트 유형, 템플릿, 주소, 시간대, 시작일/종료일, 프로젝트 값/통화 입력 UI
- 유효한 작성 시 로컬 mock 프로젝트를 목록에 추가하는 흐름
- 취소/닫기 시 목록을 변경하지 않는 흐름
- 프로젝트명 또는 번호 기준의 목록 검색
- 검색/필터/컬럼 설정/페이지네이션의 ACC #6 레이아웃 반영

Out of scope:

- Project Admin 구성원/회사/역할 화면
- 프로젝트 템플릿 관리 화면
- Build 앱 셸, 시트 목록, 2D 뷰어, 마크업, 이슈, 파일, 사진
- 인증, 권한, DB 스키마, API persistence
- Autodesk cloud/API, paid SDK, 외부 배포
- 고객 또는 기밀 도면 파일
- CAD editor 기능

Done when:

- `docs/feature-notes/001-initial-setup.md`에 근거 화면, 범위, 사용자 흐름, 데이터 모델, 검증 기준이 연결되어 있다.
- 구현 후 프로젝트 목록과 프로젝트 작성 모달이 지정된 ACC screenshot 2개와 비교 가능하다.
- 구현 후 `CHECKS.md`의 초기 설정 화면 수동 검증 기준을 통과하고 결과가 `EVIDENCE.md`에 기록된다.

## Selected Second Product Slice: Project Admin Member Access

Selected scope:

- Project Admin `구성원` access view for `Study_Project`
- `Project`, `Member`, and `ProjectMemberAccess` peer-level local mock model

In scope:

- Project Admin shell with `구성원` selected
- Members with access to `Study_Project`
- Search by member name or email
- Row selection and right inspector
- Add existing mock member modal
- Role choices: `관리자`, `편집자`, `뷰어`
- Empty selection validation: `구성원을 선택하세요.`
- Duplicate project/member validation: `이미 이 프로젝트에 추가된 구성원입니다.`

Out of scope:

- Company information and company management
- New user account creation
- Email invitation
- Real authentication, authorization, or RBAC enforcement
- DB schema, API persistence, deployment
- Access deletion/revocation
- Autodesk cloud/API, paid SDK, customer drawing data

Done when:

- `docs/feature-notes/002-project-admin-member-access.md` links the reference screens, scope, user flow, data model, and verification criteria.
- The seven core docs and UI support docs include FR-PA-001 through FR-PA-009 traceability.
- The planning gate records PASS for the local mock Project Admin member access slice before implementation starts.
- Implementation later passes `CHECKS.md` Project Admin manual checks and records evidence in `EVIDENCE.md`.

## Selected Third Product Slice: Build Shell And Sheets List

Selected scope:

- ACC Build project shell for `Study_Project`
- `시트` module list backed by local mock sheet metadata

In scope:

- Local path from `Study_Project` in the project list to Build
- Build header and left rail with `시트` selected
- Sheet table with thumbnail, number, version chip, version set, discipline, tags, and last updater
- Search by sheet number, title, discipline, or tag
- List/grid view toggle affordance
- Export, filter, row menu, and pagination affordances

Out of scope:

- 2D sheet viewer
- Sheet upload, publish, compare, or file storage
- Markup, issue, form, photo, file, and Bridge workflows
- Real auth/RBAC, DB/API persistence, Autodesk API, paid SDK, customer drawing data, deployment

Done when:

- `docs/feature-notes/003-build-shell-sheets-list.md` links the reference screens, scope, user flow, data model, and verification criteria.
- The seven core docs and UI support docs include FR-BS-001 through FR-BS-009 traceability.
- The planning gate records PASS for the local mock Build shell and sheets list slice before implementation starts.
- Implementation passes `npm test` and `npm run build`; browser evidence remains separately BLOCKED unless fresh browser interaction, console state, and screenshots are captured.

## Selected Fourth Product Slice: 2D Sheet Viewer First Slice

Selected scope:

- ACC #11 `2D sheet viewer` first slice design
- Local-only viewer shell/static sheet render for a selected mock sheet from `Study_Project`

Default decision:

- Use a local static viewer shell for the first slice.
- Reserve equipment entity ID / ontology binding as a local viewer data slot only.
- Do not evaluate, install, or adopt a real viewer engine without human approval.

In scope:

- Local entry from the Build `시트` list into a viewer shell.
- Selected sheet context with sheet number/title and `Study_Project`.
- Static sheet render area with no real drawing file.
- ACC-style right tool rail and bottom view controls as local affordances.
- Left markup/issues panel tabs with empty states.
- Optional local sheet navigation context or filmstrip affordance.
- Nullable `equipmentEntityId` / ontology binding slot in local state.

Out of scope:

- Real viewer engine adoption, dependency installation, PDF/DWG/DXF parsing, Canvas/WebGL/tiled renderer, Autodesk-backed processing, or paid SDK.
- Customer or confidential drawing files.
- Sheet upload, publish, version compare, file storage, drawing sync.
- Persisted markup, issue creation, measurement, calibrated scale, or CAD editor behavior.
- Auth/RBAC, DB/API persistence, TypeDB/schema integration, Autodesk API, deployment.

Done when:

- `docs/feature-notes/004-2d-sheet-viewer-first-slice.md` links the reference screens, scope, user flow, data model, and verification criteria.
- The seven core docs and UI support docs include FR-SV-001 through FR-SV-009 traceability.
- The planning gate records PASS for the local-only viewer shell/static render slice before implementation starts.
- Project Admin Task 6 remains a separate blocker and is not closed from viewer-slice evidence.
