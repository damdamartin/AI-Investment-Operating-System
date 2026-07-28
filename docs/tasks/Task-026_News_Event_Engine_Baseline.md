# Task-026: News Event Engine Baseline

Status: Complete
Implemented In: 0.4.11

## Objective

Implement a baseline News and Event Engine that converts normalized news and validated AI analysis into event scores.

## Context

Required reading: `docs/06_AI_Architecture.md`, `docs/07_Trading_System.md`, `docs/11_AI_RULES.md`.

## Scope

- Event importance score.
- Confidence score.
- Positive, neutral, negative classification mapping.
- Contradiction and review-required handling.

## Out of Scope

- Direct signal generation.
- Direct trading.

## Outputs

- News/Event score service.
- Tests with fixture AIAnalysis records.

## Acceptance Criteria

- Low confidence or contradiction flags reduce or block event score.
- Review-required analysis cannot produce automated trade candidates.
- Event scores reference source analysis IDs.

## Tests Required

- Unit tests for confidence thresholds.
- Unit tests for contradiction behavior.

## Safety Requirements

- News and AI analysis cannot bypass risk and order approval.

## Dependencies

- Task-022.
- Task-023.
