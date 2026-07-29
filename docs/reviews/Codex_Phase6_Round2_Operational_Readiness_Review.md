# Codex Phase 6 Round 2 Operational Readiness Review

Version: 1.0.0
Status: Complete
Review Date: 2026-07-29
Task: P6-008 Phase 6 Round 2 Integration Review
Assigned Engineer: Engineer 4

## Purpose

This document records the Phase 6 round 2 integration and operational
readiness review after P6-005 (operator dashboard), P6-006 (alerting and
reports), and P6-007 (scheduler and runbooks) were merged into local
`main`.

This review does not authorize live trading, order creation, order
cancellation, order modification, transfer, withdrawal, currency
conversion, or production capital use. It does not weaken any existing
fail-closed control, and none of the P6-005/006/007 changes reviewed here
weaken one either.

Merge commits reviewed (local `main`, never pushed to GitHub):

- `19e3421` — Merge Phase 6 Engineer 1: P6-005 operator dashboard
- `349cc89` — Merge Phase 6 Engineer 2: P6-006 alerting and reports
- `3cc8fa9` — Merge Phase 6 Engineer 3: P6-007 scheduler and runbooks

Underlying feature commits: `268e7a6` (P6-005), `c49fe84` (P6-006),
`dd1cae1` (P6-007). Local `main` tip at review time: `3cc8fa9`. This
review was produced from `phase6/p6-008-round2-operational-readiness-review`
after merging local `main` into it (merge commit `32a18bc`).

Every claim below was checked directly against the merged source in this
worktree — `src/application/dashboard/read-only-dashboard.ts`,
`src/application/alerting/operational-alerting-service.ts`,
`src/application/observability/observability-metrics.ts`,
`src/application/scheduler/scheduler-job-runner.ts`, and
`src/application/incident-runbooks/incident-runbook-review.ts` — not
inferred from the accompanying `docs/phase6/*.md` notes alone, though
those notes were also read and found to accurately describe the merged
source.

## Phase Status

- Phase 1 (scaffold and pre-merge regression-gap check): complete.
- Phase 2 (full integration review after P6-005/P6-006/P6-007 merge):
  complete.

## Summary

P6-005, P6-006, and P6-007 merged into local `main` cleanly, with no merge
conflicts when merged into this worktree either (`32a18bc`). `npm run
check` passes cleanly (typecheck plus 82 test files / 698 tests, all
green — 696 from merged `main` plus the 2 Phase 1 regression tests this
branch already carried) on the merged branch. All three branches add new,
strictly observational operator-facing surfaces on top of the Phase 6
round 1 safety chain; none weaken or bypass an existing fail-closed
control, and none add a code path capable of placing, cancelling, or
modifying a broker order, moving money, or calling a real Toss API.

Direct grep confirmation across all four changed modules
(`dashboard/`, `alerting/`, `scheduler/`, `incident-runbooks/`) found zero
references to `TossSecuritiesAdapter`, `submitOrder(`, `cancelOrder(`, or
`replaceOrder(`, and zero references to `fetch(`, `http.request`,
`https.request`, or `axios` — no network-call capability of any kind was
added anywhere in this round.

`Phase6OperatorSafetyDashboardService` (P6-005) gives the operator a
single, sanitized aggregate view over the round 1 chain, with
`paperSimulationReady` and `liveReadinessBlocked` kept intentionally
distinct from the permanently-literal `liveBrokerWriteAllowed: false`.
`OperationalAlertingService`/`ObservabilityMetricsService` (P6-006) add
seven new/strengthened alert categories, all deterministically classified
and all structurally incapable of implying live-trading authorization
(`liveBrokerWriteAllowed: false` and `impliesLiveTradingAuthorization:
false` are literals on every `AlertEvent`, not computed values).
`SchedulerJobRunner`/`IncidentRunbookReview` (P6-007) add five no-write
review jobs and enforce `noWrite`/`callsBrokerApi` constraints at the
runner level — not merely by per-job convention — and extend the
incident-runbook reviewer to catch an entire missing scenario, not just an
incomplete one.

No regression gap requiring a new test in the consolidated
`tests/safety/safety-regression.test.ts` harness was found this phase; see
"Phase 2 Regression Check" below for why, and what was checked instead.

## What Changed in P6-005 (Operator Dashboard)

Files: `src/application/dashboard/read-only-dashboard.ts`,
`tests/application/read-only-dashboard.test.ts`,
`docs/phase6/operator-dashboard.md`.

- Added `Phase6OperatorSafetyDashboardService` with exactly one public
  method, `buildSafetyStatus` — verified directly:
  `Object.getOwnPropertyNames(Phase6OperatorSafetyDashboardService.prototype)`
  is exercised in `tests/application/read-only-dashboard.test.ts` ("exposes
  no method that could place, cancel, or modify a broker order") and
  independently confirmed by reading the class body: only a constructor
  (implicit) and `buildSafetyStatus` exist.
- `buildSafetyStatus` consumes already-computed outputs from the real
  round 1 engines (`PaperOrderIntentPipelineResult`,
  `ReconciliationWorkflowResult`, `RiskEngineOutput`,
  `KillSwitchTradingGate`, `OrderApprovalEngineOutput`,
  `BrokerWriteCommandGuardResult`) plus a caller-confirmed
  `auditTrailRecorded: boolean` flag, and produces six sub-views
  (`paperOrderIntent`, `reconciliationLiveReadiness`, `riskVeto`,
  `killSwitchGate`, `approvalGuard`, `auditCoverage`) plus three top-level
  fields: `paperSimulationReady`, `liveReadinessBlocked`, and
  `liveBrokerWriteAllowed: false`.
- Confirmed by direct inspection of `buildSafetyStatus`
  (`read-only-dashboard.ts` lines 253-307): `liveBrokerWriteAllowed` is
  passed into `redactObject` as the literal `false as const` — it is not
  computed from any input and cannot be flipped to `true` by any
  combination of inputs.
- `liveReadinessBlocked` deliberately excludes
  `approvalGuard.brokerWriteGuardAllowed` from its OR-chain. I independently
  verified the stated reasoning holds: `BrokerWriteCommandGuard` is always
  evaluated in this codebase against
  `PHASE6_NO_LIVE_BROKER_WRITE_ENVIRONMENT_POLICY`
  (`broker-write-command-guard.ts`), whose `liveBrokerWritesEnabled` is a
  frozen, permanent `false` — so `guardResult.allowed` is `false` on every
  Phase 6 evaluation regardless of every other gate, which would make
  `liveReadinessBlocked` trivially always `true` and erase the distinction
  the task asked for between "blocked because of an unresolved
  paper/simulation issue" and "blocked because Phase 6 categorically
  disallows live writes" (the latter is what the separate, always-`false`
  `liveBrokerWriteAllowed` field reports). This is a reasonable, safety-
  preserving design choice, not a loosened check: `liveReadinessBlocked:
  false` never implies live trading is allowed, only that the
  reconciliation/kill-switch/risk/approval chain currently has no open
  block, and `liveBrokerWriteAllowed` remains the unconditional `false`
  gate underneath it.
