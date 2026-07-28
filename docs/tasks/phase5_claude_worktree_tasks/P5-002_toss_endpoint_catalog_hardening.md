# Task ID

P5-002

## Goal

Harden Toss read-only endpoint catalog validation so read-only operation class, source evidence, method, path, and mutation risk are checked explicitly.

## Module

Toss Phase 5 endpoint catalog.

## Files To Modify Or Create

- `src/application/toss/read-only-endpoint-catalog.ts`
- `tests/application/toss-read-only-endpoint-catalog.test.ts`
- `docs/phase5/toss-read-only-endpoints.example.json`
- optionally `docs/phase5/toss-read-only-call-gate.md`

## Input

- `docs/reviews/Codex_Phase5_Architecture_Review.md`
- `docs/phase5/README.md`
- `docs/phase5/toss-read-only-call-gate.md`
- existing endpoint catalog tests

## Output

Catalog validation that fails closed when:

- endpoint operation class is missing
- source evidence is missing
- method and operation class disagree
- endpoint looks mutation-capable
- non-authentication `POST` is used
- endpoint is unrelated to an open question

## Forbidden

- Do not guess real Toss endpoint paths.
- Do not call Toss API.
- Do not add order creation, cancellation, replacement, transfer, withdrawal, or exchange endpoints.
- Do not weaken existing write-path guards.

## Test Criteria

Run:

```bash
npm run check
npm run phase5:toss:endpoints
```

Both commands must pass without network calls.

## Completion Conditions

- Existing catalog tests pass.
- New negative tests prove write-shaped or under-evidenced endpoints fail closed.
- `liveBrokerWriteAllowed` remains `false`.

## Recommended Branch

`phase5/p5-002-toss-endpoint-catalog`

