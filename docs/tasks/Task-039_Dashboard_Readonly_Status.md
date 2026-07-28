# Task-039: Dashboard Read-Only Status

## Objective

Create the initial read-only dashboard status surface.

## Context

Required reading: `docs/09_Operation_Deployment.md`, `docs/11_AI_RULES.md`.

## Scope

- System status view.
- Portfolio status view.
- Strategy status view.
- Risk status view.
- AI Health Check status view.
- Reconciliation status view.

## Out of Scope

- Kill switch controls.
- Live trading controls.
- Strategy promotion controls.

## Outputs

- Read-only dashboard module or API boundary.
- Tests for data masking.

## Acceptance Criteria

- Broker account identifiers are masked.
- Secrets are never displayed.
- Read-only dashboard cannot mutate system state.

## Tests Required

- Unit or integration tests for masking and read-only behavior.

## Safety Requirements

- No dashboard path may call Toss write methods.

## Dependencies

- Task-018.
- Task-037.
- Task-038.
