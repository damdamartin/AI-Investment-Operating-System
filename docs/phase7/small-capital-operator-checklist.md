# Phase 7 Small-Capital Operator Checklist (P7-003)

Version: 0.1.0
Status: Draft
Last Updated: 2026-07-29
Related Task: `docs/tasks/phase7_claude_worktree_tasks/P7-003_small_capital_readiness_gates.md`
Related Code: `src/application/live-readiness/small-capital-readiness.ts`
Related Docs: `docs/phase7/small-capital-readiness-gates.md`,
`docs/phase7/manual-live-approval-record.md`,
`docs/phase6/phase6-operator-runbook.md` (style precedent),
`docs/phase6/operator-dashboard.md`, `docs/phase6/alerting-and-reports.md`,
`docs/phase6/phase6-scheduler-jobs.md`, `docs/07_Trading_System.md`
(sections 30, 31), `docs/08_Testing_Validation.md` (section 12)

## Purpose

This checklist is for a human operator (`OWNER` role, per
`docs/09_Operation_Deployment.md` section 22) deciding whether
small-capital-live promotion readiness currently holds, using
`evaluateSmallCapitalReadiness` from
`src/application/live-readiness/small-capital-readiness.ts`.

**This checklist does not authorize live trading.** No real broker write
path exists in this repository. This checklist prepares an operator to use
the readiness gate correctly once a later, separately reviewed phase
implements real broker connectivity — and it doubles as the go/no-go
procedure that phase's operator would actually follow.

If any step below produces a result that looks like it authorizes a real
broker write today, treat that as a stop condition, not as a step to
follow — nothing in this repository should ever produce that result, and
if it does, stop and escalate rather than proceeding.

## Prerequisites Before Using This Checklist

Do not start this checklist unless all of the following already hold —
these are inputs *to* small-capital-live readiness, not part of it:

- Backtest, Walk-Forward Validation, and Shadow Portfolio stages have
  passed for the target strategy version (`docs/08_Testing_Validation.md`
  sections 8–10).
- Paper Trading has run for at least the default minimum
  (`docs/08_Testing_Validation.md` section 13.1: at least 30 trading days
  or 30 order lifecycle simulations) with no unresolved operational
  errors, using the already-merged Phase 6 paper trading engine.
- The Phase 6 daily go/no-go checklist
  (`docs/phase6/phase6-operator-runbook.md`) currently reports **Go** on
  all five checks.
- `docs/13_Compliance_and_Legal_Review.md` section 9's compliance gate
  (`evaluateLiveTradingCompliance`) currently reports `allowed: true`.

## Small-Capital Readiness Go/No-Go Checklist

Run through these steps in order. Each step maps to one input group of
`SmallCapitalReadinessInput` (`docs/phase7/small-capital-readiness-gates.md`,
sections 1–9).

### Step 1: Confirm And Record Numeric Capital Limits

- Confirm `maxOrderValue`, `maxDailyNotionalExposure`, and
  `maxTotalCapitalExposure` are each set, positive, and paired with the
  correct currency for the portfolio being evaluated.
- Confirm these limits match what the (to-be-signed) manual approval
  record's attestation actually reviewed — a limit change after signing
  requires a new approval (`docs/phase7/manual-live-approval-record.md`,
  "Revocation").
- **Go**: all three limits are explicit, positive, and match the signed
  approval's scope. **No-Go**: any limit is missing, zero, negative, or
  was changed after the approval was signed.

### Step 2: Confirm The Proposed Order (If Evaluating One)

- Confirm market is `KR` or `US`, asset type is `STOCK` or `ETF`, and
  order type is `LIMIT`.
- Confirm the order falls inside the regular session window and is not
  flagged extended-hours or fractional.
- Confirm the order's value and projected daily/total exposure are within
  Step 1's limits.
- **Go**: all fields above check out, or no specific order is being
  evaluated yet (general readiness only — expect a
  `no_proposed_order_evaluated_against_numeric_limits` warning, which is
  informational, not blocking). **No-Go**: any field above is
  out-of-policy.

### Step 3: Confirm The Manual Live Approval Record

- Confirm a `ManualLiveApprovalRecord` exists with `approvalStatus:
  "APPROVED"`, `approvedByRole: "OWNER"`, the exact required attestation
  text, a recorded `approvedAt`, and an `expiresAt` that has not yet
  passed.
- Confirm `revokedAt` is not set.
- Confirm the record's `scopePortfolioId` and `scopeStrategyVersionId`
  match what is actually being evaluated.
