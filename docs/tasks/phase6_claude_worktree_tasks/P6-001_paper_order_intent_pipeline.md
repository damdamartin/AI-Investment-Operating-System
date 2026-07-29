# Task ID

P6-001

## Goal

Create a paper-only order intent pipeline that connects strategy/risk output to paper trading without creating any real broker write command.

## Assigned Engineer

Engineer 1

## Module

Paper trading, order intent, and audit-friendly simulation handoff.

## Files To Modify Or Create

Primary files:

- `src/application/paper-trading/paper-trading-engine.ts`
- `tests/application/paper-trading-engine.test.ts`
- `src/application/execution-simulation/order-execution-simulation-service.ts`
- `tests/application/order-execution-simulation-service.test.ts`

Allowed supporting files:

- `src/application/order-approval/order-approval-engine.ts`
- `src/application/audit/audit-log.ts`
- `tests/application/audit-log.test.ts`
- `docs/phase6/paper-order-intent-pipeline.md`

Avoid editing reconciliation, kill-switch, dashboard, or integration review files owned by other Phase 6 tasks unless coordination is required.

## Input

- Phase 5 read-only verification is complete.
- Existing domain and application modules already model paper trading, order approval, audit, and execution simulation.
- Phase 6 remains simulation-only.

## Output

Implement or refine a paper-only order intent flow that can:

- accept a strategy decision or candidate order intent
- produce a paper-trading action or rejection
- record why the intent was accepted, rejected, or deferred
- preserve enough audit context to reconstruct the decision
- explicitly mark every output as non-broker, paper-only, and not live executable

The pipeline must make it impossible for a caller to obtain a real broker order submission command from this path.

## Forbidden

- Do not implement Toss real order submission.
- Do not implement real cancel/replace.
- Do not add HTTP calls to Toss.
- Do not read `.env`.
- Do not use real account refs, symbols, quantities, prices, or holdings from local receipts.
- Do not create a generic broker write command.
- Do not push to GitHub.

## Test Criteria

Run:

```bash
npx vitest run tests/application/paper-trading-engine.test.ts tests/application/order-execution-simulation-service.test.ts tests/application/audit-log.test.ts
npm run check
```

Tests must prove:

- approved simulation intent remains paper-only
- rejected/deferred intent includes clear reason codes
- live broker write metadata remains false or absent
- no output can be interpreted as a Toss order payload
- audit context includes decision lineage without secrets or raw broker data

## Completion Conditions

- Paper order intent pipeline is implemented or clearly strengthened.
- All tests pass.
- Final report lists changed files, reason-code behavior, and safety confirmation.

## Recommended Branch

`phase6/p6-001-paper-order-intent-pipeline`
