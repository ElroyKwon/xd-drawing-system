# Data Model

## Entities

```text
Project
- id: string
- typeIcon: string
- name: string
- number: string
- projectType: string
- templateId: string | null
- address: string
- manualAddress: boolean
- timezone: string
- startDate: string | null
- endDate: string | null
- projectValue: string
- currency: string
- defaultAccess: string
- hub: string
- createdAt: string
```

## Required Fields

| Field | Required for create? | Used in list? | Notes |
|---|---:|---:|---|
| id | Yes | Yes | Generated locally in implementation. |
| name | Yes | Yes | Required validation field. |
| number | No | Yes | Search target when provided. |
| typeIcon | No | Yes | Can use a default project icon. |
| projectType | No | No | Modal metadata only in this slice. |
| templateId | No | No | Template management is out of scope. |
| address | No | Optional | Can appear as secondary text under name. |
| manualAddress | No | No | Supports modal affordance. |
| timezone | No | No | Default `서울`. |
| startDate | No | No | Stored as local string if entered. |
| endDate | No | No | Stored as local string if entered. |
| projectValue | No | No | Stored as local string if entered. |
| currency | No | No | Default `USD`. |
| defaultAccess | No | Yes | Default `Build`. |
| hub | No | Yes | Default mock hub such as `TEST-`. |
| createdAt | Yes | Yes | Generated locally at create time. |

## CRUD Expectations

| Operation | Required? | Notes |
|---|---:|---|
| Create | Yes | Valid modal submit appends one local mock `Project`. |
| Read | Yes | Project list renders local mock projects and created projects. |
| Update | No | No edit screen or inline edit in this slice. |
| Delete | No | No destructive action in this slice. |
| Undo | No | Cancel/close is a no-change flow, not an undo flow. |

## Search Expectations

- Search target fields: `name`, `number`.
- Search is local and case-insensitive when implementation language permits.
- Clearing search restores the full local mock list.
- Empty result displays an empty state without mutating data.

## Persistence Boundary

- Data is local mock state only.
- No DB schema is introduced.
- No API contract is introduced.
- No customer data is used.
- No Autodesk cloud data is read or written.

## Requirement Mapping

| Requirement ID | Data support |
|---|---|
| FR-IS-001 | `Project` list display fields. |
| FR-IS-002 | `name`, `number` search fields. |
| FR-IS-003 | Modal visibility state; no persistent entity. |
| FR-IS-004 | Modal metadata fields in `Project`. |
| FR-IS-005 | `name` required validation. |
| FR-IS-006 | Local create append operation. |
| FR-IS-007 | No mutation on cancel/close. |
| FR-IS-008 | Data does not drive layout overflow; long text must be handled by UI. |
| FR-IS-009 | Local-only persistence boundary. |

## Project Admin Member Access Model

The second slice adds peer-level `Project`, `Member`, and `ProjectMemberAccess` mock records. It does not introduce company entities, auth entities, database schema, or API contracts.

### Entities

```text
Project
- id: string
- name: string

Member
- id: string
- name: string
- email: string
- phone: string

ProjectMemberAccess
- projectId: string
- memberId: string
- role: "관리자" | "편집자" | "뷰어"
- status: "활성" | "대기"
- addedAt: string
```

### Duplicate Rule

- A `Member` may have access to many projects.
- One project/member pair may have only one `ProjectMemberAccess` record.
- Duplicate submit is blocked with `이미 이 프로젝트에 추가된 구성원입니다.`

### CRUD Expectations

| Operation | Required? | Notes |
|---|---:|---|
| Create | Yes | Valid add appends one local `ProjectMemberAccess` row. |
| Read | Yes | Project Admin table reads derived rows for `Study_Project`. |
| Update | No | Role editing beyond selected add role is not required in this slice. |
| Delete | No | Access deletion/revocation is out of scope and human-gated. |
| Undo | No | Cancel/close is a no-change flow, not an undo flow. |

### Project Admin Requirement Mapping

| Requirement ID | Data support |
|---|---|
| FR-PA-001 | `selectedProject` mock record uses `Study_Project`. |
| FR-PA-002 | `ProjectMemberAccess` records filtered by selected project. |
| FR-PA-003 | `Member.name` and `Member.email` are search targets. |
| FR-PA-004 | Derived access row contains member identity plus role/status. |
| FR-PA-005 | Modal state does not create a persistent entity until valid submit. |
| FR-PA-006 | Empty `memberId` is invalid. |
| FR-PA-007 | Existing same project/member access is invalid. |
| FR-PA-008 | Valid submit creates one local access record with selected role. |
| FR-PA-009 | Separate peer-level data types exclude company/auth/DB/API scope. |

