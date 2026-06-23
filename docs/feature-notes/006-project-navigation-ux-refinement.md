# Feature Note 006 - Project Navigation UX Refinement

Date: 2026-06-19

## Problem

The project hub mock was visually close to ACC but not functionally useful enough:

- `My Home` was an inert tab.
- Creating a project added a row but did not open the created project.
- Newly created projects reused the same-looking downstream content instead of proving separate project context.
- The project list did not clearly communicate where to click to enter a project.
- The `Hub` label was unclear in Korean.
- The create-project modal exposed hardcoded template choices before XD had made a template decision.

## Scope

- Make `My Home` an actionable local dashboard with project entry points.
- Make project names in the list clear project-entry buttons.
- After project creation, open the new project's Project Admin context.
- Keep Project Admin member access and Build sheets scoped to the selected project.
- Leave project templates undecided and display only a no-template placeholder.
- Add Autodesk project-template research without implementing XD template behavior.

## Acceptance Notes

- `Study_Project` still opens its existing Project Admin and Build sheet data.
- A newly created project opens Project Admin immediately and starts with only the creator as project administrator.
- The new project's Build sheet list is empty and does not show `Study_Project` sheets.
- `허브` is shown as `허브(조직)` to clarify current meaning.
- No real Autodesk API, DB/API/schema, auth/RBAC, deployment, paid SDK, customer drawing, or Project Admin Task 6 PASS change is introduced.

## Evidence

Historical evidence was recorded before the root evidence log was retired.
