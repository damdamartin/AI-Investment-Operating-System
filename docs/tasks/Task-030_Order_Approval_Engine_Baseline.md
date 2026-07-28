# Task-030: Order Approval Engine Baseline

## Objective

Implement the baseline Order Approval Engine that accepts or rejects OrderIntent records before any broker submission.

## Context

Required reading: `docs/07_Trading_System.md`, `docs/11_AI_RULES.md`, `docs/13_Compliance_and_Legal_Review.md`.

## Scope

- OrderIntent input.
- RiskCheck requirement.
- MoneyCheck requirement.
- BrokerAccount requirement.
- Compliance gate requirement.
- Broker capability requirement.
- OrderApproval output.

## Out of Scope

- Broker submission.
- Outbox worker.
- Live write endpoint.

## Outputs

- Order Approval Engine.
- Rejection reason model.
- Tests for approval and rejection paths.

## Acceptance Criteria

- Approval cannot be created without passing risk, money, account, compliance, and capability checks.
- Rejections are persisted or persistence-ready with reason codes.
- Approval record is separate from broker order.

## Tests Required

- Unit tests for every missing prerequisite.
- Regression test that AI output cannot create approval.

## Safety Requirements

- If any approval dependency is unknown, reject.

## Dependencies

- Task-005.
- Task-017.
- Task-028.
- Task-029.
