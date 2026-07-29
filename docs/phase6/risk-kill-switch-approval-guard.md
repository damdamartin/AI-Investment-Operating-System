# Risk, Kill Switch, and Approval Guard (P6-003)

Version: 0.1.0
Status: Draft
Last Updated: 2026-07-29
Related Task: `docs/tasks/phase6_claude_worktree_tasks/P6-003_risk_kill_switch_approval_guard.md`

## Purpose

This note documents the Phase 6 strengthening of the combined risk /
kill-switch / order-approval / broker-write-guard boundary. Everything else
in Phase 6 (paper order intent pipeline, reconciliation, dashboards)
depends on this chain to stay non-live.

The chain order enforced end-to-end is:

```text
risk decision (RiskEngine)
-> kill-switch state (KillSwitchControlService)
-> approval status (OrderApprovalEngine)
-> broker-write guard classification (BrokerWriteCommandGuard)
```

Every step fails closed: a missing input is treated the same as a blocking
input, never as an implicit pass.

## What Changed

### RiskEngine (`src/application/risk-engine/risk-engine.ts`)

- Accepts an optional `killSwitchGate: KillSwitchTradingGate` from
  `KillSwitchControlService.evaluateTradingGate()` / `evaluateAggregateTradingGate()`,
  in addition to the existing raw `killSwitches: KillSwitchState[]` array.
  When the gate is not allowed, the risk engine reuses its reason codes
  verbatim (for example `kill_switch_active_global`) instead of inventing a
  second, divergent reason vocabulary. This is defense in depth: a risk
  decision can no longer disagree with the kill-switch control chain.
- `reasonCodes` and `RiskCheck.failedLimitIds` are now deduplicated and
  sorted for deterministic, audit-friendly output.
- Existing behavior (hard limits, drawdown block, local `killSwitches`
  check) is unchanged and backward compatible; the new field is additive.

### KillSwitchControlService (`src/application/kill-switch/kill-switch-control-service.ts`)

- `activate` and `deactivate` now reject **out-of-order commands**: a
  command whose `occurredAt` is earlier than the state's `updatedAt` is
  rejected with `kill_switch_command_out_of_order`. This prevents a stale
  or replayed deactivation from silently turning off a kill switch that was
  reactivated more recently.
- New `evaluateAggregateTradingGate(states: KillSwitchControlState[])`
  combines every scope that may apply to a single order (GLOBAL, MARKET,
  PORTFOLIO, STRATEGY, ASSET). It fails closed: ACTIVE beats UNKNOWN beats
  INACTIVE, and an empty array is treated the same as a missing state.

### OrderApprovalEngine (`src/application/order-approval/order-approval-engine.ts`)

Per `docs/07_Trading_System.md` section 15, the Order Approval Engine's
documented inputs include "current kill switch state" and "latest
reconciliation status" — neither was previously checked. This is now fixed:

- New optional `killSwitchGate: KillSwitchTradingGate`. Missing ->
  `missing_kill_switch_gate`. Blocked -> the gate's own reason codes are
  reused verbatim.
- New optional `reconciliation: ReconciliationReport`. Missing ->
  `missing_reconciliation_state`. Blocking -> `reconciliation_<status>_blocks_trading`
  (same naming convention as `BrokerWriteCommandGuard`, for a single audit
  vocabulary across the whole chain).
- New optional `evaluatedAt: Date` plus `maxCheckAgeMs` (default
  `DEFAULT_MAX_CHECK_AGE_MS` = 5 minutes). An approval built on a stale
  `RiskCheck` or `MoneyCheck` is rejected (`risk_check_stale` /
  `money_check_stale`), as is one with a clock-skewed, future-dated check
  (`risk_check_timestamp_in_future` / `money_check_timestamp_in_future`).
  Omitting `evaluatedAt` entirely fails closed with `missing_evaluation_time`.
- `reasonCodes` are deduplicated and sorted.

All new fields are optional (`| undefined`) to match this file's existing
style (`riskCheck`, `moneyCheck`, `brokerAccount`, etc. are all optional
with a runtime "missing_X" check) — safety is enforced at runtime, not by
making TypeScript compilation fail for existing callers. **Any caller that
does not yet pass `killSwitchGate`, `reconciliation`, and `evaluatedAt` will
now get a REJECTED approval instead of an APPROVED one.** This is
intentional (fail closed on a genuine input gap), but any other Phase 6
work that constructs `OrderApprovalEngineInput` should be updated during
integration to supply these three fields.

