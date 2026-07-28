# Task-034: Paper Trading Engine

## Objective

Implement Paper Trading to simulate the operational order lifecycle without real capital.

## Context

Required reading: `docs/07_Trading_System.md`, `docs/08_Testing_Validation.md`, `docs/11_AI_RULES.md`.

## Scope

- Paper OrderIntent generation from approved simulated signals.
- Simulated order approval.
- Simulated broker order state.
- Simulated fills and rejections.

## Out of Scope

- Live broker write calls.
- Real Toss order endpoints.

## Outputs

- Paper Trading engine.
- Tests for lifecycle simulation.

## Acceptance Criteria

- Paper Trading exercises order lifecycle states.
- Paper results are stored separately from live results.
- Paper Trading cannot use live BrokerAccount write permissions.

## Tests Required

- Lifecycle tests.
- Unknown state simulation test.

## Safety Requirements

- Paper Trading must not call real broker write endpoints.

## Dependencies

- Task-007.
- Task-030.
