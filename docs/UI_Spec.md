# UI Spec

## Screens

| ID | Screen | Source evidence |
|---|---|---|
| UI-IS-001 | 허브 레벨 프로젝트 목록 | ACC #6 `Video Screen1781231401038.png` |
| UI-IS-002 | 프로젝트 목록 위 중앙 프로젝트 작성 모달 | ACC #1 `ScreenShot Tool -20260612102152.png` |

## UI-IS-001 Project List

### Layout

- Top product/header band follows the ACC hub-level information hierarchy, adapted to XD product naming when implementation begins.
- Left/top context shows `Hub Admin`.
- Page greeting and tab row include `My Home`, `프로젝트`, `프로젝트 템플릿`; only `프로젝트` tab is active in this slice.
- Primary action `+ 프로젝트 만들기` appears above the project table.
- Search input and filter affordance are aligned to the table toolbar area.
- Table header includes type, name, number, default access, hub, created date, sort affordance, settings affordance.
- Bottom pagination shows visible item count and page controls.

### Components

- Hub header.
- Tab row.
- Primary create button.
- Search input.
- Filter icon button.
- Project table.
- Default access dropdown affordance.
- Sort indicator.
- Settings/column icon button.
- Pagination controls.

### Fields

| Field | Display | Requirement |
|---|---|---|
| typeIcon | Project type icon column | FR-IS-001 |
| name | Project name text, optional secondary address line | FR-IS-001, FR-IS-002 |
| number | Project number | FR-IS-001, FR-IS-002 |
| defaultAccess | Default module, initially `Build` | FR-IS-001 |
| hub | Hub code/name | FR-IS-001 |
| createdAt | Created date/time label | FR-IS-001 |

### Actions

| Action | Result | Requirement | User-flow step |
|---|---|---|---|
| Search by name/number | Filters local mock list | FR-IS-002 | UF-IS-003 |
| Clear search | Restores full local mock list | FR-IS-002 | UF-IS-004 |
| Click `+ 프로젝트 만들기` | Opens modal | FR-IS-003 | UF-IS-005 |
| Click filter affordance | No data mutation; may show inert affordance in this slice | FR-IS-001 | UF-IS-002 |
| Click settings affordance | No data mutation; may show inert affordance in this slice | FR-IS-001 | UF-IS-002 |
| Use pagination controls | Shows stable pagination affordance for mock list | FR-IS-001 | UF-IS-002 |

## UI-IS-002 Project Creation Modal

### Layout

- Modal is centered over a dimmed project list.
- Header contains `프로젝트 작성` title and close button.
- Body uses stacked fields with labels, required mark on `프로젝트 이름`, select affordances, date picker affordances, and two-column date/value groupings where width permits.
- Footer contains `취소` and primary `프로젝트 작성`.

### Fields

| Field | Type | Required | Notes | Requirement |
|---|---|---:|---|---|
| projectName | text | Yes | Required-field validation target | FR-IS-004, FR-IS-005 |
| projectNumber | text | No | Used by list search after create when supplied | FR-IS-004 |
| projectType | select | No | Default can be `지정되지 않음` | FR-IS-004 |
| templateId | select | No | Template management screen is out of scope | FR-IS-004 |
| address | text | No | Supports visible manual-address affordance | FR-IS-004 |
| manualAddress | affordance/toggle | No | Can be non-persistent in this slice | FR-IS-004 |
| timezone | select | No | Default can be `서울` | FR-IS-004 |
| startDate | date input | No | Placeholder `YYYY/MM/DD` | FR-IS-004 |
| endDate | date input | No | Placeholder `YYYY/MM/DD` | FR-IS-004 |
| projectValue | number/text | No | Currency amount | FR-IS-004 |
| currency | select | No | Default can be `USD` to match screenshot | FR-IS-004 |

### Actions

| Action | Result | Requirement | User-flow step |
|---|---|---|---|
| Submit empty name | Shows validation and keeps modal open | FR-IS-005 | UF-IS-007 |
| Submit valid name | Adds one local mock project and closes modal | FR-IS-006 | UF-IS-009, UF-IS-010 |
| Click `취소` | Closes modal without list mutation | FR-IS-007 | UF-IS-012 |
| Click close | Closes modal without list mutation | FR-IS-007 | UF-IS-013 |

