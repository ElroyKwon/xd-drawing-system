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

Decisions already accepted:

- Project folder name: `xd-drawing-system`
- Product family direction: XD system integration
- UI/UX source: saved ACC Build screenshots and local analysis documents
- Initial work: project setup and reference material copy only
- Initial setup slice implementation may use local mock data and local-only app scaffold.
