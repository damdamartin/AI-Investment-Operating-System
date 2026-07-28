# Task-003: Core Value Objects

## Objective

Implement core value objects used across the domain.

## Context

Required reading: `docs/03_Domain_Model.md`, `docs/07_Trading_System.md`, `docs/11_AI_RULES.md`.

## Scope

- Money.
- Currency.
- Quantity.
- Price.
- Percent.
- Market.
- AssetType.
- TimeRange.

## Out of Scope

- Persistence models.
- External API payload models.

## Outputs

- Immutable or validation-safe value object implementations.
- Error types for invalid values.

## Acceptance Criteria

- Currency mismatch cannot be silently combined.
- Negative quantity, price, or money behavior is explicit.
- Precision handling is documented and tested.

## Tests Required

- Unit tests for construction, validation, arithmetic, comparison, and serialization.

## Safety Requirements

- Money and quantity calculations must not use unsafe floating-point assumptions unless explicitly justified and tested.

## Dependencies

- Task-001.
