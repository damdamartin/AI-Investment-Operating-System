# Task-005: Broker Account Model

Status: Complete
Implemented In: 0.4.1

## Objective

Implement the first-class BrokerAccount and PortfolioBrokerAccountLink domain models.

## Context

Required reading: `docs/03_Domain_Model.md`, `docs/04_Database_Architecture.md`, `docs/07_Trading_System.md`, `docs/open_questions.md`.

## Scope

- BrokerAccount entity.
- Broker permission status enum.
- PortfolioBrokerAccountLink entity.
- Validation for active links and live permission.

## Out of Scope

- Real Toss account lookup.
- Broker account credential storage.

## Outputs

- Domain models.
- Validation helpers for order approval prerequisites.

## Acceptance Criteria

- Unknown account permission blocks live broker write operations.
- A live order can resolve to exactly one verified broker account or fails.
- Account identifiers are safe for logs and dashboards.

## Tests Required

- Unit tests for permission states.
- Unit tests for portfolio-account link validation.

## Safety Requirements

- Never expose raw broker account numbers.
- Default permission state is unverified.

## Dependencies

- Task-003.
- Task-004.
