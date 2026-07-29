# Phase 6 Simulation Safety Plan

Version: 0.2.0
Status: Round 1 Complete
Last Updated: 2026-07-29

## Purpose

Phase 6 begins after Phase 5 read-only Toss verification closes.

This phase is limited to paper trading, simulation, auditability, reconciliation, risk controls, kill switches, approval guards, and integration review.

Phase 6 does not authorize live trading.

## Current Scope

Allowed:

- paper-only order intent flow
- simulated execution records
- sanitized reconciliation summaries
- risk veto and reason-code improvements
- kill-switch enforcement
- order approval and audit coverage
- broker write guard regression tests
- operator checklists and safety reviews

Forbidden:

- real Toss order submission
- real Toss order cancellation
- real Toss order modification or replacement
- transfer
- withdrawal
- money-moving currency conversion
- production capital use
- reading or committing `.env`
- reading or committing real `tmp/phase5` receipts
- real Toss API calls from tests

## Task Instructions

Claude Code parallel task instructions live in:

- `docs/tasks/phase6_claude_worktree_tasks/README.md`
- `docs/tasks/phase6_claude_worktree_tasks/PHASE6_FOUR_ENGINEER_ORCHESTRATOR_PROMPT.md`
- `docs/tasks/phase6_claude_worktree_tasks/ROUND2_FOUR_ENGINEER_ORCHESTRATOR_PROMPT.md`

## Phase 6 Completion Target

Phase 6 is complete when the project can prove:

- paper order intents cannot become live broker orders
- unresolved reconciliation blocks future live-readiness
- risk veto, kill switch, and approval failure block action
- broker write guard rejects write-looking commands
- audit output is sufficient to reconstruct paper/simulation decisions
- live broker writes remain blocked

## Round 1 Status

P6-001, P6-002, and P6-003 merged into local `main`, and P6-004's
integration review (`docs/reviews/Codex_Phase6_Simulation_Safety_Review.md`)
confirms all six completion-target items above:

- paper order intents cannot become live broker orders — `PaperOrderIntentPipeline`
  has no code path that constructs a broker-write command of any shape.
- unresolved reconciliation blocks future live-readiness — `ReconciliationWorkflowResult.liveReadinessBlocked`
  is a hard, non-overridable block on any unresolved discrepancy, not just
  a warning.
- risk veto, kill switch, and approval failure block action — proven
  end-to-end in `tests/safety/safety-regression.test.ts` using the real
  merged `RiskEngine`, `KillSwitchControlService`, and `OrderApprovalEngine`.
- broker write guard rejects write-looking commands — proven for both
  structurally forbidden AI-context shapes and for stale/unapproved
  approvals.
- audit output is sufficient to reconstruct paper/simulation decisions —
  `PaperOrderIntentAuditContext` and `AuditLogService` preserve decision
  lineage while redacting secrets and raw broker data.
- live broker writes remain blocked — no `TossSecuritiesAdapter` or any
  Toss order-write implementation exists anywhere in the repository.

Live trading is not authorized. See the review's "Remaining Blockers
Before Any Future Live-Capable Design Phase" for what a future round would
still need before any live-capable design work could even begin.

## Round 2 Plan

Round 2 focuses on operational readiness around the paper/simulation core:

- operator dashboard read model
- sanitized alerts and reports
- scheduler-safe no-write jobs
- operator runbooks and checklists
- integration safety review

Round 2 still does not authorize live trading. Dashboard, alert, report,
and scheduler outputs must remain no-write and must not trigger broker
orders, cancellations, replacements, transfers, withdrawals, or
money-moving currency conversion.
