---
name: evidence-report
description: Use for final reports, handoffs, session closeout, PR summaries, or completion claims where implementation evidence, checks, risks, and human approval items must be summarized clearly.
---

# Evidence Report

## Purpose

Produce a concise, evidence-based closeout that separates completed work from unverified claims.

## Inputs

Read:

- `EVIDENCE.md`
- `CHECKS.md`
- `PLAN.md`
- `HUMAN_GATE.md`
- recent `.ai-loop/results/` files when worker validation was used
- git diff or changed files when available

## Report Format

```text
Result:
Changed files:
Implemented items:
Product check status:
Evidence-path status:
Progress-doc consistency:
Dirty-file grouping:
Commit/staging guidance:
Verification evidence:
Not run / unavailable checks:
Known risks:
Human approval items:
Next recommended step:
```

## Rules

- Do not hide failed checks.
- Do not describe unchecked work as complete.
- Do not describe a validation as complete when automated checks pass but required browser, console, screenshot, account, or external-tool evidence is missing.
- Do not describe work as commit-ready or handoff-ready while owned plan checkboxes, task status rows, or next-session instructions still contradict the evidence. Report `handoff cleanup needed` instead.
- Dirty files must be grouped at least as: loop/protocol/skill changes, blocker handoff changes, product docs changes, product code/evidence changes, and runtime queue/log/result artifacts.
- If shared handoff files such as `EVIDENCE.md` or `docs/sessions/NEXT_SESSION.md` contain multiple work groups, recommend partial staging or separate commit groups.
- Separate worker self-report from orchestrator provenance. A worker can report its local commands and blockers; runner real-run provenance requires runner/log/result/outbox/processed artifacts.
- Treat old screenshots and logs as historical unless the request explicitly labels them as reused evidence.
- Keep the report short enough to act on.
- If evidence is missing, say exactly what is missing.
