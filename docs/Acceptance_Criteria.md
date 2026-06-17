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

## Human Approval Criteria

- PASS for planning only if all `HUMAN_GATE.md` risky items remain out of scope.
- FAIL or stop before implementation if a task introduces auth, permission, DB schema, customer data, Autodesk cloud/API, paid SDK, deletion of reference data, or deployment.
- FAIL or stop before implementation if Project Admin work expands into company management, real RBAC enforcement, email invitation, DB/API persistence, or access deletion.
