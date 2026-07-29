# Task ID

P6-006

## Goal

Add Phase 6 operational alerts and paper/simulation reports for risk, reconciliation, kill-switch, and guard states.

## Assigned Engineer

Engineer 2

## Module

Operational alerting, observability metrics, and paper/simulation reporting.

## Files To Modify Or Create

Primary files:

- `src/application/alerting/operational-alerting-service.ts`
- `tests/application/operational-alerting-service.test.ts`
- `src/application/observability/observability-metrics.ts`
- `tests/application/observability-metrics.test.ts`
- `docs/phase6/alerting-and-reports.md`

Allowed supporting files:

- `src/application/api-usage/api-usage-monitor.ts`
- `tests/application/api-usage-monitor.test.ts`

Avoid editing dashboard and scheduler/runbook files owned by P6-005/P6-007 unless coordination is required.

## Input

- Phase 6 round 1 produces deterministic reason codes for paper intent, reconciliation, risk, kill switch, approval, and broker-write guard outcomes.
- Alerts and reports must remain operational/read-only.

## Output

Implement or strengthen alert/report logic for:

- reconciliation discrepancies
- kill-switch active or unknown state
- risk veto
- stale approval/checks
- broker-write guard rejection
- paper intent rejection/deferment
- API usage/cost warnings that do not expose secrets

Alerts should be severity-classified and deterministic.

## Forbidden

- Do not trigger order execution from alerts.
- Do not add automatic remediation that places/cancels/modifies orders.
- Do not call Toss or any real broker API.
- Do not read `.env` or local real receipts.
- Do not include raw account identifiers, raw symbols, raw prices, raw quantities, tokens, or headers in alert text.
- Do not push to GitHub.

## Test Criteria

Run:

```bash
npx vitest run tests/application/operational-alerting-service.test.ts tests/application/observability-metrics.test.ts tests/application/api-usage-monitor.test.ts
npm run check
```

Tests must prove:

- alert severity is deterministic
- alerts never imply live trading authorization
- alert text is sanitized
- reconciliation and kill-switch blockers produce high-severity operator alerts
- stale approvals/checks produce actionable but non-executing alerts

## Completion Conditions

- Operational alerts/report summaries are Phase 6-aware.
- No alert can trigger broker writes.
- All tests pass.
- Final report lists alert categories and safety confirmation.

## Recommended Branch

`phase6/p6-006-alerting-and-reports`
