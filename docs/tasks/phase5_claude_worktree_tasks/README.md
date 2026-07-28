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
| [P5-007](P5-007_toss_endpoint_script_validator_alignment.md) | Toss Endpoint Script/Validator Alignment | `phase5/p5-007-toss-endpoint-script-alignment` |
| [P5-008](P5-008_open_question_evidence_policy.md) | Open Question Evidence Policy (Round 3) | `phase5/p5-008-open-question-evidence-policy` |
| [P5-009](P5-009_read_only_one_call_harness.md) | Read-Only One-Call Harness | `phase5/p5-009-read-only-one-call-harness` |
| [P5-010](P5-010_phase5_local_runbook_and_operator_checklist.md) | Phase 5 Local Runbook and Operator Checklist | `phase5/p5-010-local-runbook-operator-checklist` |
| [P5-011](P5-011_phase5_readiness_review_and_cleanup.md) | Phase 5 Readiness Review and Cleanup | `phase5/p5-011-readiness-review-cleanup` |

## Merge Guidance

Tasks P5-001, P5-004, and P5-005 can start immediately.

Tasks P5-002 and P5-003 both touch Toss Phase 5 tooling and should coordinate if run at the same time.

Task P5-006 should run after at least one implementation task lands, or it may run first as a test-only baseline review.

## Round 3 (P5-007 through P5-011)

Task P5-007 fixed CLI/TypeScript validator drift in the Toss endpoint catalog script and merged first, ahead of the round-3 four-engineer parallel batch.

Tasks P5-008 (Engineer 1), P5-009 (Engineer 2), and P5-010 (Engineer 3) ran in parallel, each scoped to its own files (open-question evidence policy, the no-network one-call harness, and the operator runbook, respectively), and were merged into `main` by the orchestrator. Task P5-011 (Engineer 4) ran in two phases: phase 1 did a regression-gap check against the pre-merge codebase and produced a scaffold readiness review while P5-008/009/010 were still in progress; phase 2, after the orchestrator merged P5-008/009/010 into local `main`, filled in the readiness review with the actual merged content and re-ran the full verification suite. See `docs/reviews/Codex_Phase5_Readiness_Review.md` for the result.

As of the P5-011 review, live trading remains blocked and OQ-001 through OQ-004 remain `OPEN` with `NO_EVIDENCE` — round 3 hardened policy, tooling, and documentation, but did not itself collect or record any real Toss evidence.

