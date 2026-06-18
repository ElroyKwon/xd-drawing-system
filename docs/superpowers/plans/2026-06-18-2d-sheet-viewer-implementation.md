# 2D Sheet Viewer First Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement ACC #11 `2D sheet viewer` first slice as a local-only viewer shell/static sheet render opened from a selected Build `시트` row.

**Architecture:** Keep the current Vite + React + TypeScript + Vitest app pattern: no router, local view state in `App.tsx`, local mock `Sheet` data from `buildSheetsData.ts`, and a focused `SheetViewerView` component for the viewer shell. Add only local UI state for selected sheet, selected tool, zoom affordance, panel tab, and nullable equipment entity ID slot.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, existing `lucide-react` dependency, existing CSS in `src/styles.css`.

---

## Request Envelope

- Mode: `implementation`.
- Coordination mode: solo or direct-subagent implementation is allowed in the next session. This document itself did not dispatch a worker.
- Planning basis: ACC #11 planning gate PASS recorded on 2026-06-18 for local-only viewer shell/static sheet render.
- Commit/push: do not commit or push unless the user explicitly asks in the implementation session.
- Browser validation: do not reuse Project Admin Task 6 evidence. Fresh browser evidence for this viewer slice may be collected only after implementation, and it remains separate from Task 6.

## Implementation Scope

Included:

- Open a viewer shell from a selected local mock sheet row in the Build `시트` list.
- Show selected sheet context: `Study_Project`, sheet number, sheet title, and return-to-sheets action.
- Render a static sheet surface that looks like a drawing sheet but does not load, parse, or display a real drawing file.
- Render right tool rail affordances for select, move, text, shape, pen, measurement, stamp, and color.
- Render bottom view controls for pan, fit, zoom out, zoom in, fullscreen, compare, and measure as local affordances only.
- Render left panel tabs for `마크업` and `이슈`, with empty states and local tab switching.
- Maintain local `SheetViewerState` for `projectId`, `sheetId`, `selectedTool`, `zoomLevel`, `panelTab`, and `equipmentEntityIdSlot`.
- Reserve `equipmentEntityId` / ontology binding only as a nullable local data slot. The implementation must not connect this slot to TypeDB, DB/API, schema, or entity resolution.
- Preserve local sheet navigation context with a lightweight local context strip or count such as `1 / 6`, without upload/storage/sync.

Excluded:

- Real viewer engine, PDF.js, OpenSeadragon, APS Viewer, ODA, tiled renderer, Canvas/WebGL renderer, drawing parser, or new dependency installation.
- Customer/confidential drawings, upload, publish, storage, drawing sync, version compare, calibrated measurement, or real compare behavior.
- Persisted markup, persisted issues, issue creation, markup creation, saving, or record mutation.
- Auth/RBAC, DB/API persistence, TypeDB/schema integration, Autodesk API, paid SDK, deployment, or CAD editor behavior.
- Project Admin Task 6 browser validation rerun, 0009 request creation, or using Build/viewer browser evidence as Task 6 evidence.

## Owned Files For Next Implementation

Preferred existing-file edits:

- Modify `src/App.tsx`: add a `sheet-viewer` active view, store `selectedSheetId`, pass `onOpenSheet` to `BuildSheetsView`, render `SheetViewerView`, and keep return paths local.
- Modify `src/App.test.tsx`: add integration tests for Project List -> Build sheets -> selected sheet viewer -> return to sheets.
- Modify `src/BuildSheetsView.tsx`: accept `onOpenSheet(sheetId: string)`, expose an accessible selected-sheet open action from each row, and keep existing sheet list/search behavior intact.
- Modify `src/BuildSheetsView.test.tsx`: add tests that clicking a sheet open action calls `onOpenSheet` with the selected local sheet ID.
- Modify `src/styles.css`: add viewer shell, static sheet surface, right rail, bottom controls, and panel tab styles using existing ACC-like visual language.

Preferred new files:

- Create `src/SheetViewerView.tsx`: owns the viewer shell UI and local viewer interactions.
- Create `src/SheetViewerView.test.tsx`: owns focused viewer rendering and interaction tests.
- Create `src/sheetViewerData.ts`: owns `SheetViewerState`, viewer tool/tab types, state factory, selected-sheet resolver, and local-only boundary constants.
- Create `src/sheetViewerData.test.ts`: owns helper tests, including nullable equipment entity slot and no real-engine dependency assumptions.

