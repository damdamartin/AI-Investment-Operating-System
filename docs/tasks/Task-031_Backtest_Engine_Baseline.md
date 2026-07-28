# Task-031: Backtest Engine Baseline

## Objective

Create a baseline backtest engine that runs strategies against historical data with cost model references.

## Context

Required reading: `docs/08_Testing_Validation.md`, `docs/04_Database_Architecture.md`, `docs/06_AI_Architecture.md`.

## Scope

- Historical data loading boundary.
- Strategy evaluation loop.
- Cost model application.
- Basic result metrics.
- Evidence record output.

## Out of Scope

- Live trading.
- Full production strategy suite.

## Outputs

- Backtest engine skeleton.
- Result model.
- Tests with fake historical data.

## Acceptance Criteria

- Backtest requires a cost model version.
- Backtest records data range and input references.
- Missing corporate action data can block or flag results.

## Tests Required

- Unit tests for cost model application.
- Fixture tests for historical data gaps.

## Safety Requirements

- Backtest result alone cannot promote a strategy.

## Dependencies

- Task-011.
- Task-027.
