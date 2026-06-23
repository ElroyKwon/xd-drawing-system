# Feature Note 007 - Hub / Project / Build Shell Separation

Date: 2026-06-19

## Problem

The previous mock switched between Hub, Project Admin, and Build views, but the user-facing information architecture still felt mixed:

- Hub-level project administration and project-level administration reused similar visual framing.
- `기본 액세스 Build` was unclear.
- Hub organization settings had no screen.
- Project Admin and Build did not explicitly show that the user had left the Hub level and entered a selected project context.

## Scope

- Keep Hub-level tabs only in the Hub shell.
- Add a Hub-level `허브 설정` tab and settings screen.
- Rename project-list `기본 액세스` to `기본 앱`.
- Mark Project Admin as `Project 레벨`.
- Mark Build as `Project 작업 레벨`.
- Keep Project Admin and Build separate from Hub tabs and `Hub Admin` framing.

## Acceptance Notes

- Hub-level screens show `Hub Admin`, `My Home`, `프로젝트`, `프로젝트 템플릿`, and `허브 설정`.
- `허브 설정` shows organization information, project creation authority, template authority, and the default app.
- Project Admin shows selected project context with `Project 레벨` and `프로젝트 관리`.
- Build shows selected project context with `Project 작업 레벨` and `프로젝트 작업`.
- Project Admin / Build screens do not show Hub tabs.
- No DB/API/Auth/RBAC, Autodesk API, deployment, customer drawing, template product-scope implementation, or Project Admin Task 6 PASS change is introduced.

## Evidence

Historical evidence was recorded before the root evidence log was retired.
