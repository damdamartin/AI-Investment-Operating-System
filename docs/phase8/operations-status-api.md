# Phase 8 Operations Status API Read Model (P8-001)

Version: 0.1.0
Status: Draft
Last Updated: 2026-07-29
Related Task: `docs/tasks/phase8_claude_worktree_tasks/P8-001_operations_status_api.md`
Related Code: `src/application/operations/operations-status-read-model.ts`,
`tests/application/operations-status-read-model.test.ts`
Related Inputs:
`src/application/dashboard/read-only-dashboard.ts`,
`src/application/alerting/operational-alerting-service.ts`,
`src/application/observability/observability-metrics.ts`,
`src/application/scheduler/scheduler-job-runner.ts`,
`src/application/live-readiness/small-capital-readiness.ts`

## Purpose

This document defines the Phase 8 operations status read model:
`OperationsStatusReadModel`. It aggregates the already-computed Phase 6/7
safety, alerting, scheduler, and readiness outputs into a single sanitized,
advisory-only status summary for dashboard/API consumption. It does not
authorize live trading, does not implement a broker-write adapter, and does
not add any command surface anywhere in this codebase.

## What This Module Is (and Is Not)

`OperationsStatusReadModel` is a pure aggregation read model. It exposes
exactly one public method, `buildStatus(input)`, which reads
already-computed inputs and returns a report. It has:

- no network code
- no filesystem access
- no reads of `.env` or `tmp/phase5/*`
- no method that can place, cancel, modify, or approve an order
- no method that can activate or deactivate the kill switch
- no method that can enable live trading, promote a strategy, or increase
  capital allocation
- no mutation of any input it receives

It does not compute new safety decisions. Every field in its output is
either copied directly from an already-computed Phase 6/7 output, or is a
simple, deterministic, and tested aggregation (worst-of-severity ranking,
counting, filtering) over those already-computed outputs. It never invents
a live-readiness signal that the underlying Phase 6/7 modules did not
already produce.

## Inputs

`OperationsStatusReadModelInput` accepts, unmodified:

- `dashboardStatus: DashboardReadOnlyStatus` -- from `ReadOnlyDashboardService`
- `phase6SafetyStatus: Phase6OperatorSafetyStatus` -- from
  `Phase6OperatorSafetyDashboardService`
- `smallCapitalReadiness: SmallCapitalReadinessReport` -- from
  `evaluateSmallCapitalReadiness`
- `openAlerts: AlertEvent[]` -- from `OperationalAlertingService`
- `schedulerDefinitions: ScheduledJobDefinition[]` and
  `schedulerRuns: ScheduledJobRun[]` -- from the scheduler module
- `generatedAt: Date`

This module imports the real output types from each of the five source
modules directly (not locally-defined duck types), so the TypeScript
compiler itself proves structural compatibility with the real merged
Phase 6/7 types on every `npm run check` run -- there is no drift risk
between this read model's expectations and what those modules actually
produce.

## Output

`buildStatus` returns an `OperationsStatusSummary` covering exactly the
nine areas required by the task:

1. **System health** -- `systemHealth: "OK" | "WARNING" | "ERROR" | "BLOCKED"`,
   a deterministic worst-of ranking across the underlying dashboard system
   status, kill-switch gate, reconciliation live-readiness, derived API
   health, and scheduler safety/failure state. See "System Health
   Derivation" below.
2. **Paper/simulation readiness** -- `paperSimulationReady: boolean`,
   copied directly from `Phase6OperatorSafetyStatus.paperSimulationReady`.
3. **Live readiness blocked/unblocked status** -- `liveReadinessBlocked:
   boolean`, copied directly from
   `Phase6OperatorSafetyStatus.liveReadinessBlocked`.
4. **Kill-switch state** -- `killSwitch: { allowed, blocksNewOrders,
   reasonCodes }`, copied directly from
   `Phase6OperatorSafetyStatus.killSwitchGate`.
5. **Reconciliation state** -- `reconciliation: { status, severity,
   tradingSafetyState, blocksDependentTrading, liveReadinessBlocked,
   reasonCodes }`, combining `DashboardReadOnlyStatus.reconciliation` (the
   simple `CLEAN | MISMATCH | UNKNOWN` status) with
   `Phase6OperatorSafetyStatus.reconciliationLiveReadiness` (the richer
   severity/trading-safety-state view).
6. **AI/API health state** -- `aiApiHealth: { ai, api }`. `ai` is copied
   directly from `DashboardReadOnlyStatus.aiHealth`
   (`GREEN | YELLOW | RED | BLOCKED`). `api` (`OK | DEGRADED | DOWN`) is
   derived from currently open alerts in the `API_FAILURE`,
   `API_USAGE_WARNING`, and `BROKER_UNAVAILABLE` categories -- any open
   `CRITICAL` alert in those categories yields `DOWN`; any other open alert
   in those categories yields `DEGRADED`; otherwise `OK`.
