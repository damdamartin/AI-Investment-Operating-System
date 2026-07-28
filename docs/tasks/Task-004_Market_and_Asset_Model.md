# Task-004: Market and Asset Model

## Objective

Implement internal models for markets, sessions, assets, symbols, and broker asset mappings.

## Context

Required reading: `docs/03_Domain_Model.md`, `docs/05_API_Architecture.md`, `docs/07_Trading_System.md`.

## Scope

- Market model for KR and US.
- Asset model for stock and ETF.
- Trading status model.
- BrokerAssetMapping model.
- Market session metadata placeholder.

## Out of Scope

- Live market calendar integration.
- Real Toss API calls.

## Outputs

- Domain models and validation tests.

## Acceptance Criteria

- Unknown market or asset type blocks tradability.
- Internal asset identity is separate from Toss payload shape.
- ETF support is represented without assuming every ETF is tradable.

## Tests Required

- Unit tests for asset classification and tradability flags.

## Safety Requirements

- Unclassified assets default to no trade.

## Dependencies

- Task-003.