## Build Shell And Sheets List Model

The third slice adds local mock `Sheet` metadata for the Build sheets list. It does not introduce drawing files, sheet binary storage, published versions, database schema, API contracts, Autodesk objects, or customer drawing data.

### Entity

```text
Sheet
- id: string
- projectId: string
- number: string
- title: string
- version: string
- versionSet: string
- disciplineCode: "A" | "E" | "M" | "P"
- disciplineLabel: string
- tag: string
- lastUpdatedBy: string
```

### CRUD Expectations

| Operation | Required? | Notes |
|---|---:|---|
| Create | No | Upload/publish is out of scope. |
| Read | Yes | Build sheets table reads local mock sheets for `Study_Project`. |
| Update | No | Metadata editing is out of scope. |
| Delete | No | Sheet deletion is out of scope and customer-data-sensitive. |
| Undo | No | No mutating action exists in this slice. |

### Search Expectations

- Search target fields: `number`, `title`, `disciplineLabel`, `tag`.
- Search is local and case-insensitive.
- Clearing search restores all current project sheet rows.
- Empty result displays a stable empty row without mutating data.

### Build Sheets Requirement Mapping

| Requirement ID | Data support |
|---|---|
| FR-BS-001 | `projectId` ties sheets to the selected local project. |
| FR-BS-002 | Shell state selects the sheets module; no persisted entity needed. |
| FR-BS-003 | `Sheet[]` provides the local rows. |
| FR-BS-004 | Sheet metadata fields support table display. |
| FR-BS-005 | `number`, `title`, `disciplineLabel`, and `tag` support search. |
| FR-BS-006 | View-mode state is UI state only. |
| FR-BS-007 | Toolbar/menu/pagination affordances do not mutate data. |
| FR-BS-008 | No drawing file or viewer entity is introduced. |
| FR-BS-009 | Local-only data excludes auth/DB/API/Autodesk/customer drawing scope. |

## 2D Sheet Viewer First Slice Model

The fourth slice reserves local viewer state for a future static viewer shell. It does not introduce drawing files, binary storage, parsed geometry, persisted markup, persisted issues, database schema, TypeDB schema, API contracts, Autodesk objects, or customer drawing data.

### Entity

```text
SheetViewerState
- projectId: string
- sheetId: string
- selectedTool: "select" | "move" | "text" | "shape" | "pen" | "measure" | "stamp"
- zoomLevel: string
- panelTab: "markup" | "issues"
- equipmentEntityIdSlot: string | null
```

### CRUD Expectations

| Operation | Required? | Notes |
|---|---:|---|
| Create | No | Viewer state is local UI state only. |
| Read | Yes | Viewer reads selected local `Sheet` metadata and local viewer state. |
| Update | Local only | Tool, zoom, selected panel, and selected sheet may change in memory. |
| Delete | No | No drawing, markup, issue, or access record deletion exists in this slice. |
| Undo | No | No persisted mutation exists. |

### Ontology Slot Boundary

- `equipmentEntityIdSlot` is reserved as a nullable local field only.
- It does not create TypeDB schema, DB columns, API contracts, ontology writes, or entity-resolution logic.
- Real ontology binding is a separate human-gated integration slice.

### 2D Sheet Viewer Requirement Mapping

| Requirement ID | Data support |
|---|---|
| FR-SV-001 | `sheetId` ties viewer state to a selected local sheet. |
| FR-SV-002 | Existing `Sheet` metadata supports context labels. |
| FR-SV-003 | Static render surface has no persisted drawing entity. |
| FR-SV-004 | `selectedTool` supports right-rail local selection state. |
| FR-SV-005 | `zoomLevel` supports bottom-control affordance state. |
| FR-SV-006 | `panelTab` supports markup/issues empty panels. |
| FR-SV-007 | Existing local `Sheet[]` supports navigation context. |
| FR-SV-008 | `equipmentEntityIdSlot` reserves future ontology binding. |
| FR-SV-009 | No external persistence, viewer engine, customer drawing, or integration data is introduced. |

## DWG/DXF Upload Conversion Management Model

The DUC planning slice adds a future local data shape for drawing intake, conversion, scan summaries, and traceability. It does not create DB schema, API contracts, TypeDB schema, production storage, Autodesk objects, customer drawing records, or viewer-rendering guarantees.

### Entities

