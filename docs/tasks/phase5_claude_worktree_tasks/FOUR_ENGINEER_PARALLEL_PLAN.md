# Phase 5 Four-Engineer Parallel Coding Plan

Status: Draft
Created: 2026-07-28
Audience: Four Claude Code coding engineers
Source Tasks: `P5-001` through `P5-006`

## Purpose

This document splits Phase 5 implementation work across four coding engineers with low file-conflict risk.

The team must build only read-only verification, local safety checks, sanitized evidence handling, and fixture-based adapter quality work.

## Universal Instructions For All Engineers

Read these files first:

- `docs/11_AI_RULES.md`
- `docs/phase5/README.md`
- `docs/phase5/toss-read-only-call-gate.md`
- `docs/reviews/Codex_Phase5_Architecture_Review.md`
- the engineer-specific section in this document

Run before finishing:

```bash
npm run check
```

Do not request, print, commit, or paste:

- API keys
- client secrets
- access tokens
- refresh tokens
- account numbers
- raw broker API responses
- raw request headers

Do not implement:

- Toss order creation
- Toss order cancellation
- Toss order replacement
- transfers
- withdrawals
- currency conversion that moves money
- production capital use
- any real network call in tests

Every new or changed safety report must keep:

```text
liveBrokerWriteAllowed: false
```

Where applicable, no-network commands must keep:

```text
networkCallsPerformed: false
```

## Engineer 1: Toss Endpoint Catalog Hardening

Task IDs:

- Primary: `P5-002`
- Support: relevant regression assertions from `P5-006`

Recommended branch:

```text
phase5/eng1-toss-endpoint-catalog
```

Goal:

Harden Toss read-only endpoint catalog validation so endpoint entries are classified, evidenced, and fail closed when they look under-specified or mutation-capable.

Owned files:

- `src/application/toss/read-only-endpoint-catalog.ts`
- `tests/application/toss-read-only-endpoint-catalog.test.ts`
- `docs/phase5/toss-read-only-endpoints.example.json`

Avoid editing:

- `src/application/toss/read-only-evidence-intake.ts`
- `src/application/toss/read-only-evidence-recorder.ts`
- `src/adapters/naver/*`
- `src/adapters/claude/*`
- `docs/open_questions.md`

Required implementation:

- Add or refine explicit read-only operation classification.
- Validate that method, operation, evidence kind, and source are consistent.
- Keep non-authentication `POST` blocked.
- Keep write-shaped paths blocked unless they are explicitly order-status or fill read operations with safe evidence.
- Add negative tests for mutation-looking endpoints.
- Add positive tests for legitimate order-status or fill read endpoint metadata if represented as read-only.

Inputs:

- `P5-002_toss_endpoint_catalog_hardening.md`
- current endpoint catalog tests

Outputs:

- stricter endpoint catalog validator
- updated fixture/example catalog
- tests proving fail-closed behavior

Completion criteria:

- `npm run check` passes
- `npm run phase5:toss:endpoints` passes or fails only for intentional example-state blockers already documented
- no real Toss endpoint path is guessed without official or local verification evidence
- no write endpoint is added

## Engineer 2: Toss Evidence Approval And Sanitization Harness

Task IDs:

- Primary: `P5-003`
- Support: relevant no-secret/no-write assertions from `P5-006`

Recommended branch:

```text
phase5/eng2-toss-evidence-approval
```

Goal:

Create a public-safe approval artifact and strengthen evidence intake/recording so exactly one future read-only Toss call can be approved and summarized without leaking secrets.

Owned files:

- `src/application/toss/read-only-evidence-intake.ts`
- `src/application/toss/read-only-evidence-recorder.ts`
- `tests/application/toss-read-only-evidence-intake.test.ts`
- `tests/application/toss-read-only-evidence-recorder.test.ts`
- `docs/phase5/toss-read-only-call-gate.md`
- optionally `docs/phase5/read-only-call-approval.example.json`

Avoid editing:

- `src/application/toss/read-only-endpoint-catalog.ts`
- `tests/application/toss-read-only-endpoint-catalog.test.ts`
- `src/adapters/naver/*`
- `src/adapters/claude/*`
- `docs/open_questions.md`

Required implementation:

- Define a sanitized approval record shape for one scoped future read-only call.
- Reject approval records containing secret-like text or account identifiers.
- Reject approval records for write operations.
- Ensure approval does not authorize multiple calls.
- Ensure evidence recorder still rejects live write command shapes.
- Update documentation with the approval artifact rules.

Inputs:

- `P5-003_toss_approval_and_evidence_harness.md`
- current evidence intake and recorder tests

Outputs:

- approval artifact schema or validator
- stronger evidence sanitization tests
- updated call-gate documentation

Completion criteria:

