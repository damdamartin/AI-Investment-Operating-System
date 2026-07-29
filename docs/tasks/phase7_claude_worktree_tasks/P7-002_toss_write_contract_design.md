# P7-002 Toss Write Contract Design

## Task ID

P7-002

## Goal

Design the future `TossSecuritiesAdapter` write contract without adding a
callable live-write implementation.

## Assigned Engineer

Engineer 2

## Responsible Module

Adapter contracts, broker command safety boundary, contract tests.

## Files To Modify Or Create

- `docs/phase7/toss-write-contract-design.md`
- `src/adapters/toss-write-contract.ts` if a type-only contract is useful
- `tests/adapters/toss-write-contract.test.ts` if a contract test is added

Coordinate before touching existing adapter interfaces.

## Inputs

- `docs/05_API_Architecture.md`
- `docs/07_Trading_System.md`
- `docs/11_AI_RULES.md`
- `tests/adapters/contracts.test.ts`
- `src/application/broker-write-command-guard.ts`
- `src/index.ts`

## Output

A future write-adapter design that specifies:

- allowed future operations as types, not live behavior
- required inputs from `OrderApproval`
- idempotency key/client order ID requirements
- kill-switch re-check requirements immediately before submission
- no blind retry after ambiguous submit
- normalized broker error and unknown-state behavior
- redaction requirements
- audit/outbox requirements

Any TypeScript added in this task must keep future write methods
uncallable unless a later phase explicitly supplies a reviewed command
type. A placeholder may exist, but it must not be able to submit, cancel,
replace, transfer, withdraw, or exchange anything.

## Forbidden

- No `fetch`, HTTP client, axios, undici, or network code to Toss order
  endpoints.
- No real request body builder for orders.
- No environment variable reads.
- No `liveBrokerWriteAllowed: true`.
- No changes that weaken `BrokerWriteCommandGuard`.

## Test Criteria

Run:

```bash
npx vitest run tests/adapters/contracts.test.ts tests/adapters/toss-write-contract.test.ts tests/safety/safety-regression.test.ts
npm run check
```

If `tests/adapters/toss-write-contract.test.ts` is not added, omit it
from the targeted command.

## Completion Criteria

- Future write boundary is documented.
- Any added contract code is non-executable with respect to broker writes.
- Safety regression still proves no real broker write path exists.
- `npm run check` passes.

## Recommended Branch

`phase7/p7-002-toss-write-contract-design`
