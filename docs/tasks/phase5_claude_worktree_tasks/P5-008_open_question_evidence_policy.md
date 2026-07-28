# Task ID

P5-008

## Goal

Define a Phase 5 evidence status policy for Toss open questions so evidence collection is not confused with live trading authorization.

## Assigned Engineer

Engineer 1

## Module

Open question policy and Phase 5 documentation.

## Files To Modify Or Create

Primary files:

- `docs/open_questions.md`
- `docs/phase5/README.md`

Allowed supporting files:

- `docs/phase5/open-question-evidence-policy.md`
- `tests/application/toss-open-question-evidence-tracker.test.ts`
- `src/application/toss/open-question-evidence-tracker.ts`

Avoid editing Toss endpoint catalog, evidence recorder, Naver, Claude, order, risk, money, or broker write modules.

## Required Reading

- `docs/11_AI_RULES.md`
- `docs/phase5/README.md`
- `docs/open_questions.md`
- `docs/reviews/Codex_Phase5_Architecture_Review.md`
- `src/application/toss/open-question-evidence-tracker.ts`
- `tests/application/toss-open-question-evidence-tracker.test.ts`

## Implementation Requirements

Add a clear policy that distinguishes:

- no evidence
- evidence collected
- evidence sanitized
- evidence reviewed
- question in review
- question resolved
- live trading still blocked

For OQ-001 through OQ-004, document that Phase 5 evidence may support review but does not by itself authorize:

- Toss order creation
- Toss order cancellation
- Toss order replacement
- live capital use
- production reconciliation based on unverified identifiers

If code is changed, keep it review-only and fixture-based. Do not add network calls.

## Forbidden

- Do not mark OQ-001 through OQ-004 as resolved.
- Do not authorize live broker writes.
- Do not request, print, or commit API keys, tokens, account numbers, raw headers, or raw API responses.
- Do not modify `.env`.
- Do not implement real Toss calls.

## Tests

Run:

```bash
npm run check
```

If code changes touch open question evidence tracking, also run:

```bash
npx vitest run tests/application/toss-open-question-evidence-tracker.test.ts
```

## Completion Conditions

- Evidence policy is explicit and hard to misread.
- Open questions remain open unless actual reviewed evidence and human decision exist.
- Live broker write blockers remain visible.
- `npm run check` passes.

## Recommended Branch

`phase5/p5-008-open-question-evidence-policy`

