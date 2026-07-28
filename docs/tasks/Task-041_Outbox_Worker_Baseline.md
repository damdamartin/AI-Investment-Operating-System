# Task-041: Outbox Worker Baseline

## Objective

Implement the baseline worker pattern for processing durable outbox events.

## Context

Required reading: `docs/04_Database_Architecture.md`, `docs/07_Trading_System.md`, `docs/09_Operation_Deployment.md`.

## Scope

- Pending event selection.
- Worker lock metadata.
- Attempt count update.
- Success, failure, and dead-letter transitions.
- Idempotency key usage.

## Out of Scope

- Real Toss broker write calls.
- External notification provider integration.

## Outputs

- Outbox worker service.
- Tests for lock, retry, success, failure, and dead-letter paths.

## Acceptance Criteria

- A worker cannot process the same event concurrently.
- Failed events are retried according to policy.
- Events move to dead-letter after retry exhaustion.

## Tests Required

- Unit tests for state transitions.
- Integration tests for worker locking if database support exists.

## Safety Requirements

- Unknown broker state must not be blindly retried.

## Dependencies

- Task-012.
- Task-018.