## States

- Empty: If the filtered list has no results, show a compact empty state that does not replace the page shell.
- Loading: No async loading is required in this slice; if a future scaffold introduces loading, it must not block local mock rendering.
- Error: No server error state is required because no backend exists.
- Validation: Empty `projectName` blocks submit, highlights the field, and shows a clear required message.
- No-change: Cancel and close must preserve the list length and existing rows.

## Responsive Requirements

- Desktop: Table layout follows ACC #6 with horizontal space for all key columns.
- Tablet/mobile: Controls may stack, and the project table may become a horizontally scrollable table or compact list, but text must not overlap or clip.
- Modal: Width is constrained to viewport, body can scroll if height is insufficient, footer remains reachable.
- Buttons and labels must fit in Korean at supported widths.

## UI-PA-001 Project Admin Member Access

### Screen

| ID | Screen | Source evidence |
|---|---|---|
| UI-PA-001 | Project Admin 구성원 access view for `Study_Project` | ACC #2 `ScreenShot Tool -20260612102437.png`; ACC #3 `Video Screen1781227558018.png` |

### Layout

- Project/Admin context shows `Project Admin` and `Study_Project`.
- Left rail shows Project Admin navigation with `구성원` selected.
- Any `회사` rail label is only non-selected navigation context; company information and company management are excluded from this slice.
- Main panel heading is `구성원`.
- Main action is `구성원 추가`.
- Toolbar contains `내보내기`, search, filter affordance, and column/settings affordance.
- Member access table columns are `이름`, `이메일`, `전화`, `상태`, `역할`, `추가된 일시`.
- Right inspector shows selected member identity and project-specific role/status.

### Fields

| Field | Display | Requirement |
|---|---|---|
| projectName | `Study_Project` context label | FR-PA-001 |
| name | Member name | FR-PA-002, FR-PA-003, FR-PA-004 |
| email | Member email | FR-PA-002, FR-PA-003, FR-PA-004 |
| phone | Member phone | FR-PA-002, FR-PA-004 |
| status | Project access status, e.g. `활성`, `대기` | FR-PA-002, FR-PA-004 |
| role | Project-specific role, one of `관리자`, `편집자`, `뷰어` | FR-PA-004, FR-PA-008 |
| addedAt | Project access added date/time | FR-PA-002 |

### Actions

| Action | Result | Requirement | User-flow step |
|---|---|---|---|
| Enter Project Admin from `Study_Project` | Opens Project Admin member access view | FR-PA-001 | UF-PA-001 |
| Search by name/email | Filters project-access member rows | FR-PA-003 | UF-PA-003 |
| Clear search | Restores current project access rows | FR-PA-003 | UF-PA-004 |
| Select member row | Updates right inspector | FR-PA-004 | UF-PA-005 |
| Click `구성원 추가` | Opens add-existing-member modal | FR-PA-005 | UF-PA-006 |
| Submit with no member | Shows `구성원을 선택하세요.` and keeps modal open | FR-PA-006 | UF-PA-008 |
| Submit duplicate member | Shows `이미 이 프로젝트에 추가된 구성원입니다.` and keeps modal open | FR-PA-007 | UF-PA-009 |
| Submit valid member + role | Adds one local access row and closes modal | FR-PA-008 | UF-PA-010 |
| Cancel/close add modal | Closes modal without data mutation | FR-PA-005 | UF-PA-012 |

### Add Existing Member Modal

- Title: `구성원 추가`.
- Fields: existing member selector and role selector.
- Role choices: `관리자`, `편집자`, `뷰어`.
- Buttons: `취소`, `추가`, close icon.
- Validation messages must be exactly:
  - `구성원을 선택하세요.`
  - `이미 이 프로젝트에 추가된 구성원입니다.`

### Project Admin States

- Empty selection validation: Add submit is blocked until a member is chosen.
- Duplicate validation: Same `projectId` + `memberId` cannot be added twice.
- Empty search result: show stable table shell or compact empty row without mutating state.
- Server error: Not required because this slice has no backend.
- Company scope: no company fields, company details, or company management actions are shown; this covers FR-PA-009.
