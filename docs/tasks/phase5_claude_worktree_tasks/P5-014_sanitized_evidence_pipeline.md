# Task ID

P5-014

## Goal

Strengthen the sanitized evidence pipeline so Phase 5 can convert one real read-only verification result into reviewed evidence without exposing secrets or raw account data.

## Assigned Engineer

Engineer 3

## Module

Toss evidence intake, manifest promotion, redaction, and open-question mapping.

## Files To Modify Or Create

Primary files:

- `src/application/toss/read-only-evidence-intake.ts`
- `src/application/toss/read-only-evidence-manifest.ts`
- `src/application/toss/open-question-evidence-tracker.ts`
- `tests/application/toss-read-only-evidence-intake.test.ts`
- `tests/application/toss-read-only-evidence-manifest.test.ts`
- `tests/application/toss-open-question-evidence-tracker.test.ts`

Allowed supporting files:

- `scripts/promote-toss-evidence-intake.mjs`
- `scripts/report-toss-open-questions.mjs`
- `tests/scripts/promote-toss-evidence-intake-script.test.ts`
- `tests/scripts/report-toss-open-questions-script.test.ts`
- `docs/phase5/open-question-evidence-policy.md`
- `docs/phase5/evidence-intake.example.json`
- `docs/phase5/evidence-manifest.example.json`

Avoid editing HTTP client or verification runner files owned by P5-012/P5-013.

## Input

- A future P5-013 runner will write sanitized local evidence.
- Current open questions OQ-001 through OQ-004 must remain explicit and auditable.

## Output

Evidence pipeline enhancements that:

- accept sanitized read-only verification summaries
- reject raw response-like payloads
- reject token-like, secret-like, account-number-like, and header-like text
- map `ACCOUNT_SNAPSHOT_READ` evidence to OQ-002
- map `POSITION_QUERY_READ` evidence to OQ-002
- keep unresolved questions unresolved unless valid sanitized evidence exists

## Forbidden

- Do not include real Toss API payloads in docs or tests.
- Do not mark open questions resolved with placeholder evidence.
- Do not weaken redaction.
- Do not introduce actual network calls.
- Do not touch `.env`.
- Do not push to GitHub.

## Test Criteria

Run:

```bash
npx vitest run tests/application/toss-read-only-evidence-intake.test.ts tests/application/toss-read-only-evidence-manifest.test.ts tests/application/toss-open-question-evidence-tracker.test.ts
npm run check
```

Tests must prove:

- sanitized account evidence can be promoted
- raw response examples are rejected
- account-number-like strings are rejected
- source references cannot contain bearer tokens or request headers
- open-question status changes only when evidence is valid and sanitized

## Completion Conditions

- Evidence pipeline accepts the future P5-013 sanitized output shape.
- Validators remain fail-closed for ambiguous or unsafe evidence.
- `npm run check` passes.

## Recommended Branch

`phase5/p5-014-sanitized-evidence-pipeline`

