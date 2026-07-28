# Task-047: Kill Switch Control Service

## Objective

Implement the kill switch state model and control service.

## Context

Required reading: `docs/07_Trading_System.md`, `docs/09_Operation_Deployment.md`, `docs/11_AI_RULES.md`.

## Scope

- Kill switch states.
- Activate and deactivate workflow.
- Reason and actor metadata.
- Audit and alert hooks.

## Out of Scope

- Dashboard UI.
- Broker order cancellation.

## Outputs

- Kill switch control service.
- Tests for activation, deactivation, and blocked trading checks.

## Acceptance Criteria

- Active kill switch blocks new order approval.
- Deactivation requires explicit action and audit metadata.
- State changes are auditable.

## Tests Required

- Unit tests for state transitions.
- Regression test for active kill switch blocking approval.

## Safety Requirements

- Unknown kill switch state must fail closed.

## Dependencies

- Task-018.
- Task-028.
