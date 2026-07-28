# Task-049: Strategy Promotion Dashboard Workflow

Status: Complete
Implemented In: 0.4.34
Last Updated: 2026-07-28

## Objective

Define and implement the dashboard workflow boundary for reviewing strategy promotion evidence.

## Context

Required reading: `docs/06_AI_Architecture.md`, `docs/08_Testing_Validation.md`, `docs/09_Operation_Deployment.md`.

## Scope

- Read-only promotion evidence view.
- Promotion decision request boundary.
- Sensitive control gate integration.
- Audit event for decisions.

## Out of Scope

- Fully automated production promotion.
- Live capital allocation increase.

## Outputs

- Promotion workflow dashboard boundary.
- Tests for evidence visibility and control gating.

## Acceptance Criteria

- Missing evidence blocks promotion action.
- Promotion decision is auditable.
- Initial implementation can require manual approval.

## Tests Required

- Unit or integration tests for promotion gating.

## Safety Requirements

- Dashboard cannot promote a strategy by bypassing Strategy Promotion Workflow.

## Implementation Notes

- Added `StrategyPromotionDashboardWorkflow` as the dashboard boundary for strategy promotion review.
- Added read-only promotion evidence view with evidence references and open questions.
- Added promotion decision request boundary that first passes through `DashboardSensitiveControlGate`.
- Promotion requests then pass through `StrategyPromotionWorkflow`; dashboard approval cannot bypass required evidence checks.
- Missing evidence blocks the promotion decision.
- Dashboard promotion decisions produce audit metadata and remain decision-only.

## Dependencies

- Task-036.
- Task-048.
