---
name: development-loop-orchestrator
description: Use when coordinating a feature from project entry through docs, planning gate, implementation, validation, evidence, and handoff, especially when the user wants the current stage determined before choosing the next skill.
---

# Development Loop Orchestrator

## Purpose

Determine the current development-loop stage and route to the next required skill. This is not a background hook or automatic scheduler. It is a control skill for agent-led sessions.

## Stages

```text
0. Bootstrap
0.5 Scope interview
1. Feature docs
2. Planning gate
3. Implementation
4. Validation
4B. Blocker resolution
5. Evidence report
6. Handoff / next session
```

## Required Sub-Skills

Use these skills as needed:

- `project-bootstrap` for Stage 0
- `socratic-planning` for Stage 0.5
- `feature-docs-scaffold` for Stage 1
- `planning-gate` for Stage 2
- `validator-loop` for Stage 4
- `evidence-report` for Stage 5

## Stage Detection

Use targeted reads first. Do not run broad full-tree scans such as `rg --files` over the whole repository when the project has large `reference/`, archive, prototype, generated, or vendor folders. If file discovery is necessary, restrict it to the loop surface first:

```text
.
docs/
docs/sessions/
.agents/skills/
.claude/skills/
reference/README.md
reference/acc-analysis/
```

Read large reference trees only after a selected feature needs a specific source file. This keeps the orchestrator focused on stage detection instead of wasting context on unrelated reference material.

Read available files:

- `AGENTS.md`
- `README.md`
- `SPEC.md`
- `PLAN.md`
- `CHECKS.md`
- `EVIDENCE.md`
- `HUMAN_GATE.md`
- `docs/sessions/NEXT_SESSION.md`
- `docs/PRD.md`
- `docs/TRD.md`
- `docs/UI_Spec.md`
- `docs/Data_Model.md`
- `docs/Task_List.md`
- `docs/Acceptance_Criteria.md`
- `docs/Test_Scenarios.md`
- `.ai-loop/results/` recent result files when validation or worker-loop state is involved

Then decide:

| Condition | Stage | Next action |
|---|---:|---|
| Project instructions or loop files missing | 0 | Run `project-bootstrap` |
| Feature or MVP request exists but exact slice, exclusions, persistence, or verification route are unclear | 0.5 | Run `socratic-planning` |
| Feature selected but 7 core docs missing | 1 | Run `feature-docs-scaffold` |
| Docs exist but cross-links not verified | 2 | Run `planning-gate` |
| Gate result is `FAIL` | 1 or 2 | Fix docs; do not implement |
| Gate result is `SLICE-ONLY PASS` | 2 | Confirm boundary before implementation |
| Gate result is full `PASS` or user accepts slice boundary | 3 | Implementation may start |
| Implementation changed files but checks not recorded | 4 | Run `validator-loop` |
| Stage 4 validation has the same named evidence-path blocker in two consecutive attempts and no changed precondition | 4B | Draft or run a blocker-resolution request; do not rerun the same validation path |
| Evidence/handoff says PASS but plan checkboxes, task status, or next-session instructions still show the work open | 5 | Report `handoff cleanup needed`; do not treat as product failure |
| Verification evidence exists but no closeout | 5 | Run `evidence-report` |
| Closeout exists and next session is updated | 6 | Stop or ask for next feature |

## Rules

- Do not treat `SLICE-ONLY PASS` as a full document-loop pass.
- Do not start implementation if human approval gates are triggered.
- Do not skip validation because the change is small.
- Do not describe hook automation as complete unless hook scripts/config exist and were tested.
- Keep the next action to one stage. Do not bundle implementation and validation in the same instruction unless the user explicitly asks and the gate permits it.
- Keep product checks and evidence-path blockers separate. Passing `npm test` or build commands does not close validation when required browser, console, or screenshot evidence is blocked.
- If the same named blocker appears in two consecutive validation attempts for the same evidence path, require a changed precondition before another validation rerun. Without that change, route to Stage 4B blocker resolution.
- After implementation or validation, compare evidence/handoff against owned progress docs: plan checkboxes, task status rows, and next-session instructions. If they disagree, report cleanup separately from product correctness.
- Before commit-ready guidance, require either aligned progress docs or an explicit note that the plan is an original/static plan that should not be mutated.
- When dirty files span loop/protocol/skill, blocker handoff, product docs, product code/evidence, and runtime queue/log/result artifacts, group them instead of summarizing one undifferentiated dirty tree.

## Output

Use this format:

```text
Development Loop Stage:
Current evidence:
Blocking items:
Evidence-path blocker:
Progress-doc consistency:
Dirty-file grouping:
Recommended next skill:
Exact next prompt:
Can implementation start: yes/no/slice-only
Hook automation status:
```

## Hook Automation Status

Report one of:

- `none`: no hook or watcher exists
- `designed-only`: docs describe hook behavior but no executable exists
- `scripted`: hook/watcher script exists but not verified
- `verified`: hook/watcher script exists and has evidence in `EVIDENCE.md`

Default to `none` unless evidence proves otherwise.
