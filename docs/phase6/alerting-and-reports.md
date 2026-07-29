# Phase 6 Alerting and Reports (P6-006)

Version: 0.1.0
Status: Draft
Last Updated: 2026-07-29
Related Task: `docs/tasks/phase6_claude_worktree_tasks/P6-006_phase6_alerting_and_reports.md`

## Purpose

This note documents the Phase 6 round 2 strengthening of operational
alerting and observability metrics for the round-1 safety core: paper order
intent decisions, reconciliation, risk vetoes, kill-switch state, order
approval staleness, and broker-write-guard rejections. It also adds
sanitized API usage/cost warnings.

This work is strictly observational. No alert or metric can trigger, place,
cancel, modify, or retry a broker order. It consumes the deterministic
reason codes produced by the already-merged round-1 modules
(`risk-engine.ts`, `kill-switch-control-service.ts`,
`order-approval-engine.ts`, `broker-write-command-guard.ts`,
`paper-trading-engine.ts`, `reconciliation-workflow-service.ts`) read-only;
none of those files were modified.

## Files Changed

- `src/application/alerting/operational-alerting-service.ts`
- `src/application/observability/observability-metrics.ts`
- `tests/application/operational-alerting-service.test.ts`
- `tests/application/observability-metrics.test.ts`
- `docs/phase6/alerting-and-reports.md` (this file)

`src/application/api-usage/api-usage-monitor.ts` and its test were reviewed
but not modified — the existing sanitization (`redactObject` over
`safeMetadata`) was already sufficient, and the new cost/rate-limit alerts
are built from its already-safe aggregate summary fields (`totalCalls`,
`totalFailures`, `totalRateLimited`, `totalEstimatedCostUsd`), never from
raw request/response data.

## Design Note: Why No Round-1 File Was Imported Or Modified

`OperationalAlertingService`'s new builder methods (`fromKillSwitchGate`,
`fromRiskCheck`, `fromOrderApprovalRejection`, `fromBrokerWriteGuardResult`,
`fromPaperOrderIntentDecision`, `fromReconciliationWorkflow`,
`fromApiUsageSummary`) accept small, locally-defined, duck-typed input
interfaces (for example `{ allowed: boolean; reasonCodes: string[] }`)
instead of importing the concrete round-1 types
(`KillSwitchTradingGate`, `RiskEngineOutput`, `OrderApprovalEngineOutput`,
`BrokerWriteCommandGuardResult`, `PaperOrderIntentPipelineResult`,
`ReconciliationWorkflowResult`).

This was a deliberate choice, not an oversight:

- Two round-1 modules (`kill-switch-control-service.ts`,
  `reconciliation-workflow-service.ts`) already import
  `OperationalAlertingService` from this file. Importing their types back
  into `operational-alerting-service.ts` would create a module cycle.
- TypeScript's real output shapes are structurally compatible with these
  local interfaces, so callers can pass a real
  `BrokerWriteCommandGuardResult` (etc.) directly with no adapter code.
- It keeps every alert builder testable in isolation with plain object
  literals, which is what the test suite does throughout.

## Alert Categories Implemented Or Strengthened

