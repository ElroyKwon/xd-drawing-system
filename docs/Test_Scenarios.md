# Test Scenarios

These scenarios define the active checks for the implemented local mock initial setup slice.

| Test ID | Requirement ID | Acceptance ID | Scenario | Expected result |
|---|---|---|---|---|
| TS-IS-001 | FR-IS-001 | AC-IS-001 | Open the project list screen. | Required ACC #6 list structure and columns are visible. |
| TS-IS-002 | FR-IS-002 | AC-IS-002 | Search by `Study_Project`, search by a project number, then clear search. | Matching rows filter correctly and full list returns after clear. |
| TS-IS-003 | FR-IS-003 | AC-IS-003 | Click `+ 프로젝트 만들기`. | Centered `프로젝트 작성` modal opens over the project list. |
| TS-IS-004 | FR-IS-004 | AC-IS-004 | Inspect modal fields and defaults. | All ACC #1 fields and select/date affordances are present. |
| TS-IS-005 | FR-IS-005 | AC-IS-005 | Submit the modal with an empty project name. | Required validation appears, modal stays open, list count is unchanged. |
| TS-IS-006 | FR-IS-006 | AC-IS-006 | Enter a valid project name and submit. | One local mock project is added, modal closes, new row is searchable by name/number when number is provided. |
| TS-IS-007 | FR-IS-007 | AC-IS-007 | Reopen modal, enter partial data, click `취소`; repeat with close button. | Modal closes and list count remains unchanged for both actions. |
| TS-IS-008 | FR-IS-008 | AC-IS-008 | Run desktop and mobile viewport checks through create, validation, cancel, close, and search flows. | No overlap, clipping, broken modal layout, or console errors. |
| TS-IS-009 | FR-IS-009 | AC-IS-009 | Review dependencies and runtime requirements. | No auth, DB, API, Autodesk account, paid SDK, customer drawing, or deployment is required. |

## Project Admin Member Access Scenarios

| Test ID | Requirement ID | Acceptance ID | Scenario | Expected result |
|---|---|---|---|---|
| TS-PA-001 | FR-PA-001 | AC-PA-001 | Open Project Admin for `Study_Project`. | Project Admin member access view renders with `Study_Project` context and `구성원` selected. |
| TS-PA-002 | FR-PA-002 | AC-PA-002 | Inspect the initial member access table. | Only `Study_Project` access rows are visible. |
| TS-PA-003 | FR-PA-003 | AC-PA-003 | Search by member name, search by email, then clear search. | Matching rows filter correctly and all current project access rows return after clear. |
| TS-PA-004 | FR-PA-004 | AC-PA-004 | Select a different member row. | Right inspector updates to the selected member's identity, role, and status. |
| TS-PA-005 | FR-PA-005 | AC-PA-005 | Click `구성원 추가`. | Add-existing-member modal opens without creating access. |
| TS-PA-006 | FR-PA-006 | AC-PA-006 | Submit the add modal with no selected member. | `구성원을 선택하세요.` appears and access row count is unchanged. |
| TS-PA-007 | FR-PA-007 | AC-PA-007 | Select an already-added member and submit. | `이미 이 프로젝트에 추가된 구성원입니다.` appears and duplicate access is not created. |
| TS-PA-008 | FR-PA-008 | AC-PA-008 | Select an existing member without current access, choose a role, and submit. | One local access row is added for `Study_Project`, the modal closes, and the row can be selected. |
| TS-PA-009 | FR-PA-009 | AC-PA-009 | Review Project Admin dependencies and rendered fields. | `Project`, `Member`, and `ProjectMemberAccess` remain separate and no company/auth/DB/API scope is required. |

## Automated Checks

- `npm test` should cover list structure, search filtering, required-name validation, successful create append, and cancel/close no-change behavior.
- `npm test` should cover Project Admin rendering, current project access rows, search, row selection, add modal, empty validation, duplicate validation, and valid add.
- `npm test` should cover Build shell rendering, selected sheets navigation, sheet metadata rows, search, view toggle affordance, and app entry from `Study_Project`.
- Future DUC automated checks should cover intake validation, conversion job normalization, DXF scan summary normalization, and JSON traceability artifact generation only after a DUC implementation gate.
- `npm run build` should pass before the baseline is considered stable.
- Browser automation or manual browser checks should record screenshot paths when UI behavior changes.

## Build Shell And Sheets List Scenarios

| Test ID | Requirement ID | Acceptance ID | Scenario | Expected result |
|---|---|---|---|---|
| TS-BS-001 | FR-BS-001 | AC-BS-001 | Open Build for `Study_Project` from the project list. | Build sheets view renders for the current project. |
| TS-BS-002 | FR-BS-002 | AC-BS-002 | Inspect the Build shell. | Header and left rail are visible with `시트` selected. |
| TS-BS-003 | FR-BS-003 | AC-BS-003 | Inspect the initial sheets table. | Six local mock sheet rows for `Study_Project` are visible. |
| TS-BS-004 | FR-BS-004 | AC-BS-004 | Inspect a sheet row. | Thumbnail, number/title, version chip, version set, discipline, tag, last updater, and row menu are present. |
| TS-BS-005 | FR-BS-005 | AC-BS-005 | Search by `A101`, by `mechanical`, then clear search. | Matching rows filter correctly and all current sheets return after clear. |
| TS-BS-006 | FR-BS-006 | AC-BS-006 | Toggle grid view and back to list view. | Selected affordance changes and functional sheet list remains usable. |
| TS-BS-007 | FR-BS-007 | AC-BS-007 | Inspect export, filter, row menu, and pagination affordances. | Controls are present and do not require backend/file export. |
| TS-BS-008 | FR-BS-008 | AC-BS-008 | Try the Build sheets slice without opening a viewer or upload flow. | No 2D viewer/upload/storage/compare/markup/issues workflow is required. |
| TS-BS-009 | FR-BS-009 | AC-BS-009 | Review dependencies and runtime requirements. | No auth, DB, API, Autodesk account, paid SDK, customer drawing, or deployment is required. |

