# Task-017: Compliance Gate Service

## Objective

Implement the internal compliance gate model that blocks live broker write operations until required reviews are satisfied.

## Context

Required reading: `docs/13_Compliance_and_Legal_Review.md`, `docs/07_Trading_System.md`, `docs/11_AI_RULES.md`, `docs/open_questions.md`.

## Scope

- Compliance review status model.
- Gate evaluation function.
- Blocking reason model.
- Tests for approved, rejected, unverified, and limitation states.

## Out of Scope

- Providing legal, tax, or investment advice.
- Automating external legal review.

## Outputs

- Compliance gate service or domain module.
- Test fixtures.

## Acceptance Criteria

- Default compliance state blocks live broker write operations.
- Approved with limitations is enforceable as constraints.
- Gate returns explicit blocking reasons.

## Tests Required

- Unit tests for all review states.
- Regression test that unresolved critical open questions block affected live operations.

## Safety Requirements

- If compliance status is unclear, fail closed.

## Dependencies

- Task-005.
- Task-008.