| Category | Trigger | Typical severity |
|---|---|---|
| `RECONCILIATION_MISMATCH` | `classify()` on a `RECONCILIATION_MISMATCH`/`STALE_MARKET_DATA` event (existing, used by `ReconciliationWorkflowService`), or the new severity-aware `fromReconciliationWorkflow()` | ERROR (existing path) / CRITICAL for HIGH, CRITICAL, or UNKNOWN reconciliation severity (new path) |
| `KILL_SWITCH` | `classify()` on `KILL_SWITCH_ACTIVATED` (existing) or the new `KILL_SWITCH_STATE_UNKNOWN` event type; `fromKillSwitchGate()`; kill-switch reason codes surfaced through `fromOrderApprovalRejection()` | CRITICAL always — active and unknown kill-switch state are both treated as high severity |
| `RISK_VETO` (new) | `fromRiskCheck()` for a `FAIL` or `BLOCKED` `RiskCheck` result | ERROR (`FAIL`) or CRITICAL (`BLOCKED`, or any kill-switch-tagged reason code) |
| `STALE_APPROVAL` (new) | `fromOrderApprovalRejection()` when the rejection reason codes are staleness-only (`*_stale`, `*_timestamp_in_future`, `missing_evaluation_time`) | WARNING — actionable (re-run the check), never executing |
| `BROKER_WRITE_GUARD_BLOCKED` (new) | `fromBrokerWriteGuardResult()` when `BrokerWriteCommandGuard` rejects a command | ERROR by default, CRITICAL if a kill-switch or reconciliation reason code is present |
| `PAPER_INTENT_BLOCKED` (new) | `fromPaperOrderIntentDecision()` for `REJECTED` or `DEFERRED` paper decisions | WARNING for `DEFERRED` (missing input only), ERROR for `REJECTED`, CRITICAL if a live-write-capable broker account was attached to a paper candidate |
| `API_USAGE_WARNING` (new) | `fromApiUsageSummary()` — cost threshold, failure-rate threshold, or any rate-limited call in the period | WARNING or CRITICAL for cost, ERROR for failure rate, WARNING for rate limiting |

Existing categories (`API_FAILURE`, `BROKER_UNAVAILABLE`, `ORDER_FAILURE`,
`UNKNOWN_BROKER_STATE`, `DUPLICATE_ORDER_RISK`, `RISK_LIMIT`, `STALE_DATA`,
`AI_HEALTH`, `CLAUDE_SCHEMA_FAILURE`, `DATABASE_BACKUP_FAILURE`,
`WORKER_DOWN`) are unchanged.

## Deterministic Severity Classification

All new reason-code-driven builders share one private, pure function,
`classifyReasonCodes(reasonCodes: string[])`, so severity never depends on
call order, timing, or randomness — only on which reason codes are present.
Rule precedence (first match wins, evaluated with `.some()` so array order
never matters):

1. Any reason code containing `kill_switch` → **CRITICAL**.
2. Any reason code containing `reconciliation` → **CRITICAL**.
3. The exact code `live_broker_account_not_allowed_for_paper_trading` → **CRITICAL**
   (an active safety violation — a live-write-capable account attached to a
   paper-only candidate — not a missing input).
4. Any reason code containing `stale`, `timestamp_in_future`, or equal to
   `missing_evaluation_time` → **WARNING** (actionable, not an active veto).
5. Any reason code starting with `missing_` → **ERROR** (a required gate was
   never supplied).
6. Otherwise → **ERROR** (an active rejection, e.g.
   `risk_check_not_passing`, `money_check_not_passing`,
   `broker_account_live_trading_not_allowed`).

Reconciliation workflow severity is mapped separately and just as
deterministically: `reconciliationAlertSeverity()` maps `CRITICAL`,
`UNKNOWN`, and `HIGH` all to `CRITICAL`, `MEDIUM` to `ERROR`, `LOW` to
`WARNING`, and `NONE` produces no alert at all.

Tests prove this determinism directly: the same reason-code set in a
different array order yields the same severity and category, and calling
the same builder twice with the same input is repeatable.

## Alerts Never Imply Live Trading Authorization

Every `AlertEvent`, regardless of which builder produced it, now carries two
literal (not computed) fields:

```ts
liveBrokerWriteAllowed: false;
impliesLiveTradingAuthorization: false;
```

These are structural guarantees, not just message-wording conventions — no
code path in `operational-alerting-service.ts` can set either field to
anything but `false`. A test asserts this holds across every builder
method, and a separate test scans alert `title`/`message` text for phrases
that would wrongly imply trading was authorized, resumed, or executed live.

## Sanitization

