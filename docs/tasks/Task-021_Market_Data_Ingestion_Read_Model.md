# Task-021: Market Data Ingestion Read Model

## Objective

Create the read-side model for normalized market data ingestion without live trading behavior.

## Context

Required reading: `docs/02_System_Architecture.md`, `docs/04_Database_Architecture.md`, `docs/05_API_Architecture.md`, `docs/07_Trading_System.md`.

## Scope

- Define market data snapshot model.
- Define ingestion metadata.
- Store source, collected time, market, asset, price, volume, and data freshness.
- Add stale-data detection helper.

## Out of Scope

- Real-time streaming.
- Broker order submission.
- Strategy execution.

## Outputs

- Market data read model.
- Persistence-ready DTO or repository boundary.
- Tests for freshness and missing data.

## Acceptance Criteria

- Stale market data is detectable.
- Market data source is traceable.
- Missing or suspect data cannot be treated as fresh.

## Tests Required

- Unit tests for freshness thresholds.
- Fixture tests for valid, stale, missing, and suspect data.

## Safety Requirements

- Stale data must block trading decisions in later tasks.

## Dependencies

- Task-004.
- Task-010.
