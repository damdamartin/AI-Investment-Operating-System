# Task-006: Strategy and Signal Model

Status: Complete
Implemented In: 0.4.1

## Objective

Implement strategy, strategy version, score set, and signal domain models.

## Context

Required reading: `docs/03_Domain_Model.md`, `docs/06_AI_Architecture.md`, `docs/08_Testing_Validation.md`, `docs/11_AI_RULES.md`.

## Scope

- Strategy.
- StrategyVersion.
- EngineScoreSet.
- Signal.
- Strategy lifecycle states.

## Out of Scope

- Real strategy algorithms.
- Production promotion workflow implementation.

## Outputs

- Domain models and state validation.

## Acceptance Criteria

- Approved strategy versions cannot be mutated in place.
- Signal is represented separately from OrderIntent.
- Candidate strategy states cannot skip required validation states.

## Tests Required

- Unit tests for strategy version immutability.
- Unit tests proving Signal does not create orders by itself.

## Safety Requirements

- AI-generated strategy suggestions must remain research artifacts until validated.

## Dependencies

- Task-003.
- Task-004.
