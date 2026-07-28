# Task-012: Outbox Event Schema

## Objective

Create database support for durable side-effect commands.

## Context

Required reading: `docs/04_Database_Architecture.md`, `docs/07_Trading_System.md`, `docs/09_Operation_Deployment.md`.

## Scope

- outbox_events table.
- status model.
- idempotency key constraint.
- retry metadata fields.

## Out of Scope

- Worker implementation.
- Broker submission logic.

## Outputs

- Database migration.
- Tests for unique idempotency keys and status transitions where applicable.

## Acceptance Criteria

- Outbox events can be created transactionally with future approval records.
- Duplicate idempotency keys are rejected.
- Dead-letter state is representable.

## Tests Required

- Migration tests.
- Constraint tests.

## Safety Requirements

- Outbox schema must support safe retries without duplicate broker submissions.

## Dependencies

- Task-009.
