# Task ID

P5-009

## Goal

Create a no-network one-call readiness harness that proves the project can prepare exactly one future Toss read-only verification call without actually calling Toss.

## Assigned Engineer

Engineer 2

## Module

Toss read-only call approval, planning, and evidence scoping.

## Files To Modify Or Create

Primary files:

- `src/application/toss/read-only-verification-planner.ts`
- `src/application/toss/read-only-evidence-recorder.ts`
- `src/application/toss/read-only-evidence-intake.ts`
- `tests/application/toss-read-only-verification-planner.test.ts`
- `tests/application/toss-read-only-evidence-recorder.test.ts`
- `tests/application/toss-read-only-evidence-intake.test.ts`

Allowed supporting files:

- `docs/phase5/read-only-call-approval.example.json`
- `docs/phase5/toss-read-only-call-gate.md`
- `docs/phase5/local-toss-read-only-runbook.md`

Avoid editing endpoint catalog validation unless absolutely required.

## Required Reading

- `docs/11_AI_RULES.md`
- `docs/phase5/README.md`
- `docs/phase5/toss-read-only-call-gate.md`
- `docs/phase5/read-only-call-approval.example.json`
- `src/application/toss/read-only-verification-planner.ts`
- `src/application/toss/read-only-evidence-recorder.ts`
- `src/application/toss/read-only-evidence-intake.ts`

## Implementation Requirements

Add or refine a review-only flow that ties together:

- endpoint catalog entry
- local readiness
- sanitized approval record
- dry-run prepared request
- expected evidence kind
- evidence recorder approval scope

The harness must prove:

- zero network calls are performed
- exactly one read-only operation is scoped
- approval cannot be reused as an unbounded permission
- evidence kind must match approval expectation
- live broker writes remain blocked

If a new service/model is useful, keep it under `src/application/toss/` and make its safety type explicit.

## Forbidden

- Do not implement a real HTTP call.
- Do not call Toss API.
- Do not add write endpoints.
- Do not add API keys, tokens, account identifiers, raw request headers, or raw API responses.
- Do not change `.env`.
- Do not make call-gate approval enough to unlock live writes.

## Tests

Run:

```bash
npm run check
npm run phase5:toss:plan
npm run phase5:toss:call-gate
```

`phase5:toss:call-gate` may fail closed in default local state. That is acceptable only if `liveBrokerWriteAllowed` remains `false`.

## Completion Conditions

- One-call harness is review-only and no-network.
- Tests prove unbounded or write-looking approvals fail closed.
- `liveBrokerWriteAllowed: false` remains true in all reports.
- `npm run check` passes.

## Recommended Branch

`phase5/p5-009-read-only-one-call-harness`