- **Go**: the record is `APPROVED`, unexpired, unrevoked, correctly
  scoped, and was actually signed by the human `OWNER` (not
  copy-pasted or generated on their behalf — see
  `docs/phase7/manual-live-approval-record.md`, "Why AI Cannot
  Auto-Populate This Record"). **No-Go**: anything above fails, or the
  operator cannot confirm the human actually reviewed what they signed.

### Step 4: Confirm Reconciliation Freshness

- Read the current reconciliation signal
  (`ReconciliationWorkflowResult.liveReadinessBlocked` /
  `.stale`, already merged in Phase 6).
- **Go**: `liveReadinessBlocked: false` and `stale: false`. **No-Go**:
  either is `true` — follow the `RECONCILIATION_MISMATCH` incident
  scenario in `docs/phase6/phase6-operator-runbook.md` before proceeding
  further.

### Step 5: Confirm Kill-Switch State

- Read the current aggregate kill-switch trading gate across GLOBAL,
  MARKET, PORTFOLIO, STRATEGY, and ASSET scopes
  (`KillSwitchControlService.evaluateAggregateTradingGate`, already
  merged in Phase 6).
- **Go**: `allowed: true` and `blocksNewOrders: false` for every
  applicable scope. **No-Go**: any scope blocks — follow the
  `KILL_SWITCH_ACTIVATION` incident scenario in
  `docs/phase6/phase6-operator-runbook.md`.

### Step 6: Confirm Dashboard And Alert State

- Confirm the operator dashboard is reachable and reports
  `systemStatus: "OK"` (not `WARNING`, `ERROR`, or `BLOCKED`).
- Confirm there are zero currently open CRITICAL-severity alerts.
- Confirm the audit trail for the relevant evaluation period was actually
  recorded (`auditTrailRecorded: true`), not merely assumed.
- **Go**: all three conditions hold. **No-Go**: any condition fails —
  investigate via `docs/phase6/operator-dashboard.md` and
  `docs/phase6/alerting-and-reports.md` before proceeding.

### Step 7: Confirm Compliance Gate

- Read the current `evaluateLiveTradingCompliance` result
  (`src/application/compliance/compliance-gate.ts`, already merged).
- **Go**: `allowed: true`, with any `limitations` reviewed and accepted by
  the operator. **No-Go**: `allowed: false` — resolve each listed
  `reasons` entry per `docs/13_Compliance_and_Legal_Review.md` before
  proceeding.

### Step 8: Run The Combined Evaluation

- Call `evaluateSmallCapitalReadiness` with the inputs confirmed in Steps
  1–7.
- **Go**: `readyForSmallCapitalLive: true` and `blockingReasonCodes` is
  empty. Note that `liveBrokerWriteAllowed` on the report is always
  `false` — this is expected and correct; it does not mean the gate
  failed. **No-Go**: `readyForSmallCapitalLive: false` — read
  `blockingReasonCodes` against the canonical list in
  `docs/phase7/small-capital-readiness-gates.md` section 10 and resolve
  each one before re-evaluating.

## What A "Go" Result Means (And Does Not Mean)

A "Go" result across all eight steps means: the design-time gates this
task defines are currently satisfied, on paper, using currently-available
signals. It does **not** mean:

- live trading is authorized — no phase of this repository authorizes
  that, and this evaluator's `liveBrokerWriteAllowed` field is a literal
  `false` specifically so nobody mistakes a "Go" for authorization.
- a real broker write path exists — it does not, anywhere in this
  repository, as of Phase 7.
- future evaluations will also pass — reconciliation, kill-switch state,
  dashboard health, and compliance status can all change at any time, and
  a fresh evaluation is required before every future decision, not a
  cached "Go" from an earlier check.

## Stop Conditions

Stop immediately and escalate to a human `OWNER` if any of the following
appears at any point while using this checklist:

- `liveBrokerWriteAllowed: true` anywhere in any report, dashboard, alert,
  or log — this should never happen; if it does, it indicates a bug, not
  a state to act on.
- a `ManualLiveApprovalRecord` with `approvalStatus: "APPROVED"` that no
  identifiable human `OWNER` can explain having signed.
- a broker account number, API key, access/refresh token, or raw broker
  payload appearing anywhere in a readiness report, dashboard, alert, or
  this checklist's own working notes.
- any document or code change appears to weaken an existing fail-closed
  check, guard, or test assertion in order to make a readiness evaluation
  pass.
- `.env` or real `tmp/phase5/` receipt contents appearing anywhere in a
  readiness evaluation's inputs, logs, or output — none of the inputs this
  gate requires should ever need those files, and none of this task's code
  reads them.

If a stop condition triggers, do not paste the offending output anywhere,
and do not proceed to the next step.

## Final Rule

`readyForSmallCapitalLive: true` is evidence, not authorization. The
decision to actually enable any real broker write remains a separate,
later, human-reviewed implementation-phase decision, per
`docs/phase7/README.md`'s exit criteria: "Phase 7 completion is not
approval for live trading. It is only approval to move toward a later,
separately reviewed implementation phase."
