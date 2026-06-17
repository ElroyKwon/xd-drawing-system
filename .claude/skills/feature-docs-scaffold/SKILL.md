---
name: feature-docs-scaffold
description: Use when starting a new feature, product slice, UI screen, MVP scope, or implementation plan before coding, especially when PRD, TRD, UI specs, user flows, data models, task lists, acceptance criteria, or test scenarios are missing or unclear.
---

# Feature Docs Scaffold

## Purpose

Create the design-document set required for a real development loop before implementation starts.

This skill exists because a feature note alone is too easy to treat as a complete plan. For durable work, requirements, UI, data, tasks, acceptance criteria, and tests must be separate enough to cross-check.

## Required Documents

Create or update these 7 core documents for the selected feature:

```text
docs/PRD.md
docs/TRD.md
docs/UI_Spec.md
docs/Data_Model.md
docs/Task_List.md
docs/Acceptance_Criteria.md
docs/Test_Scenarios.md
```

Recommended additions when the feature has visible UI or multi-step workflow:

```text
docs/Design_Map.md
docs/User_Flow.md
docs/Planning_Gate_Checklist.md
```

## Interaction Boundary

If the user has already selected the feature or slice and explicitly asks to create the feature-document set, do not restart a separate brainstorming approval loop before writing these documents. Treat the selected slice, existing project docs, and source evidence as the approved planning input.

If the feature or slice is not selected, or if exclusions, persistence boundary, verification route, or browser/E2E needs are unclear, do not create the document set yet. Ask for `socratic-planning` first so the user chooses a concrete scope.

This skill may create planning documents, but it must not scaffold app code, install packages, implement UI, or change runtime behavior. If another skill asks for brainstorming before implementation, apply it after the document scaffold only when the next action would change product behavior or code.

Record any conflict between this document-scaffold flow and a broader brainstorming workflow as a skill-improvement note instead of blocking the requested document pass.

## Steps

1. Identify the feature or slice name.
2. Read project instructions and current scope documents:
   - `AGENTS.md`
   - `SPEC.md`
   - `PLAN.md`
   - `CHECKS.md`
   - `HUMAN_GATE.md`
3. Read feature evidence:
   - screenshot analysis
   - existing feature notes
   - source requirements
   - reference docs
4. Create missing documents from the Required Documents list.
5. Add only the selected feature scope. Do not describe future features as if they are in scope.
6. Add cross-links:
   - every PRD feature -> at least one task
   - every PRD feature -> at least one acceptance criterion
   - every PRD feature -> at least one test scenario
   - every visible UI action -> at least one user-flow step when `User_Flow.md` exists
   - every data field used by UI -> `Data_Model.md`
7. Record out-of-scope decisions and human approval gates.
8. Stop before implementation. Run or request `planning-gate` next.

## Document Minimums

### PRD.md

Include:

- Feature goal
- Users
- In scope
- Out of scope
- Functional requirements with stable IDs, for example `FR-001`
- Source evidence

### TRD.md

Include:

- Technical approach
- Frontend/backend boundary
- Persistence model
- External dependencies
- Explicit non-use of APIs, SDKs, or databases when out of scope

### UI_Spec.md

Include:

- Screens
- Components
- Fields
- Buttons/actions
- Validation states
- Empty/loading/error states
- Responsive requirements

### Data_Model.md

Include:

- Local data types or database entities
- Required fields
- Create/read/update/delete/undo expectations
- Persistence and mock-data boundary

### Task_List.md

Include:

- Task IDs, for example `T-001`
- One implementation unit per task
- Linked requirement IDs
- Verification notes

### Acceptance_Criteria.md

Include:

- Pass/fail criteria with IDs, for example `AC-001`
- Linked requirement IDs
- No vague wording such as "works well" or "looks good"

### Test_Scenarios.md

Include:

- Manual and automated checks
- Browser scenarios when UI is involved
- Console/error checks
- Linked requirement and acceptance IDs

## Thin Slice Exception

A very small experiment may use fewer documents only if all of these are true:

- the user explicitly accepts a thin slice
- the feature has no persistence beyond local mock data
- no authentication, authorization, database, external API, paid SDK, customer data, or deployment is involved
- the missing document names and replacement locations are listed
- the gate result is labeled `SLICE-ONLY PASS`, not normal `PASS`

## Output

Use this format:

```text
Feature Docs Scaffold Result: COMPLETE/INCOMPLETE

Feature:
Documents created:
Documents updated:
Documents intentionally omitted:
Omission rationale:
Requirement IDs:
Task IDs:
Acceptance IDs:
Test scenario IDs:
Human approval items:
Next action:
```

## Rule

Do not start implementation from this skill. The next step is `planning-gate`.
