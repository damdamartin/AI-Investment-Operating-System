# Task-008: Risk and Money Model

## Objective

Implement domain models for risk limits, risk checks, money checks, and cash reservation rules.

## Context

Required reading: `docs/03_Domain_Model.md`, `docs/07_Trading_System.md`, `docs/08_Testing_Validation.md`, `docs/11_AI_RULES.md`.

## Scope

- RiskLimit.
- RiskCheck.
- MoneyCheck.
- CashBalance.
- Basic cash reservation validation.

## Out of Scope

- Full portfolio optimizer.
- Real-time market exposure calculation.

## Outputs

- Domain models and validation helpers.

## Acceptance Criteria

- Failed risk check blocks order approval.
- Failed money check blocks order approval.
- Reserved cash and available cash cannot be mixed.
- Risk limit changes are version-ready.

## Tests Required

- Unit tests for risk and money check pass/fail behavior.
- Unit tests for cash reservation edge cases.

## Safety Requirements

- No order may assume cash is available without a MoneyCheck.

## Dependencies

- Task-003.
- Task-005.
