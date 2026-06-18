# TRD

## Technical Approach

초기 설정 slice는 planning gate PASS 이후 Vite + React + TypeScript + Vitest baseline으로 구현됐다. 현재 구현은 클라이언트 로컬 상태와 mock 프로젝트 데이터만 사용해 ACC #6 `프로젝트 목록`과 ACC #1 `프로젝트 작성 모달`의 UI/상호작용을 검증한다.

## Frontend Boundary

- 허브 레벨 프로젝트 목록 화면을 현재 app의 첫 진입 화면으로 둔다.
- 프로젝트 목록 데이터는 초기 mock 배열에서 읽는다.
- `+ 프로젝트 만들기`는 같은 화면 위에 modal state를 열고 닫는다.
- form state는 클라이언트 내부 상태로 유지한다.
- submit 시 프로젝트 이름 validation을 먼저 수행한다.
- 유효한 submit은 mock 배열에 1건 append한다.
- 검색은 클라이언트에서 프로젝트 이름과 번호를 대상으로 수행한다.
- 필터, 컬럼/설정, 페이지네이션은 ACC #6 레이아웃 affordance로 먼저 제공하고, 실제 고급 설정 기능은 후속 slice로 미룬다.

## Backend Boundary

- 이 slice에는 backend가 없다.
- REST API, database persistence, authentication, authorization, Autodesk account 연결은 만들지 않는다.
- 서버 상태, tenant model, role-permission model은 후속 설계/승인 전까지 다루지 않는다.

## Persistence Model

- Persistence: 없음.
- Runtime state: 브라우저 세션 내 local mock state.
- Reload behavior: 구현 시 새로고침하면 기본 mock 목록으로 돌아가는 것이 허용된다.
- Customer data: 사용하지 않는다.

## External Dependencies

- 현재 app baseline은 `package.json`의 Vite, React, TypeScript, Vitest, Testing Library 의존성을 사용한다.
- 후속 구현 단계에서 paid SDK, Autodesk API, customer drawing 사용이 필요한 경우 `HUMAN_GATE.md` 기준으로 먼저 확인한다.
- 저장된 screenshot/reference 문서는 읽기 전용 근거로만 사용한다.

## Explicit Non-Use

- No Autodesk cloud/API integration.
- No Autodesk account login.
- No paid SDK.
- No database schema.
- No production API.
- No auth/permission model.
- No deployment.
- No customer/confidential drawings.
- No CAD editor or DWG editing behavior.

## Requirement Mapping

| Requirement ID | Technical handling |
|---|---|
| FR-IS-001 | Render project list from local mock projects. |
| FR-IS-002 | Filter local mock projects by lowercase name/number match. |
| FR-IS-003 | Toggle modal visibility from create CTA. |
| FR-IS-004 | Maintain modal form state for listed fields. |
| FR-IS-005 | Block submit and show field-level validation when name is empty. |
| FR-IS-006 | Append one mock `Project` and close modal on valid submit. |
| FR-IS-007 | Close modal without state mutation on cancel/close. |
| FR-IS-008 | Validate layout manually in desktop/mobile browser and check console. |
| FR-IS-009 | Keep all data and integration boundaries local-only. |

## Project Admin Member Access Technical Addendum

The Project Admin member-access slice remains frontend-only and uses local mock state. It does not introduce routing libraries, backend persistence, authentication, authorization, database schema, Autodesk cloud/API, paid SDK, deployment, or customer drawing data.

### Data Types

```text
Project
- id
- name

Member
- id
- name
- email
- phone

ProjectMemberAccess
- projectId
- memberId
- role
- status
- addedAt
```

Derived UI rows join `ProjectMemberAccess` to `Member` by `memberId`. Duplicate access is blocked when the same `projectId` and `memberId` already exist.

### Frontend Handling

- `src/projectAdminData.ts` will own types, mock records, constants, and helper functions.
- `src/ProjectAdminView.tsx` will own local state, table filtering, row selection, inspector display, add modal state, and validation messages.
- `src/App.tsx` will expose a small local entry path from `Study_Project` to Project Admin without adding a router.
- Company information is excluded; if a non-selected `회사` navigation label appears for Project Admin context, it must not expose company fields or management behavior.

### Project Admin Requirement Mapping