Conditional existing-file edits:

- Modify `src/buildSheetsData.ts` only if the implementation needs a shared helper such as `findSheetById(projectId, sheetId, sheets)`. Prefer putting viewer-specific helpers in `src/sheetViewerData.ts`.
- Modify `src/buildSheetsData.test.ts` only if `buildSheetsData.ts` changes.

Forbidden edits in the next implementation request:

- Do not modify `package.json`, `package-lock.json`, `reference/`, `docs/evidence/`, `evidence/`, or `.ai-loop/`.
- Do not add dependency files or browser evidence assets during the TDD implementation phase.

## TDD Plan

Write tests before implementation. Each RED step must fail for the expected missing behavior, not because of a syntax error unrelated to the behavior under test.

1. Viewer state/data helper tests
   - File: `src/sheetViewerData.test.ts`
   - Expected failing tests:
     - `createInitialSheetViewerState` returns project/sheet IDs, default `selectedTool: "select"`, default `zoomLevel: "fit"`, default `panelTab: "markup"`, and `equipmentEntityIdSlot: null`.
     - selected sheet resolver returns `A001` for `project-study` / `sheet-a001` and `undefined` for another project.
     - forbidden scope constants or helper state do not reference real engine, Autodesk API, customer drawing, DB/API, or TypeDB integration.
   - Expected pass condition: helper tests pass without touching package dependencies or external data.

2. Build sheet row entry test
   - File: `src/BuildSheetsView.test.tsx`
   - Expected failing test:
     - rendering `BuildSheetsView` with `onOpenSheet={fn}` and clicking `A001 열기` calls `fn("sheet-a001")`.
   - Expected pass condition: existing Build shell/search/toggle tests still pass, and selected sheet open action is accessible by role/name.

3. App-level viewer entry test
   - File: `src/App.test.tsx`
   - Expected failing test:
     - click `Study_Project Build 열기`, click `A001 열기`, then viewer shell shows `Study_Project`, `A001`, and `ARCHITECTURAL- GRAPHIC SYMBOLS& ABBREVIATIONS`.
   - Expected pass condition: app transitions from project list to Build sheets to viewer shell without adding a router.

4. Viewer header/context test
   - File: `src/SheetViewerView.test.tsx`
   - Expected failing test:
     - `SheetViewerView` renders selected project/sheet context, a `시트 목록` return action, and local sheet navigation context.
   - Expected pass condition: context is derived from the selected local `Sheet`, not hard-coded to only one label.

5. Static sheet render surface test
   - File: `src/SheetViewerView.test.tsx`
   - Expected failing test:
     - viewer renders a labeled static sheet surface and does not render `canvas`, `iframe`, `object`, file input, upload control, or customer drawing file label.
   - Expected pass condition: central render is local HTML/CSS only.

6. Right tool rail selected-state test
   - File: `src/SheetViewerView.test.tsx`
   - Expected failing test:
     - tool buttons for `선택`, `이동`, `텍스트`, `도형`, `펜`, `측정`, `스탬프`, and `색상` render; clicking `펜` updates only the active local affordance.
   - Expected pass condition: selected tool state changes locally and no markup record is created or saved.

7. Bottom controls affordance test
   - File: `src/SheetViewerView.test.tsx`
   - Expected failing test:
     - pan, fit, zoom out, zoom in, fullscreen, compare, and measure controls render as buttons; zoom controls update a visible local zoom label or state.
   - Expected pass condition: controls do not claim real measurement, compare, fullscreen API, or engine behavior.

8. Markup/issues panel tabs empty-state test
   - File: `src/SheetViewerView.test.tsx`
   - Expected failing test:
     - default `마크업` tab shows an empty markup state; clicking `이슈` shows an empty issue state; no create/save controls appear.
   - Expected pass condition: tab state is local and no records are created.

