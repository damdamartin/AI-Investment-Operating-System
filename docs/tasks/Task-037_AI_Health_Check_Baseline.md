# Task-037: AI Health Check Baseline

Status: Complete
Implemented In: 0.4.22

## Objective

Implement baseline AI Health Check reporting for system and strategy health.

## Context

Required reading: `docs/06_AI_Architecture.md`, `docs/09_Operation_Deployment.md`.

## Scope

- Health status model: green, yellow, red.
- Metrics input model.
- Claude analysis request boundary.
- Structured health result validation.

## Out of Scope

- Automatic live strategy changes.
- Direct alerts beyond local status output.

## Outputs

- AI Health Check service.
- Tests with fixture metric inputs and AI outputs.

## Acceptance Criteria

- Health Check cannot trigger trades.
- Red status can be consumed by alerting or dashboard later.
- Invalid Claude health output is rejected.

## Implementation Notes

- Added an `AIHealthCheckService`.
- Added health status model: `GREEN`, `YELLOW`, `RED`, and `BLOCKED`.
- Added health metrics input model and default deterministic health policy.
- Added Claude health output schema validation.
- Added audit-only health check records for later dashboard and alerting consumption.
- Invalid Claude output is rejected and does not override deterministic fallback status.
- Claude output cannot downgrade deterministic `RED` or `BLOCKED` status.

## Tests Required

- Schema validation tests.
- Unit tests for status calculation fallback.

## Safety Requirements

- AI Health Check is auditor, not trader.

## Dependencies

- Task-016.
- Task-023.
