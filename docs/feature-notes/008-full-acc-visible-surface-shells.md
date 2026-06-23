# 008 - Full ACC Visible Surface Shells

## Source Screens

- `reference/acc-screenshots/_ACC-Build-화면분석-재현설계.md`
- `reference/acc-screenshots/Video Screen1781231381430.png` through viewer/issue/markup/photo captures
- `reference/acc-analysis/_ACC-Build-화면분석-재현설계.md`

## User Goal

The site must stop feeling like a static picture. Screens visible in the saved ACC Build analysis should open as local UI shells so the Hub, Project Admin, Build workspace, and viewer levels are visibly separated and reviewable.

## In Scope

- Hub `My Home` dashboard areas: recent projects, assigned work, bookmarks, recent items.
- Hub `프로젝트 템플릿` screen with sample template cards and Hub template empty state.
- Project Admin side sections: `회사`, `브리지`, `액티비티`, `알림`, `위치`, `설정`.
- Build sections: `홈`, `시트`, `파일`, `이슈`, `양식`, `사진`, `구성원`, `브리지`, `설정`.
- Local issue-create modal affordance.
- Local path from a sheet row into a static 2D sheet viewer shell.
- Viewer shell with selected sheet context, static sheet surface, markup/issues tabs, right tool rail, bottom controls, compare button, and filmstrip.

## Out Of Scope

- Real template creation/publishing/copy rules.
- Real upload, file storage, issue persistence, issue deletion, markup persistence, sheet compare calculation, viewer engine adoption, drawing parsing, Autodesk/APS, DB/API, TypeDB wiring, auth/RBAC, customer drawings, deployment.
- Project Admin Task 6 browser validation PASS.

## Implementation Files

- `src/App.tsx`
- `src/App.test.tsx`
- `src/ProjectAdminView.tsx`
- `src/ProjectAdminView.test.tsx`
- `src/BuildSheetsView.tsx`
- `src/BuildSheetsView.test.tsx`
- `src/styles.css`

## Checks

- RED: focused tests failed for missing template screen, Project Admin section shells, Build section shells, issue modal, sheet viewer entry, and My Home bookmark/recent areas.
- GREEN: `npm test -- src/App.test.tsx src/ProjectAdminView.test.tsx src/BuildSheetsView.test.tsx`
- Full app: `npm test`
- Build: `npm run build`
- Browser: local URL `http://127.0.0.1:5174/`, with snapshots and screenshot evidence for representative screens.

## Evidence

- `docs/evidence/full-surface-my-home-2026-06-19.png`
- `docs/evidence/full-surface-project-templates-2026-06-19.png`
- `docs/evidence/full-surface-project-admin-settings-2026-06-19.png`
- `docs/evidence/full-surface-build-home-2026-06-19.png`
- `docs/evidence/full-surface-build-photos-2026-06-19.png`
- `docs/evidence/full-surface-viewer-2026-06-19.png`