| Requirement ID | Technical handling |
|---|---|
| FR-PA-001 | Render `ProjectAdminView` for `Study_Project` from local app state. |
| FR-PA-002 | Build rows by joining `ProjectMemberAccess` to `Member` and filtering by selected project. |
| FR-PA-003 | Filter derived rows by lowercase member name/email match. |
| FR-PA-004 | Store selected `memberId` and render details in the right inspector. |
| FR-PA-005 | Toggle add-existing-member modal visibility from `구성원 추가`. |
| FR-PA-006 | Block submit and show `구성원을 선택하세요.` when no member is selected. |
| FR-PA-007 | Block duplicate project/member submit and show `이미 이 프로젝트에 추가된 구성원입니다.` |
| FR-PA-008 | Append one local `ProjectMemberAccess` row with selected role and close the modal. |
| FR-PA-009 | Keep `Project`, `Member`, and `ProjectMemberAccess` separate and avoid company/auth/DB/API scope. |

## Build Shell And Sheets List Technical Addendum

The Build shell and sheets list slice remains frontend-only and uses local mock sheet metadata. It does not introduce a router, backend persistence, authentication, authorization, database schema, Autodesk cloud/API, paid SDK, deployment, customer drawing data, upload/publish flow, or 2D viewer engine.

### Data Types

```text
Sheet
- id
- projectId
- number
- title
- version
- versionSet
- disciplineCode
- disciplineLabel
- tag
- lastUpdatedBy
```

### Frontend Handling

- `src/buildSheetsData.ts` owns sheet types, mock rows, and filtering helpers.
- `src/BuildSheetsView.tsx` owns the Build shell, selected `시트` navigation state, sheet table, search query, and list/grid view toggle affordance.
- `src/App.tsx` exposes a local entry path from `Study_Project` to Build sheets without adding a routing library.
- Grid view is an affordance in this slice. The functional, tested view is the ACC #10 table/list.

### Build Shell Requirement Mapping

| Requirement ID | Technical handling |
|---|---|
| FR-BS-001 | Render `BuildSheetsView` for `Study_Project` from local app state. |
| FR-BS-002 | Render fixed Build header and left rail; set `시트` as selected. |
| FR-BS-003 | Render local `Sheet[]` rows filtered by selected project. |
| FR-BS-004 | Display sheet metadata fields directly from mock rows. |
| FR-BS-005 | Filter rows by lowercase number/title/discipline/tag match. |
| FR-BS-006 | Store selected view mode locally and expose list/grid toggle affordance. |
| FR-BS-007 | Render inert local affordances for export, filter, row menu, and pagination. |
| FR-BS-008 | Exclude viewer/upload/storage/compare/markup/issues from code paths. |
| FR-BS-009 | Keep external integrations and persistence out of scope. |

## 2D Sheet Viewer First Slice Technical Addendum

The first viewer slice is a document-loop kickoff for a future frontend-only implementation. It should use local mock sheet metadata and static sheet render UI. It must not add a real viewer engine, dependency installation, drawing parser, backend persistence, authentication, authorization, database schema, TypeDB integration, Autodesk cloud/API, paid SDK, deployment, or customer drawing data.

### Data Types

```text
SheetViewerState
- projectId
- sheetId
- selectedTool
- zoomLevel
- panelTab: "markup" | "issues"
- equipmentEntityIdSlot: string | null
```

### Frontend Handling

- A future `SheetViewerView` can be opened from a selected local `Sheet` row.
- The central drawing surface is a static local render or placeholder, not a parsed drawing file.
- Toolbar buttons, bottom controls, and panel tabs are local UI state only.
- Markup, issue, compare, measurement, and fullscreen controls may be visible affordances but must not persist data or require an engine.
- `equipmentEntityIdSlot` reserves the future XD ontology binding point without TypeDB, DB/API, or schema work.

### Human-Gated Alternatives

- Real viewer engine evaluation/adoption is a separate gated decision.
- PDF.js, OpenSeadragon, APS Viewer, ODA, Autodesk-backed processing, paid SDKs, customer drawing ingestion, and DB/API/TypeDB integration require approval before implementation.

### 2D Sheet Viewer Requirement Mapping

| Requirement ID | Technical handling |
|---|---|
| FR-SV-001 | Open a future local `SheetViewerView` from selected mock sheet state. |
| FR-SV-002 | Read selected `Sheet` metadata for title/context labels. |
| FR-SV-003 | Render a static local sheet surface with no drawing file loading. |
| FR-SV-004 | Store selected viewer tool as local UI state. |
| FR-SV-005 | Store zoom/fit control affordance state locally. |
| FR-SV-006 | Store left panel tab state and render empty markup/issues panels. |
| FR-SV-007 | Reuse local mock sheet list for navigation context. |
| FR-SV-008 | Reserve `equipmentEntityIdSlot` only; no ontology integration. |
| FR-SV-009 | Keep all real viewer, persistence, external integration, customer drawing, and deployment work out of scope. |
