# Task ID

P5-005

## Goal

Expand Claude structured-output evaluation fixtures and metadata checks without calling broker APIs or sending secrets to prompts.

## Module

Claude adapter and AI analysis validation.

## Files To Modify Or Create

- `src/adapters/claude/analysis-schema.ts`
- `src/adapters/claude/claude-adapter.ts`
- `src/application/ai/`
- `tests/adapters/claude-adapter.test.ts`
- `tests/application/ai-analysis-persistence.test.ts`
- optionally `docs/phase5/claude-structured-output-evaluation.md`

## Input

- `docs/06_AI_Architecture.md`
- `docs/05_API_Architecture.md`
- `docs/11_AI_RULES.md`
- existing Claude adapter tests

## Output

Fixture-based validation for:

- invalid JSON-like output rejection
- missing confidence rejection
- unsupported enum handling
- `requires_review` behavior
- contradiction and unknown fields
- model and prompt template metadata references
- token usage and cost metadata where available

## Forbidden

- Do not call Toss API.
- Do not include broker credentials, account numbers, or raw broker payloads in prompts or tests.
- Do not let Claude output create executable broker commands.
- Do not implement strategy promotion automation.

## Test Criteria

Run:

```bash
npm run check
```

## Completion Conditions

- Invalid Claude output is rejected.
- Low-confidence output cannot increase conviction.
- AI output remains advisory and cannot approve orders.
- Tests use fixtures or injected generators only.

## Recommended Branch

`phase5/p5-005-claude-eval-fixtures`

