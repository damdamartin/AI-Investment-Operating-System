# Naver News Quality Notes (Phase 5, P5-004)

Status: Active
Last Updated: 2026-07-28

## Purpose

This note documents the fixture-based Naver News data quality module added for Phase 5,
addressing `docs/reviews/Codex_Phase5_Architecture_Review.md` finding M1.

Module: `src/application/news-quality/naver-news-quality.ts`
Entry point: `measureNaverNewsQuality(rawItems, options)`

## What It Measures

Given raw (pre-normalization) Naver News search items, `measureNaverNewsQuality` produces a
`NaverNewsQualityReport` covering:

- malformed or missing publication dates (items the adapter would silently drop)
- duplicate articles, grouped by the adapter's existing `duplicateKey`
- old resurfaced articles: either a large gap between `publishedAt` and `collectedAt`, or a
  duplicate key reappearing long after it was first observed (via a caller-supplied
  `previouslySeenDuplicateKeys` list — never a live store, always injected by the caller)
- weak URL consistency: `originalLink` that does not parse as a valid URL
- weak source consistency: `originalLink` that cannot be distinguished from the Naver
  aggregator link itself (`news.naver.com` and known variants)
- Korean company name ambiguity warnings, using illustrative example fixtures
  (`DEFAULT_KOREAN_COMPANY_AMBIGUITY_FIXTURES`, e.g. `SK`, `삼성`, `카카오`, `현대`)
- U.S. stock/ETF coverage gap warnings, using illustrative example fixtures
  (`DEFAULT_US_COVERAGE_GAP_FIXTURES`, e.g. `AAPL`, `SPY`, `QQQ`)

Callers may override the Korean ambiguity and U.S. coverage fixtures with their own target
lists; the defaults exist to demonstrate the checks work end to end.

## Safety Invariants

Every `NaverNewsQualityReport` carries these fixed fields:

```text
createsTradingSignal: false
createsOrder: false
increasesTradingConviction: false
safetyType: "NAVER_NEWS_QUALITY_REPORT_ONLY"
```

These are structural, not computed from input, so no volume of duplicate or stale articles can
flip them. The module has no concept of conviction, score, or signal strength — it only reports
counts and warning findings. This satisfies:

- `docs/11_AI_RULES.md` Rule 2 (news alone must never trigger an order)
- `docs/11_AI_RULES.md` Rule 8 (low confidence / low quality cannot increase conviction)
- `docs/05_API_Architecture.md` section 6.6 (duplicate articles must not amplify signal strength,
  old articles must not be treated as new)

## No Network Calls, No Credentials

`measureNaverNewsQuality` is a pure function over caller-supplied fixture data
(`NaverNewsRawItem[]`). It performs no HTTP requests and needs no Naver client ID or secret.
Tests exercise it entirely with in-memory fixtures — see
`tests/application/news-quality/naver-news-quality.test.ts`.

## Out of Scope

This module does not decide news impact, does not resolve ambiguous company references to a
single symbol, and does not create `NewsEvent` records. That remains the responsibility of the
News and Event Engine pipeline described in `docs/06_AI_Architecture.md` section 11.
