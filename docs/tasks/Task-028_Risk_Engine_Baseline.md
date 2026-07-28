# Task-028: Risk Engine Baseline

## Objective

Implement the baseline Risk Engine that can approve or veto candidate orders based on risk rules.

## Context

Required reading: `docs/07_Trading_System.md`, `docs/08_Testing_Validation.md`, `docs/11_AI_RULES.md`.

## Scope

- Position concentration checks.
- Strategy exposure checks.
- Market exposure checks.
- Drawdown gate placeholder.
- Kill switch gate.
- RiskCheck output.

## Out of Scope

- Broker submission.
- Advanced portfolio optimization.

## Outputs

- Risk Engine service.
- RiskCheck model integration.
- Tests for veto logic.

## Acceptance Criteria

- Any failed hard risk rule returns rejection.
- Kill switch blocks approval.
- RiskCheck includes reason codes.

## Tests Required

- Unit tests for each hard rule.
- Regression tests for kill switch and drawdown gate.

## Safety Requirements

- Risk Engine failure or unavailability must block live order approval.

## Dependencies

- Task-008.
- Task-019.
