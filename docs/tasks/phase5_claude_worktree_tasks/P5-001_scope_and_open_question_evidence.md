# Task ID

P5-001

## Goal

Clarify Phase 5 read-only scope and define how sanitized evidence maps to open questions without resolving live-trading blockers prematurely.

## Module

Documentation and planning.

## Files To Modify Or Create

- `docs/open_questions.md`
- `docs/phase5/README.md`
- optionally `docs/phase5/open-question-evidence-policy.md`

## Input

- `docs/reviews/Codex_Phase5_Architecture_Review.md`
- `docs/11_AI_RULES.md`
- `docs/phase5/README.md`
- `docs/13_Compliance_and_Legal_Review.md`

## Output

Documentation that distinguishes:

- evidence collected
- evidence reviewed
- open question status
- live trading authorization

## Forbidden

- Do not mark OQ-001 through OQ-004 as resolved without actual reviewed evidence.
- Do not add any API key, token, account number, or raw API response.
- Do not authorize live broker writes.

## Test Criteria

Run:

```bash
npm run check
```

## Completion Conditions

- Open questions have a clear evidence-review policy.
- Phase 5 evidence is explicitly not live trading approval.
- Live broker write blockers remain visible.

## Recommended Branch

`phase5/p5-001-scope-evidence-policy`

