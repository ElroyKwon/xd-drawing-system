# 002 - Project Admin Member Access

## Slice

`Project Admin - 프로젝트 접근 구성원 관리`

## Product Decision

`Project` and `Member` are peer-level resources. Access is granted through `ProjectMemberAccess`.

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

## In Scope

- Current project context: `Study_Project`.
- Project Admin shell with `구성원` selected.
- Members with access to `Study_Project`.
- Search by member name or email.
- Row selection and right inspector.
- Add existing mock member modal.
- Role choices: `관리자`, `편집자`, `뷰어`.
- Duplicate project/member access validation.

## Out Of Scope

- Company information.
- New user creation.
- Email invite.
- Real auth/RBAC enforcement.
- DB/API persistence.
- Access deletion/revocation.
- Autodesk cloud/API.

## References

- `reference/acc-screenshots/ScreenShot Tool -20260612102437.png`
- `reference/acc-screenshots/Video Screen1781227558018.png`
- `reference/acc-analysis/_ACC-Build-화면분석-재현설계.md` sections `#2` and `#3`
- Current boundary is recorded in this note and the approval rules in `AGENTS.md`.

## Verification

- `npm test`
- `npm run build`
- Browser desktop/narrow checks for Project Admin table, inspector, add modal, validation, duplicate handling, and console errors.
