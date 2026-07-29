# Phase 7 Small-Capital Readiness Gates (P7-003)

Version: 0.1.0
Status: Draft
Last Updated: 2026-07-29
Related Task: `docs/tasks/phase7_claude_worktree_tasks/P7-003_small_capital_readiness_gates.md`
Related Code: `src/application/live-readiness/small-capital-readiness.ts`,
`tests/application/small-capital-readiness.test.ts`
Related Docs: `docs/phase7/README.md`,
`docs/phase7/manual-live-approval-record.md`,
`docs/phase7/small-capital-operator-checklist.md`,
`docs/07_Trading_System.md` (sections 30, 31),
`docs/08_Testing_Validation.md` (sections 12, 13, 22),
`docs/09_Operation_Deployment.md`, `docs/11_AI_RULES.md`,
`docs/13_Compliance_and_Legal_Review.md`,
`docs/phase6/operator-dashboard.md`, `docs/phase6/alerting-and-reports.md`,
`docs/phase6/phase6-scheduler-jobs.md`

## Purpose

This document defines the small-capital readiness gates that must pass
before a **later, separately reviewed** phase may implement or enable real
Toss broker writes. It is a design document, not an implementation of live
trading.

Per `docs/phase7/README.md`, Phase 7:

- does not authorize live trading
- does not implement a real broker-write adapter
- only defines evidence, contracts, approval boundaries, and readiness
  gates for a future phase

Every gate below is written to **fail closed**: if a required input is
missing, unverified, stale, or ambiguous, the gate blocks readiness. None
of these gates, individually or together, can enable a real broker call.
The only thing that consumes them today is a pure evaluator
(`evaluateSmallCapitalReadiness` in
`src/application/live-readiness/small-capital-readiness.ts`) that returns a
report — it never calls a broker, never writes state, and never flips
`liveBrokerWriteAllowed` away from its literal `false`.

## How This Fits The Existing Validation Ladder

Per `docs/08_Testing_Validation.md` section 3, every strategy or trading
capability must move through:

```text
Unit Tests
-> Integration Tests
-> Contract Tests
-> Backtest
-> Walk-Forward Validation
-> Shadow Portfolio
-> Paper Trading
-> Small-Capital Live
-> Production
```

This document defines the gate between **Paper Trading** (fully covered by
Phase 6, see `docs/phase6/README.md`) and **Small-Capital Live** (not
implemented anywhere in this repository). It also defines the exit
conditions a future phase must satisfy before **Production** capital
expansion. It does not define or shortcut Backtest, Walk-Forward, or Shadow
Portfolio gates, which remain governed by `docs/08_Testing_Validation.md`
sections 8–10.

## 1. Numeric Capital Limits

These are illustrative, conservative starting defaults. They are not
hardcoded anywhere as "the" limits — they are supplied per-portfolio as
`SmallCapitalCapitalLimits` input to the evaluator, and an operator must
explicitly set them (see `docs/phase7/small-capital-operator-checklist.md`)
before any future live-capable phase could use them. Any *increase* to
these limits requires a new `ManualLiveApprovalRecord` (see
`docs/phase7/manual-live-approval-record.md`); a decrease does not.

| Limit | Suggested starting default | Currency | Rationale |
| --- | --- | --- | --- |
| Maximum order value | KRW 300,000 (~US$220) | KRW or USD, must match the traded instrument's currency | Small enough that a single mis-sized order cannot meaningfully damage the account while broker mechanics are still being validated (`docs/07_Trading_System.md` section 30). |
| Maximum daily notional exposure | KRW 900,000 (~US$650) | same | Roughly 3x a single max order, allowing a handful of small trades per day without permitting the daily limit to be reached by one oversized order. |
| Maximum total capital exposure | KRW 3,000,000 (~US$2,200) | same | The entire small-capital-live "at risk" ceiling across all open positions at once. Deliberately small relative to any meaningful portfolio, per `docs/07_Trading_System.md` section 30's "strict maximum total capital." |

These numbers deliberately have no authority beyond being a documented,
reviewable starting point. The evaluator takes real `Money` values (paired
with currency, per `docs/11_AI_RULES.md` Rule 20 — money is never a naked
number) and blocks readiness if a proposed order's value, projected daily
notional, or projected total exposure exceeds the corresponding configured
limit, or if any of the three limits is missing, zero, or negative
(`invalid_capital_limit_*`, `order_value_exceeds_max_order_value`,
`daily_notional_exposure_exceeds_max`, `total_capital_exposure_exceeds_max`).

