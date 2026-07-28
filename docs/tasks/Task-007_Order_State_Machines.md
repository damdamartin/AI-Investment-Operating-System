# Task-007: Order State Machines

## Objective

Implement internal order state machines for OrderIntent, OrderApproval, BrokerOrder, and Fill.

## Context

Required reading: `docs/03_Domain_Model.md`, `docs/07_Trading_System.md`, `docs/11_AI_RULES.md`.

## Scope

- OrderIntent states.
- OrderApproval states.
- BrokerOrder states.
- Fill representation.
- Invalid transition errors.

## Out of Scope

- Broker API submission.
- Reconciliation workers.

## Outputs

- State machine code and tests.

## Acceptance Criteria

- BrokerOrder cannot exist without an approval reference.
- Rejected approvals cannot be submitted.
- Unknown broker state is representable and blocks dependent trading.

## Tests Required

- Unit tests for valid and invalid transitions.
- Regression test for no approval, no broker submission.

## Safety Requirements

- Default behavior for unknown order state is stop, not retry.

## Dependencies

- Task-003.
- Task-006.
