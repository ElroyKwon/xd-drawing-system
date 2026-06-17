---
name: socratic-planning
description: Use when a feature, MVP, UI screen, product slice, project start, or implementation request is vague, too broad, missing scope choices, or would otherwise move into docs or coding before the user has selected a concrete slice.
---

# Socratic Planning

## Purpose

Turn an unclear feature idea into a selected, testable implementation slice before design documents or code are created.

This skill fills the gap before `feature-docs-scaffold`: it helps the user choose the scope, exclusions, persistence boundary, and verification route. It is not a document generator and it is not an implementation skill.

## When to Use

Use this skill when any of these are true:

- the user asks to build, plan, create, or start a feature but the exact slice is not selected
- the request could expand into multiple screens, modules, users, or workflows
- storage, authentication, external APIs, browser testing, or completion criteria are unclear
- the agent is about to create PRD/TRD/UI/Data/Task/Test documents from a vague idea
- `development-loop-orchestrator` cannot decide whether the next step is docs, gate, implementation, validation, or review

Do not use this skill when the user has already selected a concrete feature or slice and explicitly asks for the document set. In that case, use `feature-docs-scaffold`.

## Hard Boundaries

- Do not write app code.
- Do not scaffold a project.
- Do not create the 7 core feature documents until the user chooses a scope.
- Do not ask an open-ended list of many questions at once.
- Do not treat your recommended option as accepted until the user confirms it.

## Interview Flow

1. Restate the goal in one short sentence.
2. Identify what is still unknown:
   - target user
   - first workflow
   - in-scope features
   - out-of-scope features
   - persistence/storage boundary
   - verification method
   - browser/E2E need
   - human approval gates
3. Offer 2-3 scope candidates.
4. For each candidate, state:
   - what it includes
   - what it excludes
   - why it is useful
   - verification difficulty: low, medium, or high
   - likely next skill
5. Recommend one candidate and explain the reason.
6. Ask the user to choose one candidate before continuing.
7. After the user chooses, produce a planning handoff for `feature-docs-scaffold`.

## Scope Candidate Pattern

Prefer small, inspectable slices. A good candidate can be documented, implemented, and verified without guessing.

Use this format:

```text
Option A - [smallest useful slice]
Includes:
Excludes:
Verification:
Risk:

Option B - [broader slice]
Includes:
Excludes:
Verification:
Risk:

Option C - [integration-heavy slice]
Includes:
Excludes:
Verification:
Risk:

Recommendation:
Question:
```

If the user wants speed, still present at least two choices. The smallest option can be the default recommendation.

## Planning Handoff

After the user selects a scope, output exactly this block:

```text
Socratic Planning Result: READY_FOR_DOCS / NEEDS_USER_CHOICE

Selected feature:
Goal:
Target user:
In scope:
Out of scope:
Persistence boundary:
Verification route:
Browser/E2E required:
Human approval gates:
Source evidence to read:
Recommended next skill:
Exact next prompt:
```

Use `READY_FOR_DOCS` only after the user has selected or clearly accepted a scope.

Use `NEEDS_USER_CHOICE` when the user has not selected a scope. In that case, do not tell the next agent to create docs yet.

## Routing

- If scope is selected and feature docs are missing, route to `feature-docs-scaffold`.
- If docs exist but cross-links are unverified, route to `planning-gate`.
- If implementation already happened but checks are missing, route to `validator-loop`.
- If verification exists but handoff is missing, route to `evidence-report`.

## Common Mistakes

| Mistake | Correction |
|---|---|
| Creating PRD/TRD immediately from a vague idea | Present 2-3 scope candidates first |
| Asking many open questions without options | Give concrete choices and trade-offs |
| Letting the recommended option silently become the plan | Ask the user to choose |
| Treating browser/E2E as implicit | State whether it is required |
| Expanding MVP into full product planning | Keep the first slice small and verifiable |

## Rule

The next step after this skill is usually `feature-docs-scaffold`, but only after the user has chosen a concrete scope.
