# 003 - Build Shell And Sheets List

## Slice

`Build shell + Sheets list`

## Product Decision

The next product step enters the ACC-style Build module from the existing project list and renders the first drawing-facing screen: the sheets list. This slice proves the project-level shell and sheet metadata table before any 2D viewer, upload, file storage, or customer drawing workflow.

```text
Project
Sheet
  - projectId
  - number
  - title
  - versionSet
  - discipline
  - tags
  - lastUpdatedBy
```

## In Scope

- Local entry from `Study_Project` to the Build module.
- ACC Build-style top header and left rail.
- `시트` selected in the left rail.
- Local mock sheets for `Study_Project`.
- Sheet table with thumbnail, number, version chip, version set, discipline, tags, and last updater.
- Search by sheet number, title, discipline, or tag.
- List/grid view toggle affordance with table as the functional view.
- Export, filter, row menu, and pagination affordances only.

## Out Of Scope

- 2D viewer.
- Sheet upload, publish, version compare, and file storage.
- Markup, issues, forms, photos, files, and Bridge workflows.
- Real auth, RBAC, DB/API persistence, Autodesk API, paid SDK, customer drawing data, and deployment.

## References

- `reference/acc-screenshots/Video Screen1781231464329.png`
- `reference/acc-screenshots/Video Screen1781231492911.png`
- `reference/acc-analysis/_ACC-Build-화면분석-재현설계.md` sections `#8` and `#10`

## Verification

- `npm test`
- `npm run build`
- Browser desktop/narrow checks for Build shell, selected `시트` nav, sheets table, search, view toggle affordance, and console state when browser automation is available.
