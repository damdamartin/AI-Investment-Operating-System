# Task ID

P5-006

## Goal

Strengthen Phase 5 regression coverage so safety gates prove no network calls or live broker writes are enabled by local preparation commands.

## Module

Phase 5 scripts, tests, and safety regression harness.

## Files To Modify Or Create

- `tests/scripts/*phase5*`
- `tests/scripts/*toss*`
- `tests/safety/safety-regression.test.ts`
- optionally `scripts/phase5-toss-doctor.mjs`
- optionally `docs/phase5/phase5-toss-completion-checklist.md`

## Input

- `docs/phase5/README.md`
- `docs/phase5/phase5-toss-completion-checklist.md`
- `docs/phase5/toss-read-only-call-gate.md`
- existing Phase 5 script tests

## Output

Regression tests that confirm:

- preflight performs no network calls
- doctor performs no network calls
- completion performs no network calls
- call gate fails closed by default
- explicit approval still does not permit live broker writes
- secret-looking values are rejected or masked

## Forbidden

- Do not perform live API calls in tests.
- Do not add real credentials to fixtures.
- Do not weaken current failure defaults.
- Do not implement Toss write operations.

## Test Criteria

Run:

```bash
npm run check
npm run phase5:toss:doctor
npm run phase5:toss:completion
```

`phase5:toss:completion` may fail closed if local readiness is incomplete; that is acceptable if the failure report still shows `liveBrokerWriteAllowed: false` and `networkCallsPerformed: false`.

## Completion Conditions

- `npm run check` passes.
- Safety regression tests cover Phase 5 no-network/no-write behavior.
- Documentation states that completion is read-only readiness only.

## Recommended Branch

`phase5/p5-006-phase5-regression`

