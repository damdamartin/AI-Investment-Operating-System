# Task-036: Strategy Promotion Workflow

Status: Complete
Implemented In: 0.4.21

## Objective

Implement the workflow model for promoting strategies through validation stages.

## Context

Required reading: `docs/08_Testing_Validation.md`, `docs/06_AI_Architecture.md`, `docs/13_Compliance_and_Legal_Review.md`.

## Scope

- Promotion evidence model.
- Stage transition validation.
- Default promotion gate v0.2.
- Rejection reason model.
- Rollback plan reference.

## Out of Scope

- Fully automated production promotion.
- Live capital expansion.

## Outputs

- Promotion workflow service.
- Tests for stage gating.

## Acceptance Criteria

- Strategies cannot skip validation stages.
- Missing evidence blocks promotion.
- Compliance and open-question blocks are represented.

## Implementation Notes

- Added a `StrategyPromotionWorkflow` service.
- Added promotion evidence model with pass, warn, fail, and unverified states.
- Added default promotion gate v0.2 evidence requirements.
- Added validation for StrategyVersion stage transitions.
- Added missing evidence, failed evidence, unverified evidence, compliance, open-question, and human approval reason codes.
- Added rollback plan reference capture.
- Kept promotion output decision-only with no capital allocation or production activation command.

## Tests Required

- Unit tests for each stage transition.
- Regression test for backtest-only promotion rejection.

## Safety Requirements

- Early operation should require human approval for promotion to production.

## Dependencies

- Task-017.
- Task-031.
- Task-032.
- Task-033.
- Task-034.
- Task-035.
