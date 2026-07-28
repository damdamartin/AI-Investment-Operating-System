# Task-024: Market Engine Baseline

## Objective

Implement a baseline Market Engine that scores assets using price and volume data.

## Context

Required reading: `docs/02_System_Architecture.md`, `docs/03_Domain_Model.md`, `docs/07_Trading_System.md`.

## Scope

- Trend score placeholder.
- Volume score placeholder.
- Volatility score placeholder.
- Data freshness check.
- EngineScore output.

## Out of Scope

- Final production strategy logic.
- AI analysis.
- Broker execution.

## Outputs

- Market Engine service.
- Deterministic score output.
- Tests using fixtures.

## Acceptance Criteria

- Engine refuses stale or missing market data.
- Score output includes input references and score version.
- Score alone does not create Signal or OrderIntent.

## Tests Required

- Unit tests for scoring.
- Safety test for stale data refusal.

## Safety Requirements

- Market Engine is an analysis engine, not an execution engine.

## Dependencies

- Task-021.
