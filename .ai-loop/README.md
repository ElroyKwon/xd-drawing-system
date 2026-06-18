# AI Loop File Hook Protocol

This is a test-scope file based orchestration loop for `xd-drawing-system`.

## Current Modes

The runner supports explicit mode dispatch based on the request frontmatter `mode`.

### `review-only`

Sandbox: `read-only`

Allowed:

- Read project instructions and loop documents
- Run `git status`, `git diff`, `npm test`, and `npm run build`
- Produce a markdown result file

Blocked:

- File edits
- Formatting
- Commits
- Dependency installation
- External API calls
- Database, auth, permission, deployment, or paid SDK work

Prompt: `.ai-loop/prompts/baseline-review.md`

### `validation-evidence`

Sandbox: `workspace-write`

Allowed only when the request explicitly lists the checks and evidence paths:

- Read project instructions and loop documents
- Run verification commands listed in the request
- Run dev-server or browser checks listed in the request
- Create screenshot or verification artifacts listed in the request
- Update evidence and handoff files listed in the request

Blocked by default:

- Implementation code edits
- Formatting unrelated files
- Commits
- Dependency installation
- External API calls
- Database, auth, permission, deployment, or paid SDK work

If validation finds a blocking implementation bug, the worker reports `BLOCKED` and recommends a separate `implementation` request unless the request explicitly authorizes a scoped fix.

Repeated blocker preflight:

- Before rerunning a blocked evidence path, compare recent result files and handoff notes for the same target.
- If the same named blocker appears in two consecutive attempts and no changed precondition is documented, do not create another same-path validation request.
- The next request should resolve or change the blocked evidence path first.
- Automated test/build PASS does not close validation when required browser, console, or screenshot evidence is still blocked.

Prompt: `.ai-loop/prompts/validation-evidence.md`

### `implementation`

Sandbox: `workspace-write`

Allowed only when the request explicitly lists owned files, boundaries, and verification commands:

- TDD-driven code or document edits inside owned files
- Focused verification commands listed in the request
- Final result reporting

Blocked by default:

- Edits outside owned files
- Commits
- Dependency installation unless separately approved
- External API calls
- Database, auth, permission, deployment, or paid SDK work
- Customer or confidential drawing data

Prompt: `.ai-loop/prompts/implementation.md`

### Blocker-resolution requests

`blocker-resolution` is a request purpose, not a runner mode. Use one of the supported modes above based on the allowed work:

- Use `validation-evidence` only for an authorized availability re-test after a changed precondition is documented.
- Use `implementation` when the request owns loop scripts, prompt files, configuration, or other non-product files needed to restore the evidence path.
- Keep product `src/` edits blocked unless the request explicitly owns those files for a product fix.

For a repeated browser blocker, the request should name the failed layer, the intended automation path, the proof that the precondition changed, and the Task 6 validation request that should run after the path is restored.

### Progress-doc and dirty-file grouping

Implementation and validation workers must check progress-document consistency before commit-ready or handoff-ready claims:

- Compare evidence/handoff PASS claims with owned plan checkboxes, task status rows, and next-session instructions.
- If evidence is PASS but progress docs remain open, report `handoff cleanup needed`; do not call it product failure unless implementation or required evidence is missing.
- If the plan is intentionally an original/static execution plan, say so explicitly instead of silently leaving unchecked tasks.
- Group dirty files as loop/protocol/skill changes, blocker handoff changes, product docs changes, product code/evidence changes, and runtime queue/log/result artifacts.
- When shared handoff files contain multiple groups, recommend partial staging or separate commit groups.

Unknown modes fail before worker launch with a clear `Unsupported mode` error.

## Folder Contract

```text
.ai-loop/
  control/
    inbox/       request files created by the orchestrator
    outbox/      event files created after a worker result is available
    processed/   request files already picked up by the watcher
  workers/
    codex/
      inbox/     copied request files handed to Codex worker
      running/   currently running request snapshots
      results/   raw worker result markdown
      processed/ worker request snapshots after completion
  results/       human-facing result copies
  locks/         lock files to prevent duplicate processing
  state/         loop state metadata
  logs/          watcher and command logs
  prompts/       reusable worker prompt templates
```

## Request Naming

Only files matching this pattern are picked up:

```text
.ai-loop/control/inbox/*.request.md
```

Result files do not trigger another run. This prevents infinite loops.

## Running The Runner

One-shot dry run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\ai-loop\run-next-ai-loop-request.ps1 -Once -DryRun
```

One-shot real worker run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\ai-loop\run-next-ai-loop-request.ps1 -Once
```

Continuous polling:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\ai-loop\run-next-ai-loop-request.ps1
```

To keep this loop automatic, leave the continuous runner open in a dedicated AI terminal. The runner polls `control/inbox` and processes each new `*.request.md` file.

The runner prefers `codex.cmd` on Windows and calls `codex exec` with the sandbox configured for the request mode and `-o <result-file>`. It does not pass an approval-policy flag because some local `codex exec` versions do not support it. It also sets UTF-8 process environment variables before launching the worker because Korean output can otherwise be garbled on Windows consoles.

`scripts/ai-loop/watch-ai-loop.ps1` remains as a compatibility wrapper, but AI terminal instructions should use `run-next-ai-loop-request.ps1`.
