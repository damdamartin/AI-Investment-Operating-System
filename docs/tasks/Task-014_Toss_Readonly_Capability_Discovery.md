# Task-014: Toss Read-Only Capability Discovery

Status: Complete
Implemented In: 0.4.4

## Objective

Implement read-only Toss Securities capability discovery using safe adapter boundaries.

## Context

Required reading: `docs/05_API_Architecture.md`, `docs/07_Trading_System.md`, `docs/13_Compliance_and_Legal_Review.md`, `docs/open_questions.md`.

## Scope

- Read-only capability registry.
- Account capability discovery interface.
- Fixture-based tests for supported, unsupported, partial, and unverified capabilities.
- No live order submission.

## Out of Scope

- Broker write endpoints.
- Production live trading.
- Storing real credentials.

## Outputs

- Read-only Toss adapter methods or mocks.
- Capability result model.

## Acceptance Criteria

- Unknown capability defaults to unverified.
- Unverified capability blocks dependent live tasks.
- Capability checks produce safe audit records or log events.

## Tests Required

- Contract tests with fixtures.
- Unit tests for capability states.

## Safety Requirements

- This task must not implement order creation, correction, cancellation, or live broker write calls.

## Dependencies

- Task-002.
- Task-005.
- Task-013.
