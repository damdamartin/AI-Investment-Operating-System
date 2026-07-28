# Task-022: News Event Normalization

Status: Complete
Implemented In: 0.4.7

## Objective

Normalize raw news articles into deduplicated news event candidates.

## Context

Required reading: `docs/05_API_Architecture.md`, `docs/06_AI_Architecture.md`, `docs/11_AI_RULES.md`.

## Scope

- Article normalization.
- Duplicate grouping.
- Company and keyword reference fields.
- NewsEventCandidate model.
- Source and timestamp validation.

## Out of Scope

- Claude interpretation.
- Trading signal creation.

## Outputs

- News normalization service.
- Fixture tests.

## Acceptance Criteria

- Duplicate articles can be grouped.
- Old articles can be flagged.
- Ambiguous company references remain unresolved instead of guessed.

## Tests Required

- Unit tests for duplicate grouping.
- Unit tests for stale news detection.
- Unit tests for ambiguous symbol handling.

## Safety Requirements

- NewsEventCandidate is not a Signal and cannot become an order.

## Dependencies

- Task-015.
