# User Flow

## Primary Flow

1. `UF-IS-001` User opens the hub-level project list.
2. `UF-IS-002` User reviews existing local mock projects, table columns, default access, and pagination affordance.
3. `UF-IS-003` User enters a project name or project number in the search input.
4. `UF-IS-004` User clears the search and sees the full local mock list again.
5. `UF-IS-005` User clicks `+ 프로젝트 만들기`.
6. `UF-IS-006` System opens the centered `프로젝트 작성` modal over the list.
7. `UF-IS-008` User enters a project name and optional metadata.
8. `UF-IS-009` User clicks `프로젝트 작성`.
9. `UF-IS-010` System adds one local mock project to the list and closes the modal.

## Validation Flow

1. `UF-IS-005` User clicks `+ 프로젝트 만들기`.
2. `UF-IS-006` System opens the centered `프로젝트 작성` modal.
3. `UF-IS-007` User clicks `프로젝트 작성` while project name is empty.
4. System shows required-field validation, keeps the modal open, and does not add a project.
5. User enters a valid project name and submits again.
6. System follows `UF-IS-010`.

## Cancel / No-Change Flow

1. `UF-IS-005` User clicks `+ 프로젝트 만들기`.
2. `UF-IS-006` System opens the centered `프로젝트 작성` modal.
3. `UF-IS-012` User clicks `취소`.
4. System closes the modal and leaves the project list count unchanged.
5. User reopens the modal.
6. `UF-IS-013` User clicks the close button.
7. System closes the modal and leaves the project list count unchanged.

## Project Admin Member Access Flow

1. `UF-PA-001` User opens Project Admin member access for `Study_Project` from the project list.
2. `UF-PA-002` System shows Project Admin with `구성원` selected and the current `Study_Project` access rows.
3. `UF-PA-003` User searches by member name or email.
4. `UF-PA-004` User clears search and sees all current `Study_Project` access rows again.
5. `UF-PA-005` User selects a member row.
6. System updates the right inspector with the selected member's project-specific role and status.
7. `UF-PA-006` User clicks `구성원 추가`.
8. `UF-PA-007` System opens the add-existing-member modal.
9. `UF-PA-010` User selects a member without current access, chooses `관리자`, `편집자`, or `뷰어`, and submits.
10. `UF-PA-011` System adds one local `ProjectMemberAccess` row, closes the modal, and shows the new row in the table.

## Project Admin Validation Flow

1. `UF-PA-006` User clicks `구성원 추가`.
2. `UF-PA-007` System opens the add-existing-member modal.
3. `UF-PA-008` User submits without selecting a member.
4. System shows `구성원을 선택하세요.` and does not add access.
5. User selects an already-added member.
6. `UF-PA-009` User submits duplicate access for the same project/member pair.
7. System shows `이미 이 프로젝트에 추가된 구성원입니다.` and does not add access.
8. `UF-PA-012` User clicks `취소` or close.
9. System closes the modal without mutating access rows.

## Project Admin Requirement Mapping

| Requirement ID | User-flow coverage |
|---|---|
| FR-PA-001 | UF-PA-001, UF-PA-002 |
| FR-PA-002 | UF-PA-002 |
| FR-PA-003 | UF-PA-003, UF-PA-004 |
| FR-PA-004 | UF-PA-005 |
| FR-PA-005 | UF-PA-006, UF-PA-007 |
| FR-PA-006 | UF-PA-008 |
| FR-PA-007 | UF-PA-009 |
| FR-PA-008 | UF-PA-010, UF-PA-011 |
| FR-PA-009 | Out-of-scope flow list keeps company/auth/DB/API outside the Project Admin member-access flow. |

## Build Shell And Sheets List Flow

1. `UF-BS-001` User opens Build for `Study_Project` from the project list.
2. `UF-BS-002` System shows Build shell with project context and `시트` selected in the left rail.
3. `UF-BS-003` User searches sheets by number, title, discipline, or tag.
4. `UF-BS-004` User clears search and sees all current local mock sheets again.
5. `UF-BS-005` User toggles between list and grid view affordance.
6. System updates the selected view button while keeping the functional sheets list available.
7. `UF-BS-006` User reviews export, filter, row menu, and pagination affordances.
8. System does not mutate data or require backend/export services.
9. `UF-BS-007` User returns to the project list.

## Build Shell Requirement Mapping

| Requirement ID | User-flow coverage |
|---|---|
| FR-BS-001 | UF-BS-001, UF-BS-007 |
| FR-BS-002 | UF-BS-002 |
| FR-BS-003 | UF-BS-002 |
| FR-BS-004 | UF-BS-002 |
| FR-BS-005 | UF-BS-003, UF-BS-004 |
| FR-BS-006 | UF-BS-005 |
| FR-BS-007 | UF-BS-006 |
| FR-BS-008 | Out-of-scope flow list keeps viewer/upload/storage/compare/markup/issues outside this slice. |
| FR-BS-009 | Out-of-scope flow list keeps auth/DB/API/Autodesk/customer drawing/deployment outside this slice. |

## Out Of Scope Flows

- User does not log in.
- User does not manage company information or company records.
- User does not create new user accounts or send email invitations.
- User does not enforce real RBAC or edit a role/permission matrix.
- User does not manage templates beyond selecting a visible modal option.
- User does not open a 2D viewer, upload/publish sheets, compare versions, create markup, create issues, manage files, or manage photos.
- User does not upload, view, edit, or delete customer drawings.
- User does not sync with Autodesk cloud or any external API.
