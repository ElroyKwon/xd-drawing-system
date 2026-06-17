# Project Admin Member Access Design

## Purpose

Implement the next product slice as `Project Admin - 프로젝트 접근 구성원 관리`.

The product model treats `Project` and `Member` as peer-level resources. A member gains access to a project through an explicit project-member access record. This avoids implying that a member belongs to only one project.

```text
Project
Member
ProjectMemberAccess
  - projectId
  - memberId
  - role
  - status
  - addedAt
```

## Scope

In scope:

- Show the current project context as `Study_Project`.
- Show a Project Admin shell with a left navigation rail.
- Show a table of members who currently have access to the selected project.
- Support searching the project-access member table by name or email.
- Select a member row and show a right inspector panel.
- Show role/status details in the inspector.
- Open a `구성원 추가` modal.
- In the modal, choose an existing mock member and a project role.
- Add that member to the selected project's access list.
- Prevent duplicate access records for the same project/member pair.

Out of scope:

- Company information and company management.
- New user account creation.
- Email invitation flow.
- Real authentication, authorization enforcement, or RBAC backend.
- Database/API persistence.
- Deleting members or revoking access.
- Project switching beyond showing `Study_Project` as the current project.
- Build module launch behavior and onboarding coach marks.

## Reference Basis

Primary ACC references:

- `reference/acc-screenshots/ScreenShot Tool -20260612102437.png`
- `reference/acc-screenshots/Video Screen1781227558018.png`
- `reference/acc-analysis/_ACC-Build-화면분석-재현설계.md` sections `#2` and `#3`.

Relevant local design references:

- `reference/dks-design-docs/도면관리시스템_상세설계/06_화면목업-재현계획/06-2_화면별-목업명세/06-2-1_계정허브.md`
- `reference/dks-design-docs/도면관리시스템_상세설계/04_백엔드-API-파이프라인/04-5_인증인가.md`
- `reference/dks-design-docs/도면관리시스템_상세설계/03_데이터설계-DBD/03-2_도메인스키마/README.md`

## User Experience

The user starts from the existing hub-level app and enters a Project Admin view for `Study_Project`.

The Project Admin view has:

- Top product/project context.
- Left rail items: `구성원`, `회사`, `브리지`, `액티비티`, `알림`, `위치`, `설정`.
- `구성원` is selected.
- Main heading: `구성원`.
- Primary action: `구성원 추가`.
- Table tools: `내보내기`, search input, filter affordance, column settings affordance.
- Table columns: `이름`, `이메일`, `전화`, `상태`, `역할`, `추가된 일시`.
- Right inspector for the selected access record.

The right inspector shows member identity and project-specific access details:

- Name.
- Email.
- Phone.
- Status.
- Role select/display.

Company fields are intentionally omitted from this slice.

## Data Model

Use local mock state only.

```ts
type Project = {
  id: string;
  name: string;
};

type Member = {
  id: string;
  name: string;
  email: string;
  phone: string;
};

type ProjectMemberAccess = {
  projectId: string;
  memberId: string;
  role: "관리자" | "편집자" | "뷰어";
  status: "활성" | "대기";
  addedAt: string;
};
```

Derived UI rows join `ProjectMemberAccess` to `Member` by `memberId`.

Duplicate rule:

- A member can appear in many projects.
- A member cannot be added twice to the same project.

## Interaction Details

### Search

Search filters current project's access rows by member name or email. Clearing search restores all current project access rows.

### Row Selection

Selecting a row changes the right inspector to that member's project access details.

If search hides the selected row, the inspector keeps showing the last selected member until the user selects another visible row. This avoids inspector content jumping while the user types.

### Add Existing Member Modal

The modal contains:

- Existing member selector.
- Role selector.
- Cancel button.
- Add button.

Behavior:

- Add is blocked if no member is selected.
- Add is blocked if the selected member already has access to `Study_Project`.
- Valid add creates one local `ProjectMemberAccess` row and closes the modal.
- Newly added access row appears in the table and can be selected.

## Error Handling

Local validation messages:

- No member selected: `구성원을 선택하세요.`
- Duplicate access: `이미 이 프로젝트에 추가된 구성원입니다.`

No network or server error state is required because this slice has no backend.

## Testing

Automated tests should cover:

- Project Admin view renders with selected `구성원` nav item.
- Current project context is visible.
- Table shows only members with access to `Study_Project`.
- Search filters by name and email and restores all rows when cleared.
- Row selection updates the right inspector.
- `구성원 추가` opens the modal.
- Empty submit shows validation and does not add a row.
- Duplicate member submit shows validation and does not add a row.
- Valid existing member + role submit adds one access row and closes the modal.

Manual/browser checks should cover:

- Desktop layout: left rail, table, inspector fit without overlap.
- Mobile or narrow layout: table remains scrollable and inspector/modal remain usable.
- Korean labels fit inside buttons and table headers.
- Browser console has no errors during search, select, add, duplicate validation, cancel, and close.

## Human Gate

This slice must stop for confirmation before:

- Real authentication or authorization enforcement.
- DB schema creation or migration.
- API persistence.
- Email invite or account provisioning.
- Company management.
- Deleting project access.
- Any Autodesk cloud/API integration.

## Acceptance

This design is ready for feature docs and planning gate when:

- The feature is scoped to project-member access records, not company management.
- The data model keeps `Project`, `Member`, and `ProjectMemberAccess` separate.
- All behavior remains local mock state only.
- Duplicate project/member access is explicitly handled.
- Company information is excluded.
