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

## Build Shell And Sheets List Gate - 2026-06-18

### Document Existence

- [x] `docs/feature-notes/003-build-shell-sheets-list.md`
- [x] `docs/PRD.md`
- [x] `docs/TRD.md`
- [x] `docs/UI_Spec.md`
- [x] `docs/Data_Model.md`
- [x] `docs/Task_List.md`
- [x] `docs/Acceptance_Criteria.md`
- [x] `docs/Test_Scenarios.md`
- [x] `docs/Design_Map.md`
- [x] `docs/User_Flow.md`

### Build Shell Cross Checks

- [x] FR-BS-001 through FR-BS-009 are represented in PRD, TRD, UI, data, task, acceptance, test, design, and user-flow documents.
- [x] T-BS-001 through T-BS-009 map to FR-BS-001 through FR-BS-009.
- [x] AC-BS-001 through AC-BS-009 map to FR-BS-001 through FR-BS-009.
- [x] TS-BS-001 through TS-BS-009 map to FR-BS-001 through FR-BS-009.
- [x] Visible Build shell and sheets actions map to `UF-BS-*` user-flow steps.
- [x] Local `Sheet` metadata supports the sheets list without drawing files.
- [x] 2D viewer, upload/publish, sheet compare, markup/issues, auth/RBAC, DB/API persistence, Autodesk API, paid SDK, customer drawing data, and deployment remain out of scope.

### Build Shell Requirement Coverage

| Requirement ID | Gate check |
|---|---|
| FR-BS-001 | Build entry from `Study_Project` is documented. |
| FR-BS-002 | Build shell and selected `시트` rail are documented. |
| FR-BS-003 | Local mock sheets table is documented. |
| FR-BS-004 | Sheet row metadata fields are documented. |
| FR-BS-005 | Number/title/discipline/tag search is documented. |
| FR-BS-006 | List/grid view toggle affordance is documented. |
| FR-BS-007 | Export/filter/row menu/pagination affordances are documented. |
| FR-BS-008 | Viewer/upload/storage/compare/markup/issues exclusions are documented. |
| FR-BS-009 | Auth/DB/API/Autodesk/customer drawing/deployment exclusions are documented. |

### Build Shell Gate Status

- Result: PASS on 2026-06-18.
- Reason: seven core docs and UI support docs exist, FR-to-task/acceptance/test mappings are complete, UI actions map to user-flow steps, data model supports the local mock Sheet list, and risky external integration items remain out of scope.
- Implementation eligibility: Build shell and sheets list local mock slice may proceed to implementation without resolving the separate Project Admin Task 6 browser evidence blocker.

## 2D Sheet Viewer First Slice Kickoff - 2026-06-18

### Document Existence

- [x] `docs/feature-notes/004-2d-sheet-viewer-first-slice.md`
- [x] `docs/superpowers/plans/2026-06-18-2d-sheet-viewer-first-slice.md`
- [x] `docs/PRD.md`
- [x] `docs/TRD.md`
- [x] `docs/UI_Spec.md`
- [x] `docs/Data_Model.md`
- [x] `docs/Task_List.md`
- [x] `docs/Acceptance_Criteria.md`
- [x] `docs/Test_Scenarios.md`
- [x] `docs/Design_Map.md`
- [x] `docs/User_Flow.md`

### Viewer Slice Cross Checks

- [x] FR-SV-001 through FR-SV-009 are represented in PRD, TRD, UI, data, task, acceptance, test, design, and user-flow documents.
- [x] T-SV-001 through T-SV-009 map to FR-SV-001 through FR-SV-009.
- [x] AC-SV-001 through AC-SV-009 map to FR-SV-001 through FR-SV-009.
- [x] TS-SV-001 through TS-SV-009 map to FR-SV-001 through FR-SV-009.
- [x] Visible viewer shell actions map to `UF-SV-*` user-flow steps.
- [x] Local `SheetViewerState` reserves an equipment entity ID / ontology slot without TypeDB, DB/API, or schema work.
- [x] Real viewer engine, customer drawing files, upload/publish, sheet compare, persisted markup/issues, auth/RBAC, DB/API persistence, TypeDB/schema integration, Autodesk API, paid SDK, CAD editor behavior, and deployment remain out of scope.
- [x] Project Admin Task 6 remains a separate `BLOCKED_BROWSER_UNAVAILABLE` evidence-path blocker.

### 2D Sheet Viewer Requirement Coverage

| Requirement ID | Gate check |
|---|---|
| FR-SV-001 | Viewer shell entry from selected local sheet is documented. |
| FR-SV-002 | Selected sheet and project context are documented. |
| FR-SV-003 | Static local sheet render surface is documented. |
| FR-SV-004 | Right-side viewer tool rail affordances are documented. |
| FR-SV-005 | Bottom view-control affordances are documented. |
| FR-SV-006 | Left markup/issues empty panel tabs are documented. |
| FR-SV-007 | Local sheet navigation context is documented. |
| FR-SV-008 | Equipment entity ID / ontology data slot is documented as local-only. |
| FR-SV-009 | Real viewer engine and gated integration exclusions are documented. |

### 2D Sheet Viewer Gate Status

- Result: PASS on 2026-06-18 formal planning gate.
- Current result: document-loop kickoff passed planning-gate review for the local-only viewer shell/static sheet render slice.
- Checklist truth: the checked kickoff and traceability items above were verified against the live PRD, TRD, UI, data, task, acceptance, test, design, and user-flow documents during this gate review.
- Implementation eligibility: the local-only viewer shell/static sheet render slice may proceed to a scoped implementation request with owned files and TDD checks. This PASS does not authorize real viewer engine or external integration work.
- Human gate: real viewer engine evaluation/adoption, customer drawings, Autodesk-backed processing, paid SDK, DB/API/TypeDB/schema integration, CAD editor behavior, and deployment remain unapproved.
