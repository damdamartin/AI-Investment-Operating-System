# Task-044: Order Cancel Simulation

## Objective

Implement simulated order cancellation behavior for Paper Trading and execution tests.

## Context

Required reading: `docs/07_Trading_System.md`, `docs/08_Testing_Validation.md`.

## Scope

- Cancel request model.
- Simulated cancel accepted, rejected, too-late, and unknown states.
- Audit record hooks.

## Out of Scope

- Real Toss cancel endpoint.
- Dashboard cancel control.

## Outputs

- Simulated cancel service.
- Tests for cancel lifecycle.

## Acceptance Criteria

- Filled orders cannot be cancelled.
- Unknown cancel state is represented and blocks assumptions.
- Cancel events are auditable.

## Tests Required

- Unit tests for cancel state transitions.

## Safety Requirements

- Do not implement live broker cancel calls in this task.

## Dependencies

- Task-007.
- Task-043.
