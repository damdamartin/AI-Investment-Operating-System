# Task-019: Safety Regression Test Harness

Status: Complete
Implemented In: 0.4.2

## Objective

Create a dedicated safety regression test harness for non-negotiable AI and trading rules.

## Context

Required reading: `docs/08_Testing_Validation.md`, `docs/11_AI_RULES.md`, `docs/07_Trading_System.md`.

## Scope

- Test category or suite for safety regressions.
- Initial tests for AI boundary, signal/order separation, risk failure, money failure, kill switch, and unverified broker capability.

## Out of Scope

- Complete E2E trading lifecycle.
- Real broker integration.

## Outputs

- Safety test suite.
- Documentation for adding future safety tests.

## Acceptance Criteria

- Test suite fails if AI output can directly create orders.
- Test suite fails if Signal is treated as OrderIntent.
- Test suite fails if unverified broker capability or account permission can pass live approval.

## Tests Required

- This task is itself a test foundation task.

## Safety Requirements

- Safety tests must be easy to run locally and in CI.

## Dependencies

- Task-003.
- Task-006.
- Task-007.
- Task-008.
