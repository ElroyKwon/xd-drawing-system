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
