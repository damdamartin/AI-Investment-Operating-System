# Task ID

P5-016

## Goal

Extend Phase 5 read-only verification from verified account/holdings checks to a narrowly scoped Toss market-prices read-only verification path.

## Assigned Engineer

Engineer 1

## Module

Toss read-only market data adapter and verification runner.

## Files To Modify Or Create

Primary files:

- `src/adapters/toss/toss-read-only-http-client.ts`
- `tests/adapters/toss-read-only-http-client.test.ts`
- `scripts/phase5-toss-read-only-verify.mjs`
- `tests/scripts/phase5-toss-read-only-verify-script.test.ts`

Allowed supporting files:

- `docs/phase5/toss-official-api-source-notes.md`
- `docs/phase5/toss-read-only-endpoints.example.json`
- `docs/phase5/local-toss-read-only-runbook.md`

Avoid editing evidence policy/review files owned by P5-017/P5-019 unless coordination is required.

## Input

- Current `main` already supports human-approved `accounts` and `holdings` read-only verification.
- The latest local operator run has verified both `accounts` and `holdings` without raw payload storage.
- Use only official Toss documentation for market-prices endpoint shape.
- Tests must use mock servers only.

## Output

Add a market-prices read-only target that can be tested with mocks and, later, attempted once by a human operator after local preflight/call-gate approval.

The implementation must:

- keep `liveBrokerWriteAllowed:false`
- keep `rawPayloadStored:false`
- store only sanitized receipt metadata such as operation, evidence kind, timestamp, item count, and safety flags
- never store raw prices, raw symbols, raw response bodies, request headers, account references, tokens, or credentials
- fail closed if the market-prices endpoint is not explicitly verified in the endpoint catalog

## Forbidden

- Do not implement order creation, order cancellation, order modification, transfer, withdrawal, or currency conversion.
- Do not add a generic HTTP request escape hatch.
- Do not ask for or read `.env` values in tests.
- Do not call the real Toss API in tests.
- Do not commit raw market data responses, screenshots, headers, tokens, credentials, symbols from a real account, or account identifiers.
- Do not push to GitHub.

## Test Criteria

Run:

```bash
npx vitest run tests/adapters/toss-read-only-http-client.test.ts tests/scripts/phase5-toss-read-only-verify-script.test.ts
npm run check
```

Tests must prove:

- market-prices calls use only a mock server
- unapproved market-prices verification performs no network call
- preflight/call-gate failure performs no network call
- successful mock market-prices verification writes only sanitized evidence
- write-looking targets still fail closed
- account/holdings behavior remains unchanged

## Completion Conditions

- Market-prices target is available only through a fixed read-only allow-list.
- All tests pass.
- `npm run check` passes.
- Final report lists changed files, safety invariants, and any remaining human-only steps.

## Recommended Branch

`phase5/p5-016-market-prices-read-only-verification`
