# Phase 6 Operator Dashboard (P6-005)

Version: 0.1.0
Status: Draft
Last Updated: 2026-07-29
Related Docs: 07_Trading_System.md, 11_AI_RULES.md, docs/reviews/Codex_Phase6_Simulation_Safety_Review.md, docs/tasks/phase6_claude_worktree_tasks/P6-005_phase6_operator_dashboard.md

## Purpose

This document describes the Phase 6 round 2 operator dashboard read model
implemented for task P6-005. It gives a human operator a single, sanitized
status view over the Phase 6 round 1 paper/simulation safety chain — the
paper order intent pipeline (P6-001), reconciliation live-readiness
(P6-002), and the risk / kill-switch / order-approval / broker-write-guard
chain (P6-003) — without exposing secrets, raw broker data, or account
identifiers, and without implying that live trading is authorized.

## Scope

Implemented in `src/application/dashboard/read-only-dashboard.ts`:

- `ReadOnlyDashboardService` / `DashboardReadOnlyStatus` — existing general
  operational status view (system/trading/broker/data-freshness/AI-health),
  unchanged in shape. Fixed in this round: `generatedAt` no longer passes
  through `redactObject`, which previously collapsed any `Date` value into
  `{}` because `redactObject` walks `Object.entries`, and a `Date` instance
  has zero enumerable own properties. `generatedAt` is now attached after
  redaction so the caller gets back the real `Date` it passed in.
- `Phase6OperatorSafetyDashboardService` / `Phase6OperatorSafetyStatus` —
  new in this round. This is the read model this task was scoped to add.

This module is a **status surface only**. It has no method, field, or code
path that can place, cancel, modify, or approve a broker order, and no
live-trading-enable toggle exists anywhere in it (checked directly:
`Phase6OperatorSafetyDashboardService.prototype` exposes exactly one method,
`buildSafetyStatus`, alongside the implicit constructor).

## Input Model

`Phase6OperatorSafetyStatusInput` accepts already-computed outputs from the
real Phase 6 round 1 engines (or equivalent in-memory test fixtures) — it
never calls Toss, never performs a network request, and never reads `.env`
or `tmp/phase5` receipts:

- `paperOrderIntent: PaperOrderIntentPipelineResult` — from
  `PaperOrderIntentPipeline.evaluate()`
- `reconciliationWorkflow: ReconciliationWorkflowResult` — from
  `ReconciliationWorkflowService.evaluate()`
- `riskEngineOutput: RiskEngineOutput` — from `RiskEngine.evaluate()`
- `killSwitchGate: KillSwitchTradingGate` — from
  `KillSwitchControlService.evaluateTradingGate()` /
  `evaluateAggregateTradingGate()`
- `orderApproval: OrderApprovalEngineOutput` — from
  `OrderApprovalEngine.evaluate()`
- `brokerWriteGuard: BrokerWriteCommandGuardResult` — from
  `BrokerWriteCommandGuard.evaluate()`
- `auditTrailRecorded: boolean` — caller-confirmed flag: did the
  corresponding audit record actually get persisted to the audit log sink
  (e.g. via `AuditLogService`)? The dashboard cannot observe this on its
  own; it only reports what the caller confirms.
- `generatedAt: Date`

## Output Model

`Phase6OperatorSafetyStatus` groups six sub-views, one per required status
area from the task, plus three top-level fields the task requires the
dashboard to keep visibly distinct:

| Sub-view | Reports |
|---|---|
| `paperOrderIntent` | paper order intent decision, paper order status, reason codes, whether the kill switch blocks paper execution |
| `reconciliationLiveReadiness` | reconciliation severity, trading-safety state, and the hard `liveReadinessBlocked` gate |
| `riskVeto` | risk check result, risk level, whether an active veto (`FAIL`/`BLOCKED`) is in effect |
| `killSwitchGate` | whether the kill-switch gate currently allows new orders |
| `approvalGuard` | order approval status and broker-write guard decision, both with reason codes |
| `auditCoverage` | whether a sanitized audit context exists and whether the audit trail was actually recorded |

Top-level fields:

- **`paperSimulationReady: boolean`** — true only when the paper/simulation
  execution path itself is healthy: `PaperOrderIntentPipeline` accepted the
  candidate (`decision === "ACCEPTED"`), the resulting paper order is not in
  an `UNKNOWN` broker state, it does not block dependent trading, the
  kill-switch gate is not blocking new orders, and an audit trail exists and
  was confirmed recorded. This is intentionally independent of
  `liveReadinessBlocked` and `brokerWriteGuard` — paper trading can be ready
  even while the live-readiness chain has an open block, because Phase 6
  never authorizes live trading regardless of either signal.

  Note that `PaperOrderIntentPipeline` itself does not consult kill-switch
  state (a deliberate design choice explained in
  `docs/phase6/paper-order-intent-pipeline.md`, so the paper pipeline stays
  self-contained and cannot be made to depend on live-broker machinery). The
  dashboard is the layer responsible for showing the operator the *combined*
  picture, so it aggregates the kill-switch gate on top of the pipeline's
  own decision to compute `paperSimulationReady` and
  `paperOrderIntent.killSwitchBlocksPaperExecution`.

