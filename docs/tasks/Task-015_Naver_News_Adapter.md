# Task-015: Naver News Adapter

Status: Complete
Implemented In: 0.4.5

## Objective

Implement the Naver News adapter for news search and normalized article metadata.

## Context

Required reading: `docs/05_API_Architecture.md`, `docs/06_AI_Architecture.md`, `docs/11_AI_RULES.md`.

## Scope

- Adapter method for search queries.
- Normalized news article model.
- HTML tag cleanup.
- Basic duplicate grouping key.
- Rate limit and error handling metadata.

## Out of Scope

- AI event interpretation.
- Direct trading signal generation.

## Outputs

- NaverNewsAdapter implementation or mock-compatible boundary.
- Tests using fixtures.

## Acceptance Criteria

- News results do not directly create trading signals.
- Old or duplicate articles can be identified by metadata.
- API errors fail safely.

## Tests Required

- Fixture tests for normal and malformed responses.
- Tests for duplicate key generation.

## Safety Requirements

- News alone must never trigger an order.

## Dependencies

- Task-002.
- Task-013.
