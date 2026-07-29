# Task ID

P6-007

## Goal

Define scheduler-safe Phase 6 jobs and operator runbooks for paper/simulation monitoring without enabling live broker operations.

## Assigned Engineer

Engineer 3

## Module

Scheduler, incident runbooks, and operator checklists.

## Files To Modify Or Create

Primary files:

- `src/application/scheduler/scheduler-job-runner.ts`
- `tests/application/scheduler-job-runner.test.ts`
- `src/application/incident-runbooks/incident-runbook-review.ts`
- `tests/application/incident-runbook-review.test.ts`
- `docs/phase6/phase6-operator-runbook.md`
- `docs/phase6/phase6-scheduler-jobs.md`

Allowed supporting files:

- `docs/phase6/README.md`

Avoid editing dashboard and alerting implementation files owned by P6-005/P6-006 unless coordination is required.

## Input

- Phase 6 round 1 safety controls are complete.
- Round 2 needs repeatable local/operator checks for paper/simulation state.
- Scheduler jobs must be no-write and safe on a fresh checkout.

## Output

Define safe scheduler job behavior and runbooks for:

- paper/simulation status review
- reconciliation review
- kill-switch state review
- alert/report generation
- audit coverage review
- fail-closed handling when local Phase 5 files are missing

Each job must be explicitly no-write and must not call real Toss APIs.

## Forbidden

- Do not schedule real order submission.
- Do not schedule real read-only Toss verification calls.
- Do not schedule transfer/withdrawal/currency-conversion work.
- Do not read `.env` or real `tmp/phase5` receipts.
- Do not add cron-like behavior that runs broker-facing network calls.
- Do not push to GitHub.

## Test Criteria

Run:

```bash
npx vitest run tests/application/scheduler-job-runner.test.ts tests/application/incident-runbook-review.test.ts
npm run check
```

Tests must prove:

- scheduled Phase 6 jobs are no-write
- missing local state fails closed or reports blocked status
- runbook review catches missing safety steps
- no scheduler output contains secret-like or raw broker data
- live broker writes remain blocked

## Completion Conditions

- Scheduler/job guidance is Phase 6-aware and no-write.
- Operator runbooks are specific enough for go/no-go decisions.
- All tests pass.
- Final report confirms no real API calls or broker writes were added.

## Recommended Branch

`phase6/p6-007-scheduler-and-runbooks`
