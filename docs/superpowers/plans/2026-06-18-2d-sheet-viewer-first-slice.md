# 2D Sheet Viewer First Slice Document Plan

> **For agentic workers:** This is a document-loop kickoff plan only. Do not implement product code from this file until planning gate PASS is recorded.

**Goal:** Define the ACC #11 `2D sheet viewer` first slice as a local-only viewer shell/static sheet render that continues from the Build `시트` list.

**Default decision:** Use a local-only static viewer shell for the first slice. Real viewer engine evaluation/adoption is human-gated and not authorized by this plan.

**Architecture boundary:** No product implementation, no dependency install, no customer drawings, no DB/API/TypeDB integration, no `.ai-loop` runtime request, no Project Admin Task 6 rerun.

---

## Owned Documents For The Document Loop

- `docs/feature-notes/004-2d-sheet-viewer-first-slice.md`
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

## Blocked Files And Work

- Do not modify `src/`.
- Do not edit `package.json` or `package-lock.json`.
- Do not modify `reference/`.
- Do not create or modify `docs/evidence/`.
- Do not create or modify `.ai-loop/control/`, `.ai-loop/logs/`, `.ai-loop/results/`, or `.ai-loop/workers/`.
- Do not create `0009`.
- Do not rerun Project Admin Task 6 browser validation.
- Do not mark Project Admin Task 6 PASS.
- Do not install or adopt a real viewer engine.
- Do not use Autodesk API, paid SDK, auth/RBAC, DB/API/schema, customer drawing, or deployment.

## Tasks

### Task 0: Preflight And Guard

- [x] Confirm clean preflight with `git status --short --untracked-files=all`.
- [x] Confirm live branch/commit matches expected `master` / `f59d850`.
- [x] Confirm Project Admin Task 6 remains `BLOCKED_BROWSER_UNAVAILABLE`.
- [x] Confirm no 0009 request exists or is created.

### Task 1: Reference Basis

- [x] Read ACC #11 and adjacent viewer references in the ACC analysis.
- [x] Confirm the viewer is the natural continuation from ACC #10 `시트` list.
- [x] Keep ACC #12-#17 as panel/settings context, not full first-slice scope.

### Task 2: Document Scaffold

- [x] Create the ACC #11 feature note.
- [x] Add `FR-SV-001` through `FR-SV-009` to the seven core docs and UI support docs.
- [x] Add `T-SV-*`, `AC-SV-*`, `TS-SV-*`, and `UF-SV-*` mappings.
- [x] Record real viewer engine and ontology integration gates.

### Task 3: Planning Gate Readiness

- [x] Run or request formal `planning-gate`.
- [ ] Only after planning gate PASS, draft implementation work with owned files and TDD checks.
- [x] Keep browser validation requirements separate from Project Admin Task 6 evidence.

## Next Action

Draft the scoped implementation work for the ACC #11 local-only viewer shell/static sheet render slice with owned files and TDD checks. Do not implement a real viewer engine, install dependencies, use customer drawings, connect TypeDB/DB/API/Autodesk, create `0009`, or reuse Build browser evidence as Project Admin Task 6 evidence.