Every alert and metric payload passes through the existing
`redactObject()` (`src/config/redaction.ts`) before being returned, exactly
as the pre-existing `classify()`/`emit()` paths already did. The new
builders only ever place already-safe values into `payload` — reason codes
(a fixed internal vocabulary, never raw broker data), counts, severities,
scopes, decisions, and rounded cost figures. None of the new code accepts
or forwards raw account identifiers, symbols, prices, quantities, tokens,
or headers. `fromApiUsageSummary()` in particular only reads
`ApiUsageSummary`'s already-aggregated numeric fields
(`totalCalls`, `totalFailures`, `totalRateLimited`,
`totalEstimatedCostUsd`) — it never touches `safeMetadata` contents or
`claudeUsage` details directly.

## Observability Metrics Strengthening

`src/application/observability/observability-metrics.ts` gained:

- Five new baseline metric names: `trading.stale_approval`,
  `trading.broker_write_guard_blocked`, `order.paper_intent_rejected`,
  `order.paper_intent_deferred`, `api.cost_warning`.
- `metricNameForAlertCategory(category)` — a deterministic, explicit
  (not inferred) mapping from `AlertCategory` to the baseline metric that
  should be incremented when that alert fires. Categories without a mapped
  metric return `undefined` rather than a guessed name.
- `paperIntentMetricNameFor(decision)` — separates the two paper-intent
  outcomes that share one alert category (`PAPER_INTENT_BLOCKED`) into two
  distinct counters.
- `ObservabilityMetricsService.emitFromAlert(alert)` — emits the mapped
  baseline metric from an `AlertEvent`, carrying only `{ alertId }` plus
  `severity`/`category` labels, never the alert's own (already sanitized)
  payload contents.
- `ObservabilityMetricsService.summarizeAlertSeverity(alerts)` — a
  deterministic per-severity count for dashboard/report summaries.

Observability importing `AlertCategory`/`AlertEvent`/`AlertSeverity` types
from alerting is a one-directional dependency (`observability -> alerting`);
alerting does not import from observability, so no cycle is introduced.

## Forbidden Actions — Confirmed Absent

- No alert or metric builder constructs, submits, cancels, retries, or
  modifies a broker order. Grep confirms no reference to
  `TossSecuritiesAdapter`, `submitOrder`, `cancelOrder`, or
  `BrokerWriteCommandGuardInput` construction anywhere in either changed
  source file.
- No network call of any kind was added; both files remain pure functions
  over already-in-memory inputs.
- `.env` and real `tmp/phase5/*` receipts were not read, printed,
  inspected, or committed as part of this work.
- No file outside this task's ownership
  (`src/application/alerting/`, `src/application/observability/`,
  `src/application/api-usage/`, the matching test files, and this doc) was
  modified.

## Test Coverage Summary

`tests/application/operational-alerting-service.test.ts` (28 tests) and
`tests/application/observability-metrics.test.ts` (15 tests) prove:

- Alert severity is deterministic (order-independence and repeatability
  tests).
- Alerts never imply live trading authorization (structural field check
  plus a message-content scan across builders).
- Alert text is sanitized (existing redaction tests plus new tests on the
  API usage/cost warning payloads).
- Reconciliation severities `HIGH`/`CRITICAL`/`UNKNOWN` and both active and
  unknown kill-switch states produce `CRITICAL`, `immediateNotification:
  true` operator alerts.
- Stale/clock-skewed approval and money/risk checks, and deferred paper
  intents pending a missing check, produce `WARNING`-level, non-executing,
  actionable alerts (`STALE_APPROVAL` category, `immediateNotification:
  false`).
- `metricNameForAlertCategory` and `paperIntentMetricNameFor` are
  deterministic and every mapped name resolves to a real baseline metric
  definition.

`tests/application/api-usage-monitor.test.ts` (5 tests, unmodified) was
re-run alongside the above per the task's required command and continues to
pass unchanged.
