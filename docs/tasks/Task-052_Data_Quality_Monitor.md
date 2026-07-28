# Task-052: Data Quality Monitor

## Objective

Implement baseline monitoring for stale, missing, duplicate, or suspect data.

## Context

Required reading: `docs/02_System_Architecture.md`, `docs/04_Database_Architecture.md`, `docs/09_Operation_Deployment.md`.

## Scope

- Data quality status model.
- Market data freshness checks.
- News freshness checks.
- AI output validation failure rate checks.
- Alert hook for critical data problems.

## Out of Scope

- Provider replacement automation.
- Trading signal generation.

## Outputs

- Data quality monitor.
- Tests with stale and missing data fixtures.

## Acceptance Criteria

- Stale data is flagged.
- Critical data gaps can block trading-dependent flows.
- Quality status is dashboard-ready.

## Tests Required

- Unit tests for data quality classification.

## Safety Requirements

- Suspect data must not be treated as trusted input.

## Dependencies

- Task-021.
- Task-022.
- Task-023.
- Task-040.
