# Task-037: AI Health Check Baseline

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

## Tests Required

- Schema validation tests.
- Unit tests for status calculation fallback.

## Safety Requirements

- AI Health Check is auditor, not trader.

## Dependencies

- Task-016.
- Task-023.
