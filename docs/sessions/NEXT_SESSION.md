# Next Session

## Start Here

```powershell
cd "D:\_Project\xd-drawing-system"
codex
```

Read in order:

1. `AGENTS.md`
2. `README.md`
3. `SPEC.md`
4. `PLAN.md`
5. `CHECKS.md`
6. `HUMAN_GATE.md`
7. `reference/README.md`

## Immediate Resume - 2026-06-17 Update

Do not start the next product feature first. The stale planning-era document cleanup has been completed; resume by deciding the commit split for the current dirty baseline.

First actions:

1. Review the 2026-06-17 evidence section in `EVIDENCE.md`.
2. Confirm current diff and decide commit split:
   - product baseline: `package*.json`, config, `index.html`, `src/**`, product docs/evidence
   - local skill loop: `.agents/skills/**`, `.claude/skills/**`
   - ai-loop scaffold: `.ai-loop/README.md`, `.ai-loop/prompts/**`, `.ai-loop/state/**`, `scripts/ai-loop/**`, `.gitignore`
3. Re-run verification if more edits are made:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\ai-loop\test-ai-loop-hook.ps1
   npm test
   npm run build
   ```
4. Keep `.ai-loop` runtime requests/results/logs/locks out of commits. `.gitignore` now excludes those runtime artifacts; only scaffold files and `.gitkeep` placeholders should be considered.

Latest verification:

```text
Date: 2026-06-17
Commands:
  powershell -ExecutionPolicy Bypass -File .\scripts\ai-loop\test-ai-loop-hook.ps1
  npm test
  npm run build
Result:
  AI loop hook scaffold verification: PASS
  npm test: PASS, 1 test file / 6 tests passed
  npm run build: PASS, tsc && vite build completed
Not run:
  npm run dev -- --port 5173
  Browser desktop/mobile verification
```

AI terminal automation status:

- Codex does not currently have the same built-in hook behavior as Claude Code in this setup.
- The project uses an external PowerShell polling runner around `codex exec`.
- Continuous runner command for another AI terminal:
  ```powershell
  powershell -ExecutionPolicy Bypass -File .\scripts\ai-loop\run-next-ai-loop-request.ps1
  ```
- One-shot runner command:
  ```powershell
  powershell -ExecutionPolicy Bypass -File .\scripts\ai-loop\run-next-ai-loop-request.ps1 -Once
  ```
- Current runner mode is `review-only`; do not use it for implementation yet.
- `0003-baseline-review-ai-terminal` was processed, but its Korean result text is mojibake because it ran before UTF-8 hardening. Use the `EVIDENCE.md` summary rather than the raw result as the readable handoff.
- UTF-8 hardening has passed source-level scaffold checks, but a fresh real worker run after that hardening has not been executed yet.

## Current State

Project setup and the first implementation slice are complete.

Implemented slice:

- ACC #6 `프로젝트 목록`
- ACC #1 `프로젝트 작성 모달`

Current app baseline:

- Vite + React + TypeScript + Vitest scaffold exists.
- `src/App.tsx` implements a local mock project list and creation modal.
- `src/App.test.tsx` covers list structure, search, modal fields, required-name validation, valid create, cancel, and close no-change behavior.
- `docs/evidence/` contains desktop/mobile screenshot evidence, including the latest validator screenshots:
  - `docs/evidence/validator-current-desktop.png`
  - `docs/evidence/validator-current-mobile-list.png`
- No DB/API/Auth/Autodesk cloud/paid SDK/customer drawing/deployment/CAD editor work has been introduced.
- Latest validator-loop run recorded a non-blocking Chrome DevTools Issues note: form fields should have `id` or `name` attributes. Browser console errors were not observed.

User's long-term goal is not just to create a skill collection. The goal is to build and test a low-intervention AI development loop where one main orchestrator can drive sub-skills for design, planning gate, implementation, validation, evidence, and iteration.

Goal anchor:

```text
G:\내 드라이브\_Obsidian\지식관리\AI개발루프-스킬학습\_GOAL-ANCHOR.md
```

The project contains:

- ACC Build screenshots and screen analysis
- DKS drawing-management design documents
- Autodesk Cloud / APS research
- Cheongju FMS reference material
- Previous prototype documentation and data
- AI development loop templates and local skills

## Recommended Next Work

Start by checking the completed implementation evidence:

1. Run `git status --short`.
2. Read `PLAN.md`, `CHECKS.md`, `EVIDENCE.md`, and `docs/TRD.md`.
3. Run current verification:
   ```powershell
   npm test
   npm run build
   npm run dev -- --port 5173
   ```
4. Open `http://127.0.0.1:5173/` and confirm the initial setup slice still behaves as recorded.

