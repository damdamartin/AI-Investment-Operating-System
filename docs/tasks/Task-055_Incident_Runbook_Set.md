# Task-055: Incident Runbook Set

## Objective

Create incident runbooks for the most important failure scenarios.

## Context

Required reading: `docs/09_Operation_Deployment.md`, `docs/11_AI_RULES.md`.

## Scope

- Broker API failure runbook.
- Unknown order state runbook.
- Reconciliation mismatch runbook.
- Claude API failure runbook.
- Naver API failure runbook.
- Kill switch activation runbook.

## Out of Scope

- Full incident management platform integration.

## Outputs

- Incident runbook documents.
- Checklist for each scenario.

## Acceptance Criteria

- Each runbook includes symptoms, immediate action, investigation, recovery, and postmortem notes.
- Trading safety state is explicit in each runbook.

## Tests Required

- Documentation review against failure scenarios.

## Safety Requirements

- Runbooks must prefer no trade over uncertain trade.

## Dependencies

- Task-040.
- Task-046.
- Task-047.
