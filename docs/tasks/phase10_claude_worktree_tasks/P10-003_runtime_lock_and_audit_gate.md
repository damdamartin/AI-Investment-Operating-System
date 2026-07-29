# P10-003 Runtime Lock And Audit Gate

## Task ID

P10-003

## Goal

Create a no-write runtime lock and audit gate that proves the application
remains unable to perform live broker writes until a later, separately
approved implementation phase changes that boundary.

## Assigned Engineer

Engineer 3

## Responsible Module

Runtime lock status, audit evidence, safety regression guard.

## Files To Modify Or Create

- `src/application/live-readiness/runtime-live-lock-gate.ts`
- `src/application/live-readiness/index.ts`
- `tests/application/runtime-live-lock-gate.test.ts`
- `tests/safety/safety-regression.test.ts`
- `docs/phase10/runtime-live-lock-gate.md`

Avoid editing P10-001/P10-002 files unless coordination is required.

## Inputs

- `src/application/broker-write-guard/broker-write-command-guard.ts`
- `src/adapters/toss-write-contract.ts`
- `src/adapters/toss-write-preflight.ts`
- `src/application/live-readiness/small-capital-enablement-gate.ts`
- `docs/phase7/toss-write-contract-design.md`
- `docs/phase9/toss-write-preflight-contract-guard.md`
- `docs/11_AI_RULES.md`

## Output

A pure gate/report that checks the current runtime safety posture:

- broker write guard still denies writes
- future Toss write contract is still non-callable
- no runtime approval report can flip `liveBrokerWriteAllowed`
- no order endpoint/network capability is exposed by this gate
- audit summary is sanitized and evidence-only

This task may add safety-regression tests that intentionally tamper with
inputs and prove the gate re-derives no-write output.

## Forbidden

- No callable `TossSecuritiesAdapter` implementation.
- No `fetch`, `axios`, `undici`, order endpoint calls, or broker payloads.
- No `.env` or `tmp/phase5` reads.
- No real order, cancellation, replacement, transfer, withdrawal, or FX.
- No `liveBrokerWriteAllowed: true` runtime path.

## Test Criteria

Run:

```bash
npx vitest run tests/application/runtime-live-lock-gate.test.ts tests/safety/safety-regression.test.ts tests/adapters/toss-write-contract.test.ts tests/adapters/toss-write-preflight.test.ts
npm run check
```

## Completion Criteria

- Gate output is hard no-write even when upstream readiness is clean.
- Tampered `liveBrokerWriteAllowed: true` inputs are detected as blocking.
- Safety regression tests prove no callable write adapter exists.
- `npm run check` passes.

## Recommended Branch

`phase10/p10-003-runtime-lock-and-audit-gate`
