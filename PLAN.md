# Project Plan

## Phase 0: Project Setup

- [x] Create project root at `D:\_Project\xd-drawing-system`
- [x] Create reference, docs, public, local skill folders
- [x] Copy ACC screenshots and analysis
- [x] Copy DKS design and Autodesk Cloud references
- [x] Copy old prototype reference materials without build artifacts
- [x] Copy AI development loop package
- [x] Add project instruction files
- [x] Verify final file counts and key paths

Verification status:

- Core paths checked on 2026-06-15.
- `reference/acc-screenshots`: 39 files.
- `reference/dks-design-docs/도면관리시스템_상세설계`: 92 files.
- Setup evidence is recorded in `EVIDENCE.md`.

## Phase 1: First Implementation Slice

Selected slice:

- `#1 프로젝트 작성 모달`
- `#6 프로젝트 목록`

Before implementation:

- [x] Identify exact screenshot files for the selected slice.
- [x] Write feature note in `docs/feature-notes/001-initial-setup.md`.
- [x] Update `SPEC.md` and `CHECKS.md` for the selected slice.
- [x] Run a planning gate before code changes.

Planning gate status:

- Result: TEMPORARY PASS on 2026-06-15.
- This was a feature-note-based interim pass, not a full pass against the original loop's seven-document standard.
- Before implementation, reinforce the local skill/check workflow and re-enter the initial setup slice.
- Local skills were reinforced to include `feature-docs-scaffold` and `development-loop-orchestrator`.
- Local `.agents/skills` and `.claude/skills` copies were refreshed on 2026-06-15; duplicate nested skill directories were removed.
- Next gate must create or validate the seven core documents before implementation.

Document-loop re-entry plan:

- [x] Run `development-loop-orchestrator` to determine current stage.
- [x] Run `feature-docs-scaffold` for the initial setup slice.
- [x] Create or update `docs/PRD.md`.
- [x] Create or update `docs/TRD.md`.
- [x] Create or update `docs/UI_Spec.md`.
- [x] Create or update `docs/Data_Model.md`.
- [x] Create or update `docs/Task_List.md`.
- [x] Create or update `docs/Acceptance_Criteria.md`.
- [x] Create or update `docs/Test_Scenarios.md`.
- [x] Run enhanced `planning-gate`.
- [x] Confirm implementation eligibility only after full `PASS` or explicitly accepted `SLICE-ONLY PASS`.

Enhanced planning gate status:

- Result: PASS on 2026-06-15.
- Basis: seven core documents exist and FR-IS-001 through FR-IS-009 map to tasks, acceptance criteria, test scenarios, UI/data support, and local-only boundaries.
- UI support documents also exist: `docs/Design_Map.md`, `docs/User_Flow.md`, `docs/Planning_Gate_Checklist.md`.
- Implementation started after this PASS in the 2026-06-15 implementation-loop test session.

Implementation plan after gate:

- [x] Choose app scaffold and package scripts without changing `reference/`.
- [x] Build a hub-level project list screen matching ACC #6 layout.
- [x] Add local mock project data.
- [x] Add search by project name or number.
- [x] Add `+ 프로젝트 만들기` action.
- [x] Build the ACC #1 project creation modal.
- [x] Add required-name validation.
- [x] Add local mock create flow that appends a project to the list.
- [x] Add cancel and close flows that do not mutate the list.
- [x] Run automated checks available in the app package.
- [x] Run manual checks in `CHECKS.md`.
- [x] Record implementation evidence in `EVIDENCE.md`.

Implementation status:

- Result: PASS on 2026-06-15 for the local mock initial setup slice.
- App scaffold: Vite + React + TypeScript + Vitest.
- Runtime boundary: local state and mock rows only; no DB/API/Auth/Autodesk/paid SDK/customer data/deployment.
- Evidence: see `EVIDENCE.md` section `Initial Setup Slice Implementation`.

## Phase 2: Project Admin Member Access Slice

Selected slice:

- `Project Admin - 프로젝트 접근 구성원 관리`
- Current project context: `Study_Project`

Document-loop tasks:

- [x] Read local loop skills and approved Project Admin design.
- [x] Create `docs/feature-notes/002-project-admin-member-access.md`.
- [x] Update `docs/PRD.md`, `docs/TRD.md`, `docs/UI_Spec.md`, `docs/Data_Model.md`, `docs/Task_List.md`, `docs/Acceptance_Criteria.md`, `docs/Test_Scenarios.md`.
- [x] Update `docs/Design_Map.md`, `docs/User_Flow.md`, `docs/Planning_Gate_Checklist.md`.
- [x] Update `SPEC.md`, `PLAN.md`, `CHECKS.md`, `HUMAN_GATE.md`, `EVIDENCE.md`.
- [x] Run document consistency checks for FR-PA-001 through FR-PA-009 and company scope boundaries.
- [x] Run planning gate for the local mock Project Admin member access slice.

