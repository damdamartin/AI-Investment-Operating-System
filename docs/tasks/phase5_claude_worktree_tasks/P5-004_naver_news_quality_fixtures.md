# Task ID

P5-004

## Goal

Add fixture-based Naver News data quality measurement for Phase 5 without creating trading signals.

## Module

Naver News adapter and news quality review.

## Files To Modify Or Create

- `src/adapters/naver/naver-news-adapter.ts`
- `src/application/news/` or a new `src/application/news-quality/` module
- `tests/adapters/naver-news-adapter.test.ts`
- new tests under `tests/application/`
- optionally `docs/phase5/naver-news-quality-notes.md`

## Input

- `docs/05_API_Architecture.md`
- `docs/06_AI_Architecture.md`
- `docs/11_AI_RULES.md`
- existing Naver adapter tests

## Output

Fixture-based quality metrics for:

- malformed publication dates
- duplicate articles
- old resurfaced articles
- source and URL consistency
- Korean company ambiguity examples
- U.S. coverage warning examples

## Forbidden

- Do not create signals or orders.
- Do not call Toss API.
- Do not require real Naver credentials in tests.
- Do not commit raw real API responses.

## Test Criteria

Run:

```bash
npm run check
```

## Completion Conditions

- News quality measurement is read-only and fixture-based.
- Duplicate or stale news cannot increase trading conviction.
- Adapter tests run without external API credentials.

## Recommended Branch

`phase5/p5-004-naver-quality-fixtures`