- `npm run check` passes
- `npm run phase5:toss:preflight` performs no network calls
- all reports keep `liveBrokerWriteAllowed: false`
- no network client is implemented

## Engineer 3: Naver News Quality Fixtures

Task IDs:

- Primary: `P5-004`

Recommended branch:

```text
phase5/eng3-naver-news-quality
```

Goal:

Add fixture-based Naver News data quality measurement without creating trading signals or requiring credentials.

Owned files:

- `src/adapters/naver/naver-news-adapter.ts`
- `tests/adapters/naver-news-adapter.test.ts`
- new module under `src/application/news-quality/` if needed
- new tests under `tests/application/`
- optionally `docs/phase5/naver-news-quality-notes.md`

Avoid editing:

- `src/application/toss/*`
- `src/adapters/claude/*`
- `docs/open_questions.md`
- order, risk, money, or broker write guard modules

Required implementation:

- Add fixture-based quality metrics for duplicate articles.
- Detect malformed or missing publication dates.
- Flag old resurfaced articles.
- Flag weak source or URL consistency.
- Add warning examples for Korean company ambiguity and U.S. coverage gaps.
- Keep all output as analysis metadata only.

Inputs:

- `P5-004_naver_news_quality_fixtures.md`
- existing Naver adapter tests

Outputs:

- read-only news quality model or service
- fixture tests for quality warnings
- no trading signal creation

Completion criteria:

- `npm run check` passes
- tests require no real Naver credentials
- duplicate or stale news cannot increase trading conviction
- no order, signal, or broker module is changed

## Engineer 4: Claude Structured Output Evaluation And Phase 5 Regression

Task IDs:

- Primary: `P5-005`
- Secondary: `P5-006`

Recommended branch:

```text
phase5/eng4-claude-eval-regression
```

Goal:

Expand Claude structured-output evaluation fixtures and add Phase 5 regression tests that preserve no-network and no-live-write behavior.

Owned files:

- `src/adapters/claude/analysis-schema.ts`
- `src/adapters/claude/claude-adapter.ts`
- `src/application/ai/*`
- `tests/adapters/claude-adapter.test.ts`
- `tests/application/ai-analysis-persistence.test.ts`
- `tests/safety/safety-regression.test.ts`
- `tests/scripts/*phase5*`
- `tests/scripts/*toss*`
- optionally `docs/phase5/claude-structured-output-evaluation.md`

Avoid editing:

- `src/application/toss/read-only-endpoint-catalog.ts`
- `src/application/toss/read-only-evidence-intake.ts`
- `src/application/toss/read-only-evidence-recorder.ts`
- `src/adapters/naver/*`
- `docs/open_questions.md`

Required implementation:

- Add fixtures for invalid Claude output rejection.
- Reject missing confidence or unsupported values.
- Test `requires_review`, contradictions, and unknown fields.
- Ensure Claude output cannot contain executable broker commands.
- Add or strengthen regression tests for Phase 5 scripts:
  - preflight performs no network calls
  - doctor performs no network calls
  - completion performs no network calls
  - call gate fails closed by default
  - approval does not permit live broker writes

Inputs:

- `P5-005_claude_structured_output_evaluation.md`
- `P5-006_phase5_regression_checks.md`
- existing Claude and Phase 5 script tests

Outputs:

- stronger Claude validation fixtures
- safety regression coverage for Phase 5 no-network/no-write behavior

Completion criteria:

- `npm run check` passes
- invalid Claude output is rejected
- low-confidence output cannot increase conviction
- Phase 5 script tests do not require credentials or network
- all live write reports remain blocked

## Coordination Rules

Each engineer should work in a separate worktree and branch.

Before starting:

```bash
git fetch origin
git checkout main
git pull --ff-only
git checkout -b <recommended-branch>
```

Before handoff:

```bash
npm run check
git status --short
```

Commit message format:

```text
Phase 5: <short task summary>
```

## Merge Order

Recommended merge order:

1. Engineer 1: endpoint catalog hardening
2. Engineer 2: evidence approval and sanitization
3. Engineer 3: Naver news quality fixtures
4. Engineer 4: Claude evaluation and regression

If Engineer 4 changes broad Phase 5 script tests, merge it last and re-run:

```bash
npm run check
npm run phase5:toss:doctor
npm run phase5:toss:preflight
```

`phase5:toss:preflight` may fail closed in local default state. That is acceptable only if it reports sanitized blockers and no network calls.

## Final Integration Checklist

After all four branches are merged:

- `npm run check`
- `npm run phase5:toss:doctor`
- `npm run phase5:toss:preflight`
- confirm no `.env` or secret file is staged
- confirm no real raw API response file is staged
- confirm no Toss write endpoint or write HTTP client was implemented
- confirm `liveBrokerWriteAllowed: false` remains true in every Phase 5 report

