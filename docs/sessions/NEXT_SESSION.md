# Next Session

## Start Here

```powershell
cd "D:\_Project\xd-drawing-system"
codex
```

Read in order:

1. `AGENTS.md`
2. `docs/sessions/NEXT_SESSION.md`
3. `docs/superpowers/specs/2026-06-17-project-admin-member-access-design.md`
4. `docs/superpowers/plans/2026-06-17-project-admin-member-access.md`
5. `EVIDENCE.md`
6. `PLAN.md`
7. `CHECKS.md`
8. `HUMAN_GATE.md`

## Immediate Resume - 2026-06-17 Closeout

Current repository state at this handoff:

- Branch: `master`
- Latest committed HEAD before this closeout update: `85dd1cc docs: plan project admin member access implementation`
- First product slice is implemented, verified, and committed.
- Review-only `.ai-loop` runner scaffold is committed.
- Project Admin member-access design spec is committed at `e47e8a8`.
- Project Admin member-access implementation plan is committed at `85dd1cc`.
- No Project Admin implementation code has started yet.

The next session should start from the Project Admin member-access plan, not from a new feature choice.

First actions:

1. Run `git status --short --untracked-files=all`.
2. Read the design spec and implementation plan listed above.
3. Execute Task 0 from `docs/superpowers/plans/2026-06-17-project-admin-member-access.md`.
4. Do not write Project Admin implementation code before the feature docs and planning gate updates are complete.
5. Keep visual/HTML viewer work text-only unless the user explicitly asks for an HTML viewer.

Product decision carried forward:

- `Project` and `Member` are peer resources.
- A project admin grants a member project-specific access.
- One member can belong to multiple projects with different roles.
- Company information is excluded from this slice.
- The relationship model is `ProjectMemberAccess`.

Implementation-plan clarification:

- For the add-existing-member modal, prefer showing all mock members and validating duplicate access on submit.
- This preserves the duplicate-validation behavior required by the plan and avoids hiding the test path behind disabled options.

Verification to rerun after Task 0 or any code/docs changes:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\ai-loop\test-ai-loop-hook.ps1
npm test
npm run build
```

Browser/dev-server verification is not current for Project Admin because implementation has not started.

## Current Product Baseline

Implemented slice:

- ACC #6 project list
- ACC #1 project creation modal

Current app baseline:

- Vite + React + TypeScript + Vitest app scaffold exists.
- `src/App.tsx` implements a local mock project list and creation modal.
- `src/App.test.tsx` covers list structure, search, modal fields, required-name validation, valid create, cancel, and close no-change behavior.
- Local mock data is not persistent.
- Filter/settings/pagination are layout affordances only in the first slice.
- No DB/API/Auth/Autodesk cloud/paid SDK/customer drawing/deployment/CAD editor work has been introduced.

## AI Loop Runner Boundary

- The current `.ai-loop` runner is review-only.
- It is an external PowerShell runner around `codex exec`; it is not a full automatic development loop.
- Keep `.ai-loop` runtime requests/results/logs/locks out of commits.

One-shot runner command:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\ai-loop\run-next-ai-loop-request.ps1 -Once
```

## Human Gate

Before using real Autodesk accounts, paid SDKs, customer drawings, auth, permissions, DB schema, deployment, or destructive data changes, stop and ask.
