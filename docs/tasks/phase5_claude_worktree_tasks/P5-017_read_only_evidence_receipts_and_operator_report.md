# Task ID

P5-017

## Goal

Strengthen the Phase 5 sanitized evidence workflow so completed local read-only receipts for accounts, holdings, and future market-prices checks can be summarized consistently without exposing raw data.

## Assigned Engineer

Engineer 2

## Module

Sanitized evidence intake, manifest promotion, and operator reporting.

## Files To Modify Or Create

Primary files:

- `src/application/toss/read-only-evidence-intake.ts`
- `src/application/toss/read-only-evidence-manifest.ts`
- `tests/application/toss-read-only-evidence-intake.test.ts`
- `tests/application/toss-read-only-evidence-manifest.test.ts`

Allowed supporting files:

- `scripts/promote-toss-evidence-intake.mjs`
- `tests/scripts/promote-toss-evidence-intake-script.test.ts`
- `docs/phase5/evidence-intake.example.json`
- `docs/phase5/evidence-manifest.example.json`
- `docs/phase5/open-question-evidence-policy.md`

Avoid editing the market-prices runner/client files owned by P5-016 unless coordination is required.

## Input

- Existing verification receipts use this sanitized shape:

```text
operation
evidenceKind
collectedAt
itemCount
liveBrokerWriteAllowed:false
networkCallsPerformed:true
rawPayloadStored:false
safetyType
```

- Real local receipt files under `tmp/phase5/` are git-ignored and must not be committed.

## Output

Improve the evidence pipeline so it can safely classify and report multiple sanitized read-only receipts for the same open question.

The implementation should:

- accept multiple valid OQ-002 receipts, such as account snapshot plus holdings
- keep canonical evidence-kind to open-question mapping strict
- reject secret-like, header-like, raw response-like, account-number-like, or traversal-like references
- provide a deterministic operator-facing summary structure without reading raw API payloads
- prepare for `MARKET_DATA_READ` evidence if P5-016 adds it, without marking trading safe or resolved automatically

## Forbidden

- Do not read `.env`.
- Do not read or commit real `tmp/phase5` receipt contents beyond generic schema assumptions.
- Do not include raw response payloads, raw symbols, raw prices, quantities, headers, tokens, credentials, or account identifiers in examples/tests.
- Do not auto-mark an item `reviewedByHuman:true`.
- Do not weaken existing evidence rejection rules.
- Do not push to GitHub.

## Test Criteria

Run:

```bash
npx vitest run tests/application/toss-read-only-evidence-intake.test.ts tests/application/toss-read-only-evidence-manifest.test.ts tests/scripts/promote-toss-evidence-intake-script.test.ts
npm run check
```

Tests must prove:

- duplicate valid evidence for the same open question is counted safely
- unsafe receipt references are rejected
- raw body/header/credential/account-like summaries are rejected
- generated summaries do not imply live trading authorization
- `liveBrokerWriteAllowed:false` remains fixed

## Completion Conditions

- Evidence workflow supports accounts plus holdings receipts cleanly.
- Future market-prices receipt shape is either supported or explicitly documented as pending P5-016.
- All tests pass.
- Final report identifies any integration point P5-016 must align with.

## Recommended Branch

`phase5/p5-017-read-only-evidence-receipts`
