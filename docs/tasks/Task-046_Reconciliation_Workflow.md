# Task-046: Reconciliation Workflow

Status: Complete
Implemented In: 0.4.31
Last Updated: 2026-07-28

## Objective

Implement the workflow that uses read-only reconciliation results to update trading safety state.

## Context

Required reading: `docs/07_Trading_System.md`, `docs/09_Operation_Deployment.md`, `docs/11_AI_RULES.md`.

## Scope

- Reconciliation job orchestration.
- Mismatch severity classification.
- Trading block flag for uncertain state.
- Audit and alert hooks.

## Out of Scope

- Live corrective trading.
- Real broker write operations.

## Outputs

- Reconciliation workflow service.
- Tests for match, mismatch, stale, and unknown cases.

## Acceptance Criteria

- Unknown broker state blocks dependent trading.
- Severe mismatch can generate alert event.
- Reconciliation results are auditable.

## Tests Required

- Unit tests for severity classification.
- Integration tests with read-only reconciliation fixtures.

## Safety Requirements

- Never fix reconciliation mismatch by placing trades automatically in this task.

## Implementation Notes

- Added `ReconciliationWorkflowService` to convert read-only reconciliation reports into operational safety decisions.
- Added severity classification for clean, mismatch, stale, unknown, and critical missing-record cases.
- Added `CLEAR`, `WATCH`, and `BLOCKED` trading safety states.
- Added alert hooks for severe reconciliation mismatch and stale reconciliation reports.
- Added audit record output for every workflow evaluation.
- Corrective trading is explicitly disabled in the workflow result.

## Dependencies

- Task-038.
- Task-040.
