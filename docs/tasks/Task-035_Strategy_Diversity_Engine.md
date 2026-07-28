# Task-035: Strategy Diversity Engine

## Objective

Implement baseline strategy diversity analysis to prevent overconcentration in similar strategies.

## Context

Required reading: `docs/06_AI_Architecture.md`, `docs/08_Testing_Validation.md`.

## Scope

- Strategy category model.
- Holdings overlap metric.
- Signal timing similarity placeholder.
- Return correlation placeholder.
- Diversity review output.

## Out of Scope

- Advanced portfolio optimization.
- Production capital allocation automation.

## Outputs

- Strategy Diversity Engine baseline.
- Tests with fake strategy results.

## Acceptance Criteria

- Highly overlapping strategies can be flagged.
- Diversity review can be referenced by promotion workflow.
- Lower-return defensive strategies can be marked as diversification candidates.

## Tests Required

- Unit tests for overlap detection.
- Unit tests for correlation threshold placeholder behavior.

## Safety Requirements

- Recent high return alone must not justify concentrated allocation.

## Dependencies

- Task-006.
- Task-031.
