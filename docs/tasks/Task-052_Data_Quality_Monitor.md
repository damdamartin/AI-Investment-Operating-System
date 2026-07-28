# Task-052: Data Quality Monitor

Status: Complete
Implemented In: 0.4.37
Last Updated: 2026-07-28

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

## Implementation Notes

- Added `DataQualityMonitor` for market data, news data, and AI validation quality checks.
- Added dashboard-ready quality status model with `GREEN`, `YELLOW`, `RED`, and `BLOCKED`.
- Added stale and missing market data checks using existing market data freshness assessment rules.
- Added stale and missing news event checks.
- Added Claude/AI validation failure-rate checks.
- Critical market data problems block trading-dependent flows and can emit alert hooks.

## Dependencies

- Task-021.
- Task-022.
- Task-023.
- Task-040.
