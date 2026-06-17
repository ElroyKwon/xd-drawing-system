# Human Approval Gate

Stop and ask before:

- Changing authentication or permission models
- Creating or changing database schema
- Deleting project data or reference data
- Introducing customer or confidential drawing files beyond copied local references
- Connecting to Autodesk cloud accounts or external APIs
- Adding paid SDKs such as ODA or Autodesk services
- Deploying outside the local development machine
- Replacing the current scope of "viewer + overlay" with a CAD editor scope
- Introducing real Project Admin auth/RBAC enforcement
- Creating Project Admin DB schema or API persistence
- Sending email invites or provisioning user accounts
- Adding company management or company data to the Project Admin member-access slice
- Deleting or revoking project access records

Decisions already accepted:

- Project folder name: `xd-drawing-system`
- Product family direction: XD system integration
- UI/UX source: saved ACC Build screenshots and local analysis documents
- Initial work: project setup and reference material copy only
- Initial setup slice implementation may use local mock data and local-only app scaffold.
- Project Admin member-access slice may use local mock `Project`, `Member`, and `ProjectMemberAccess` data only.
- Company information is excluded from the Project Admin member-access slice.
