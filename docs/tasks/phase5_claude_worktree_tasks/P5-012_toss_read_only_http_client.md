# Task ID

P5-012

## Goal

Implement a narrowly scoped Toss read-only HTTP client for Phase 5 verification, using mock-only tests and strict redaction.

## Assigned Engineer

Engineer 1

## Module

Toss read-only adapter layer.

## Files To Modify Or Create

Primary files:

- `src/adapters/toss/toss-read-only-http-client.ts`
- `src/adapters/toss/index.ts`
- `tests/adapters/toss-read-only-http-client.test.ts`

Allowed supporting files:

- `src/adapters/contracts/toss.ts`
- `docs/phase5/toss-official-api-source-notes.md`
- `docs/phase5/local-toss-read-only-runbook.md`

Avoid editing scripts owned by P5-013 unless coordination is required.

## Input

- Local `.env` may exist, but tests must not read real credentials.
- Official Toss read-only endpoints already documented:
  - `POST /oauth2/token`
  - `GET /api/v1/accounts`
  - `GET /api/v1/holdings`
- Existing dry-run client:
  - `src/adapters/toss/toss-read-only-dry-run-client.ts`

## Output

A real HTTP client abstraction that can:

- issue an OAuth token request
- call `GET /api/v1/accounts`
- call `GET /api/v1/holdings`
- return only typed results to callers
- provide sanitized error metadata without raw payloads, tokens, account numbers, request headers, or client secrets

The client must expose safety metadata such as:

```text
liveBrokerWriteAllowed: false
allowedOperations: AUTHENTICATION_READ, ACCOUNT_SNAPSHOT_READ, POSITION_QUERY_READ
```

## Forbidden

- Do not implement order creation, order cancellation, order modification, transfer, withdrawal, or currency conversion.
- Do not add `POST /api/v1/orders` or any order write path.
- Do not print, log, test-snapshot, or commit raw Toss responses.
- Do not read or modify `.env` in tests.
- Do not call the real Toss API in tests.
- Do not push to GitHub.

## Test Criteria

Run:

```bash
npx vitest run tests/adapters/toss-read-only-http-client.test.ts
npm run check
```

Tests must use local mock HTTP servers only and prove:

- token value is never returned in logs/reports
- account numbers are redacted or omitted
- non-2xx responses fail closed with sanitized reason codes
- write-looking paths cannot be requested through this client
- `liveBrokerWriteAllowed:false` is hardcoded in client reports

## Completion Conditions

- Client exists and is exported.
- Mock-only tests pass.
- No real network call is made by tests.
- `npm run check` passes.
- Final report lists changed files and confirms no broker write capability was added.

## Recommended Branch

`phase5/p5-012-toss-read-only-http-client`

