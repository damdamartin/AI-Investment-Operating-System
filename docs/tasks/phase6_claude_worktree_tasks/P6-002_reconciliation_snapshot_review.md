# Task ID

P6-002

## Goal

Strengthen read-only reconciliation review so paper/simulation state can be compared against sanitized broker snapshots without exposing raw broker data or enabling writes.

## Assigned Engineer

Engineer 2

## Module

Reconciliation, read-only broker snapshot review, and discrepancy reporting.

## Files To Modify Or Create

Primary files:

- `src/application/reconciliation/reconciliation-service.ts`
- `src/application/reconciliation/reconciliation-workflow-service.ts`
- `tests/application/reconciliation-service.test.ts`
- `tests/application/reconciliation-workflow-service.test.ts`

Allowed supporting files:

- `src/application/dashboard/read-only-dashboard.ts`
- `tests/application/read-only-dashboard.test.ts`
- `docs/phase6/reconciliation-snapshot-review.md`

Avoid editing paper-intent or kill-switch guard files owned by P6-001/P6-003 unless coordination is required.

## Input

- Phase 5 produced local sanitized receipts for account, holdings, and market data reads.
- Real receipt files remain local and git-ignored.
- Reconciliation must work from sanitized summaries or mock fixtures, not raw real broker payloads.

## Output

Improve reconciliation review so it can:

- compare expected paper/simulation positions against read-only broker snapshot summaries
- classify discrepancies as informational, blocking, or requiring human review
- require reconciliation before any future live-capable phase could proceed
- report `liveBrokerWriteAllowed:false`
- avoid storing raw account identifiers, raw symbols, raw quantities, raw prices, headers, or tokens

## Forbidden

- Do not read `.env`.
- Do not read or commit real `tmp/phase5` receipt files.
- Do not call Toss or any real broker API.
- Do not implement broker writes or correction commands.
- Do not auto-resolve discrepancies by placing/canceling/modifying orders.
- Do not push to GitHub.

## Test Criteria

Run:

```bash
npx vitest run tests/application/reconciliation-service.test.ts tests/application/reconciliation-workflow-service.test.ts tests/application/read-only-dashboard.test.ts
npm run check
```

Tests must prove:

- matched snapshots pass as read-only review only
- missing/extra/mismatched positions produce deterministic reason codes
- unresolved reconciliation blocks future live-readiness reporting
- output is sanitized
- no correction command or broker write payload is produced

## Completion Conditions

- Reconciliation review is stronger and remains read-only.
- Dashboard/status integration, if touched, remains read-only.
- All tests pass.
- Final report lists discrepancy categories and safety confirmation.

## Recommended Branch

`phase6/p6-002-reconciliation-snapshot-review`
