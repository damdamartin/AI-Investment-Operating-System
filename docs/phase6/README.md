# Phase 6 Simulation Safety Plan

Version: 0.1.0
Status: Draft
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

## Phase 6 Completion Target

Phase 6 is complete when the project can prove:

- paper order intents cannot become live broker orders
- unresolved reconciliation blocks future live-readiness
- risk veto, kill switch, and approval failure block action
- broker write guard rejects write-looking commands
- audit output is sufficient to reconstruct paper/simulation decisions
- live broker writes remain blocked
