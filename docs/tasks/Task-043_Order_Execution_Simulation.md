# Task-043: Order Execution Simulation

Status: Complete
Implemented In: 0.4.28

## Objective

Implement simulated order execution through the execution pipeline without calling live broker write methods.

## Context

Required reading: `docs/07_Trading_System.md`, `docs/08_Testing_Validation.md`, `docs/11_AI_RULES.md`.

## Scope

- Simulated execution command from approved OrderApproval.
- Simulated broker response.
- Simulated accepted, rejected, partial, and unknown states.
- Outbox integration using fake handlers.

## Out of Scope

- Real Toss order submission.
- Live capital use.

## Outputs

- Execution simulation service.
- Tests for simulated order lifecycle paths.

## Acceptance Criteria

- Only approved orders can enter simulated execution.
- Unknown simulated state blocks dependent actions.
- Results are auditable.

## Implementation Notes

- Added an `OrderExecutionSimulationService`.
- Added simulated execution command model built from approved `OrderApproval` records.
- Added simulated broker response and execution record models.
- Added accepted, rejected, partially filled, filled, and unknown simulated execution states.
- Added simulated outbox event creation for fake execution handlers.
- Unknown simulated broker state is routed as `UNKNOWN_BROKER_STATE` for dead-letter handling by the Outbox worker.
- Rejected approvals are refused before execution simulation.

## Tests Required

- Lifecycle tests.
- Regression test for rejected approval not executable.

## Safety Requirements

- Simulation code must not call Toss write methods.

## Dependencies

- Task-030.
- Task-041.
