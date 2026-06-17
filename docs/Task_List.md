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

## Deferred Tasks

- Project Admin member/company/role management.
- Project template management screen.
- Build module shell.
- Sheets list and 2D viewer.
- Markup, issue, file, photo workflows.
- Auth, permissions, API, DB, deployment.