9. Return-to-sheets test
   - Files: `src/SheetViewerView.test.tsx`, `src/App.test.tsx`
   - Expected failing tests:
     - component-level return button calls `onBackToSheets`.
     - app-level return button leaves viewer and shows the Build `시트` list with the previous local sheet rows.
   - Expected pass condition: no data reload, backend, or routing library is required.

10. Forbidden scope regression test
    - File: `src/SheetViewerView.test.tsx` or `src/sheetViewerData.test.ts`
    - Expected failing test before implementation:
      - viewer output must not contain `Autodesk`, `PDF.js`, `ODA`, `TypeDB 연결`, `업로드`, `게시`, `저장`, `마크업 저장`, `이슈 만들기`, or customer drawing file names.
      - rendered DOM must not include `canvas`, `iframe`, `object`, or file input.
    - Expected pass condition: the first slice remains a static local UI shell only.

## Implementation Order

### Task 1: Add Viewer State/Data Helpers

**Files:**
- Create: `src/sheetViewerData.test.ts`
- Create: `src/sheetViewerData.ts`

- [ ] Step 1: Write RED helper tests for default state, selected-sheet resolution, and nullable `equipmentEntityIdSlot`.
- [ ] Step 2: Run `npm test -- src/sheetViewerData.test.ts`.
  - Expected: FAIL because `src/sheetViewerData.ts` does not exist or exports are missing.
- [ ] Step 3: Implement minimal helper module.
- [ ] Step 4: Run `npm test -- src/sheetViewerData.test.ts`.
  - Expected: PASS.

### Task 2: Add SheetViewerView Skeleton

**Files:**
- Create: `src/SheetViewerView.test.tsx`
- Create: `src/SheetViewerView.tsx`
- Modify: `src/styles.css`

- [ ] Step 1: Write RED tests for viewer header/context, return action, and local sheet context strip.
- [ ] Step 2: Run `npm test -- src/SheetViewerView.test.tsx`.
  - Expected: FAIL because `SheetViewerView` does not exist.
- [ ] Step 3: Implement minimal `SheetViewerView` props and shell:
  - `projectName`
  - `sheet`
  - `sheets`
  - `onBackToSheets`
- [ ] Step 4: Add the smallest CSS needed for readable shell layout.
- [ ] Step 5: Run `npm test -- src/SheetViewerView.test.tsx`.
  - Expected: PASS for context tests.

### Task 3: Add Static Surface And Boundary Tests

**Files:**
- Modify: `src/SheetViewerView.test.tsx`
- Modify: `src/SheetViewerView.tsx`
- Modify: `src/styles.css`

- [ ] Step 1: Write RED tests for the static sheet render surface and forbidden DOM elements.
- [ ] Step 2: Run `npm test -- src/SheetViewerView.test.tsx`.
  - Expected: FAIL because static surface and boundary assertions are not implemented yet.
- [ ] Step 3: Implement central static sheet render using local HTML/CSS only.
- [ ] Step 4: Run `npm test -- src/SheetViewerView.test.tsx`.
  - Expected: PASS; no `canvas`, `iframe`, `object`, file input, real engine, or customer drawing text appears.

### Task 4: Add Right Tool Rail

**Files:**
- Modify: `src/SheetViewerView.test.tsx`
- Modify: `src/SheetViewerView.tsx`
- Modify: `src/styles.css`

- [ ] Step 1: Write RED selected-tool tests for all right rail affordances.
- [ ] Step 2: Run `npm test -- src/SheetViewerView.test.tsx`.
  - Expected: FAIL because the tool rail is missing or not interactive.
- [ ] Step 3: Implement local selected-tool state and accessible buttons.
- [ ] Step 4: Run `npm test -- src/SheetViewerView.test.tsx`.
  - Expected: PASS; selected-tool state changes without creating markup.

### Task 5: Add Bottom View Controls

**Files:**
- Modify: `src/SheetViewerView.test.tsx`
- Modify: `src/SheetViewerView.tsx`
- Modify: `src/styles.css`

- [ ] Step 1: Write RED tests for pan, fit, zoom out, zoom in, fullscreen, compare, and measure controls.
- [ ] Step 2: Run `npm test -- src/SheetViewerView.test.tsx`.
  - Expected: FAIL because bottom controls are missing.
