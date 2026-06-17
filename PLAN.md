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

- [ ] Add Project Admin data helper tests and local mock model.
- [ ] Add Project Admin view render tests and shell.
- [ ] Add search and row selection behavior.
- [ ] Add add-existing-member modal with empty and duplicate validation.
- [ ] Wire a local path from `Study_Project` in the project list to Project Admin.
- [ ] Run `npm test`, `npm run build`, browser desktop/narrow checks, and console checks.
- [ ] Record Project Admin implementation evidence and handoff.

Deferred slices:

1. Build shell and Sheets list
2. Project Admin role/permission matrix after human approval
3. Company management after separate scope approval

## Operating Rule

Work one feature at a time. Do not build the whole ACC clone in one pass.