- **`liveReadinessBlocked: boolean`** — true whenever any part of the chain
  the caller actually controls (reconciliation, kill switch, risk veto,
  order approval) is not fully clear:
  `reconciliationLiveReadiness.liveReadinessBlocked || !killSwitchGate.allowed || riskVeto.vetoActive || approvalGuard.approvalStatus !== "APPROVED"`.
  This field deliberately does **not** factor in
  `approvalGuard.brokerWriteGuardAllowed`: under Phase 6,
  `BrokerWriteCommandGuard` is always evaluated against
  `PHASE6_NO_LIVE_BROKER_WRITE_ENVIRONMENT_POLICY`
  (`src/application/broker-write-guard/broker-write-command-guard.ts`),
  whose `liveBrokerWritesEnabled` is permanently `false` — so that flag
  would read `false` on every single evaluation regardless of any other
  input, which would make `liveReadinessBlocked` trivially always `true`
  and erase the distinction this field exists to show the operator. That
  permanent phase-wide block is what `liveBrokerWriteAllowed` reports,
  unconditionally, below. A `liveReadinessBlocked: false` result never
  implies live trading is allowed; it only means the pre-broker-write chain
  currently has no open block.

- **`liveBrokerWriteAllowed: false`** — a literal, not a computed, `false`.
  It cannot be flipped to `true` by any combination of inputs to this
  service. Phase 6 never authorizes a live broker write; this field exists
  so no caller can mistake a clean `paperSimulationReady`/
  `liveReadinessBlocked` reading for live-trading authorization.

Every sub-view that models a Phase 6 round 1 output that already carries its
own `liveBrokerWriteAllowed: false` field (`paperOrderIntent`,
`reconciliationLiveReadiness`, `approvalGuard`) repeats that literal `false`
at the view level too, so it is visible without having to cross-reference
the top-level field.

## How To Interpret The Status (Operator Guidance)

- `paperSimulationReady: true` means paper/simulation order flow is
  currently healthy and safe to continue observing. It says nothing about
  live trading.
- `liveReadinessBlocked: true` means at least one part of the live-readiness
  chain (reconciliation, kill switch, risk, approval) currently has an open
  issue. Investigate the specific sub-view with a non-clean value
  (`reconciliationLiveReadiness.liveReadinessReasonCodes`,
  `riskVeto.reasonCodes`, `killSwitchGate.reasonCodes`,
  `approvalGuard.approvalReasonCodes`) to find the cause.
- `liveBrokerWriteAllowed` is always `false` in Phase 6. Seeing it `true`
  anywhere is not a valid dashboard output and would indicate a bug, not a
  system state to act on.
- `auditCoverage.auditTrailRecorded: false` means the operator should not
  treat this evaluation as fully reconstructable later, even if every other
  field looks healthy.

## Safety Guarantees

- No method on `Phase6OperatorSafetyDashboardService` (or
  `ReadOnlyDashboardService`) accepts a command to place, cancel, modify, or
  approve an order, or to activate/deactivate a kill switch. Both classes
  expose exactly one public method each (`buildSafetyStatus` /
  `buildStatus`), verified directly against
  `Object.getOwnPropertyNames(...prototype)` in
  `tests/application/read-only-dashboard.test.ts`.
- No live-trading-enable toggle, flag, or placeholder exists anywhere in
  this module.
- Every sub-view is built from a fixed, explicit field list (never a spread
  of the raw round 1 output), so a future round 1 engine change that adds a
  new field cannot silently leak into dashboard output.
- The entire non-`Date` portion of both `DashboardReadOnlyStatus` and
  `Phase6OperatorSafetyStatus` is passed through `redactObject`
  (`src/config/redaction.ts`) as defense in depth, masking any
  accidentally-included key matching `secret`, `token`, `api[_-]?key`,
  `password`, `account[_-]?ref`, `account[_-]?number`, or
  `client[_-]?secret`.
- Broker account identifiers are never exposed unmasked: the only account
  reference this module ever surfaces is
  `PaperOrderIntentAuditContext.brokerAccountMaskedRef`
  (`BrokerAccount.maskedExternalRef()`), inherited unchanged from the
  paper order intent pipeline's own output.

## Out Of Scope

This dashboard does not implement, and must never be extended to implement:

- any control that places, cancels, or modifies an order
- any live-trading-enable toggle, including a disabled/placeholder one
- any Toss API call or other network call
- reading, printing, or committing `.env` or real `tmp/phase5` receipts
