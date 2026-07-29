# Phase 6 Claude Worktree Tasks

Status: Round 1 Complete
Created: 2026-07-29
Last Updated: 2026-07-29
Source Review: `docs/reviews/Codex_Phase5_Final_Closure_Review.md`
Round 1 Closure Review: `docs/reviews/Codex_Phase6_Simulation_Safety_Review.md`

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

| Task ID | Title | Recommended Branch | Status | Merge Commit |
|---|---|---|---|---|
| [P6-001](P6-001_paper_order_intent_pipeline.md) | Paper Order Intent Pipeline | `phase6/p6-001-paper-order-intent-pipeline` | Merged | `76515cd` |
| [P6-002](P6-002_reconciliation_snapshot_review.md) | Reconciliation Snapshot Review | `phase6/p6-002-reconciliation-snapshot-review` | Merged | `e8855e7` |
| [P6-003](P6-003_risk_kill_switch_approval_guard.md) | Risk, Kill Switch, and Approval Guard | `phase6/p6-003-risk-kill-switch-approval-guard` | Merged | `98955d5` |
| [P6-004](P6-004_phase6_integration_safety_review.md) | Phase 6 Integration Safety Review | `phase6/p6-004-integration-safety-review` | Merged | `0a89df1` |
| [P6-005](P6-005_phase6_operator_dashboard.md) | Phase 6 Operator Dashboard | `phase6/p6-005-operator-dashboard` | Draft | pending |
| [P6-006](P6-006_phase6_alerting_and_reports.md) | Phase 6 Alerting and Reports | `phase6/p6-006-alerting-and-reports` | Draft | pending |
| [P6-007](P6-007_phase6_scheduler_and_runbooks.md) | Phase 6 Scheduler and Runbooks | `phase6/p6-007-scheduler-and-runbooks` | Draft | pending |
| [P6-008](P6-008_phase6_round2_integration_review.md) | Phase 6 Round 2 Integration Review | `phase6/p6-008-round2-operational-readiness-review` | Draft | pending |

## Merge Guidance

P6-001, P6-002, and P6-003 ran in parallel, each respecting its owned files, and merged into local `main` with no conflicts in the order below.

P6-004 ran in two phases:

- Phase 1: scaffold review and regression-gap check while P6-001 through P6-003 were running. Found that the consolidated `tests/safety/safety-regression.test.ts` harness did not yet exercise `RiskEngine`, `KillSwitchControlService`, or `OrderApprovalEngine` end-to-end; closed with two new integration-style regression tests.
- Phase 2: completed the integration review after P6-001 through P6-003 were merged into local `main`. Added four more regression tests requested by Engineer 3 (P6-003) for the kill-switch-gate and staleness behavior that closed Engineer 4's Phase 1 finding. Full findings: `docs/reviews/Codex_Phase6_Simulation_Safety_Review.md`.

Actual merge order (local `main`, never pushed to GitHub):

1. P6-001 (`76515cd`)
2. P6-002 (`e8855e7`)
3. P6-003 (`98955d5`)
4. P6-004 (`0a89df1`)

## Round 1 Outcome

`npm run check` passes on merged `main` (typecheck clean, 82 test files, 638 tests). No branch weakened an existing fail-closed control; P6-003 added new checks (kill-switch gate consultation, approval/check staleness, out-of-order kill-switch commands) that only make approval and broker-write decisions stricter. No real Toss broker-write adapter exists anywhere in the repository. Full detail, including a pre-existing (non-Phase-6) Phase 5 tooling bug discovered while running the Phase 5 no-write readiness commands, is in `docs/reviews/Codex_Phase6_Simulation_Safety_Review.md`.

This closes Phase 6 round 1. A follow-up reliability fix for `scripts/validate-toss-evidence-intake.mjs` landed after the round 1 merge so missing intake files now produce sanitized fail-closed reports instead of an unhandled exception.

## Round 2 Plan (P6-005 through P6-008)

Round 2 connects the Phase 6 safety core to operator-facing status, alerting, reporting, scheduler-safe jobs, and runbooks. It remains strictly no-write: no real Toss calls, no broker write commands, no dashboard controls that can trade, and no scheduler job that touches broker-facing network operations.

Use `ROUND2_FOUR_ENGINEER_ORCHESTRATOR_PROMPT.md` to launch the four-engineer batch. P6-005 owns dashboard read models, P6-006 owns alerting and reports, P6-007 owns scheduler/runbooks, and P6-008 owns integration review and safety regression coverage.

Any further Phase 6 work, and any future live-capable design phase, requires explicit human review per `docs/reviews/Codex_Phase6_Simulation_Safety_Review.md`, "Remaining Blockers Before Any Future Live-Capable Design Phase".

## Phase 6 Boundary

Phase 6 may produce paper orders, simulated execution records, approval/audit records, risk decisions, and reconciliation reports.

Phase 6 must not produce or submit real broker write commands.
