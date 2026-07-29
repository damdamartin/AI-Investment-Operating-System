# P9-002 Toss Write Preflight Contract Guard

## Task ID

P9-002

## Goal

Strengthen the future Toss write-adapter contract with a no-write
preflight guard that verifies whether all evidence and safety gates would
be required before any later implementation can become callable.

## Assigned Engineer

Engineer 2

## Responsible Module

Future Toss write contract, broker command guard preflight, safety
regression.

## Files To Modify Or Create

- `src/adapters/toss-write-preflight.ts`
- `tests/adapters/toss-write-preflight.test.ts`
- `docs/phase9/toss-write-preflight-contract-guard.md`
- `src/adapters/contracts/index.ts` or `src/index.ts` only if exports are
  required

Coordinate before changing `src/adapters/toss-write-contract.ts`.

## Inputs

- `src/adapters/toss-write-contract.ts`
- `src/application/broker-write-guard/broker-write-command-guard.ts`
- `docs/phase7/toss-write-contract-design.md`
- `docs/phase9/README.md`
- `docs/08_Testing_Validation.md`

## Output

A pure preflight evaluator that checks the future write-adapter
prerequisites:

- all `LCB-*` blockers are human-reviewed in supplied evidence summaries
- `BrokerWriteCommandGuard` result is supplied and allowed in principle
- kill-switch state is supplied and not blocking
- reconciliation is fresh and clean
- idempotency/client order ID policy is present
- redaction policy is present
- timeout/error normalization policy is present
- no raw broker payload storage is allowed

The evaluator must remain no-write. It must not construct a callable
adapter and must not call Toss.

## Forbidden

- No `fetch`, axios, undici, HTTP client, or Toss order endpoint code.
- No real request body builder for orders.
- No `process.env` reads.
- No `.env` or `tmp/phase5` reads.
- No weakening of `BrokerWriteCommandGuard`.
- No `liveBrokerWriteAllowed: true`.

## Test Criteria

Run:

```bash
npx vitest run tests/adapters/toss-write-contract.test.ts tests/adapters/toss-write-preflight.test.ts tests/application/broker-write-command-guard.test.ts tests/safety/safety-regression.test.ts
npm run check
```

## Completion Criteria

- Preflight fails closed on missing evidence and missing safety inputs.
- Future write methods remain uncallable or no-write placeholders.
- Safety regression still proves no callable broker-write path exists.
- `npm run check` passes.

## Recommended Branch

`phase9/p9-002-toss-write-preflight-contract-guard`
