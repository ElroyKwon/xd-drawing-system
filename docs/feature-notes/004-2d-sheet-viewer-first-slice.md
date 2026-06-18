# 004 - 2D Sheet Viewer First Slice

## Slice

ACC #11 `2D sheet viewer` first slice design.

## Product Decision

The next product step continues from the committed Build shell and `시트` list. The first viewer slice should prove the drawing-viewing workflow without adopting a real viewer engine or loading customer drawings.

Default assumption:

- Local-only viewer shell/static sheet render.
- The viewer opens from a local mock sheet row such as `A001`.
- Viewer controls, markup tools, issue toggle, and panel areas are rendered as local UI affordances first.
- Equipment entity ID / ontology binding is reserved as a viewer data slot only.

Do not proceed automatically with real viewer engine evaluation or adoption. PDF.js, OpenSeadragon, APS Viewer, ODA, Autodesk-backed processing, or any paid/external viewer dependency requires `HUMAN_GATE.md` review first.

```text
Project
Sheet
SheetViewerState
  - projectId
  - sheetId
  - selectedTool
  - zoomLevel
  - panelTab
  - equipmentEntityIdSlot
```

## In Scope

- Local entry from the Build `시트` list into a viewer shell for a selected mock sheet.
- ACC #11-style viewer layout: sheet title/context, central static sheet render area, right vertical tool rail, bottom view controls, left markup/issue panel affordance.
- Local sheet navigation context, optionally with a bottom filmstrip affordance using current mock sheets.
- Empty-state panel copy for markup/issues without creating markup or issues.
- Local UI state for selected tool, zoom/fit affordance, panel tab, and selected sheet.
- Reserved viewer data slot for `equipmentEntityId` / ontology binding without DB/API/TypeDB integration.

## Out Of Scope

- Real 2D viewer engine adoption or dependency installation.
- PDF/DWG/DXF parsing, tiled rendering, canvas/WebGL renderer, or Autodesk-backed sheet processing.
- Customer/confidential drawing files.
- Sheet upload, publish, file storage, version compare, or drawing sync.
- Creating, editing, saving, or persisting markup.
- Creating, editing, saving, or persisting issues.
- Measurement, sheet compare, real zoom/pan math, or calibrated scale.
- Auth/RBAC, DB/API persistence, TypeDB/schema integration, Autodesk API, paid SDK, deployment.
- CAD editor scope.

## References

- `reference/acc-screenshots/Video Screen1781231512247.png`
- `reference/acc-screenshots/Video Screen1781231537335.png`
- `reference/acc-screenshots/Video Screen1781231557885.png`
- `reference/acc-screenshots/Video Screen1781231575003.png`
- `reference/acc-screenshots/Video Screen1781231601337.png`
- `reference/acc-analysis/_ACC-Build-화면분석-재현설계.md` sections `#11` through `#17`

## Verification

Document-loop kickoff only in this session:

- Confirm `FR-SV-001` through `FR-SV-009` are represented in the seven core docs and UI support docs.
- Confirm real viewer engine, customer drawings, DB/API/TypeDB, Autodesk, paid SDK, and deployment remain gated or out of scope.
- Confirm Project Admin Task 6 stays open and `BLOCKED_BROWSER_UNAVAILABLE`.
- Confirm no `src/`, package, reference, `docs/evidence`, or `.ai-loop` runtime files changed.

Implementation checks are intentionally deferred until after a planning gate.