- [ ] Step 3: Implement controls as local affordances; only zoom/fit changes visible local state.
- [ ] Step 4: Run `npm test -- src/SheetViewerView.test.tsx`.
  - Expected: PASS; no real measurement or compare behavior is claimed.

### Task 6: Add Markup/Issues Empty Panel Tabs

**Files:**
- Modify: `src/SheetViewerView.test.tsx`
- Modify: `src/SheetViewerView.tsx`
- Modify: `src/styles.css`

- [ ] Step 1: Write RED tests for `마크업` default empty state and `이슈` tab switching.
- [ ] Step 2: Run `npm test -- src/SheetViewerView.test.tsx`.
  - Expected: FAIL because panel tabs are missing.
- [ ] Step 3: Implement local `panelTab` state and empty states.
- [ ] Step 4: Run `npm test -- src/SheetViewerView.test.tsx`.
  - Expected: PASS; no create/save controls appear.

### Task 7: Wire Build Sheet Row To Viewer

**Files:**
- Modify: `src/BuildSheetsView.test.tsx`
- Modify: `src/BuildSheetsView.tsx`

- [ ] Step 1: Write RED test for `A001 열기` calling `onOpenSheet("sheet-a001")`.
- [ ] Step 2: Run `npm test -- src/BuildSheetsView.test.tsx`.
  - Expected: FAIL because `onOpenSheet` and row open action are missing.
- [ ] Step 3: Add optional `onOpenSheet?: (sheetId: string) => void` prop and an accessible row action.
- [ ] Step 4: Run `npm test -- src/BuildSheetsView.test.tsx`.
  - Expected: PASS; existing Build tests remain passing.

### Task 8: Wire App View State

**Files:**
- Modify: `src/App.test.tsx`
- Modify: `src/App.tsx`

- [ ] Step 1: Write RED app-level tests for Project List -> Build sheets -> `A001 열기` -> viewer and viewer return -> Build sheets.
- [ ] Step 2: Run `npm test -- src/App.test.tsx`.
  - Expected: FAIL because App does not have `sheet-viewer` state.
- [ ] Step 3: Add `activeView: "sheet-viewer"` and `selectedSheetId` state, pass `onOpenSheet`, and render `SheetViewerView` with selected local sheet.
- [ ] Step 4: Run `npm test -- src/App.test.tsx`.
  - Expected: PASS.

### Task 9: Run Whole App Verification

**Files:**
- No new files unless prior tasks require small CSS refinements.

- [ ] Step 1: Run `npm test`.
  - Expected: PASS, including existing initial setup, Project Admin, Build sheets, viewer helper, and viewer component tests.
- [ ] Step 2: Run `npm run build`.
  - Expected: PASS.
- [ ] Step 3: Run `git diff --check`.
  - Expected: PASS; no output.
- [ ] Step 4: Run forbidden-path check:

```powershell
git diff --name-only -- package.json package-lock.json reference docs/evidence evidence .ai-loop
```

  - Expected: PASS; no output.
  - Note: do not include `src` in this implementation-session forbidden path because `src` is the owned implementation surface.
- [ ] Step 5: Run 0009 guard:

```powershell
Get-ChildItem -Recurse -Force -LiteralPath '.ai-loop' | Where-Object { $_.Name -match '0009' }
```

  - Expected: PASS; no output.

## Verification Plan

Required implementation-session checks:

```powershell
npm test
npm run build
git diff --check
git diff --name-only -- package.json package-lock.json reference docs/evidence evidence .ai-loop
Get-ChildItem -Recurse -Force -LiteralPath '.ai-loop' | Where-Object { $_.Name -match '0009' }
```

Expected results:

- `npm test`: PASS.
- `npm run build`: PASS.
- `git diff --check`: no output.
- Forbidden-path check: no output.
- 0009 guard: no output.

Browser validation:

- Browser validation is not part of this implementation TDD request unless the user explicitly asks after source verification passes.
- Any later viewer browser evidence must be recorded as ACC #11 viewer evidence only.
- It must not be used to close Project Admin Task 6.

## Blocker And Evidence Guard

