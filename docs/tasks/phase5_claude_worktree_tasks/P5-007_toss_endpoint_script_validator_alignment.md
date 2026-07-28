# Task ID

P5-007

## Goal

Align the local Toss endpoint validation script with the hardened TypeScript endpoint catalog validator so Phase 5 command-line checks and application-level tests enforce the same read-only safety rules.

## Background

Engineer 1 hardened `src/application/toss/read-only-endpoint-catalog.ts`, but reported a follow-up issue:

`scripts/validate-toss-endpoints.mjs` still contains separate plain-JavaScript validation logic. This creates rule drift because the CLI command can pass endpoint catalogs that the TypeScript validator would reject.

This task fixes that drift without adding real Toss API calls or broker write behavior.

## Module

Phase 5 Toss endpoint validation script and tests.

## Files To Modify Or Create

Primary files:

- `scripts/validate-toss-endpoints.mjs`
- `tests/scripts/validate-toss-endpoints-script.test.ts`

Allowed supporting files if needed:

- `src/application/toss/read-only-endpoint-catalog.ts`
- `tests/application/toss-read-only-endpoint-catalog.test.ts`
- `docs/phase5/toss-read-only-endpoints.example.json`

Avoid broad edits outside these files.

## Required Reading

- `docs/11_AI_RULES.md`
- `docs/phase5/README.md`
- `docs/phase5/toss-read-only-call-gate.md`
- `docs/reviews/Codex_Phase5_Architecture_Review.md`
- `docs/tasks/phase5_claude_worktree_tasks/FOUR_ENGINEER_PARALLEL_PLAN.md`
- `src/application/toss/read-only-endpoint-catalog.ts`
- `scripts/validate-toss-endpoints.mjs`
- `tests/application/toss-read-only-endpoint-catalog.test.ts`
- `tests/scripts/validate-toss-endpoints-script.test.ts`

## Implementation Requirements

Make the CLI script enforce the same safety semantics as the TypeScript validator:

- unsupported catalog version fails
- duplicate endpoint IDs fail
- missing or invalid path fails
- path must start with `/`
- invalid method fails
- missing or invalid operation class fails
- missing or invalid source evidence fails
- non-authentication `POST` fails
- operation/evidence kind mismatch fails
- hard mutation verbs in paths fail
- ambiguous `orders` or `fills` paths require verified matching order-status or fill-read evidence
- endpoint must map to a tracked Phase 5 Toss open question, currently `OQ-001` through `OQ-004`
- unverified endpoints remain warnings, not automatic hard failures, unless they are mutation-looking order/fill paths requiring verified evidence

Prefer reducing duplicated logic if practical. If direct TypeScript import from the `.mjs` script is not practical in this repository, duplicate the minimum logic deliberately and add tests that keep script behavior aligned with the TypeScript validator.

## Forbidden

- Do not call Toss API.
- Do not add real network calls.
- Do not add Toss order creation, cancellation, replacement, transfer, withdrawal, or exchange endpoints.
- Do not add or request API keys, tokens, account numbers, raw headers, or raw API responses.
- Do not change `.env`.
- Do not weaken `src/application/toss/read-only-endpoint-catalog.ts` to make the script easier to align.
- Do not allow CLI output to report live broker writes as allowed.

## Required Tests

Add or update script-level tests for:

- invalid method is rejected
- missing operation class is rejected
- missing source evidence is rejected
- operation/evidence mismatch is rejected
- hard mutation path is rejected
- unverified `orders` or `fills` path is rejected when it depends on order-status/fill-read evidence
- verified order-status or fill-read path with matching evidence is accepted
- output always includes `liveBrokerWriteAllowed: false`

Run:

```bash
npm run check
npm run phase5:toss:endpoints
```

Optional but recommended:

```bash
npm run phase5:toss:doctor
npm run phase5:toss:preflight
```

`phase5:toss:preflight` may fail closed in the default local state. That is acceptable only if the output keeps:

```text
liveBrokerWriteAllowed: false
networkCallsPerformed: false
```

## Completion Conditions

- CLI endpoint validation no longer lags behind the TypeScript validator for Phase 5 read-only safety rules.
- `npm run check` passes.
- `npm run phase5:toss:endpoints` passes for the current example catalog.
- No real network calls are introduced.
- No Toss write endpoint or write HTTP client is implemented.
- Worktree is clean except for the intended committed changes.

## Recommended Branch

`phase5/p5-007-toss-endpoint-script-alignment`

