---
name: validator-loop
description: Use when work is claimed to be done, before final reports, before PRs, after implementation, or when tests/build/browser behavior must prove completion with repeatable evidence.
---

# Validator Loop

## Purpose

Verify completed work with evidence instead of accepting an agent's completion claim.

## Required Inputs

Read available files:

- `SPEC.md`
- `PLAN.md`
- `CHECKS.md`
- `EVIDENCE.md`
- `HUMAN_GATE.md`
- recent `.ai-loop/results/` files when validation is running through the worker loop
- project test files
- package scripts

## Verification Loop

0. Before rerunning a blocked evidence path, compare recent validation results for the same target.
   - If the same named blocker appears in two consecutive attempts and no changed precondition is documented, do not rerun the same checks.
   - Report `Validation Result: BLOCKED`, name the blocker, and set the next action to a blocker-resolution request.
1. Identify required commands from `CHECKS.md` or project scripts.
2. Run or request the smallest relevant checks first.
3. If a check fails, record:
   - failure item
   - command
   - reproduction
   - expected behavior
   - actual behavior
   - likely owner
   - next verification command
4. Do not mark complete while any required check fails.
5. Compare passing evidence with owned progress docs and handoff files.
   - If plan checkboxes, task status rows, or next-session instructions still show the work open, report `handoff cleanup needed`.
   - Do not turn progress-doc mismatch into product `FAIL` unless the required implementation or evidence is actually missing.
6. Update `EVIDENCE.md` with results when owned by the request.

## Classification Rules

- Use `PASS` only when every required command and required evidence path has fresh evidence.
- Use `FAIL` for product or implementation behavior that ran and did not meet requirements.
- Use `BLOCKED` when a required evidence path cannot run because of browser/devtools automation, account access, dependency policy, human approval, or environment limits.
- If automated tests/build pass but browser evidence is required and unavailable, report `BLOCKED`, not `PASS`.
- Existing screenshots or prior logs are historical evidence unless the request explicitly authorizes reuse and labels them as reused.
- Use `handoff cleanup needed` when product checks and evidence pass but owned progress docs/checklists/task statuses do not match the completed state.

## Output

```text
Validation Result: PASS/FAIL/BLOCKED

Commands run:
Passing checks:
Failing checks:
Manual scenarios:
Progress-doc consistency:
Evidence updated:
Remaining risks:
Human approval items:
Next action:
```

## Rule

The phrase "looks good" is not evidence. Use commands, screenshots, browser checks, or documented manual scenarios.
