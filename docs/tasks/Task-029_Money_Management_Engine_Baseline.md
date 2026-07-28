# Task-029: Money Management Engine Baseline

Status: Complete
Implemented In: 0.4.14

## Objective

Implement baseline position sizing and cash allocation checks.

## Context

Required reading: `docs/07_Trading_System.md`, `docs/03_Domain_Model.md`, `docs/11_AI_RULES.md`.

## Scope

- Available cash check.
- Reserved cash check.
- Per-order cap.
- Per-strategy cap.
- Minimum cash rule.
- MoneyCheck output.

## Out of Scope

- Full portfolio optimizer.
- Real broker cash sync.

## Outputs

- Money Management Engine.
- Tests for cash and allocation constraints.

## Acceptance Criteria

- Orders cannot use reserved or unsettled cash as available cash.
- Allocation cap failures return explicit rejection reasons.
- MoneyCheck is required before order approval.

## Tests Required

- Unit tests for cash states.
- Unit tests for allocation limits.

## Safety Requirements

- No order may assume buying power without MoneyCheck.

## Dependencies

- Task-008.