- `paperSimulationReady` requires the paper pipeline to have `ACCEPTED` the
  candidate, a non-`UNKNOWN` paper order status, no
  `blocksDependentTrading`, no kill-switch block on paper execution
  (aggregated at the dashboard layer, since `PaperOrderIntentPipeline`
  itself deliberately does not consult kill-switch state — confirmed
  against `docs/phase6/paper-order-intent-pipeline.md`'s stated reasoning
  from round 1), and a confirmed audit trail. Verified in
  `tests/application/read-only-dashboard.test.ts` that
  `paperSimulationReady` can be `true` while `liveReadinessBlocked` is
  `true` (a LOW-severity reconciliation issue) — proving the two fields are
  genuinely independent, not accidentally coupled.
- Fixed a pre-existing bug in `ReadOnlyDashboardService.buildStatus`
  (unchanged in shape, present since before this round): `generatedAt`
  passed through `redactObject`, which walks `Object.entries` and sees zero
  enumerable own properties on a `Date`, collapsing it to `{}`. Both
  `buildStatus` and `buildSafetyStatus` now redact everything else first
  and attach the real `Date` afterward — confirmed by reading both method
  bodies directly.
- Every sub-view is built from an explicit, fixed field list (never a
  spread of the raw round 1 output) — confirmed by reading
  `paperOrderIntentView`, `reconciliationLiveReadinessView`,
  `riskVetoView`, `approvalGuardView`, and `auditCoverageView`; none of
  them do `...result` or `...output`.
- `tests/application/read-only-dashboard.test.ts` grew from 5 to 14 tests,
  using the real merged `RiskEngine`, `KillSwitchControlService`,
  `OrderApprovalEngine`, `BrokerWriteCommandGuard`,
  `PaperOrderIntentPipeline`, and `ReconciliationWorkflowService` — not
  hand-rolled stand-ins — to prove the dashboard's aggregation logic
  against the actual round 1 chain end-to-end.

## What Changed in P6-006 (Alerting and Reports)

Files: `src/application/alerting/operational-alerting-service.ts`,
`src/application/observability/observability-metrics.ts`,
`tests/application/operational-alerting-service.test.ts`,
`tests/application/observability-metrics.test.ts`,
`docs/phase6/alerting-and-reports.md`.
`src/application/api-usage/api-usage-monitor.ts` was reviewed but not
modified (confirmed: no diff against round 1 baseline).

- Added seven new/strengthened `AlertCategory` values:
  `RISK_VETO`, `STALE_APPROVAL`, `BROKER_WRITE_GUARD_BLOCKED`,
  `PAPER_INTENT_BLOCKED`, `API_USAGE_WARNING` (all new), plus
  strengthened `RECONCILIATION_MISMATCH` (severity-aware) and `KILL_SWITCH`
  (now also covers an unknown, not just active, state) — confirmed against
  the `AlertCategory` union and the seven new builder methods
  (`fromKillSwitchGate`, `fromRiskCheck`, `fromOrderApprovalRejection`,
  `fromBrokerWriteGuardResult`, `fromPaperOrderIntentDecision`,
  `fromReconciliationWorkflow`, `fromApiUsageSummary`).
- Every `AlertEvent` now carries two literal fields —
  `liveBrokerWriteAllowed: false` and `impliesLiveTradingAuthorization:
  false` — confirmed directly in `buildAlert()` (the single internal
  constructor every builder method funnels through): both are hardcoded in
  the returned object literal, not derived from `input`, so no call path
  through any of the eight builder methods (`classify`,
  `fromAIHealthCheck`, and the six new/updated `from*` methods) can produce
  a value other than `false` for either field.
- Deterministic severity classification: a single private
  `classifyReasonCodes(reasonCodes)` function drives every new
  reason-code-based builder, with fixed precedence (kill-switch >
  reconciliation > live-account-in-paper-flow > staleness > missing-input >
  active-veto), checked with `.some()` so array order never matters.
  Verified directly by reading the function; it has no branch that depends
  on call order, timing, `Date.now()`, or `Math.random()`.
- Deliberate design choice, verified sound: `OperationalAlertingService`'s
  new builders accept small, locally-defined, duck-typed interfaces
  (`KillSwitchGateAlertInput`, `RiskCheckAlertInput`, etc.) instead of
  importing the concrete round 1 types. I confirmed the stated reason is
  real, not a rationalization: `grep -rn "from.*alerting"
  src/application/kill-switch/ src/application/reconciliation/` shows both
  `kill-switch-control-service.ts` and `reconciliation-workflow-service.ts`
  already import from `operational-alerting-service.ts`; importing their
  concrete output types back into the alerting file would have created a
  module import cycle. The duck-typed interfaces are structurally
  compatible with the real round 1 output shapes, so a caller can pass a
  real `KillSwitchTradingGate` (etc.) directly with no adapter code —
  confirmed this compiles cleanly under `npm run check`.
