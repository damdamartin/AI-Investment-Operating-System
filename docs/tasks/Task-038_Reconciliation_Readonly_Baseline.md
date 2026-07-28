# Task-038: Reconciliation Read-Only Baseline

Status: Complete
Implemented In: 0.4.23

## Objective

Create the read-only reconciliation baseline for comparing internal state with broker-reported state.

## Context

Required reading: `docs/07_Trading_System.md`, `docs/05_API_Architecture.md`, `docs/11_AI_RULES.md`.

## Scope

- Reconciliation status model.
- Internal vs broker position comparison.
- Internal vs broker cash comparison.
- Unknown or mismatch state flags.

## Out of Scope

- Live corrective orders.
- Broker write calls.

## Outputs

- Reconciliation service baseline.
- Tests with fake broker read data.

## Acceptance Criteria

- Mismatches are detected and classified.
- Unknown broker state blocks dependent trading in later flows.
- Reconciliation uses read-only adapter methods.

## Implementation Notes

- Added a `ReconciliationService`.
- Added reconciliation status model: `CLEAN`, `MISMATCH`, and `UNKNOWN`.
- Added internal vs broker position comparison.
- Added internal vs broker cash comparison.
- Added missing internal and missing broker record classifications.
- Added read-only adapter reconciliation path using account snapshot and positions reads.
- Unknown broker read state blocks dependent trading.
- Reconciliation reports are read-only and do not contain corrective order commands.

## Tests Required

- Unit tests for match, mismatch, missing, and unknown states.

## Safety Requirements

- Never resolve mismatches by placing trades in this task.

## Dependencies

- Task-005.
- Task-014.
