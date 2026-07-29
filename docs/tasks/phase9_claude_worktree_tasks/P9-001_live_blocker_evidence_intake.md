# P9-001 Live Blocker Evidence Intake

## Task ID

P9-001

## Goal

Create a machine-checkable, sanitized evidence intake model for
`LCB-001` through `LCB-008` without resolving any blocker on behalf of a
human.

## Assigned Engineer

Engineer 1

## Responsible Module

Live blocker evidence intake, human review records, compliance evidence
shape.

## Files To Modify Or Create

- `src/application/live-readiness/live-blocker-evidence-intake.ts`
- `src/application/live-readiness/index.ts`
- `tests/application/live-blocker-evidence-intake.test.ts`
- `docs/phase9/live-blocker-evidence-intake.md`
- optionally `docs/phase9/live-blocker-evidence-intake.example.json`

Avoid editing P9-002/P9-003 owned files unless coordination is required.

## Inputs

- `docs/phase7/live-capable-blocker-register.md`
- `docs/13_Compliance_and_Legal_Review.md`
- `docs/phase7/manual-live-approval-record.md`
- `docs/11_AI_RULES.md`

## Output

A pure validator/checker that accepts sanitized evidence summaries for:

- `LCB-001` Toss automated trading permission evidence
- `LCB-002` account permission/capability evidence
- `LCB-003` production credential/provisioning process evidence
- `LCB-004` human approval evidence
- `LCB-005` compliance/legal review evidence
- `LCB-006` operating-limit sign-off evidence
- `LCB-007` kill-switch/rollback live-context evidence
- `LCB-008` future write-adapter review evidence

Each record must require human reviewer fields, review date, evidence
source references, result/status, limitations, and prohibited-content
checks.

The validator may report a blocker as `READY_FOR_HUMAN_REVIEW` or
`HUMAN_REVIEWED`, but it must not automatically mark the canonical
blocker register as `RESOLVED`.

## Forbidden

- Do not ask for or print secrets, account numbers, raw broker payloads,
  or full contract text containing personal information.
- Do not read `.env` or `tmp/phase5`.
- Do not mark `docs/phase7/live-capable-blocker-register.md` entries as
  `RESOLVED`.
- Do not treat AI-generated text as human approval.
- Do not implement broker writes.

## Test Criteria

Run:

```bash
npx vitest run tests/application/live-blocker-evidence-intake.test.ts tests/config/redaction.test.ts
npm run check
```

## Completion Criteria

- Missing human reviewer fields fail closed.
- Secret-like/account-like payloads are rejected or redacted.
- Every `LCB-*` is represented.
- `npm run check` passes.

## Recommended Branch

`phase9/p9-001-live-blocker-evidence-intake`
