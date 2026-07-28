# Task-040: Operational Alerting Baseline

Status: Complete
Implemented In: 0.4.25

## Objective

Implement baseline exception-focused alerting rules.

## Context

Required reading: `docs/09_Operation_Deployment.md`, `docs/06_AI_Architecture.md`, `docs/07_Trading_System.md`.

## Scope

- Alert event model.
- Error and critical alert categories.
- Health Check red status alert hook.
- API failure alert hook.
- Kill switch alert hook.

## Out of Scope

- Specific email/SMS provider integration.
- Frequent trade notifications.

## Outputs

- Alerting service boundary.
- Tests for alert classification.

## Acceptance Criteria

- Normal buys, sells, profits, and daily reports do not trigger immediate alerts by default.
- Critical failures can create alert events.
- Alert events do not expose secrets.

## Implementation Notes

- Added an `OperationalAlertingService`.
- Added alert event model with category, severity, immediate notification flag, and redacted payload.
- Added classification for API failures, broker outages, order failures, unknown broker state, reconciliation mismatches, duplicate order risk, kill switch activation, risk limit breaches, stale market data, AI Health Check red/blocked, Claude schema failures, backup failures, and worker outages.
- Added AI Health Check red and blocked alert hooks.
- Normal trade and routine status events do not create alerts by default.
- Alert events are record-only and do not expose order, cancel, or manual intervention commands.

## Tests Required

- Unit tests for alert routing/classification.
- Redaction tests.

## Safety Requirements

- Alerts must support exception-focused operation without encouraging constant manual intervention.

## Dependencies

- Task-018.
- Task-037.
