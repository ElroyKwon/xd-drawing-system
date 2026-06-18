# Acceptance Criteria

| AC ID | Requirement ID | Pass/fail criterion |
|---|---|---|
| AC-IS-001 | FR-IS-001 | PASS if the project list screen visibly includes the `프로젝트` tab, `+ 프로젝트 만들기`, project table, columns for 유형/이름/번호/기본 액세스/허브/작성 날짜, settings affordance, and pagination. FAIL if any required list structure is absent. |
| AC-IS-002 | FR-IS-002 | PASS if searching by an existing project name or number narrows the list and clearing the query restores all mock projects. FAIL if search mutates data or cannot restore the full list. |
| AC-IS-003 | FR-IS-003 | PASS if clicking `+ 프로젝트 만들기` opens a centered `프로젝트 작성` modal over the project list. FAIL if it navigates away or opens an unrelated screen. |
| AC-IS-004 | FR-IS-004 | PASS if the modal shows project name, project number, project type, template, address/manual-address affordance, timezone, start date, end date, project value, and currency fields. FAIL if any required field is missing. |
| AC-IS-005 | FR-IS-005 | PASS if submitting with an empty project name shows a required-field validation state, keeps the modal open, and does not add a project. FAIL if a project is created or the validation is invisible. |
| AC-IS-006 | FR-IS-006 | PASS if submitting with a valid project name adds exactly one local mock project row and closes the modal. FAIL if zero or multiple rows are added, or the modal remains open after successful create. |
| AC-IS-007 | FR-IS-007 | PASS if `취소` and close both dismiss the modal and leave the project list count unchanged. FAIL if either action creates, deletes, or changes a row. |
| AC-IS-008 | FR-IS-008 | PASS if desktop and mobile checks show no overlapping text, clipped button labels, broken modal layout, or browser console errors during open, validation, create, cancel, search, and close flows. FAIL if any listed issue appears. |
| AC-IS-009 | FR-IS-009 | PASS if the slice can run without auth, DB, API, Autodesk account, paid SDK, customer drawing, or deployment. FAIL if implementation requires any gated external dependency. |

## Project Admin Member Access Criteria

| AC ID | Requirement ID | Pass/fail criterion |
|---|---|---|
| AC-PA-001 | FR-PA-001 | PASS if the app can render a Project Admin member access view for `Study_Project` with `구성원` selected. FAIL if the view is missing the project context or opens an unrelated screen. |
| AC-PA-002 | FR-PA-002 | PASS if the table shows only members with `ProjectMemberAccess` for `Study_Project`. FAIL if members from other projects or members without access are shown as current access rows. |
| AC-PA-003 | FR-PA-003 | PASS if searching by member name or email narrows the access table and clearing search restores all current project access rows. FAIL if search mutates access data or cannot restore the rows. |
| AC-PA-004 | FR-PA-004 | PASS if selecting a member row updates the right inspector with that member's identity, status, and role. FAIL if the inspector remains stale or shows unrelated data. |
| AC-PA-005 | FR-PA-005 | PASS if `구성원 추가` opens an add-existing-member modal. FAIL if it navigates away, creates data immediately, or opens a company/user-creation flow. |
| AC-PA-006 | FR-PA-006 | PASS if submitting the add modal without a selected member shows `구성원을 선택하세요.` and does not add access. FAIL if a row is added or the validation is invisible. |
| AC-PA-007 | FR-PA-007 | PASS if submitting a member who already has access to the same project shows `이미 이 프로젝트에 추가된 구성원입니다.` and does not add a duplicate. FAIL if duplicate access is created. |
| AC-PA-008 | FR-PA-008 | PASS if selecting an existing member and role adds exactly one local `ProjectMemberAccess` row for `Study_Project` and closes the modal. FAIL if zero or multiple rows are added or the modal remains open. |
| AC-PA-009 | FR-PA-009 | PASS if the slice keeps `Project`, `Member`, and `ProjectMemberAccess` separate and runs without company data, auth/RBAC, DB, API, Autodesk, paid SDK, customer data, or deployment. FAIL if any gated scope becomes required. |

## Build Shell And Sheets List Criteria

