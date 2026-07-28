# Task-025: Fundamental Engine Interface

Status: Complete
Implemented In: 0.4.10

## Objective

Define the Fundamental Engine interface and placeholder implementation.

## Context

Required reading: `docs/02_System_Architecture.md`, `docs/03_Domain_Model.md`, `docs/06_AI_Architecture.md`.

## Scope

- Fundamental input model.
- Fundamental score output.
- Missing-data behavior.
- Placeholder implementation for future data provider integration.

## Out of Scope

- Real financial statement provider integration.
- Production scoring model.

## Outputs

- Interface and placeholder implementation.
- Tests for missing and partial data.

## Acceptance Criteria

- Missing fundamental data lowers confidence or blocks the score according to strategy requirements.
- Engine output is versioned.
- Engine does not create orders.

## Tests Required

- Unit tests for full, partial, and missing data.

## Safety Requirements

- Do not invent financial values.

## Dependencies

- Task-004.
