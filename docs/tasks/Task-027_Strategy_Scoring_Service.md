# Task-027: Strategy Scoring Service

Status: Complete
Implemented In: 0.4.12

## Objective

Combine engine outputs into strategy-specific score sets.

## Context

Required reading: `docs/03_Domain_Model.md`, `docs/06_AI_Architecture.md`, `docs/07_Trading_System.md`.

## Scope

- EngineScoreSet aggregation.
- Strategy-specific weights.
- Score versioning.
- Candidate Signal creation only after scoring rules pass.

## Out of Scope

- OrderIntent creation.
- Production strategy promotion.

## Outputs

- Strategy scoring service.
- Tests for weighted scoring and blocking conditions.

## Acceptance Criteria

- A Signal may be created only from complete required score inputs.
- Missing required engine output blocks scoring.
- Signal remains separate from OrderIntent.

## Tests Required

- Unit tests for scoring.
- Regression test that Signal is not an order.

## Safety Requirements

- Engine scores cannot bypass Risk Engine, Money Management Engine, or Order Approval Engine.

## Dependencies

- Task-006.
- Task-024.
- Task-025.
- Task-026.