| AC ID | Requirement ID | Pass/fail criterion |
|---|---|---|
| AC-BS-001 | FR-BS-001 | PASS if the app can open a Build sheets view for `Study_Project` from the project list. FAIL if there is no local entry path or it opens an unrelated screen. |
| AC-BS-002 | FR-BS-002 | PASS if the Build header and left rail render with `시트` selected. FAIL if the project context or selected sheets navigation is missing. |
| AC-BS-003 | FR-BS-003 | PASS if the sheets table shows local mock rows for `Study_Project`. FAIL if it requires network data or shows no current project sheets. |
| AC-BS-004 | FR-BS-004 | PASS if each row shows thumbnail, number/title, version chip, version set, discipline, tag, last updater, and row menu affordance. FAIL if required sheet metadata is absent. |
| AC-BS-005 | FR-BS-005 | PASS if searching by sheet number, title, discipline, or tag narrows the table and clearing search restores all rows. FAIL if search mutates data or cannot restore rows. |
| AC-BS-006 | FR-BS-006 | PASS if list/grid toggle updates the selected view affordance and keeps the functional list visible. FAIL if toggle breaks the table or implies an unsupported grid implementation. |
| AC-BS-007 | FR-BS-007 | PASS if export, filter, row menu, and pagination render as local affordances without data mutation. FAIL if they require backend, file export, or external services. |
| AC-BS-008 | FR-BS-008 | PASS if the slice does not open a 2D viewer, upload/publish sheets, store files, compare versions, or implement markup/issues. FAIL if any excluded drawing workflow becomes required. |
| AC-BS-009 | FR-BS-009 | PASS if the slice runs without auth/RBAC, DB/API, Autodesk API, paid SDK, customer drawing data, or deployment. FAIL if any gated dependency is introduced. |

## 2D Sheet Viewer First Slice Criteria

| AC ID | Requirement ID | Pass/fail criterion |
|---|---|---|
| AC-SV-001 | FR-SV-001 | PASS if a future implementation can open a viewer shell for a selected local mock sheet from the Build `시트` list. FAIL if it requires upload, routing to an unrelated screen, or external data. |
| AC-SV-002 | FR-SV-002 | PASS if the viewer shows project context, sheet number, and sheet title for the selected local sheet. FAIL if the context is missing or stale. |
| AC-SV-003 | FR-SV-003 | PASS if the central surface renders a local static sheet representation without loading customer drawings or parsed files. FAIL if a real drawing file or engine is required. |
| AC-SV-004 | FR-SV-004 | PASS if right-rail tool buttons render and selected-tool state changes locally. FAIL if tool selection creates persisted markup or requires a real engine. |
| AC-SV-005 | FR-SV-005 | PASS if bottom controls render as local affordances for pan/fit/zoom/fullscreen/compare/measure. FAIL if they imply completed real measurement, compare, or engine behavior. |
| AC-SV-006 | FR-SV-006 | PASS if markup and issue panel tabs switch locally and show empty states. FAIL if the first slice creates or persists markup/issues. |
| AC-SV-007 | FR-SV-007 | PASS if local sheet navigation context is preserved and does not load external assets. FAIL if navigation requires upload/storage/sync. |
| AC-SV-008 | FR-SV-008 | PASS if `equipmentEntityId` / ontology binding is represented only as a reserved local data slot. FAIL if TypeDB, DB/API, schema, or entity-resolution work is introduced. |
| AC-SV-009 | FR-SV-009 | PASS if the slice runs without a real viewer engine, customer drawings, upload/publish, markup/issues persistence, DB/API/TypeDB, Autodesk, paid SDK, auth/RBAC, or deployment. FAIL if any gated dependency becomes required. |

## Human Approval Criteria

- PASS for planning only if all `HUMAN_GATE.md` risky items remain out of scope.
- FAIL or stop before implementation if a task introduces auth, permission, DB schema, customer data, Autodesk cloud/API, paid SDK, deletion of reference data, or deployment.
- FAIL or stop before implementation if Project Admin work expands into company management, real RBAC enforcement, email invitation, DB/API persistence, or access deletion.
- FAIL or stop before implementation if Build sheets work expands into real drawing files, upload/publish, viewer engine, sheet compare, DB/API persistence, Autodesk API, paid SDK, or deployment.
- FAIL or stop before implementation if 2D viewer work expands into real viewer engine adoption, customer drawing files, drawing parsing, Autodesk-backed processing, paid SDK, DB/API/TypeDB integration, persisted markup/issues, CAD editor behavior, or deployment.