## 2D Sheet Viewer First Slice Scenarios

| Test ID | Requirement ID | Acceptance ID | Scenario | Expected result |
|---|---|---|---|---|
| TS-SV-001 | FR-SV-001 | AC-SV-001 | Open a selected local sheet from the Build `시트` list. | Viewer shell renders for that selected sheet without external data. |
| TS-SV-002 | FR-SV-002 | AC-SV-002 | Inspect viewer header/context. | Project name, sheet number, and sheet title match the selected local sheet. |
| TS-SV-003 | FR-SV-003 | AC-SV-003 | Inspect central viewer surface. | Static local sheet render is visible and no customer drawing or parsed file is loaded. |
| TS-SV-004 | FR-SV-004 | AC-SV-004 | Select right-rail viewer tools. | Active affordance changes locally and no markup is persisted. |
| TS-SV-005 | FR-SV-005 | AC-SV-005 | Use bottom view controls. | Controls remain local affordances and do not claim real measurement/compare behavior. |
| TS-SV-006 | FR-SV-006 | AC-SV-006 | Switch between markup and issue panel tabs. | Selected empty panel appears without creating markup/issues. |
| TS-SV-007 | FR-SV-007 | AC-SV-007 | Use local sheet navigation context if implemented. | Selected local sheet context changes without upload/storage/sync. |
| TS-SV-008 | FR-SV-008 | AC-SV-008 | Review viewer data state. | `equipmentEntityId` / ontology slot is reserved locally only. |
| TS-SV-009 | FR-SV-009 | AC-SV-009 | Review dependencies and runtime requirements. | No real viewer engine, customer drawing, DB/API/TypeDB, Autodesk, paid SDK, auth/RBAC, or deployment is required. |

## DWG/DXF Upload Conversion Management Scenarios

| Test ID | Requirement ID | Acceptance ID | Scenario | Expected result |
|---|---|---|---|---|
| TS-DUC-001 | FR-DUC-001 | AC-DUC-001 | Review DUC intake queue design. | It supports selected local/reference DWG samples and does not require customer upload. |
| TS-DUC-002 | FR-DUC-002 | AC-DUC-002 | Review validation fields for representative DWG samples. | File type, size, discipline, xref/package availability, and eligibility are captured. |
| TS-DUC-003 | FR-DUC-003 | AC-DUC-003 | Review conversion job model against the local ODA experiment. | Job status, timestamps, converter identity, input/output counts, and messages are represented. |
| TS-DUC-004 | FR-DUC-004 | AC-DUC-004 | Review DXF scan model against `ezdxf` scan output. | Layouts, layers, blocks, entity counts, INSERT names, and text samples are supported. |
| TS-DUC-005 | FR-DUC-005 | AC-DUC-005 | Review sheet/viewable candidate logic for A03/A04 evidence. | Empty paperspace does not prevent modelspace/title/manual candidates. |
| TS-DUC-006 | FR-DUC-006 | AC-DUC-006 | Review render-risk handling after interrupted preview render. | Conversion/scanning can be successful while render remains risky or untested. |
| TS-DUC-007 | FR-DUC-007 | AC-DUC-007 | Review relation from DUC artifacts to Build `Sheet` and ACC #11 viewer. | Integration points are documented without expanding current SV scope. |
| TS-DUC-008 | FR-DUC-008 | AC-DUC-008 | Review future issue/memo/markup overlay plan. | Overlay slots are future-only and no persisted records are required now. |
| TS-DUC-009 | FR-DUC-009 | AC-DUC-009 | Review APS and Chrome DevTools research notes. | Research is useful for architecture/debugging, but real tokens/API calls remain gated. |
| TS-DUC-010 | FR-DUC-010 | AC-DUC-010 | Review JSON traceability/progress proposal. | JSON is a future automation artifact proposal and Markdown docs remain canonical. |

## Manual Browser Checks

- Compare UI against:
  - `reference/acc-screenshots/ScreenShot Tool -20260612102152.png`
  - `reference/acc-screenshots/Video Screen1781231401038.png`
  - `reference/acc-screenshots/ScreenShot Tool -20260612102437.png`
  - `reference/acc-screenshots/Video Screen1781227558018.png`
  - `reference/acc-screenshots/Video Screen1781231464329.png`
  - `reference/acc-screenshots/Video Screen1781231492911.png`
  - `reference/acc-screenshots/Video Screen1781231512247.png`
  - `reference/acc-screenshots/Video Screen1781231537335.png`
  - `reference/acc-screenshots/Video Screen1781231601337.png`
- Check desktop width.
- Check mobile width.
- Check Korean label/button fit.
- Check browser console during open, validation, create/add, duplicate validation, cancel, close, select, and search flows.

## Console Checks

- Browser console must show no errors for covered interactions.
- Network failures are not expected because this slice has no backend or external API.
