# Task-042: Broker Write Command Guard

## Objective

Create a hard guard that prevents broker write commands unless all live-trading gates are satisfied.

## Context

Required reading: `docs/07_Trading_System.md`, `docs/11_AI_RULES.md`, `docs/13_Compliance_and_Legal_Review.md`, `docs/open_questions.md`.

## Scope

- Broker write command guard interface.
- Gate checks for compliance, account permission, capability, environment, kill switch, and approval.
- Explicit blocked result model.

## Out of Scope

- Real Toss write endpoint implementation.
- Bypassing unresolved open questions.

## Outputs

- Guard service.
- Tests for every blocking condition.

## Acceptance Criteria

- Default state blocks all broker write commands.
- Guard returns explicit blocking reasons.
- Guard cannot be disabled by strategy or AI code.

## Tests Required

- Unit tests for compliance, account, capability, kill switch, and environment blocks.
- Regression test that Claude output cannot bypass the guard.

## Safety Requirements

- If any required gate is unknown, block.

## Dependencies

- Task-017.
- Task-030.
- Task-047.
