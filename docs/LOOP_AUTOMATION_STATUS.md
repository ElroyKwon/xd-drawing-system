# Loop Automation Status

## Current Status

Codex-native hook automation is not implemented.

The project now has a test-scope file-based runner that can emulate a hook by polling `.ai-loop/control/inbox/*.request.md`. This is external PowerShell automation around `codex exec`, not a built-in Codex CLI hook system.

The current project supports a skill-driven manual or agent-led loop:

```text
development-loop-orchestrator
  -> project-bootstrap
  -> feature-docs-scaffold
  -> planning-gate
  -> implementation
  -> validator-loop
  -> evidence-report
```

## What Exists

- Local skills under `.agents/skills`
- Local skills under `.claude/skills`
- Loop documents in the project root
- Next-session handoff in `docs/sessions/NEXT_SESSION.md`
- Initial setup slice feature note
- Test-scope `.ai-loop/` file protocol scaffold
- Test-scope `scripts/ai-loop/run-next-ai-loop-request.ps1` runner for `review-only` requests
- Compatibility wrapper at `scripts/ai-loop/watch-ai-loop.ps1`
- One real review-only Codex worker run processed through the runner: `0003-baseline-review-ai-terminal`

## What Does Not Exist Yet

- Warp pane automation script
- Codex/Claude auto-launch script
- Codex-native hook events equivalent to Claude Code hooks
- General-purpose file watcher beyond the current `review-only` polling runner
- Hook that automatically runs planning gate after document changes
- Hook that automatically runs validation after implementation

## Dependency Check

The machine has command-line entries for:

- `warp`
- `codex`
- `claude`
- `node`
- `npm`
- `git`

These commands make automation possible, but automation is not complete until scripts are written and verified.

## Next Automation Step

To run the current test-scope automation continuously in an AI terminal:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\ai-loop\run-next-ai-loop-request.ps1
```

After the manual skill loop is proven on the initial setup slice, create a separate automation design for:

1. Warp terminal layout
2. Codex/Claude launch commands
3. File-change watcher
4. Gate result parser
5. Evidence recorder

Do not call the loop "complete" until `review-only` worker results are readable, reviewed, and later modes have tested scripts plus `EVIDENCE.md` results.

## Runner Compatibility Note

`scripts/ai-loop/run-next-ai-loop-request.ps1` intentionally avoids `codex exec -a/--ask-for-approval`.

Some local Codex CLI versions reject that flag for `codex exec`. The current runner relies on `-s read-only` plus prompt/mode policy for the first review-only worker.

The runner also prefers `codex.cmd` on Windows, uses `Start-Process` instead of piping directly into a native command, and sets UTF-8 environment variables before launching the worker. The first real worker run completed mechanically, but its Korean result text was garbled before the UTF-8 hardening was added.
