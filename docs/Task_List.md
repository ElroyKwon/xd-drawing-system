# Task List

The initial setup slice has been implemented. This table remains the traceability map from requirements to completed implementation and verification items.

| Task ID | Requirement ID | Status | Task | Verification |
|---|---|---|---|---|
| T-IS-001 | FR-IS-001 | Done | Build hub-level project list shell with project tab, create CTA, table columns, default access, sort/settings affordances, and pagination. | AC-IS-001; TS-IS-001 |
| T-IS-002 | FR-IS-002 | Done | Add local search by project name or project number and clear-to-full-list behavior. | AC-IS-002; TS-IS-002 |
| T-IS-003 | FR-IS-003 | Done | Add `+ 프로젝트 만들기` action that opens the centered project creation modal over the list. | AC-IS-003; TS-IS-003 |
| T-IS-004 | FR-IS-004 | Done | Implement modal form fields and defaults from ACC #1. | AC-IS-004; TS-IS-004 |
| T-IS-005 | FR-IS-005 | Done | Add required-name validation that blocks empty submit. | AC-IS-005; TS-IS-005 |
| T-IS-006 | FR-IS-006 | Done | Add valid create flow that appends one local mock project and closes the modal. | AC-IS-006; TS-IS-006 |
| T-IS-007 | FR-IS-007 | Done | Add cancel and close flows that close the modal without list mutation. | AC-IS-007; TS-IS-007 |
| T-IS-008 | FR-IS-008 | Done | Verify desktop/mobile layout, Korean label fit, and console error-free interactions. | AC-IS-008; TS-IS-008 |
| T-IS-009 | FR-IS-009 | Done | Keep implementation local-only and avoid auth, DB, API, Autodesk, paid SDK, customer data, and deployment changes. | AC-IS-009; TS-IS-009 |

## Project Admin Member Access Tasks

These tasks define the second product slice before implementation. Company information and company management remain excluded.

| Task ID | Requirement ID | Status | Task | Verification |
|---|---|---|---|---|
| T-PA-001 | FR-PA-001 | Planned | Render the Project Admin member access shell for `Study_Project`. | AC-PA-001; TS-PA-001 |
| T-PA-002 | FR-PA-002 | Planned | Build local derived rows from `ProjectMemberAccess` and show only current project access members. | AC-PA-002; TS-PA-002 |
| T-PA-003 | FR-PA-003 | Planned | Add local search by project-access member name or email. | AC-PA-003; TS-PA-003 |
| T-PA-004 | FR-PA-004 | Planned | Add row selection and right inspector details. | AC-PA-004; TS-PA-004 |
| T-PA-005 | FR-PA-005 | Planned | Add `구성원 추가` action and add-existing-member modal. | AC-PA-005; TS-PA-005 |
| T-PA-006 | FR-PA-006 | Planned | Block empty add submit with `구성원을 선택하세요.` | AC-PA-006; TS-PA-006 |
| T-PA-007 | FR-PA-007 | Planned | Block duplicate `ProjectMemberAccess` for the same project/member pair with `이미 이 프로젝트에 추가된 구성원입니다.` | AC-PA-007; TS-PA-007 |
| T-PA-008 | FR-PA-008 | Planned | Add a valid existing mock member with the selected project role to `Study_Project`. | AC-PA-008; TS-PA-008 |
| T-PA-009 | FR-PA-009 | Planned | Keep `Project`, `Member`, and `ProjectMemberAccess` separate and avoid company/auth/DB/API scope. | AC-PA-009; TS-PA-009 |

## Deferred Tasks

- Project Admin role/permission matrix after human approval.
- Company management after separate scope approval.
- Project template management screen.
- Build module shell.
- Sheets list and 2D viewer.
- Markup, issue, file, photo workflows.
- Auth, permissions, API, DB, deployment.