A currency mismatch between an order and its limit is itself a blocking
condition (`*_currency_mismatch`), never a silent fallback conversion — per
`docs/07_Trading_System.md` section 24, KRW and USD are never mixed without
an explicit, verified exchange rate, which this gate does not attempt to
supply.

## 2. Allowed Market And Session Window

Fixed by policy, not caller-configurable (`SMALL_CAPITAL_ALLOWED_MARKETS`
in the evaluator module):

- `KR` — regular KRX session only
- `US` — regular US session only

Blocking conditions:

- `market_not_allowed_<market>` — any market outside `KR`/`US`.
- `order_outside_regular_session_window` — the order's
  `withinRegularSessionWindow` flag is not `true`.
- `extended_hours_orders_not_allowed` — the order's `isExtendedHours` flag
  is `true`. Per `docs/07_Trading_System.md` section 25, "extended-hours
  orders disabled until verified" — no verification path exists yet, so
  this is always blocking in small-capital-live readiness.

This gate does not itself decide what "the regular session" is for a given
market on a given day (that requires a market calendar, per
`docs/07_Trading_System.md` section 26) — it only enforces that whatever
computed that flag reported `true`, and that the order is not flagged
extended-hours.

## 3. Allowed Asset Types

Fixed by policy (`SMALL_CAPITAL_ALLOWED_ASSET_TYPES`):

- `STOCK`
- `ETF`

Per `docs/07_Trading_System.md` section 6, cryptocurrency, futures,
options, margin products, and short-selling instruments are excluded for
V1. Any asset type outside `STOCK`/`ETF` blocks readiness
(`asset_type_not_allowed_<type>`), including asset types that might be
added to shared domain vocabulary by an unrelated future change — this
gate keeps its own explicit allow-list rather than trusting whatever the
shared `AssetType` value object happens to accept at the time.

## 4. Allowed Order Types

Fixed by policy (`SMALL_CAPITAL_ALLOWED_ORDER_TYPES`):

- `LIMIT` only

Per `docs/07_Trading_System.md` section 25, market orders are avoided
"until explicitly verified and approved" with "a slippage limit,
emergency liquidation rules, and an audit record" — none of which exist in
this repository. Any order type other than `LIMIT` blocks readiness
(`order_type_not_allowed_<type>`). Fractional orders are separately and
always blocked (`fractional_orders_not_allowed`), per the same section's
"no fractional orders unless verified."

## 5. Required Human Approval Record

