# P10-002 First-Trade Operating Protocol

## Task ID

P10-002

## Goal

Define the human-executed first-trade operating protocol for a future
small-capital live pilot, without implementing any callable broker-write
code.

## Assigned Engineer

Engineer 2

## Responsible Module

First-trade runbook, manual operator protocol, no-write rehearsal model.

## Files To Modify Or Create

- `src/application/live-readiness/first-trade-operating-protocol.ts`
- `src/application/live-readiness/index.ts`
- `tests/application/first-trade-operating-protocol.test.ts`
- `docs/phase10/first-trade-operating-protocol.md`

Avoid editing P10-001/P10-003 files unless coordination is required.

## Inputs

- `docs/07_Trading_System.md`
- `docs/08_Testing_Validation.md`
- `docs/phase7/small-capital-readiness-gates.md`
- `docs/phase8/rollback-drill-runbook.md`
- `docs/phase9/small-capital-go-no-go-checklist.md`
- `docs/11_AI_RULES.md`

## Output

A pure checklist/runbook evaluator for a future first small-capital live
trade. It should verify that the operator has recorded sanitized
attestations for:

- limited capital mode
- limit-order-only policy
- maximum order amount policy
- single-strategy or narrow strategy set
- kill-switch readiness
- rollback/reconciliation rehearsal
- post-trade manual review commitment
- stop criteria after first trade

The protocol may produce `READY_FOR_HUMAN_REVIEW`, but must not produce
an executable command or a broker payload.

## Forbidden

- No real order object, broker payload, endpoint path, HTTP client, or
  write adapter implementation.
- No order submission, cancellation, replacement, transfer, withdrawal, or
  FX.
- No `.env`, `tmp/phase5`, secrets, account numbers, balances, or raw
  broker payloads.
- No `liveBrokerWriteAllowed: true`.
- Do not instruct the system to automatically place the first trade.

## Test Criteria

Run:

```bash
npx vitest run tests/application/first-trade-operating-protocol.test.ts tests/application/kill-switch-control-service.test.ts tests/application/reconciliation-workflow-service.test.ts
npm run check
```

## Completion Criteria

- Protocol output is human-executed and evidence-only.
- Missing stop criteria, kill-switch readiness, or reconciliation
  commitment fails closed.
- No executable broker command shape appears in the output.
- `npm run check` passes.

## Recommended Branch

`phase10/p10-002-first-trade-operating-protocol`
