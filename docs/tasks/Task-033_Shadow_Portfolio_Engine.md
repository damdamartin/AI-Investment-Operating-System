# Task-033: Shadow Portfolio Engine

## Objective

Implement Shadow Portfolio simulation for candidate strategies using live-like market inputs without real capital.

## Context

Required reading: `docs/06_AI_Architecture.md`, `docs/08_Testing_Validation.md`, `docs/11_AI_RULES.md`.

## Scope

- Virtual portfolio state.
- Candidate strategy registration.
- Simulated fills with slippage and cost assumptions.
- Shadow performance records.

## Out of Scope

- Real broker orders.
- Paper Trading lifecycle.

## Outputs

- Shadow Portfolio engine.
- Tests with simulated market data.

## Acceptance Criteria

- Shadow portfolios cannot link to live broker write permissions.
- Results include costs and slippage assumptions.
- Candidate strategies are isolated from production capital.

## Tests Required

- Unit tests for virtual portfolio updates.
- Regression test that Shadow cannot submit broker orders.

## Safety Requirements

- Shadow Portfolio must never call Toss write methods.

## Dependencies

- Task-011.
- Task-027.
- Task-029.