7. **Scheduler job health** -- `scheduler: { jobs, totalJobCount,
   failingJobCount, unsafeJobDefinitionCount, unsafeJobDefinitionReasonCodes
   }`. Per-job views report `lastRunStatus` (or `NEVER_RUN`),
   `lastRunReasonCodes`, and `consecutiveFailureCount` (trailing `FAILED`
   runs), derived from `schedulerDefinitions` and `schedulerRuns`.
   `unsafeJobDefinitionCount` reuses
   `reviewPhase6SchedulerJobCatalogSafety` from the scheduler module itself
   (rather than re-implementing the no-write / no-broker-call policy check)
   so this read model can never drift out of sync with that policy.
8. **Open alert counts** -- `alerts: { openAlertCount, bySeverity,
   hasOpenCriticalAlert }`, counted directly from the `openAlerts` input.
9. **Small-capital readiness evidence status** -- `smallCapitalReadiness: {
   readyForSmallCapitalLive, blockingReasonCodeCount, blockingReasonCodes,
   warningCount, liveBrokerWriteAllowed: false }`, copied directly from the
   `SmallCapitalReadinessReport` input, with `liveBrokerWriteAllowed`
   restated as a literal `false` on the summary itself.

`liveBrokerWriteAllowed: false` is also present as a literal on the
top-level `OperationsStatusSummary`. It is never computed from any input,
and no combination of inputs can flip it to `true`. This restates the same
guarantee `ReadOnlyDashboardService`, `Phase6OperatorSafetyDashboardService`,
`OperationalAlertingService`, and `evaluateSmallCapitalReadiness` already
each independently provide, so a caller reading only this aggregated
summary -- without inspecting any of the five underlying modules
individually -- still cannot mistake it for live-trading authorization,
even in the case where every other field looks clean (`systemHealth: "OK"`,
`smallCapitalReadiness.readyForSmallCapitalLive: true`).

Every constructed output is passed through `redactObject` before being
returned (the same key-based redaction used by
`ReadOnlyDashboardService`, `Phase6OperatorSafetyDashboardService`,
`OperationalAlertingService`, and `ObservabilityMetricsService`), and
`generatedAt` is attached after redaction (not passed through it) for the
same reason those services do: `redactObject` walks `Object.entries` and
would otherwise collapse a `Date` instance into `{}`.

## System Health Derivation

`systemHealth` starts from `dashboardStatus.system` and is widened (never
narrowed) to the worst of:

- `BLOCKED` if the kill-switch gate is not `allowed` or `blocksNewOrders`
  is `true`.
- `BLOCKED` if reconciliation `blocksDependentTrading` is `true`; `WARNING`
  if only `liveReadinessBlocked` is `true` (trading is not itself blocked,
  but live-readiness has an open item worth surfacing).
- `ERROR` if derived API health is `DOWN`; `WARNING` if `DEGRADED`.
- `BLOCKED` if any scheduler job definition fails the no-write /
  no-broker-call safety policy check (this should never happen in a
  correctly configured catalog, so its presence is deliberately treated as
  a hard block, not a warning, per `docs/11_AI_RULES.md` Rule 29 -- do not
  convert an unsafe condition into silent/quiet behavior); `WARNING` if any
  scheduler job's most recent run `FAILED`.

Small-capital readiness (`readyForSmallCapitalLive`) deliberately does
**not** factor into `systemHealth`. It defaults to blocked in essentially
every real deployment (see `docs/phase7/live-capable-blocker-register.md`,
none of `LCB-001` through `LCB-008` are `RESOLVED`), so folding it into
overall system health would make `systemHealth` trivially and permanently
`WARNING`/`BLOCKED` regardless of actual paper/simulation operational
health, erasing the very distinction `paperSimulationReady` versus
`liveReadinessBlocked` versus `readyForSmallCapitalLive` exists to show an
operator. This mirrors the same reasoning
`Phase6OperatorSafetyDashboardService.buildSafetyStatus` already documents
for why `liveReadinessBlocked` excludes the permanently-`false`
`brokerWriteGuardAllowed` flag under the Phase 6 no-live-write environment
policy.

## Forbidden (and Confirmed Absent)

- No command handlers of any kind. `OperationsStatusReadModel` exposes
  exactly one public method (`buildStatus`), enforced by a dedicated test.
- No dashboard action that mutates state. Every helper function in this
  module is a pure, side-effect-free transformation of its arguments.
- No real broker calls or network code. No `fetch`, `axios`, `undici`, or
  `process.env` reference exists anywhere in this module.
- No `.env` or `tmp/phase5` reads.
- No account numbers, tokens, secrets, or raw broker payloads in any
  output -- confirmed by a dedicated redaction test scanning the
  serialized summary for secret-shaped and command-shaped substrings.
- No `liveBrokerWriteAllowed: true` anywhere. It is a literal on every
  output type that carries it.

## Completion Notes

This read model does not itself wire a real HTTP/dashboard API route, a
cron trigger, or a persistence layer -- those are out of this task's scope
(and out of Phase 8's scope, per `docs/phase8/README.md`, "read-only
dashboard/status API models" as the allowed shape, not a running service).
A future phase that exposes this over an actual HTTP endpoint must keep
the same read-only, no-command-surface contract this module already
enforces, and must not add a write path to any of the five underlying
Phase 6/7 modules this read model consumes.