Next feature should not start from code directly. Select one slice, then run the document loop again:

1. `development-loop-orchestrator`
2. `feature-docs-scaffold` if the next slice lacks current 7-core docs
3. `planning-gate`
4. implementation
5. `validator-loop`
6. `evidence-report`

Candidate next slices:

1. Project Admin member/company/role screens
2. Build shell and Sheets list

Optional cleanup before the next product slice:

1. Decide whether to address the non-blocking form field `id`/`name` accessibility issue as a small bugfix slice.
2. If yes, run the same document loop for that bugfix before changing implementation.

Latest automated status check:

```text
Date: 2026-06-16
Commands:
  git status --short
  npm test
  npm run build
Result:
  npm test: PASS, 1 test file / 6 tests passed
  npm run build: PASS, tsc && vite build completed
  git status: dirty/uncommitted implementation baseline remains after commit 054e754 Initial project baseline
Not run:
  npm run dev -- --port 5173
  Browser desktop/mobile verification
Evidence:
  EVIDENCE.md / Current Status Check - 2026-06-16
```

AI loop hook test scaffold:

```text
Date: 2026-06-16
Status:
  Test-scope .ai-loop file protocol exists.
  scripts/ai-loop/run-next-ai-loop-request.ps1 supports review-only requests.
  scripts/ai-loop/watch-ai-loop.ps1 remains as a compatibility wrapper.
  scripts/ai-loop/test-ai-loop-hook.ps1 verifies the scaffold.
Verified:
  AI loop hook scaffold verification: PASS
  Watcher dry-run: PASS, processed 0001-baseline-review
  Real worker runner mechanics: PASS, processed 0003-baseline-review-ai-terminal
  PowerShell parse check: PASS
  npm test: PASS, 1 test file / 6 tests passed
  npm run build: PASS, tsc && vite build completed
Continuous runner command for another AI terminal:
  powershell -ExecutionPolicy Bypass -File .\scripts\ai-loop\run-next-ai-loop-request.ps1
One-shot runner command:
  powershell -ExecutionPolicy Bypass -File .\scripts\ai-loop\run-next-ai-loop-request.ps1 -Once
Read result from:
  .ai-loop/results/0003-baseline-review-ai-terminal.result.md
Safety:
  Current mode is review-only. Do not treat this as full hook automation.
Compatibility note:
  run-next-ai-loop-request.ps1 no longer passes `-a never` to `codex exec`.
  It uses `codex exec -C <project> -s read-only -o <result> -` for local CLI compatibility.
  It prefers codex.cmd on Windows and uses Start-Process with redirected stdin/stdout/stderr.
Known limitation:
  The 0003 worker result was generated before UTF-8 hardening and its Korean text is garbled.
  The runner now sets UTF-8 environment variables, but a fresh real worker run after that change has not been executed yet.
```

Local skills now expected:

- `project-bootstrap`
- `feature-docs-scaffold`
- `planning-gate`
- `development-loop-orchestrator`
- `validator-loop`
- `evidence-report`
- `tag-alarm-review`

Local skill path status:

- `.agents/skills/<skill>/SKILL.md` and `.claude/skills/<skill>/SKILL.md` were refreshed from the AI loop package on 2026-06-15.
- Duplicate nested skill directories were removed.
- `planning-gate` now includes `SLICE-ONLY PASS` at the top-level local skill path.

## Last Verified

```text
Date: 2026-06-15
Commands:
  npm test
  npm run build
  npm run dev -- --port 5173
Result:
  PASS
Browser:
  Chrome DevTools MCP fallback used because Browser iab was unavailable.
  Desktop 1440x900 and mobile 390x844 checks passed.
  Browser console errors: none observed.
Evidence:
  EVIDENCE.md / Initial Setup Slice Implementation
  EVIDENCE.md / Validator Loop Evidence Refresh
  docs/evidence/validator-current-desktop.png
  docs/evidence/validator-current-mobile-list.png
Remaining risk:
  No new modal screenshot was created in the latest validator-loop run.
  Chrome DevTools Issues reported a non-blocking form field id/name accessibility issue.
```

## Key Product Boundary

This is not a CAD editor.

The first product direction is:

- project setup
- members/companies/roles
- sheets
- 2D viewer
- markup overlay
- issue pins and inspector
- future entity ID binding

## Human Gate

Before using real Autodesk accounts, paid SDKs, customer drawings, auth, permissions, DB schema, or deployment, stop and ask.