- `ObservabilityMetricsService` gained `emitFromAlert(alert)` (maps an
  `AlertEvent` to its baseline metric via a fixed, explicit
  `alertCategoryMetricMap` — categories without a mapped metric return
  `undefined` rather than a guessed name) and
  `summarizeAlertSeverity(alerts)`. Both only ever construct payloads from
  `{ alertId }` plus severity/category labels — never the alert's own
  payload contents — confirmed by reading `emitFromAlert`'s body.
- `tests/application/operational-alerting-service.test.ts` grew from 6 to
  34 tests; `tests/application/observability-metrics.test.ts` grew from 5
  to 20 tests. `tests/application/api-usage-monitor.test.ts` (5 tests,
  unmodified) still passes unchanged.

## What Changed in P6-007 (Scheduler and Runbooks)

Files: `src/application/scheduler/scheduler-job-runner.ts`,
`src/application/incident-runbooks/incident-runbook-review.ts`,
`tests/application/scheduler-job-runner.test.ts`,
`tests/application/incident-runbook-review.test.ts`,
`docs/phase6/phase6-operator-runbook.md`,
`docs/phase6/phase6-scheduler-jobs.md`.

- Added `createPhase6SchedulerJobCatalog()`, defining five job kinds
  (`PHASE6_PAPER_SIMULATION_STATUS_REVIEW`, `PHASE6_RECONCILIATION_REVIEW`,
  `PHASE6_KILL_SWITCH_STATE_REVIEW`, `PHASE6_ALERT_REPORT_GENERATION`,
  `PHASE6_AUDIT_COVERAGE_REVIEW`), each with `noWrite: true`,
  `callsBrokerApi: false`, `tradingRelated: false` — confirmed directly in
  `phase6JobDefinition()`'s fixed defaults, which every catalog entry uses.
- **Enforced, not just conventional**: `SchedulerJobRunner.start()` now
  rejects any job whose definition has `noWrite !== true`
  (`scheduled_job_must_be_no_write`) or `callsBrokerApi === true`
  (`scheduled_job_must_not_call_broker_api`) *before* the run ever reaches
  `RUNNING` — confirmed by reading `start()`'s reason-code accumulation,
  which checks these unconditionally for every job, not only Phase 6 job
  kinds. `tests/application/scheduler-job-runner.test.ts` proves both
  ("refuses to start a job definition that is not marked no-write",
  "refuses to start a job definition that calls a broker API").
- Missing local state fails closed: `requiredLocalStateInputs` entries not
  present and exactly `true` in `localStateAvailability` each produce a
  `required_local_state_missing_<name>` code and a `SKIPPED` (never
  `RUNNING`) run — confirmed in `missingLocalStateRejections()`. The runner
  itself never reads `.env` or `tmp/phase5/*` — confirmed by grep: no
  `fs.readFile`/`process.env.TOSS_` reference exists anywhere in
  `scheduler-job-runner.ts`.
- Added `containsSecretLikeOrRawBrokerData(text)`, a heuristic scanner for
  secret-shaped and raw-account-number-shaped text (including the Korean
  term `계좌번호` and any run of 8+ digits), reused by both
  `safeErrorSummary()` (scheduler) and the incident-runbook reviewer
  (below) — confirmed both call sites via grep.
- `reviewPhase6SchedulerJobCatalogSafety(definitions)` is a pure,
  store-independent check proving an entire catalog is no-write,
  non-broker-calling, and free of secret-like text in job names/schedule
  expressions before any job in it is ever started — confirmed used
  directly in `tests/application/scheduler-job-runner.test.ts` against
  both the real catalog and a deliberately tampered one.
- `IncidentRunbookReview` gained three new required scenarios
  (`SCHEDULER_JOB_FAILURE`, `LOCAL_PHASE5_STATE_MISSING`,
  `AUDIT_COVERAGE_GAP`, exported via `PHASE6_REQUIRED_RUNBOOK_SCENARIOS`,
  9 scenarios total), a `runbook_section_may_contain_secret_or_raw_broker_data`
  rejection reason wired to `containsSecretLikeOrRawBrokerData`, and a new
  `reviewSet(sections)` method that flags an entire scenario missing from a
  supplied document (`missing_runbook_scenario_<name>`), not just an
  incomplete section — confirmed by reading `reviewSet()`'s body directly.
- `docs/phase6/phase6-operator-runbook.md` (new, 370 lines) documents a
  five-check daily go/no-go procedure, one per Phase 6 review job, plus all
  nine incident scenarios and explicit stop conditions. This file remains
  Engineer 3's per the task's file-ownership rules; I read it in full for
  this review (see "Whether Runbooks Are Sufficient" below) but did not
  modify it, since I found nothing in it that requires a coordinated
  correction.
- `tests/application/scheduler-job-runner.test.ts` grew from 5 to 17 tests;
  `tests/application/incident-runbook-review.test.ts` grew from 5 to 9
  tests.

## Commands Run and Results

All commands below were run from
`/Users/mac/Documents/Codex/aios-phase6-round2-worktrees/eng4` on branch
`phase6/p6-008-round2-operational-readiness-review` after merging local
`main` (merge commit `32a18bc`). Exit codes were captured directly, not
inferred from log tail output.

```bash
npm run check
```
Exit code `0`. Typecheck clean. `82` test files, `698` tests, all
passing — the `696` tests present on merged `main` plus the `2` Phase 1
regression tests this branch already carried in
`tests/safety/safety-regression.test.ts` (18 tests total in that file). No
flake was observed on this run.

