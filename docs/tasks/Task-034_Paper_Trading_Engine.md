# Task-034: Paper Trading Engine

Status: Complete
Implemented In: 0.4.19

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

## Implementation Notes

- Added a `PaperTradingEngine` for simulated order submission and broker lifecycle events.
- Added paper-only order, fill, event, and result records.
- Supported submitted, accepted, partially filled, filled, canceled, rejected, and unknown paper states.
- Unknown paper broker state blocks dependent trading in the same way an uncertain broker state should.
- Paper trading rejects live write-enabled broker accounts.
- Paper records intentionally do not contain broker order references or broker account identifiers.

## Tests Required

- Lifecycle tests.
- Unknown state simulation test.

## Safety Requirements

- Paper Trading must not call real broker write endpoints.

## Dependencies

- Task-007.
- Task-030.
