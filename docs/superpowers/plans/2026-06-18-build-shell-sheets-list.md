# Build Shell And Sheets List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local-only ACC Build-style project shell and sheets list for `Study_Project`.

**Architecture:** Keep this slice frontend-only. Add a focused sheet data helper module, a `BuildSheetsView` React view, and a small `App.tsx` navigation branch from the existing project list. The shell renders the Build header/left rail and the `시트` list; 2D viewer and upload/persistence remain out of scope.

**Tech Stack:** Vite, React, TypeScript, Vitest, Testing Library, lucide-react, local mock state only.

---

## Owned Files

- `docs/feature-notes/003-build-shell-sheets-list.md`
- `docs/PRD.md`
- `docs/TRD.md`
- `docs/UI_Spec.md`
- `docs/Data_Model.md`
- `docs/Task_List.md`
- `docs/Acceptance_Criteria.md`
- `docs/Test_Scenarios.md`
- `docs/Design_Map.md`
- `docs/User_Flow.md`
- `docs/Planning_Gate_Checklist.md`
- `SPEC.md`
- `PLAN.md`
- `CHECKS.md`
- `HUMAN_GATE.md`
- `EVIDENCE.md`
- `docs/sessions/NEXT_SESSION.md`
- `src/buildSheetsData.ts`
- `src/buildSheetsData.test.ts`
- `src/BuildSheetsView.tsx`
- `src/BuildSheetsView.test.tsx`
- `src/App.tsx`
- `src/App.test.tsx`
- `src/styles.css`

## Blocked Files And Work

- Do not modify `reference/`.
- Do not edit package/dependency files or run dependency install.
- Do not create DB/API/Auth/RBAC/Autodesk API/paid SDK/deployment/customer drawing flows.
- Do not mark Project Admin Task 6 browser evidence PASS.
- Do not create `0009` as another same-condition Task 6 validation rerun.

## Tasks

### Task 0: Documents And Planning Gate

- [x] Add `FR-BS-001` through `FR-BS-009` to the seven core docs and UI support docs.
- [x] Record the local-only boundary and human gates.
- [x] Run consistency checks for `FR-BS-*`, `T-BS-*`, `AC-BS-*`, and `TS-BS-*`.
- [x] Record planning gate PASS before implementation.

### Task 1: Sheet Data Helpers

- [x] Write `src/buildSheetsData.test.ts` first for sheet row filtering by number, title, discipline, and tag.
- [x] Run `npm test -- src/buildSheetsData.test.ts` and confirm the expected missing-module failure.
- [x] Create `src/buildSheetsData.ts` with `Sheet`, `initialSheets`, and `filterSheets`.
- [x] Re-run the focused test and confirm PASS.

### Task 2: Build Sheets View

- [x] Write `src/BuildSheetsView.test.tsx` first for shell rendering, selected `시트` nav, table columns, six mock rows, search, and view toggle state.
- [x] Run `npm test -- src/BuildSheetsView.test.tsx` and confirm the expected missing-component failure.
- [x] Create `src/BuildSheetsView.tsx` with local state only.
- [x] Add scoped CSS for `.build-shell`, `.build-rail`, `.sheets-table`, and responsive behavior.
- [x] Re-run the focused test and confirm PASS.

### Task 3: App Integration

- [x] Add an `App.test.tsx` expectation that clicking `Study_Project Build 열기` opens the sheets list.
- [x] Run `npm test -- src/App.test.tsx` and confirm the expected missing-action failure.
- [x] Update `src/App.tsx` active view state and add a local Build entry action for `Study_Project`.
- [x] Re-run `npm test -- src/App.test.tsx` and confirm PASS.

### Task 4: Validation And Evidence

- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Record Build browser evidence separately from the existing Project Admin Task 6 blocker.
- [x] Update `EVIDENCE.md` and `docs/sessions/NEXT_SESSION.md`.
