# Autodesk Project Templates Research

Date: 2026-06-19

Scope: Project list entry, Hub meaning, project creation result, My Home direction, and project template behavior in Autodesk Construction Cloud / Forma Data Management. This is research only; no XD template product decision is made here.

## Source Links

- Autodesk Help, Create and Manage Projects: https://help.autodesk.com/view/DOCS/ENU/?guid=Create_Manage_Projects
- Autodesk Help, Create Project Templates: https://help.autodesk.com/view/DOCS/ENU/?guid=Templates_Create
- Autodesk Help, Manage Account Members: https://help.autodesk.com/view/DOCS/ENU/?guid=Manage_Account_Members
- Autodesk Construction Cloud blog, My Home personalized experience: https://www.autodesk.com/blogs/construction/acc-personalized-experience/

## Findings

- In Autodesk's project list, a project row is an entry point: clicking a project from the list opens that project.
- In the create-project flow, the project opens in Project Administration after creation, and the creator becomes the first project administrator.
- Hub means the organization's hub/account space, not the individual user's Autodesk account. Hub Admin manages hub-level projects, members, settings, templates, and related permissions.
- A template is a starting point with predefined settings. Autodesk treats project templates as hub-level assets that can be selected during project creation.
- Hub administrators can restrict whether project administrators may create projects and templates.
- Autodesk supports multiple template creation paths:
  - create a blank project template,
  - create a template from an existing project,
  - save a sample template to the hub and customize it,
  - save an existing project as a template from Project Admin settings.
- Sample templates are preconfigured for different firm types and project needs. Autodesk describes their contents as folder structures, form templates, issue settings, report templates, and related project setup.
- Only supported tools/features are copied into project templates. This means XD should not assume every project setting or data object belongs in templates.
- My Home is positioned as a user-centered, cross-project dashboard. It aggregates project/task context and should contain actionable entry points rather than a static product illustration.

## XD Mock Implications

- Project names in the project list must be visually and semantically clickable.
- The create-project action should open the new project's Project Admin context immediately.
- A new project must carry separate project-scoped data. In the current mock, this means its Project Admin access list starts with the creator only, and its Build sheet list starts empty.
- The UI label should clarify Hub as `허브(조직)` until the XD naming decision is finalized.
- Project templates are intentionally left undecided. The modal should not expose hardcoded Autodesk sample categories as if XD had selected them.
- Future template design should model templates as hub-level reusable setup artifacts with explicit supported scope, permissions, and copy rules.

## Open XD Decisions

- Korean product term for Hub: keep `허브(조직)` for now, or rename to an XD-native term such as `조직`, `워크스페이스`, or `운영 조직`.
- Whether XD templates should copy only UI/setup configuration, folder/sheet metadata, access roles, or operational/O&M data structures.
- Who can create, publish, and use XD templates.
- Whether templates are required for first MVP or remain an admin-only later slice.
