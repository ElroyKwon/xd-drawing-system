# Design Map

## Source Evidence

| Evidence | Used for |
|---|---|
| `reference/acc-screenshots/ScreenShot Tool -20260612102152.png` | Project creation modal layout, labels, field order, required mark, footer buttons. |
| `reference/acc-screenshots/Video Screen1781231401038.png` | Project list screen, tab structure, create CTA, table columns, search/filter/settings/pagination. |
| `reference/acc-analysis/_ACC-Build-화면분석-재현설계.md` #1 | Modal field inventory and reproduction notes. |
| `reference/acc-analysis/_ACC-Build-화면분석-재현설계.md` #6 | Project list component inventory and reproduction notes. |
| `docs/feature-notes/001-initial-setup.md` | Slice boundary, user flow, local mock model. |
| `reference/acc-screenshots/ScreenShot Tool -20260612102437.png` | Project Admin member list, left rail, add-member action, and right inspector context. |
| `reference/acc-screenshots/Video Screen1781227558018.png` | Full member table view, search/filter/table structure. |
| `reference/acc-analysis/_ACC-Build-화면분석-재현설계.md` #2/#3 | Project Admin 구성원 screen inventory and table/inspector patterns. |
| `docs/feature-notes/002-project-admin-member-access.md` | Project Admin member access slice boundary and validation rules. |
| `docs/superpowers/specs/2026-06-17-project-admin-member-access-design.md` | Approved ProjectMemberAccess design and exclusions. |
| `reference/acc-screenshots/Video Screen1781231464329.png` | Build shell header, left rail navigation, quick link context, and project-level module framing. |
| `reference/acc-screenshots/Video Screen1781231492911.png` | Sheets list toolbar, columns, sheet row metadata, view toggle, row menu, and pagination. |
| `reference/acc-analysis/_ACC-Build-화면분석-재현설계.md` #8/#10 | Build home shell and sheets list reproduction notes. |
| `docs/feature-notes/003-build-shell-sheets-list.md` | Build shell and sheets list slice boundary and local-only exclusions. |
| `reference/acc-screenshots/Video Screen1781231512247.png` | ACC #11 viewer shell, right tool rail, bottom view controls, and central drawing area. |
| `reference/acc-screenshots/Video Screen1781231537335.png` | Viewer markup side panel empty state. |
| `reference/acc-screenshots/Video Screen1781231601337.png` | Viewer issues panel empty state. |
| `reference/acc-analysis/_ACC-Build-화면분석-재현설계.md` #11/#12/#13/#16/#17 | 2D viewer, markup/issues panel, and settings reproduction notes. |
| `docs/feature-notes/004-2d-sheet-viewer-first-slice.md` | Viewer first-slice boundary, local-only decision, and ontology data-slot reservation. |
| `HUMAN_GATE.md` | External integration and risky-change boundaries. |

## Feature To UI Map

| Requirement ID | UI element | User action |
|---|---|---|
| FR-IS-001 | Project tab, project table, default access cell, pagination | User reviews existing projects. |
| FR-IS-002 | Search input | User searches by project name or number and clears search. |
| FR-IS-003 | `+ 프로젝트 만들기` CTA, modal overlay | User opens project creation. |
| FR-IS-004 | Modal form fields | User enters optional project metadata. |
| FR-IS-005 | Project name field validation | User attempts empty submit. |
| FR-IS-006 | Primary `프로젝트 작성` button | User creates a local mock project. |
| FR-IS-007 | `취소` and close button | User dismisses without changes. |
| FR-IS-008 | Responsive list/modal layout | User uses the flow at desktop and mobile widths. |
| FR-IS-009 | Local-only runtime boundary | User completes flow without external accounts or services. |
| FR-PA-001 | Project Admin shell and `Study_Project` context | User enters Project Admin member access. |
| FR-PA-002 | Member access table | User reviews current project access members. |
| FR-PA-003 | Member search input | User filters by name or email and clears search. |
| FR-PA-004 | Table row and right inspector | User selects a member and reviews project-specific details. |
| FR-PA-005 | `구성원 추가` action and modal | User opens add-existing-member flow. |
| FR-PA-006 | Member selector validation | User attempts add without choosing a member. |
| FR-PA-007 | Duplicate project/member validation | User attempts to add a member already assigned to `Study_Project`. |
| FR-PA-008 | Existing member selector and role selector | User adds a valid member access row. |
| FR-PA-009 | Local mock Project/Member/ProjectMemberAccess model | User completes the flow without company/auth/DB/API dependencies. |
| FR-BS-001 | Build entry action from `Study_Project` | User opens Build sheets. |
| FR-BS-002 | Build header and left rail with `시트` selected | User confirms project module context. |
| FR-BS-003 | Sheets table | User reviews current project sheet rows. |
| FR-BS-004 | Sheet row metadata | User reads drawing number, title, version, discipline, tag, updater. |
| FR-BS-005 | Sheets search input | User filters by number/title/discipline/tag and clears search. |
| FR-BS-006 | List/grid toggle | User switches the selected view affordance. |
| FR-BS-007 | Export/filter/row menu/pagination affordances | User sees ACC-like list controls without data mutation. |
| FR-BS-008 | Local-only sheets list boundary | User does not open viewer/upload/storage/compare/markup/issues. |
| FR-BS-009 | Integration boundary | User completes the slice without auth/DB/API/Autodesk/customer drawing dependencies. |
| FR-SV-001 | Viewer shell entry from a sheet row | User opens a selected local sheet. |
| FR-SV-002 | Viewer header/context | User confirms selected sheet number/title and project context. |
| FR-SV-003 | Static sheet render surface | User sees a local drawing-like surface without real files. |
| FR-SV-004 | Right viewer tool rail | User selects local tool affordances. |
| FR-SV-005 | Bottom view controls | User sees pan/fit/zoom/fullscreen/compare/measure affordances. |
| FR-SV-006 | Left markup/issues panel | User switches empty panel tabs. |
| FR-SV-007 | Sheet navigation context | User stays oriented within the local sheet set. |
| FR-SV-008 | Equipment entity ID data slot | Future XD ontology binding point is reserved without integration. |
| FR-SV-009 | Viewer integration boundary | User completes the first viewer slice without real engine, customer drawing, DB/API, Autodesk, paid SDK, or deployment. |

## ACC To XD Adaptation

- ACC visual hierarchy is the benchmark; XD naming and product context can replace Autodesk brand details during implementation.
- Autodesk cross-sell products shown in ACC screenshots are not functional requirements for this slice.
- `Build` as default access may remain as a benchmark label in mock data until XD module naming is decided.
- Template selection is represented only as a modal field; template management remains out of scope.
- Company references in Project Admin are treated as excluded context only; company details and company management are not implemented in the ProjectMemberAccess slice.
- ACC Build shell and sheets list are reproduced as local UI and metadata only; real drawing files, viewer engines, upload/publish, and Autodesk-backed processing are excluded until a later approved slice.
- ACC 2D viewer is reproduced first as a local static viewer shell. The first slice reserves room for markup, issues, measurement, compare, and ontology binding but does not implement those workflows or adopt a real viewer engine.