- Project Admin Task 6 remains open / `BLOCKED_BROWSER_UNAVAILABLE`.
- Do not create `0009`.
- Do not rerun Project Admin Task 6 browser validation.
- Do not convert Build or viewer browser evidence into Project Admin Task 6 evidence.
- Product test/build PASS and browser-evidence PASS are different axes. If tests/build pass but browser evidence is unavailable, record the product check status separately from the evidence-path status.

## Actual Implementation Prompt

Use this exact prompt for the next development terminal:

```text
$ai-loop-orchestrator
---
Use skill: ai-loop-orchestrator.
Coordination mode: solo-orchestration unless direct-subagent implementation is clearly useful.

Goal:
Implement ACC #11 2D sheet viewer first slice from docs/superpowers/plans/2026-06-18-2d-sheet-viewer-implementation.md using TDD.

Must first:
1. Run git status --short --untracked-files=all.
2. Read AGENTS.md, README.md, SPEC.md, PLAN.md, CHECKS.md, HUMAN_GATE.md, EVIDENCE.md, docs/sessions/NEXT_SESSION.md.
3. Read docs/feature-notes/004-2d-sheet-viewer-first-slice.md.
4. Read docs/superpowers/plans/2026-06-18-2d-sheet-viewer-first-slice.md.
5. Read docs/superpowers/plans/2026-06-18-2d-sheet-viewer-implementation.md.
6. Confirm Project Admin Task 6 remains open / BLOCKED_BROWSER_UNAVAILABLE and do not create 0009.

Allowed edits:
- src/App.tsx
- src/App.test.tsx
- src/BuildSheetsView.tsx
- src/BuildSheetsView.test.tsx
- src/buildSheetsData.ts only if needed for a shared selected-sheet helper
- src/buildSheetsData.test.ts only if src/buildSheetsData.ts changes
- src/SheetViewerView.tsx
- src/SheetViewerView.test.tsx
- src/sheetViewerData.ts
- src/sheetViewerData.test.ts
- src/styles.css
- PLAN.md
- EVIDENCE.md
- docs/sessions/NEXT_SESSION.md
- CHECKS.md only if verification wording must be clarified

Forbidden edits:
- package.json
- package-lock.json
- reference/
- docs/evidence/
- evidence/
- .ai-loop/control/
- .ai-loop/logs/
- .ai-loop/results/
- .ai-loop/workers/
- new browser validation result assets
- 0009 request creation
- Project Admin Task 6 PASS changes
- real viewer engine dependency installation
- Autodesk API, paid SDK, auth/RBAC, DB/API/schema, TypeDB integration, customer drawing, deployment, or CAD editor scope
- commit or push unless the user explicitly asks

TDD order:
1. Write and run RED sheetViewerData helper tests.
2. Implement minimal helpers and get helper tests GREEN.
3. Write and run RED SheetViewerView context/static-surface tests.
4. Implement minimal SheetViewerView shell and static surface.
5. Add RED/GREEN tests for right tool rail, bottom controls, markup/issues tabs, and forbidden scope.
6. Add RED/GREEN BuildSheetsView row-open tests.
7. Add RED/GREEN App integration tests for Build -> viewer -> return.
8. Run npm test, npm run build, git diff --check.
9. Run git diff --name-only -- package.json package-lock.json reference docs/evidence evidence .ai-loop and expect no output.
10. Run Get-ChildItem -Recurse -Force -LiteralPath '.ai-loop' | Where-Object { $_.Name -match '0009' } and expect no output.

Completion report:
- current stage
- changed files
- tests/build/scope-check results
- Project Admin Task 6 remains BLOCKED_BROWSER_UNAVAILABLE
- viewer evidence remains separate from Task 6
- forbidden HUMAN_GATE scope untouched
```

## Self-Review

- Spec coverage: FR-SV-001 through FR-SV-009 are mapped to the TDD plan and implementation tasks.
- Placeholder scan: this plan has no unresolved placeholder tokens or unspecified implementation slots.
- Type consistency: `SheetViewerState`, `selectedTool`, `zoomLevel`, `panelTab`, and `equipmentEntityIdSlot` match the current data-model documents.
- Scope check: the plan changes only local frontend source in the next session and keeps package, reference, evidence assets, `.ai-loop`, external integrations, and Project Admin Task 6 evidence blocked.