Small-capital live readiness requires an `APPROVED`, non-expired, non-
revoked `ManualLiveApprovalRecord` signed by a human with the `OWNER` role
(per `docs/09_Operation_Deployment.md` section 22's access-control roles),
using a verbatim required attestation string
(`REQUIRED_MANUAL_APPROVAL_ATTESTATION`). Full detail, including exactly
why this cannot be inferred or auto-populated by AI or code, is in
`docs/phase7/manual-live-approval-record.md`.

Blocking conditions produced by the evaluator:

- `missing_manual_live_approval_record`
- `manual_live_approval_status_pending` / `..._rejected` / `..._revoked`
- `manual_live_approval_revoked`
- `manual_live_approval_missing_approver_name`
- `manual_live_approval_role_not_owner`
- `manual_live_approval_attestation_mismatch`
- `manual_live_approval_missing_approved_at`
- `manual_live_approval_missing_expiry`
- `manual_live_approval_expired`

## 6. Required Reconciliation Freshness

Small-capital live readiness requires a current reconciliation signal
(shape: `{ liveReadinessBlocked, stale, reasonCodes }`, structurally
compatible with `ReconciliationWorkflowResult` from
`src/application/reconciliation/reconciliation-workflow-service.ts`,
already merged in Phase 6) where:

- `liveReadinessBlocked` is `false` — no unresolved reconciliation issue
  of any severity above `NONE` (see `ReconciliationWorkflowService`'s hard,
  non-overridable gate, unchanged and read-only from this task).
- `stale` is `false` — the underlying reconciliation report was checked
  within the configured freshness window
  (`ReconciliationWorkflowPolicy.staleAfterMs`, currently 5 minutes by
  default in the existing Phase 6 module).

Blocking conditions: `missing_reconciliation_signal`,
`reconciliation_not_fully_resolved`, `reconciliation_stale`.

This gate deliberately consumes the existing `liveReadinessBlocked` /
`stale` fields rather than re-deriving reconciliation logic — reconciliation
correctness itself is owned by the already-reviewed Phase 6 round 1/2
modules (`docs/phase6/reconciliation-snapshot-review.md`), which this task
does not modify.

## 7. Required Kill-Switch State

Small-capital live readiness requires every applicable kill-switch scope
(GLOBAL, MARKET, PORTFOLIO, STRATEGY, ASSET — per
`docs/07_Trading_System.md` section 22) to currently allow new orders. The
gate consumes a signal shaped `{ allowed, blocksNewOrders, reasonCodes }`,
structurally compatible with `KillSwitchTradingGate` from
`src/application/kill-switch/kill-switch-control-service.ts`
(`evaluateTradingGate` / `evaluateAggregateTradingGate`, already merged in
Phase 6).

Blocking conditions: `missing_kill_switch_signal`,
`kill_switch_blocks_new_orders` (raised whenever `allowed` is `false` or
`blocksNewOrders` is `true`).

An `UNKNOWN` kill-switch state must never be treated as safe — per
`docs/11_AI_RULES.md` Rule 16 and the existing
`KillSwitchControlService.evaluateTradingGate` behavior, `UNKNOWN` already
produces `allowed: false`, so it naturally blocks this gate too without any
special-casing here.

## 8. Required Alert/Dashboard State

Small-capital live readiness requires a currently reachable, healthy
operator status surface. The gate consumes a locally-defined signal shape
(`SmallCapitalOperatorSurfaceSignal`) rather than importing the full
dashboard/alerting types directly, deliberately mirroring the same
decoupling rationale `docs/phase6/alerting-and-reports.md`'s "Design Note"
already uses for its own builder functions — this keeps the readiness
module import-cycle-free and independent of dashboard/alerting internals it
does not need:

```text
dashboardReachable: boolean
systemStatus: "OK" | "WARNING" | "ERROR" | "BLOCKED"
openCriticalAlertCount: number
auditTrailRecorded: boolean
```

Required state:

- `dashboardReachable` is `true` — a status surface
  (`ReadOnlyDashboardService.buildStatus` and/or
  `Phase6OperatorSafetyDashboardService.buildSafetyStatus`, both already
  merged in Phase 6) could actually be produced.
- `systemStatus` is exactly `"OK"`. Any of `WARNING`, `ERROR`, or `BLOCKED`
  blocks readiness — per `docs/11_AI_RULES.md` Rule 22 ("fail closed"),
  this gate treats a degraded-but-not-yet-critical dashboard state
  (`WARNING`) as blocking too, not merely advisory, because this gate
  guards real capital exposure, not paper/simulation activity.
- `openCriticalAlertCount` is `0`.
- `auditTrailRecorded` is `true` — the caller confirms the corresponding
  audit record was actually persisted, mirroring
  `Phase6OperatorSafetyStatus.auditCoverage.auditTrailRecorded`'s existing
  semantics (`docs/phase6/operator-dashboard.md`).

Blocking conditions: `missing_operator_surface_signal`,
`dashboard_unreachable`, `dashboard_system_status_not_ok_<status>`,
`open_critical_alerts_present`, `audit_trail_not_recorded`.

## 9. Compliance Gate

Small-capital live readiness also requires the existing compliance gate
(`evaluateLiveTradingCompliance` /
`src/application/compliance/compliance-gate.ts`, already merged and
unmodified by this task) to report `allowed: true`. Every reason the
compliance gate reports is passed through, namespaced
(`compliance_<reason>`), so an operator sees a single unified blocking list
rather than needing to check two separate reports. Per
`docs/13_Compliance_and_Legal_Review.md` section 9, the compliance gate
itself already requires Toss API terms review, broker account permission
review, data licensing review, AI data handling review, tax recording
assumptions, personal-use boundary confirmation, and operator risk
acceptance — none of which this task re-implements.

Blocking condition: `missing_compliance_gate`, plus any
`compliance_<reason>` the compliance gate itself produces.

## 10. Explicit Conditions That Block Small-Capital Live Readiness

The full canonical list of blocking reason codes the evaluator can produce
(any one of these present makes `readyForSmallCapitalLive: false`):

```text
missing_or_invalid_evaluation_time
missing_capital_limits
invalid_capital_limit_max_order_value
invalid_capital_limit_max_daily_notional_exposure
invalid_capital_limit_max_total_capital_exposure
market_not_allowed_<market>
asset_type_not_allowed_<type>
order_type_not_allowed_<type>
order_outside_regular_session_window
extended_hours_orders_not_allowed
fractional_orders_not_allowed
order_value_exceeds_max_order_value[_currency_mismatch]
daily_notional_exposure_exceeds_max[_currency_mismatch]
total_capital_exposure_exceeds_max[_currency_mismatch]
missing_manual_live_approval_record
manual_live_approval_status_pending
manual_live_approval_status_rejected
manual_live_approval_status_revoked
manual_live_approval_revoked
manual_live_approval_missing_approver_name
manual_live_approval_role_not_owner
manual_live_approval_attestation_mismatch
manual_live_approval_missing_approved_at
manual_live_approval_missing_expiry
manual_live_approval_expired
missing_reconciliation_signal
reconciliation_not_fully_resolved
reconciliation_stale
missing_kill_switch_signal
kill_switch_blocks_new_orders
missing_operator_surface_signal
dashboard_unreachable
dashboard_system_status_not_ok_<status>
open_critical_alerts_present
audit_trail_not_recorded
missing_compliance_gate
compliance_<reason>
```

A missing input is always treated as a block, never as "assume clean" —
this matches every existing Phase 6 gate module
(`BrokerWriteCommandGuard`, `ComplianceGateResult`,
`ReconciliationWorkflowResult`) and `docs/11_AI_RULES.md` Rule 22.

## 11. Rollback Procedure

This section defines the rollback procedure a future live-capable phase
must implement and rehearse *before* small-capital live trading begins —
it is a design requirement for that future phase, not something
implemented in this repository today (there is nothing live to roll back
from yet).

A future small-capital-live rollback procedure must, at minimum:

1. **Immediate stop.** Activate the `GLOBAL` kill switch
   (`KillSwitchControlService.activate`, already merged) so no new order
   intent can become an approved order, per `docs/07_Trading_System.md`
   section 22.
2. **Preserve evidence.** Do not clear logs, alerts, or the audit trail.
   Per `docs/11_AI_RULES.md` Rule 30, performance or cleanup work must
   never remove audit records, domain events, or approval evidence — this
   applies doubly during an incident.
3. **Reconcile before resuming anything.** Run a full reconciliation
   (`ReconciliationWorkflowService.evaluate`, already merged) and require
   `liveReadinessBlocked: false` and `stale: false` before any further
   action, per `docs/07_Trading_System.md` section 25 ("Recovery Requires
   Reconciliation") and section 29 ("Fail-Safe Behavior").
4. **Revoke, do not silently expire, the approval.** The operator with
   `OWNER` role sets `ManualLiveApprovalRecord.approvalStatus: "REVOKED"`
   with `revokedAt` and `revokedReason` populated (see
   `docs/phase7/manual-live-approval-record.md`, "Revocation"). A future
   phase must never treat a rollback as "the approval will just expire
   naturally" — an active incident revokes immediately.
5. **Confirm capital exposure is fully known.** Cross-check broker-reported
   cash and positions against internal records before declaring the
   incident resolved (`docs/07_Trading_System.md` section 20).
6. **Re-run the full small-capital readiness evaluation from a clean
   state.** `evaluateSmallCapitalReadiness` must report
   `readyForSmallCapitalLive: true` with **zero** blocking reason codes,
   using a **newly signed** `ManualLiveApprovalRecord` (the previous one
   was revoked in step 4), before any future live-capable phase considers
   resuming.
7. **Record a postmortem.** Follow the same postmortem structure already
   established in `docs/phase6/phase6-operator-runbook.md`'s incident
   scenarios: symptoms, immediate actions, investigation, recovery,
   root cause, and follow-up action, filed as a
   `docs/reviews/` artifact for that future phase.

Until a future phase actually implements broker connectivity, steps 1, 3,
and 5 above have no real broker state to act on — but the *procedure* and
its ordering must be defined now, reviewed now, and rehearsed against
mocked/simulated state before any real capital is ever put at risk.

## 12. What This Task Does Not Do

- It does not implement or enable any real Toss API call.
- It does not create a broker-write command of any kind, including an
  unused or example type.
- It does not create any code path capable of setting
  `ManualLiveApprovalRecord.approvalStatus` to `"APPROVED"` — that value
  can only arrive as caller-supplied input, populated by a human outside
  this codebase.
- It does not modify any Phase 6 round 1/2 implementation file (dashboard,
  reconciliation, kill switch, risk engine, order approval, broker-write
  guard, alerting, scheduler) — all are consumed read-only, by type shape
  only, never imported where avoidable.
- It does not weaken any existing safety check, guard, or test assertion.
- `readyForSmallCapitalLive: true` from this evaluator is evidence that
  design-time gates are satisfied. It is not, and can never become, live
  trading authorization on its own.
