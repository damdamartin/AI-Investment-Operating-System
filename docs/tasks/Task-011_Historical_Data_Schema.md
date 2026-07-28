# Task-011: Historical Data Schema

Status: Complete
Implemented In: 0.4.3

## Objective

Create schema support for historical price bars, corporate actions, market calendars, and cost model versions.

## Context

Required reading: `docs/02_System_Architecture.md`, `docs/04_Database_Architecture.md`, `docs/08_Testing_Validation.md`.

## Scope

- historical_price_bars.
- corporate_actions.
- cost_model_versions.
- optional market calendar placeholder.

## Out of Scope

- Selecting a historical data provider.
- Backtest engine implementation.

## Outputs

- Database migrations.
- Seed or fixture examples with fake data.

## Acceptance Criteria

- Historical bars record adjustment method and source.
- Corporate actions are linked to assets.
- Cost model versions are immutable once approved.

## Tests Required

- Migration tests.
- Data integrity tests for duplicate bars and required references.

## Safety Requirements

- Strategy validation cannot rely on unversioned cost assumptions.

## Dependencies

- Task-009.
- Task-010.
