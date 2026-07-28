# Task-032: Walk-Forward Validation

Status: Complete
Implemented In: 0.4.17

## Objective

Implement walk-forward validation to compare strategy behavior across training and validation windows.

## Context

Required reading: `docs/08_Testing_Validation.md`, `docs/06_AI_Architecture.md`.

## Scope

- Window definition model.
- Train/test split metadata.
- Result comparison.
- Degradation flags.

## Out of Scope

- Strategy auto-promotion.
- Live trading.

## Outputs

- Walk-forward validation service.
- Tests using fake backtest outputs.

## Acceptance Criteria

- Validation windows are recorded.
- Performance degradation is detected.
- Validation output can be used by promotion workflow.

## Tests Required

- Unit tests for window construction.
- Unit tests for degradation threshold behavior.

## Safety Requirements

- Validation must not use future data in earlier windows.

## Dependencies

- Task-031.