Planning gate status:

- Result: PASS on 2026-06-17.
- Basis: seven core documents and UI support documents include FR-PA-001 through FR-PA-009, task/acceptance/test mappings are complete, visible UI actions map to user-flow steps, the data model keeps `Project`, `Member`, and `ProjectMemberAccess` separate, and company/auth/DB/API scope remains excluded.
- Implementation may start only after the docs/gate commit.

Implementation plan after gate:

- [x] Add Project Admin data helper tests and local mock model.
- [x] Add Project Admin view render tests and shell.
- [x] Add search and row selection behavior.
- [x] Add add-existing-member modal with empty and duplicate validation.
- [x] Wire a local path from `Study_Project` in the project list to Project Admin.
- [ ] Run `npm test`, `npm run build`, browser desktop/narrow checks, and console checks.
- [ ] Record Project Admin implementation evidence and handoff.

Implementation status:

- Product implementation commits exist through `17259c2 feat: open project admin from project list`.
- Automated checks passed in the 0007/0008 Task 6 runs, but browser evidence is blocked by `BLOCKED_BROWSER_UNAVAILABLE`.
- Do not mark Project Admin Task 6 PASS until fresh browser interaction, console state, and screenshots are recorded.

## Phase 3: Build Shell And Sheets List Slice

Selected slice:

- `Build shell + Sheets list`
- Current project context: `Study_Project`

Document-loop tasks:

- [x] Confirm prior Project Admin Task 6 blocker is evidence-path only.
- [x] Create `docs/feature-notes/003-build-shell-sheets-list.md`.
- [x] Update `docs/PRD.md`, `docs/TRD.md`, `docs/UI_Spec.md`, `docs/Data_Model.md`, `docs/Task_List.md`, `docs/Acceptance_Criteria.md`, `docs/Test_Scenarios.md`.
- [x] Update `docs/Design_Map.md`, `docs/User_Flow.md`, `docs/Planning_Gate_Checklist.md`.
- [x] Update `SPEC.md`, `PLAN.md`, `CHECKS.md`, `HUMAN_GATE.md`.
- [x] Run document consistency checks for FR-BS-001 through FR-BS-009 and local-only scope boundaries.
- [x] Run planning gate for the local mock Build shell and sheets list slice.

Planning gate status:

- Result: PASS on 2026-06-18.
- Basis: seven core documents and UI support documents include FR-BS-001 through FR-BS-009, task/acceptance/test mappings are complete, visible UI actions map to user-flow steps, and 2D viewer/upload/auth/DB/API/Autodesk/customer drawing/deployment scope remains excluded.

Implementation plan after gate:

- [x] Add sheet data helper tests and local mock sheet model.
- [x] Add Build sheets view render tests and shell.
- [x] Add sheet search and view toggle behavior.
- [x] Wire a local path from `Study_Project` in the project list to Build sheets.
- [x] Run `npm test` and `npm run build`.
- [x] Record Build shell implementation evidence and Task 6 browser blocker separation.

Implementation status:

- Result: PASS on 2026-06-18 for the local mock Build shell and Sheets list slice.
- App path: Project List -> `Study_Project Build 열기` -> Build sheets view.
- Runtime boundary: local state and mock sheet rows only; no 2D viewer/upload/auth/DB/API/Autodesk/paid SDK/customer drawing/deployment.
- Evidence: see `EVIDENCE.md` section `Build Shell And Sheets List Implementation - 2026-06-18`.

Deferred slices:

1. 2D sheet viewer
2. Project Admin role/permission matrix after human approval
3. Company management after separate scope approval

## Phase 4: 2D Sheet Viewer First Slice

Selected slice:

- ACC #11 `2D sheet viewer` first slice design
- Current project context: `Study_Project`

Document-loop tasks:

- [x] Confirm Project Admin Task 6 blocker is evidence-path only and not a prerequisite for this planning slice.
- [x] Confirm no `0009` Task 6 rerun is created.
- [x] Create `docs/feature-notes/004-2d-sheet-viewer-first-slice.md`.
- [x] Create `docs/superpowers/plans/2026-06-18-2d-sheet-viewer-first-slice.md`.
- [x] Update `docs/PRD.md`, `docs/TRD.md`, `docs/UI_Spec.md`, `docs/Data_Model.md`, `docs/Task_List.md`, `docs/Acceptance_Criteria.md`, `docs/Test_Scenarios.md`.
- [x] Update `docs/Design_Map.md`, `docs/User_Flow.md`, `docs/Planning_Gate_Checklist.md`.
- [x] Update `SPEC.md`, `PLAN.md`, `CHECKS.md`, `HUMAN_GATE.md`.
- [x] Run document consistency checks for FR-SV-001 through FR-SV-009 and local-only viewer scope boundaries.
- [x] Run planning gate for the local-only viewer shell/static sheet render slice.

Planning gate status:

- Result: PASS on 2026-06-18.
- Basis: seven core documents and UI support documents include FR-SV-001 through FR-SV-009, T-SV-001 through T-SV-009, AC-SV-001 through AC-SV-009, TS-SV-001 through TS-SV-009, and UF-SV mappings; local-only viewer scope and HUMAN_GATE exclusions are explicit.
- Implementation eligibility: the local-only viewer shell/static sheet render slice may proceed to a scoped implementation request with owned files and TDD checks. Real viewer engine, TypeDB/DB/API/schema, customer drawings, Autodesk API, paid SDK, CAD editor, and deployment remain unauthorized.

Implementation pre-decision:

- Default first slice is `local-only viewer shell/static sheet render`.
- Real viewer engine evaluation/adoption is a HUMAN_GATE item and is not authorized.
- Equipment entity ID / ontology binding is reserved as a local viewer data slot only.
- Real TypeDB, DB/API, schema, Autodesk API, paid SDK, customer drawing, and deployment work remains separate gated scope.

Implementation plan after gate:

- [x] Draft scoped implementation request/plan with owned files and TDD checks in `docs/superpowers/plans/2026-06-18-2d-sheet-viewer-implementation.md`.
- [ ] Add viewer state/data helper tests and local selected-sheet model.
- [ ] Add viewer shell render tests for context, static sheet surface, tool rail, bottom controls, and panel tabs.
- [ ] Wire a local path from a Build sheet row to the viewer shell.
- [ ] Run `npm test` and `npm run build`.
- [ ] Record viewer evidence separately from the existing Project Admin Task 6 blocker.

Scoped implementation request status:

- Result: READY on 2026-06-18.
- Scope: local-only viewer shell/static sheet render from a selected local Build sheet row.
- Owned source candidates are limited to `src/App.tsx`, `src/App.test.tsx`, `src/BuildSheetsView.tsx`, `src/BuildSheetsView.test.tsx`, `src/buildSheetsData.ts`, `src/buildSheetsData.test.ts`, `src/SheetViewerView.tsx`, `src/SheetViewerView.test.tsx`, `src/sheetViewerData.ts`, `src/sheetViewerData.test.ts`, and `src/styles.css`.
- Verification plan: `npm test`, `npm run build`, `git diff --check`, forbidden-path check excluding `src`, and `.ai-loop` 0009 guard.
- Browser evidence remains separate from Project Admin Task 6 and must not be reused for that blocker.

## Operating Rule

Work one feature at a time. Do not build the whole ACC clone in one pass.

## Session Closeout - 2026-06-18

Current stage:

- Build shell + Sheets list slice is implemented, verified, and committed.
- AI loop blocker-handling reinforcement is committed.
- Task 6 blocker handoff is committed.
- Closeout documentation was refreshed after the commits.
- ACC #11 2D sheet viewer first slice document-loop kickoff and formal planning gate are complete.

Open work:

- Project Admin Task 6 browser validation remains `BLOCKED_BROWSER_UNAVAILABLE`.
- Do not create `0009` or rerun the same Task 6 browser validation path without a documented changed browser automation precondition.
- ACC #11 scoped implementation request/plan with owned files and TDD checks is ready at `docs/superpowers/plans/2026-06-18-2d-sheet-viewer-implementation.md`.
- Next step for ACC #11 is TDD implementation of the local-only viewer shell/static sheet render only if the user asks to implement.
- The first viewer slice is approved only as local-only viewer shell/static sheet render.
- Real 2D viewer engine work touches `HUMAN_GATE.md`; do not proceed automatically.
- Equipment entity ID / ontology binding is reserved as a viewer data slot first. Real TypeDB, DB/API, or schema integration remains separate gated work.
- ACC #8 Build home dashboard is a lower-risk alternative, but it is less central than the sheet-list-to-viewer workflow.
