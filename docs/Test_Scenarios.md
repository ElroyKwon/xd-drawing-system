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
- `npm run build` should pass before the baseline is considered stable.
- Browser automation or manual browser checks should be recorded in `EVIDENCE.md` with screenshot paths when UI behavior changes.

## Manual Browser Checks

- Compare UI against:
  - `reference/acc-screenshots/ScreenShot Tool -20260612102152.png`
  - `reference/acc-screenshots/Video Screen1781231401038.png`
  - `reference/acc-screenshots/ScreenShot Tool -20260612102437.png`
  - `reference/acc-screenshots/Video Screen1781227558018.png`
- Check desktop width.
- Check mobile width.
- Check Korean label/button fit.
- Check browser console during open, validation, create/add, duplicate validation, cancel, close, select, and search flows.

## Console Checks

- Browser console must show no errors for covered interactions.
- Network failures are not expected because this slice has no backend or external API.
