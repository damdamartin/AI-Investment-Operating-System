# Phase 6 Claude Worktree Tasks

Status: Draft
Created: 2026-07-29
Source Review: `docs/reviews/Codex_Phase5_Final_Closure_Review.md`

## Purpose

This folder contains Phase 6 task instructions for parallel Claude Code sessions.

Phase 6 starts after Phase 5 read-only Toss verification has closed. It is limited to paper trading, simulation, auditability, reconciliation, risk controls, kill switches, dashboards, and integration review. It does not authorize live broker writes.

## Universal Rules

Every session must read:

- `docs/11_AI_RULES.md`
- `docs/07_Trading_System.md`
- `docs/phase5/README.md`
- `docs/reviews/Codex_Phase5_Final_Closure_Review.md`
- the assigned task document in this folder

Forbidden in every task:

- real Toss order creation
- real Toss order cancellation
- real Toss order modification or replacement
- transfer, withdrawal, or money-moving currency conversion
- production capital use
- reading, printing, or committing `.env`
- reading, printing, or committing real `tmp/phase5` receipts
- committing API keys, tokens, account numbers, raw broker payloads, raw request headers, raw symbols, raw quantities, or raw prices from real responses
- calling the real Toss API from tests
- GitHub push

## Task Index

| Task ID | Title | Recommended Branch |
|---|---|---|
| [P6-001](P6-001_paper_order_intent_pipeline.md) | Paper Order Intent Pipeline | `phase6/p6-001-paper-order-intent-pipeline` |
| [P6-002](P6-002_reconciliation_snapshot_review.md) | Reconciliation Snapshot Review | `phase6/p6-002-reconciliation-snapshot-review` |
| [P6-003](P6-003_risk_kill_switch_approval_guard.md) | Risk, Kill Switch, and Approval Guard | `phase6/p6-003-risk-kill-switch-approval-guard` |
| [P6-004](P6-004_phase6_integration_safety_review.md) | Phase 6 Integration Safety Review | `phase6/p6-004-integration-safety-review` |

## Merge Guidance

P6-001, P6-002, and P6-003 can run in parallel if each task respects its owned files.

P6-004 should run in two phases:

- Phase 1: scaffold review and regression-gap check while P6-001 through P6-003 are running.
- Phase 2: complete the integration review after P6-001 through P6-003 are merged into local `main`.

Recommended merge order:

1. P6-001
2. P6-002
3. P6-003
4. P6-004

## Phase 6 Boundary

Phase 6 may produce paper orders, simulated execution records, approval/audit records, risk decisions, and reconciliation reports.

Phase 6 must not produce or submit real broker write commands.
