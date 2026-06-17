# Planning Gate Checklist

## Document Existence

- [x] `docs/PRD.md`
- [x] `docs/TRD.md`
- [x] `docs/UI_Spec.md`
- [x] `docs/Data_Model.md`
- [x] `docs/Task_List.md`
- [x] `docs/Acceptance_Criteria.md`
- [x] `docs/Test_Scenarios.md`
- [x] `docs/Design_Map.md`
- [x] `docs/User_Flow.md`

## Cross Checks

- [x] Every PRD feature maps to at least one task in `docs/Task_List.md`.
- [x] Every PRD feature maps to at least one acceptance criterion in `docs/Acceptance_Criteria.md`.
- [x] Every PRD feature maps to at least one test scenario in `docs/Test_Scenarios.md`.
- [x] Visible UI actions map to user-flow steps in `docs/User_Flow.md`.
- [x] Visible UI fields/actions are represented in `docs/UI_Spec.md`.
- [x] Data model supports required create/read behavior and explicitly excludes update/delete/undo for this slice.
- [x] Human approval gates are documented through `HUMAN_GATE.md`, `docs/PRD.md`, `docs/TRD.md`, and `docs/Acceptance_Criteria.md`.

## Pre-Implementation Boundary Check

- [x] The planning-gate pass itself made no app scaffold changes.
- [x] The planning-gate pass itself made no `npm install` or dependency changes.
- [x] The planning-gate pass itself made no UI implementation changes.
- [x] No DB/API/Auth/Autodesk integration.
- [x] No paid SDK.
- [x] No customer drawing data.
- [x] No deployment.

## Post-Gate Implementation Status

- [x] Initial setup slice was implemented after PASS using Vite + React + TypeScript + Vitest.
- [x] Implementation remains local mock state only.
- [x] `npm test` and `npm run build` passing evidence is recorded in `EVIDENCE.md`.
- [x] Desktop/mobile browser evidence is recorded under `docs/evidence/`.

## Gate Status

- Result: PASS on 2026-06-15.
- Reason: seven core docs exist, UI support docs exist, FR-to-task/acceptance/test mappings are complete, UI actions map to user-flow steps, and risky external integration items remain out of scope.
- Evidence: recorded in `EVIDENCE.md`.

## Project Admin Member Access Gate - 2026-06-17

### Document Existence

- [x] `docs/feature-notes/002-project-admin-member-access.md`
- [x] `docs/PRD.md`
- [x] `docs/TRD.md`
- [x] `docs/UI_Spec.md`
- [x] `docs/Data_Model.md`
- [x] `docs/Task_List.md`
- [x] `docs/Acceptance_Criteria.md`
- [x] `docs/Test_Scenarios.md`
- [x] `docs/Design_Map.md`
- [x] `docs/User_Flow.md`

### Project Admin Cross Checks

- [x] FR-PA-001 through FR-PA-009 are represented in PRD, TRD, UI, data, task, acceptance, test, design, and user-flow documents.
- [x] T-PA-001 through T-PA-009 map to FR-PA-001 through FR-PA-009.
- [x] AC-PA-001 through AC-PA-009 map to FR-PA-001 through FR-PA-009.
- [x] TS-PA-001 through TS-PA-009 map to FR-PA-001 through FR-PA-009.
- [x] Visible Project Admin actions map to `UF-PA-*` user-flow steps.
- [x] `Project`, `Member`, and `ProjectMemberAccess` stay separate.
- [x] Company information, company management, auth/RBAC enforcement, DB/API persistence, email invite, access deletion, Autodesk cloud/API, paid SDK, customer data, and deployment remain out of scope.

### Project Admin Requirement Coverage

| Requirement ID | Gate check |
|---|---|
| FR-PA-001 | Project Admin view and `Study_Project` context are documented. |
| FR-PA-002 | Current project `ProjectMemberAccess` row filtering is documented. |
| FR-PA-003 | Member name/email search is documented. |
| FR-PA-004 | Row selection and right inspector are documented. |
| FR-PA-005 | Add-existing-member modal is documented. |
| FR-PA-006 | Empty member validation is documented. |
| FR-PA-007 | Duplicate project/member validation is documented. |
| FR-PA-008 | Valid existing member add flow is documented. |
| FR-PA-009 | `Project`, `Member`, `ProjectMemberAccess` separation and company/auth/DB/API exclusions are documented. |

### Project Admin Gate Status

- Result: PASS on 2026-06-17.
- Reason: seven core docs and UI support docs exist, FR-to-task/acceptance/test mappings are complete, UI actions map to user-flow steps, data model supports the local mock ProjectMemberAccess flow, and risky external integration items remain out of scope.
- Implementation eligibility: Project Admin local mock slice may proceed to Task 1 only after this document-loop commit.
