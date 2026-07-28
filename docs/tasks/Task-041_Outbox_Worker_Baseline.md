# Task-041: Outbox Worker Baseline

Status: Complete
Implemented In: 0.4.26

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

## Implementation Notes

- Added an `OutboxWorkerService`.
- Added outbox event status model for pending, processing, processed, failed, and dead-letter states.
- Added worker lock metadata handling.
- Added attempt count updates.
- Added success, retry failure, and dead-letter transitions.
- Added idempotency key preservation.
- Unknown broker state and configured non-retryable errors move to dead-letter rather than being blindly retried.
- Output is state-transition-only and does not expose external command helpers.

## Tests Required

- Unit tests for state transitions.
- Integration tests for worker locking if database support exists.

## Safety Requirements

- Unknown broker state must not be blindly retried.

## Dependencies

- Task-012.
- Task-018.