### BrokerWriteCommandGuard (`src/application/broker-write-guard/broker-write-command-guard.ts`)

- New optional `now: Date` and `maxApprovalAgeMs` (default
  `DEFAULT_MAX_APPROVAL_AGE_MS` = 5 minutes). Once an `OrderApproval` is
  approved, the guard checks how old the underlying `RiskCheck` /
  `MoneyCheck` basis is (the later of the two `checkedAt` timestamps) against
  `now`. Too old -> `order_approval_stale`. Clock-skewed / future-dated ->
  `order_approval_timestamp_in_future`. Missing `now` entirely -> fails
  closed with `missing_evaluation_time`.
- New exported constant `PHASE6_NO_LIVE_BROKER_WRITE_ENVIRONMENT_POLICY`: a
  frozen, safe-default `BrokerWriteEnvironmentPolicy`
  (`liveBrokerWritesEnabled: false`, `allowedEnvironments: []`). Any Phase 6
  wiring code should import and reuse this constant instead of hand-building
  an environment policy object, so a typo or copy-paste mistake can never
  accidentally enable a live broker write during this phase.
- No escape hatch, bypass flag, or "trusted caller" shortcut was added.
  `BrokerWriteCommandGuard` still has no code path that calls a real broker
  API — it only classifies whether a hypothetical write command would be
  allowed, and this repository has zero `TossSecuritiesAdapter` or Toss
  order-write endpoint anywhere.

## Reason Code Reference (new or changed this round)

| Reason code | Emitted by | Meaning |
|---|---|---|
| `kill_switch_active_<scope>` / `kill_switch_state_unknown` / `kill_switch_state_missing` | RiskEngine (via `killSwitchGate`), OrderApprovalEngine (via `killSwitchGate`) | Reused verbatim from `KillSwitchControlService` so all three layers share one vocabulary |
| `kill_switch_command_out_of_order` | KillSwitchControlService | A kill-switch activate/deactivate command is older than the current state |
| `missing_kill_switch_gate` | OrderApprovalEngine | No kill-switch gate was supplied to the approval decision |
| `missing_reconciliation_state` | OrderApprovalEngine (new), BrokerWriteCommandGuard (existing) | No reconciliation report was supplied |
| `reconciliation_<status>_blocks_trading` | OrderApprovalEngine (new), BrokerWriteCommandGuard (existing) | Reconciliation is not CLEAN |
| `missing_evaluation_time` | OrderApprovalEngine, BrokerWriteCommandGuard | No "now" / `evaluatedAt` was supplied — freshness cannot be proven |
| `risk_check_stale` / `money_check_stale` | OrderApprovalEngine | Underlying check is older than `maxCheckAgeMs` |
| `risk_check_timestamp_in_future` / `money_check_timestamp_in_future` | OrderApprovalEngine | Underlying check's `checkedAt` is after `evaluatedAt` (clock skew) |
| `order_approval_stale` | BrokerWriteCommandGuard | Approval's underlying checks are older than `maxApprovalAgeMs` |
| `order_approval_timestamp_in_future` | BrokerWriteCommandGuard | Approval's underlying checks are timestamped after `now` |

All reason codes are deterministic (same input -> same output array) and
returned deduplicated and alphabetically sorted.

## For Engineer 4 (P6-004 Phase 2 Integration)

Recommended additions to `tests/safety/safety-regression.test.ts` during
integration (not made here, since this file is Engineer 4's alone this
round):

1. A regression proving `OrderApprovalEngine` rejects an otherwise-valid
   approval when `killSwitchGate` is omitted or blocked, so a future
   refactor cannot silently drop the kill-switch check from the approval
   path.
2. A regression proving `OrderApprovalEngine` rejects a stale `RiskCheck`/
   `MoneyCheck` pair (checked long before `evaluatedAt`), so a future
   refactor cannot silently remove the freshness gate.
3. A regression proving `BrokerWriteCommandGuard` rejects a broker write
   built on a stale `OrderApproval`, mirroring the existing "AI output
   alone cannot approve execution" regressions already in that file.
4. A regression proving `KillSwitchControlService.deactivate` rejects an
   out-of-order command that would otherwise silently re-open trading after
   a more recent activation.

If any other Phase 6 code (paper order intent pipeline, reconciliation
snapshot review) constructs an `OrderApprovalEngineInput` directly, it must
be updated to pass `killSwitchGate`, `reconciliation`, and `evaluatedAt` —
otherwise the engine will now reject it as `REJECTED` for missing inputs
rather than silently approving.
