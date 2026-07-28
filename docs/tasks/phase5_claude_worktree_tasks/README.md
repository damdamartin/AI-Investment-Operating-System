# Phase 5 Claude Worktree Tasks

Status: Draft
Created: 2026-07-28
Source Review: `docs/reviews/Codex_Phase5_Architecture_Review.md`

## Purpose

This folder contains draft task instructions for parallel Claude Code sessions.

Phase 5 is limited to read-only validation, local safety gates, sanitized evidence, and fixture-based adapter quality work. No task in this folder may implement live broker write operations.

## Universal Rules

Every session must read:

- `docs/11_AI_RULES.md`
- `docs/phase5/README.md`
- `docs/phase5/toss-read-only-call-gate.md`
- `docs/reviews/Codex_Phase5_Architecture_Review.md`

Forbidden in every task:

- API keys, tokens, account numbers, or raw credential-bearing payloads
- Toss order creation, cancellation, or replacement
- transfers, withdrawals, or money-moving currency conversion
- production capital use
- raw real API response commits
- changing `.env` or asking for secret values

## Task Index

| Task ID | Title | Recommended Branch |
|---|---|---|
| [P5-001](P5-001_scope_and_open_question_evidence.md) | Scope and Open Question Evidence Policy | `phase5/p5-001-scope-evidence-policy` |
| [P5-002](P5-002_toss_endpoint_catalog_hardening.md) | Toss Endpoint Catalog Hardening | `phase5/p5-002-toss-endpoint-catalog` |
| [P5-003](P5-003_toss_approval_and_evidence_harness.md) | Toss Approval and Evidence Harness | `phase5/p5-003-toss-approval-evidence` |
| [P5-004](P5-004_naver_news_quality_fixtures.md) | Naver News Quality Fixtures | `phase5/p5-004-naver-quality-fixtures` |
| [P5-005](P5-005_claude_structured_output_evaluation.md) | Claude Structured Output Evaluation | `phase5/p5-005-claude-eval-fixtures` |
| [P5-006](P5-006_phase5_regression_checks.md) | Phase 5 Regression Checks | `phase5/p5-006-phase5-regression` |

## Merge Guidance

Tasks P5-001, P5-004, and P5-005 can start immediately.

Tasks P5-002 and P5-003 both touch Toss Phase 5 tooling and should coordinate if run at the same time.

Task P5-006 should run after at least one implementation task lands, or it may run first as a test-only baseline review.