```bash
npm run phase5:toss:readiness
```
Exit code `1` (fail closed, as expected on this fresh worktree — no local
`.env` exists here; confirmed with `ls -la .env` returning "No such file or
directory"). Output:
```json
{
  "ready": false,
  "safeToAttemptReadOnlyCalls": false,
  "liveBrokerWriteAllowed": false,
  "missingFields": ["TOSS_API_BASE_URL", "TOSS_CLIENT_ID", "TOSS_CLIENT_SECRET", "TOSS_ACCOUNT_REF"],
  "reasonCodes": [
    "missing_or_placeholder_toss_account_ref",
    "missing_or_placeholder_toss_api_base_url",
    "missing_or_placeholder_toss_client_id",
    "missing_or_placeholder_toss_client_secret",
    "toss_read_only_mode_not_true"
  ],
  "safetyType": "TOSS_READ_ONLY_LOCAL_READINESS_REPORT"
}
```

```bash
npm run phase5:toss:doctor -- tmp/phase5/toss-read-only-endpoints.local.json tmp/phase5/evidence-manifest.local.json tmp/phase5/evidence-intake.local.json
```
Exit code `0` (this command reports state; it does not gate). Output
confirmed `readyForReadOnlyVerification: false`, `liveBrokerWriteAllowed:
false`, `networkCallsPerformed: false`, `preparedRequestCount: 0`, with
`blockingReasonCodes` including `endpoint_catalog_file_missing`,
`evidence_manifest_file_missing`, `evidence_intake_file_missing`,
`intake_has_no_items`, and the four `missing_or_placeholder_toss_*`
readiness codes — all correct for a fresh worktree with none of the
operator's local files present. Confirmed `tmp/phase5/` in this worktree
is an empty directory (`ls -la tmp/phase5/` shows only `.`/`..`) — no real
receipt of any kind exists here.

```bash
npm run phase5:toss:preflight -- tmp/phase5/toss-read-only-endpoints.local.json tmp/phase5/evidence-manifest.local.json tmp/phase5/evidence-intake.local.json
```
Exit code `1`, with a clean JSON fail-closed report this time — **not** a
crash. The Phase 6 round 1 review
(`docs/reviews/Codex_Phase6_Simulation_Safety_Review.md`, "Commands Run and
Results") documented this exact command crashing with an unhandled
`TypeError` on a fresh checkout, and
`docs/tasks/phase6_claude_worktree_tasks/README.md`, "Round 1 Outcome"
states a follow-up reliability fix for
`scripts/validate-toss-evidence-intake.mjs` landed after the round 1
merge. I confirm that fix is present and effective: `preflight` now
returns `readyForReadOnlyCall: false`, `readyForOpenQuestionReview: false`,
`liveBrokerWriteAllowed: false`, `networkCallsPerformed: false`, and a full
set of `doctor_*`/`endpoints_*`/`evidence_*`/`intake_*`/`openQuestions_*`/
`readiness_*` reason codes, all as valid JSON with exit code `1`.

```bash
PHASE5_TOSS_READ_ONLY_CALL_APPROVED=true npm run phase5:toss:completion -- tmp/phase5/toss-read-only-endpoints.local.json tmp/phase5/evidence-manifest.local.json tmp/phase5/evidence-intake.local.json
```
Exit code `1`. Clean JSON fail-closed report (also benefiting from the same
fix): `phase5TossPreparationComplete: false`,
`readyForFirstRealReadOnlyCall: false`, `liveBrokerWriteAllowed: false`,
`networkCallsPerformed: false`, `nextAction: "Finish local .env setup,
official endpoint verification, sanitized evidence intake, preflight, and
call-gate approval first."`. Even with
`PHASE5_TOSS_READ_ONLY_CALL_APPROVED=true` set, no network call occurred
and no live broker write was attempted — the approval flag never
overrides the underlying preflight/call-gate chain being not-ready.

**Safety invariant confirmed across all five commands**: every report
carried `liveBrokerWriteAllowed: false` (or, for the plain readiness
report, the equivalent `safeToAttemptReadOnlyCalls: false`); every
no-network command (`readiness`, `doctor`, `preflight`, `completion`)
reported `networkCallsPerformed: false` where that field is present, and
none of them performed a network call by construction (all reasons
resolved from local file/env checks only, confirmed by reading each
script's early-exit structure); no raw payload of any kind was stored,
read, or displayed — `tmp/phase5/` remained empty throughout; and no
unexpected write capability was reported anywhere.

## Whether Dashboard/Status Remains Read-Only

**Yes.** Confirmed by direct source inspection of
`src/application/dashboard/read-only-dashboard.ts` and
`src/application/dashboard/sensitive-control-gate.ts` (unchanged this
round):

- `ReadOnlyDashboardService` exposes exactly one method, `buildStatus`;
  `Phase6OperatorSafetyDashboardService` exposes exactly one method,
  `buildSafetyStatus`. Neither class has a constructor parameter, field, or
  method that accepts a command to place, cancel, modify, or approve an
  order, or to activate/deactivate a kill switch — confirmed both by
  reading the full class bodies and by the "exposes no method that could
  place, cancel, or modify a broker order" prototype-introspection test in
  `tests/application/read-only-dashboard.test.ts`, which asserts
  `Object.getOwnPropertyNames(...prototype)` equals exactly
  `["constructor", "buildSafetyStatus"]`.
- `liveBrokerWriteAllowed` is a literal `false` at the top level of
  `Phase6OperatorSafetyStatus` and on three sub-views
  (`paperOrderIntent`, `reconciliationLiveReadiness`, `approvalGuard`) —
  confirmed it is never computed from input, so no combination of round 1
  engine outputs can flip it to `true`.
- Both `buildStatus` and `buildSafetyStatus` build every field from an
  explicit, fixed list — never a spread of raw input — and pass the
  non-`Date` portion through `redactObject` as defense in depth, confirmed
  by reading both method bodies.
- `DashboardSensitiveControlGate` (unchanged this round, already reviewed
  structurally in this file's Phase 1 appendix) still has no
  `DashboardActionType` shaped like an order-submission command, and its
  `evaluate()` still only returns an authorization decision, never
  executes anything.

## Whether Alerts/Reports Remain Non-Executing

**Yes.** Confirmed by direct source inspection of
`operational-alerting-service.ts` and `observability-metrics.ts`:

- No builder method (`classify`, `fromAIHealthCheck`, `fromKillSwitchGate`,
  `fromRiskCheck`, `fromOrderApprovalRejection`,
  `fromBrokerWriteGuardResult`, `fromPaperOrderIntentDecision`,
  `fromReconciliationWorkflow`, `fromApiUsageSummary`) calls, imports, or
  constructs anything resembling a broker command. Grep confirms zero
  references to `TossSecuritiesAdapter`, `submitOrder`, `cancelOrder`,
  `replaceOrder`, or `BrokerWriteCommandGuardInput` construction anywhere
  in either changed file.
- Every `AlertEvent` carries literal (not computed) `liveBrokerWriteAllowed:
  false` and `impliesLiveTradingAuthorization: false`, set inside the
  single shared `buildAlert()` constructor every builder funnels through —
  confirmed no builder method's return path bypasses `buildAlert()`.
- `ObservabilityMetricsService.emit`/`emitFromAlert` only construct
  `MetricEvent` data records (name, category, kind, value, labels,
  payload, timestamp); neither method has a code path that could trigger
  an action.
- Severity classification is deterministic (`classifyReasonCodes`,
  `reconciliationAlertSeverity`) and never depends on call order or
  timing — reviewed directly, and the test suite additionally proves this
  with explicit order-independence and repeatability tests.
- Sanitization: every alert/metric payload passes through `redactObject()`
  before being returned; `fromApiUsageSummary` only reads
  `ApiUsageSummary`'s already-aggregated numeric fields, never
  `safeMetadata` or `claudeUsage` details directly — confirmed by reading
  the function body.

## Whether Scheduler Jobs Remain No-Write

**Yes.** Confirmed by direct source inspection of
`scheduler-job-runner.ts`:

- All five Phase 6 job definitions produced by
  `createPhase6SchedulerJobCatalog()` have `noWrite: true`,
  `callsBrokerApi: false` — confirmed both by reading
  `phase6JobDefinition()`'s hardcoded defaults (every catalog entry uses
  them; no per-job override exists) and by
  `tests/application/scheduler-job-runner.test.ts` ("marks every catalog
  job no-write, not broker-calling, and not trading-gated").
- This is enforced by `SchedulerJobRunner.start()` itself, not merely
  claimed by the job definitions: a job with `noWrite !== true` or
  `callsBrokerApi === true` is rejected with a specific reason code before
  the run ever reaches `RUNNING`, for **any** job definition passed to the
  runner — confirmed by reading `start()`'s unconditional checks (not
  scoped to `PHASE6_SCHEDULER_JOB_KINDS`) and by the two dedicated tests
  that pass a deliberately non-compliant definition and confirm rejection.
- `SchedulerJobRunner` never reads `.env` or `tmp/phase5/*` itself —
  confirmed by grep (no `fs`/`process.env.TOSS_` reference in the file).
  `requiredLocalStateInputs` failing to resolve to exactly `true` in
  `localStateAvailability` produces a `SKIPPED` run with a per-input
  `required_local_state_missing_<name>` reason code, never a silent
  proceed — confirmed in `missingLocalStateRejections()`.
- `containsSecretLikeOrRawBrokerData()` and `safeErrorSummary()` redact
  API-key-shaped tokens, `token=`/`bearer` values, access/refresh tokens,
  client/app secrets, account-number-shaped text (including `계좌번호`),
  and 8+ consecutive digits before any failed run's error text is stored —
  confirmed by reading the regex patterns directly and by
  `tests/application/scheduler-job-runner.test.ts`'s serialization test
  ("never produces a store ... that contains secret-like or raw broker
  data").
- `reviewPhase6SchedulerJobCatalogSafety()` independently re-proves the
  same three guarantees (no-write, no broker call, no secret-like text)
  for an entire catalog, store-independent, and rejects a deliberately
  tampered catalog in the test suite.

## Whether Runbooks Are Sufficient For Operator Go/No-Go Decisions

**Yes, with appropriate caveats already documented in the runbook itself.**
I read `docs/phase6/phase6-operator-runbook.md` (370 lines) in full and
cross-checked its claims against the merged source rather than trusting
the document text alone:

- The five-check daily go/no-go procedure maps one-to-one onto the five
  `createPhase6SchedulerJobCatalog()` job kinds, and each check's Go/No-Go
  criteria reference concrete, checkable fields
  (`ReconciliationWorkflowResult.liveReadinessBlocked`/
  `blocksDependentTrading`, kill-switch scope states,
  `phase5LocalEvidenceStateKnown`) rather than vague guidance — confirmed
  these fields exist with the stated shapes in the real merged types.
- The runbook explicitly separates "reconciliation `liveReadinessBlocked:
  true`" (expected in Phase 6, no action required) from "reconciliation
  `blocksDependentTrading: true`" (must be actually honored by paused
  paper trading, escalate if not) — this distinction is correct and
  matches `ReconciliationWorkflowResult`'s actual semantics as reviewed in
  round 1 and reconfirmed here.
- All nine incident scenarios in `PHASE6_REQUIRED_RUNBOOK_SCENARIOS` are
  present in the document (verified against
  `IncidentRunbookReview.reviewSet()`'s scenario list) and each declares an
  explicit, non-`CLEAR` `tradingSafetyState` and `prefersNoTrade: true` —
  the reviewer would reject any section that did not, and I confirmed the
  document's own described sections (via the doc text, since the actual
  runbook content is markdown prose, not a `IncidentRunbookSection[]`
  literal reviewable at test time) follow the same structure the reviewer
  enforces on its own test fixtures.
- Explicit "Stop Conditions" section: any `liveBrokerWriteAllowed: true`
  anywhere, any `callsBrokerApi: true`/`noWrite: false` job definition, any
  apparent real secret/token/account-number in output, an unexplained
  `UNKNOWN` kill-switch scope, or reconciliation blocking that paper
  trading does not appear to honor. These are concrete, checkable
  conditions, not vague "use judgment" guidance.
- One caveat worth naming explicitly (not a defect, a scope note): the
  runbook markdown itself is prose, not a data structure that
  `IncidentRunbookReview.reviewSet()` can programmatically validate against
  the live document text. `reviewSet()` validates `IncidentRunbookSection`
  objects (as the test suite does with fixtures matching each of the nine
  scenarios), which gives strong assurance the *shape* of a compliant
  runbook is enforced, but a future engineer manually editing
  `phase6-operator-runbook.md` could still drift the prose out of sync
  with what `reviewSet()` would accept without that drift being caught by
  `npm run check`. This is a reasonable, minor documentation-maintenance
  gap, not a safety-boundary gap — worth flagging as a small
  forward-looking improvement (e.g., a future script that parses the
  runbook into `IncidentRunbookSection` objects and runs it through
  `reviewSet()` in CI) rather than something this review needed to block
  on or fix.

## Whether Paper/Simulation Readiness Is Clearly Separated From Live Readiness

**Yes.** This is the single property P6-005 was most explicitly designed
around, and I verified it structurally rather than just reading the claim:

- `Phase6OperatorSafetyStatus` has three distinctly-named, independently
  computed fields: `paperSimulationReady` (paper execution path health
  only), `liveReadinessBlocked` (the pre-broker-write chain: reconciliation
  + kill switch + risk + approval), and `liveBrokerWriteAllowed: false` (a
  permanent literal, never computed). No two of these three fields share a
  computation — confirmed by reading `buildSafetyStatus()` line by line.
- Verified the independence is real, not just modeled: the test "shows
  paper/simulation readiness independently of a blocked live-readiness
  signal" constructs a LOW-severity reconciliation state that sets
  `liveReadinessBlocked: true` while `paperSimulationReady` stays `true` —
  this is a genuine behavioral proof, not just two fields that happen to
  both default the same way.
- `liveBrokerWriteAllowed: false` is repeated at the top level and on the
  three sub-views most likely to be mistaken for a live-trading signal
  (`paperOrderIntent`, `reconciliationLiveReadiness`, `approvalGuard`), so
  an operator looking at any one sub-view still sees the unconditional
  block without having to cross-reference the top-level field.
- The operator runbook reinforces the same separation in prose: Check 2
  ("Reconciliation Status") explicitly instructs the operator that
  `liveReadinessBlocked: true` "does not require action in Phase 6 ...
  Phase 6 never uses live readiness for anything," while
  `blocksDependentTrading: true` does require confirming paper trading is
  actually paused. This is the correct operational interpretation of the
  P6-005 field split and matches the code exactly.

## Phase 2 Regression Check

Per the task's "Add or update safety regression tests if gaps are
discovered" instruction, I checked whether the consolidated
`tests/safety/safety-regression.test.ts` harness needs a new cross-module
test now that P6-005/006/007 are merged, the same way Phase 1 found and
closed a dashboard-related gap before the merge.

**No new gap was found requiring a new test this phase**, for a specific
reason: P6-005's own test suite
(`tests/application/read-only-dashboard.test.ts`) already performs exactly
the kind of cross-module, real-engine proof the consolidated harness exists
for. It imports and exercises the real `RiskEngine`,
`KillSwitchControlService`, `OrderApprovalEngine`, `BrokerWriteCommandGuard`,
`PaperOrderIntentPipeline`, and `ReconciliationWorkflowService` (not
stand-ins), feeds their real outputs into `Phase6OperatorSafetyDashboardService`,
and proves `liveBrokerWriteAllowed` stays `false` and
`paperSimulationReady`/`liveReadinessBlocked` behave correctly across
several real-engine-driven scenarios (kill switch active, risk veto
active, reconciliation degraded, paper intent rejected). This closes the
exact type of gap Phase 1's appendix in this document flagged as a
pattern to check for once P6-005 landed.

I additionally re-verified (rather than assumed) three things specific to
this round that would have been the most likely place for a boundary gap
to hide:

1. **Alerting's duck-typed interfaces don't create a silent mismatch with
   real round 1 types.** Confirmed `npm run check` (which includes a full
   `tsc` typecheck) passes with the real round 1 output types
   (`KillSwitchTradingGate`, `RiskEngineOutput`, etc.) structurally
   assignable to the alerting module's local interfaces — if a round 1
   type had drifted from what alerting expects, this would be a compile
   error, not a silent runtime gap.
2. **Scheduler's universal `noWrite`/`callsBrokerApi` enforcement actually
   applies to the Phase 6 catalog, not just to hypothetical adversarial
   definitions.** Confirmed by reading `phase6JobDefinition()`'s output
   directly against `start()`'s checks — the five real catalog jobs all
   pass `noWrite: true, callsBrokerApi: false`, so they exercise the
   success path, and the two dedicated "refuses to start ..." tests
   exercise the rejection path with a deliberately tampered definition,
   together covering both sides.
3. **No new module reads `.env` or `tmp/phase5/*` directly.** Grep across
   all five changed/added source files
   (`read-only-dashboard.ts`, `operational-alerting-service.ts`,
   `observability-metrics.ts`, `scheduler-job-runner.ts`,
   `incident-runbook-review.ts`) for `process.env`, `fs.readFile`,
   `fs.readFileSync`, and `tmp/phase5` found no matches outside the
   existing, unrelated Phase 5 scripts this round did not touch.

Given all of the above, I judge the consolidated safety-regression harness
to already have adequate coverage of the round 2 surfaces without a new
addition this phase. This is a judgment call, not a certainty — if a
future reviewer disagrees, the two Phase 1 tests in
`tests/safety/safety-regression.test.ts` (dashboard-decision-cannot-satisfy-
guard) remain a template for adding an equivalent alerting- or
scheduler-focused cross-module proof later.

## Remaining Blockers Before Phase 7 Live-Capable Design Review

These are unchanged in kind from
`docs/reviews/Codex_Phase6_Simulation_Safety_Review.md`, "Remaining
Blockers Before Any Future Live-Capable Design Phase" — round 2 added
operator-facing visibility, not new live-capability groundwork, so none of
the original six items were resolved by this round, and none of the
operator-facing work reviewed here narrows any of them. Re-confirmed
against the round 2 merged state:

1. **No real `TossSecuritiesAdapter` or broker-write implementation
   exists.** Still true after round 2: grep for `TossSecuritiesAdapter`
   across the entire `src/` tree (not just the four modules this review
   focuses on) returns zero matches. `TossWriteAdapter.submitOrder`/
   `cancelOrder` remain typed with an uncallable `command: never`
   parameter.
2. **Phase 5 evidence and open-question resolution remain human-only
   steps.** Unchanged; round 2 did not touch Phase 5 evidence tooling
   except for the already-landed, pre-round-2 reliability fix to
   `validate-toss-evidence-intake.mjs` confirmed working above.
3. **No production credential, compliance, or broker-account provisioning
   work has occurred.** Unchanged; `BrokerAccount.canWriteLive()` still
   requires `status === "ACTIVE"`, `liveTradingEnabled === true`, and
   `permissionStatus === "LIVE_TRADING_ALLOWED"` all agreeing, and no real
   account in this codebase satisfies that — only test fixtures do.
4. **The Phase 5 preflight/completion crash bug is now fixed** (this was
   item 4 in the round 1 review's blocker list) — confirmed above under
   "Commands Run and Results." This item is resolved and is removed from
   the round 2 blocker list.
5. **No load-bearing decision in this review, or in P6-005/006/007, has
   been made by an AI agent alone.** Per `docs/11_AI_RULES.md` Rule 12 and
   Rules 26-30, any actual promotion toward live capability requires
   explicit human review and sign-off. This review does not, and cannot,
   provide that sign-off — it only reports the current, verified state of
   the still-simulation-only, now also operator-visible, system.
6. **Small-capital live readiness
   (`docs/07_Trading_System.md` section 30) remains entirely unaddressed**,
   by design. Round 2's dashboard/alerting/scheduler surfaces give an
   operator visibility that would eventually be useful for a small-capital
   live phase, but none of them implement, verify, or rehearse any of the
   items that section requires (real broker order-type verification, real
   slippage measurement, real fee/tax exposure) — those remain untouched
   and unverified.
7. **Resolved by follow-up commit `857a652`**: the round-2-specific
   documentation-maintenance gap is now closed. The actual
   `docs/phase6/phase6-operator-runbook.md` prose is parsed and checked
   against `IncidentRunbookReview.reviewSet()` by
   `tests/application/incident-runbook-review.test.ts` at
   `npm run check` time. This follow-up did not change the safety boundary
   and did not add any broker-write capability.

## Appendix: Phase 1 Regression-Gap Check (Pre-Merge Baseline)

This appendix records the Phase 1 work only: a review of the current,
pre-P6-005/P6-006/P6-007 state of the operator-facing read-only surfaces
(dashboard, alerting, scheduler, incident runbooks) against the
consolidated `tests/safety/safety-regression.test.ts` harness, following
the same Phase 1 pattern used for P6-004 in round 1
(`docs/reviews/Codex_Phase6_Simulation_Safety_Review.md`, "Appendix: Phase
1 Regression-Gap Check"). It is not the Phase 6 round 2 integration review
itself, and it does not describe any P6-005/P6-006/P6-007 content, since
none of those branches exist yet at the time this appendix was written.

Baseline commit reviewed: `855d1af` ("Add Phase 6 round 2 Claude task
plan"), local `main` tip at the start of Phase 6 round 2, before any of
P6-005, P6-006, or P6-007 were merged.

Files read as the operator-facing baseline:

- `src/application/dashboard/read-only-dashboard.ts`
- `src/application/dashboard/sensitive-control-gate.ts`
- `src/application/alerting/operational-alerting-service.ts`
- `src/application/scheduler/scheduler-job-runner.ts`
- `src/application/incident-runbooks/incident-runbook-review.ts`
- `tests/safety/safety-regression.test.ts` (pre-round-2 state: 16 tests,
  all inherited from Phase 6 round 1)

### Gap Check Finding

Round 2 adds operator-facing surfaces (dashboard, alerts, scheduler) on
top of the round 1 safety chain (`RiskEngine`, `KillSwitchControlService`,
`OrderApprovalEngine`, `BrokerWriteCommandGuard`) that
`tests/safety/safety-regression.test.ts` already exercises end-to-end.
Before this phase, the consolidated regression harness had no coverage at
all of the existing dashboard, alerting, or scheduler modules — each had
only its own per-module unit test file
(`tests/application/read-only-dashboard.test.ts`,
`tests/application/dashboard-sensitive-control-gate.test.ts`,
`tests/application/operational-alerting-service.test.ts`,
`tests/application/scheduler-job-runner.test.ts`,
`tests/application/incident-runbook-review.test.ts`), and none of those
per-module tests prove the cross-module property that an operator-facing
read-only/reporting decision cannot itself substitute for, or feed into, a
real broker-write authorization.

This is a genuine, narrow gap in current coverage: `DashboardSensitiveControlGate`
already returns `allowed`/`mutatesState` decisions for the most privileged
dashboard actions (e.g. `ENABLE_PRODUCTION_MODE`, `ACTIVATE_KILL_SWITCH`),
and by inspection none of its `DashboardActionType` values are
order-submission-shaped and none of its output escapes into
`BrokerWriteCommandGuard` today — but nothing in the regression suite
proved this before Phase 1. Closed in this phase by adding two new tests
to `tests/safety/safety-regression.test.ts`, under a new
`describe("Dashboard operator surface stays advisory-only and cannot
itself authorize a broker write", ...)` block, using the real merged
`DashboardSensitiveControlGate` and `BrokerWriteCommandGuard` classes (not
hand-rolled stand-ins):

1. "never produces a dashboard control decision shaped like a broker
   write, for any known dashboard action type, even fully authorized" —
   evaluates the gate for every current `DashboardActionType` with a
   fully-privileged, fully-confirmed actor, and asserts each `allowed`
   decision contains no order/broker-write-shaped keys
   (`submitOrder`/`cancelOrder`/`replaceOrder`/`placeOrder`/`TossSecuritiesAdapter`)
   and no function-valued properties.
2. "does not let the most privileged allowed dashboard decision
   (`ENABLE_PRODUCTION_MODE`) satisfy `BrokerWriteCommandGuard` on its
   own" — takes a real, fully-`allowed`, `mutatesState:true` dashboard
   decision and feeds it into `BrokerWriteCommandGuard.evaluate` as loose
   context, proving the guard still rejects with every expected
   `missing_*` reason code (order approval, broker account, compliance,
   environment, kill switch, reconciliation) and does not treat the
   dashboard's own authorization as a substitute for any of them.

No existing test was weakened, removed, or loosened to add this coverage.
No implementation file owned by Engineer 1, Engineer 2, or Engineer 3 was
modified — only the shared `tests/safety/safety-regression.test.ts` file,
which this task explicitly owns.

Other candidate gap areas were considered and found already adequately
covered or not yet applicable at the Phase 1 baseline:

- Alerting (`OperationalAlertingService`): by inspection, `classify` and
  `fromAIHealthCheck` only construct and return `AlertEvent` data records;
  neither method calls any execution, order, or broker-write code path,
  and there is no code path in the file that constructs a
  `BrokerWriteCommandGuardInput`-shaped object. Existing unit coverage in
  `tests/application/operational-alerting-service.test.ts` already checks
  severity classification and redaction. No cross-module broker-write
  regression is meaningful yet, because P6-006 (which is expected to
  extend this service) has not landed.
- Scheduler (`SchedulerJobRunner`): by inspection, `start`/`succeed`/`fail`
  only mutate an in-memory `SchedulerJobStore` of job/run records; no
  network client or broker adapter is imported or referenced anywhere in
  the file, and a `tradingRelated` job is rejected outright unless a
  `SchedulerSafetyState` is supplied and every one of its fields (kill
  switch inactive, reconciliation not blocking, data not stale, and
  `liveBrokerWriteGatesPermit`) agrees. No cross-module broker-write
  regression is meaningful yet, because P6-007 (which is expected to
  extend this runner with concrete job definitions) has not landed.
- Incident runbooks (`IncidentRunbookReview`): by inspection, `review` is a
  pure completeness checker over a `IncidentRunbookSection` value; it has
  no code path that can invoke or approve any action, executable or
  otherwise. Not a broker-write-adjacent surface in its current form.

These three are flagged here, not closed with new tests, because adding
speculative regression tests against modules that P6-006/P6-007 have not
yet touched would risk testing behavior that does not exist yet or
duplicating work those branches' own task documents already require
(`P6-006_phase6_alerting_and_reports.md`, `P6-007_phase6_scheduler_and_runbooks.md`,
"Test Criteria"). Phase 2 must re-check these three modules once
P6-006/P6-007 are merged and add further regression coverage if a similar
cross-module gap is found in their post-merge state.

### Tests Added In Phase 1

Both added to `tests/safety/safety-regression.test.ts`, under a new
`describe("Dashboard operator surface stays advisory-only and cannot
itself authorize a broker write", ...)` block:

- "never produces a dashboard control decision shaped like a broker write,
  for any known dashboard action type, even fully authorized"
- "does not let the most privileged allowed dashboard decision
  (ENABLE_PRODUCTION_MODE) satisfy BrokerWriteCommandGuard on its own"

`tests/safety/safety-regression.test.ts` now has 18 tests total (16
inherited from round 1, plus these 2), all passing.

### Phase 1 Commands Run

```bash
npx vitest run tests/safety/safety-regression.test.ts
npm run check
```

Both passed. `npx vitest run tests/safety/safety-regression.test.ts`
reported 18 tests passing. `npm run check` ran typecheck plus the full
test suite (82 test files, 641 tests, all passing) with no regressions
introduced.

### Phase 1 Scope Notes

- No implementation files owned by Engineer 1 (P6-005), Engineer 2
  (P6-006), or Engineer 3 (P6-007) were modified.
- No real Toss API call was made, simulated, or coded.
- No real broker write of any kind was performed, simulated, or coded.
- `.env` and `tmp/phase5/*` were not read, printed, inspected, or
  committed.
- `docs/tasks/phase6_claude_worktree_tasks/README.md` was not modified in
  this phase.
- `docs/phase6/README.md` and `docs/phase6/phase6-operator-runbook.md`
  were not modified in this phase.
- Live trading was not marked ready anywhere in this document, including
  in the placeholder sections above.