```text
DrawingSourceFile
- id: string
- sourceName: string
- extension: "dwg" | "dxf" | "zip"
- discipline: "architecture" | "structure" | "civil" | "mechanical" | "electrical" | "communication" | "fire" | "unknown"
- sourcePathLabel: string
- sizeBytes: number
- hasXrefs: boolean
- xrefPolicy: "none" | "folder-copied" | "nearby-xr-files" | "missing"
- intakeStatus: "candidate" | "validated" | "blocked"

DrawingConversionJob
- id: string
- sourceFileId: string
- converter: "local-oda-experiment" | "future-aps" | "future-other"
- status: "queued" | "converting" | "converted" | "scanned" | "failed" | "render-risk"
- startedAt: string | null
- endedAt: string | null
- inputDwgCount: number
- outputDxfCount: number
- message: string | null

DrawingConversionArtifact
- id: string
- jobId: string
- artifactType: "dxf" | "scan-json" | "preview" | "future-svf2"
- localPathLabel: string
- sizeBytes: number | null
- retainedInRepo: false

DxfScanSummary
- artifactId: string
- layoutNames: string[]
- layerCount: number
- blockCount: number
- modelspaceEntityCount: number
- topEntityTypes: Array<[string, number]>
- topInsertNames: Array<[string, number]>
- textSamples: string[]

DrawingViewableCandidate
- id: string
- sourceFileId: string
- conversionJobId: string
- label: string
- candidateType: "layout" | "modelspace-region" | "title-text" | "manual-review"
- renderStatus: "not-tested" | "risky" | "previewable" | "blocked"
- linkedSheetId: string | null
```

### Sheet-Register Path Entities (PDF, FR-DUC-012)

Per the 2026-06-23 decision (viewer=DWG, sheets=PDF), the sheet-register/collaboration
path is modelled separately from the DWG→DXF viewer path above. It does not share the
`DrawingSourceFile` entity or the "viewable candidate" concept. This is a future local
data shape only — no DB/API/TypeDB schema, no real OCR, no persisted markup/issue records.

```text
SheetSourceFile
- id: string
- sourceName: string
- extension: "pdf"
- sourcePathLabel: string
- sizeBytes: number
- pageCount: number | null
- intakeStatus: "candidate" | "validated" | "blocked"

PagedSheet
- id: string
- sheetSourceFileId: string
- pageIndex: number
- detectedSheetNumber: string | null
- detectedSheetTitle: string | null
- extractionStatus: "pending" | "extracted" | "needs-review"

SheetRegisterEntry
- id: string
- pagedSheetId: string
- sheetNumber: string
- sheetTitle: string
- versionLabel: string
- supersedesEntryId: string | null
- issueMarkupReserved: true
```

`SheetRegisterEntry` is the unit that future Issues/Markups/version-compare (FR-DUC-008)
attach to; `supersedesEntryId` reserves version-compare. No markup/issue records are
persisted in this slice.

### JSON Traceability Artifact Proposal

The current canonical planning docs remain Markdown with stable IDs. A future loop artifact may additionally emit a structured JSON summary for automation:

```json
{
  "slice": "DUC",
  "requirements": ["FR-DUC-001"],
  "tasks": ["T-DUC-001"],
  "acceptance": ["AC-DUC-001"],
  "tests": ["TS-DUC-001"],
  "conversionJobs": [
    {
      "sourceFileId": "source-arch-a03",
      "status": "scanned",
      "outputDxfCount": 11
    }
  ]
}
```

This is a proposed progress/traceability artifact only. It is not a production DB/API schema.

### DUC Requirement Mapping

| Requirement ID | Data support |
|---|---|
| FR-DUC-001 | `DrawingSourceFile` and intake queue state. |
| FR-DUC-002 | `DrawingSourceFile` validation fields and `xrefPolicy`. |
| FR-DUC-003 | `DrawingConversionJob` status, timing, converter, counts, and messages. |
| FR-DUC-004 | `DxfScanSummary` layout/layer/block/entity/text fields. |
| FR-DUC-005 | `DrawingViewableCandidate` for layout/modelspace/title/manual candidates. |
| FR-DUC-006 | `renderStatus` and `render-risk` keep rendering separate from conversion. |
| FR-DUC-007 | `linkedSheetId` reserves future relation to Build `Sheet`. |
| FR-DUC-008 | Future overlays remain out of this data model; no persisted markup/issue/memo entities are added. |
| FR-DUC-009 | APS source object/URN fields are intentionally absent until HUMAN_GATE. |
| FR-DUC-010 | JSON artifact proposal mirrors IDs but does not replace Markdown docs or create production schema. |
| FR-DUC-011 | Format-to-feature matrix lives in `docs/feature-notes/009-acc-upload-format-feature-matrix.md`; no data entity needed. |
| FR-DUC-012 | `SheetSourceFile` / `PagedSheet` / `SheetRegisterEntry` model the PDF sheet-register path, kept distinct from `DrawingSourceFile` / `DrawingViewableCandidate` (viewer path). |
