# 009 — ACC Upload Format → Feature Matrix (and the missing PDF/Sheets path)

Date: 2026-06-23
Status: Analysis / planning note. PRD/TRD reflection APPROVED at the human gate on 2026-06-23 with direction "viewer=DWG, sheets=PDF (both paths)" and applied as FR-DUC-011/012.

## Why this note exists

The project's drawing-upload design (DUC slice, `005`, PRD FR-DUC-*, TRD DUC addendum)
models **one** ingestion path only: `DWG → DXF (ODA) → ezdxf scan → viewable candidate`.
But the question "what file must be uploaded to ACC to use *all* features?" was never
answered in the design. This note answers it from ACC's actual behaviour and names the
gap so PRD/TRD can be corrected.

The short answer: **ACC uses two different ingestion paths for two different purposes,
and our design currently only mirrors one of them.**

## ACC has two ingestion surfaces

| Surface | Accepts | What happens | What it unlocks |
|---|---|---|---|
| **Files** (ACC Docs) | DWG, RVT, PDF, DGN, IFC, NWD/NWC, image, etc. | Server **Model Derivative** translates the upload to a **viewable** (SVF2) + metadata. Viewing needs the *derivative URN*, not the source storage id. DWG model/layout (배치) spaces become 2D viewables. | In-browser viewing (APS Viewer / Three.js, WebGL + 2D), property/metadata extraction, 3D coordination. |
| **Sheets** (ACC Build) | **PDF** (and **RVT** via a publish session). Sheets API currently **PDF only**. | **OCR** splits the file into individual sheets and auto-extracts sheet number + title for review. | The full field/collaboration workflow: **sheet register, version compare, Issues (pins), Markups, measurements**, field distribution, exports. |

### So: DWG or PDF?

- To **view** a drawing: DWG (or RVT) → **Files** works; Model Derivative renders it.
- To use the **collaboration feature set** ACC Build is known for — sheet register +
  Issue pins + Markups + version-compare — the canonical path is **PDF → Sheets**
  (or RVT published to Sheets). DWG is *viewable* but is not the Sheets/markup unit;
  DWG→PDF sheet export is supported only for DWG uploaded after 2023-05-01, and
  Model Derivative must finish before pages can be extracted.

This is exactly the distinction the current design is missing.

## Format → feature matrix (ACC reference behaviour)

| Upload format | View in browser | Sheet register (OCR split) | Issues / Markups / version compare | Notes |
|---|:---:|:---:|:---:|---|
| **PDF** | ✅ | ✅ (OCR) | ✅ | Primary path for the Sheets collaboration workflow. |
| **RVT** | ✅ | ✅ (publish session, 2022+) | ✅ | Publish 2D views/sheets into Sheets. |
| **DWG** | ✅ (Model Derivative) | ⚠️ via DWG→PDF export (post-2023-05-01 uploads) | ⚠️ only after it becomes a PDF sheet | Great for viewing/extents; not the native markup unit. |
| **DGN / IFC / NWD** | ✅ | ❌ | viewer markups only | Coordination/viewing, not Sheets. |

(Confidence: verified against Autodesk help/APS docs — see Sources. Evidence grade:
`static` documentation read, not exercised against a live ACC tenant.)

## Implication for XD (we have no Autodesk backend)

XD reproduces ACC behaviour in **pure JS (SVG/Canvas) + JSON**, so we must build our own
ingestion. ACC's lesson is that we likely need **two ingestion paths, not one**:

1. **Drawing/viewer path** (already designed): `DWG → DXF → scan → viewable candidate → render`.
   This is the analog of ACC **Files** + Viewer.
2. **Sheet-register path** (currently MISSING): a `document → paged sheets → sheet register`
   pipeline that is the substrate for Issues/Markups/version-compare. In ACC this is
   **PDF-OCR-based**. FR-DUC-008 *reserves* issue/markup overlay slots but never says the
   sheet-register pipeline they sit on top of — and that pipeline, in the ACC model, is
   not the DWG→DXF path.

The open product decision (for a planning gate, not to settle here): does XD ingest
**PDF** for the sheet/markup workflow, derive sheets **from DWG/DXF** directly (our own
paging of model/layout into sheets), or **both**? The current docs implicitly assume
DWG-only and never raise the question.

## PRD/TRD reflection (HUMAN_GATE — APPROVED & applied 2026-06-23)

User decision: **viewer=DWG, sheets=PDF (both paths)**. Applied to `docs/PRD.md` and
`docs/TRD.md`:

- **FR-DUC-011** — The design records an explicit upload **format → feature matrix**
  (viewing vs sheet-register vs issue/markup), using the ACC reference behaviour here.
- **FR-DUC-012** — The design defines **two ingestion paths**: the DWG-based viewer path
  (DWG→DXF→scan→viewable) and a distinct **PDF-based sheet-register path**
  (PDF → paged sheets → sheet register), which is the substrate for Issues/Markups/
  version-compare (FR-DUC-008). "Sheet/viewable candidate" (viewer) and "sheet register
  entry" (collaboration) are kept as separate concepts.

## Sources

- [DOCS Help — About Files](https://help.autodesk.com/view/DOCS/ENU/?guid=Files)
- [APS — Upload Files to Forma Sheets (PDF only)](https://aps.autodesk.com/en/docs/acc/v1/tutorials/sheets/upload-sheets)
- [BUILD Help — Add and Publish Sheets to the Field (PDF or RVT, OCR)](https://help.autodesk.com/view/BUILD/ENU/?guid=Upload_And_Publish_Sheets)
- [APS Blog — Export 2D View and Sheet of Revit or DWG to PDF](https://aps.autodesk.com/blog/acc-api-export-2d-view-and-sheet-revit-or-dwg-pdf)
- [APS Blog — Get the derivative URN of an ACC/BIM360 file for viewing](https://aps.autodesk.com/blog/get-derivative-urn-accbim360-file-viewing-it-viewer)
- [Autodesk Support — Markups missing in a new version when sheet name/number changes](https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/Markups-missing-in-a-new-version-when-changing-the-view-name-sheet-name-or-sheet-number-in-BIM-360-Document-Management.html)
