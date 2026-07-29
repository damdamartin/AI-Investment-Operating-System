# Codex Phase 6 Round 2 Operational Readiness Review

Version: 0.1.0
Status: Draft (Phase 1 of 2 — scaffold and pre-merge regression-gap check only)
Review Date: 2026-07-29
Task: P6-008 Phase 6 Round 2 Integration Review
Assigned Engineer: Engineer 4

## Purpose

This document will record the Phase 6 round 2 integration and operational
readiness review after P6-005 (operator dashboard), P6-006 (alerting and
reports), and P6-007 (scheduler and runbooks) are merged into local `main`.

This review will not authorize live trading, order creation, order
cancellation, order modification, transfer, withdrawal, currency
conversion, or production capital use. It must not weaken any existing
fail-closed control, and it must confirm that none of the P6-005/006/007
changes weaken one either.

## Phase Status

- Phase 1 (scaffold and pre-merge regression-gap check): complete.
- Phase 2 (full integration review after P6-005/P6-006/P6-007 merge):
  PENDING — awaiting P6-005/P6-006/P6-007 merge.

This document is intentionally incomplete after Phase 1. Every section
below that depends on merged P6-005/006/007 content is marked with the
literal placeholder text `PENDING — awaiting P6-005/P6-006/P6-007 merge`
and must not be filled in until those three branches are merged into local
`main` by the orchestrator. Phase 1 does not guess at, simulate, or assume
what those branches will contain.

## Summary

PENDING — awaiting P6-005/P6-006/P6-007 merge.

## What Changed in P6-005 (Operator Dashboard)

PENDING — awaiting P6-005/P6-006/P6-007 merge.

## What Changed in P6-006 (Alerting and Reports)

PENDING — awaiting P6-005/P6-006/P6-007 merge.

## What Changed in P6-007 (Scheduler and Runbooks)

PENDING — awaiting P6-005/P6-006/P6-007 merge.

## Commands Run and Results

PENDING — awaiting P6-005/P6-006/P6-007 merge.

Phase 2 must run, at minimum, the commands listed in
`docs/tasks/phase6_claude_worktree_tasks/P6-008_phase6_round2_integration_review.md`,
"Test Criteria":

```bash
npm run check
npm run phase5:toss:readiness
npm run phase5:toss:doctor -- tmp/phase5/toss-read-only-endpoints.local.json tmp/phase5/evidence-manifest.local.json tmp/phase5/evidence-intake.local.json
npm run phase5:toss:preflight -- tmp/phase5/toss-read-only-endpoints.local.json tmp/phase5/evidence-manifest.local.json tmp/phase5/evidence-intake.local.json
PHASE5_TOSS_READ_ONLY_CALL_APPROVED=true npm run phase5:toss:completion -- tmp/phase5/toss-read-only-endpoints.local.json tmp/phase5/evidence-manifest.local.json tmp/phase5/evidence-intake.local.json
```

Phase 5 local commands may fail closed on a fresh checkout with no local
`.env` or `tmp/phase5/*` files. If so, Phase 2 must report the exact
reason codes and confirm `liveBrokerWriteAllowed:false`, no unexpected
write capability, no raw payload storage, and no unexpected network calls
— per the task's "Test Criteria" section. Per the universal safety rules,
this review must never read, print, inspect, or commit the real `.env` or
real `tmp/phase5/*` receipts even if they exist locally.

## Whether Dashboard/Status Remains Read-Only

PENDING — awaiting P6-005/P6-006/P6-007 merge.

## Whether Alerts/Reports Remain Non-Executing

PENDING — awaiting P6-005/P6-006/P6-007 merge.

## Whether Scheduler Jobs Remain No-Write

PENDING — awaiting P6-005/P6-006/P6-007 merge.

## Whether Runbooks Are Sufficient For Operator Go/No-Go Decisions

PENDING — awaiting P6-005/P6-006/P6-007 merge.

## Whether Paper/Simulation Readiness Is Clearly Separated From Live Readiness

PENDING — awaiting P6-005/P6-006/P6-007 merge.

## Remaining Blockers Before Phase 7 Live-Capable Design Review

PENDING — awaiting P6-005/P6-006/P6-007 merge.

Phase 2 must at minimum re-confirm or update the six items already listed
in `docs/reviews/Codex_Phase6_Simulation_Safety_Review.md`, "Remaining
Blockers Before Any Future Live-Capable Design Phase", and add any new
blocker specific to the operator-facing surfaces added in round 2
(dashboard, alerting/reports, scheduler/runbooks).

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
