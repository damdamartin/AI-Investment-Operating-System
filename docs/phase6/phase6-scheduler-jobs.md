# Phase 6 Scheduler Jobs (P6-007)

Version: 0.1.0
Status: Draft
Last Updated: 2026-07-29
Related Task: `docs/tasks/phase6_claude_worktree_tasks/P6-007_phase6_scheduler_and_runbooks.md`
Related Code: `src/application/scheduler/scheduler-job-runner.ts`, `tests/application/scheduler-job-runner.test.ts`

## Purpose

This document defines the scheduler-safe Phase 6 round 2 jobs and the
guarantees `SchedulerJobRunner` enforces on all of them. It does not
authorize live trading, real Toss API calls, or any broker-facing network
operation. It connects operational visibility (status review, alerting,
audit coverage) to the paper/simulation core that Phase 6 round 1 already
proved safe, without adding any new write capability anywhere.

## What This Module Is (and Is Not)

`SchedulerJobRunner` is a pure, in-memory job-lifecycle state machine
(`start` / `succeed` / `fail` / `canRetry`). It does not itself contain a
cron implementation, does not itself read `.env` or `tmp/phase5/`, and does
not itself call `reconciliation-service.ts`, `kill-switch-control-service.ts`,
`paper-trading-engine.ts`, or any alerting/dashboard module. Those modules
are owned by other Phase 6 engineers this round (P6-003, P6-005, P6-006)
and are consumed read-only, if at all, by whatever wires a real cron
trigger to this runner -- never imported directly into this file. This
keeps the runner decoupled and keeps this module's safety guarantees
provable without depending on any other engineer's concurrent work.

A real deployment would wire an actual scheduler (cron, a queue worker,
etc.) to call `SchedulerJobRunner.start(...)` for each due job, compute the
job's `requiredLocalStateInputs` availability from whatever sanitized
source is appropriate (for example a prior read-only status report from a
dashboard read model), run the job's actual review logic only after
`start()` returns `ok: true`, and then call `succeed`/`fail`. This module
defines the contract that makes such wiring safe; it does not implement the
wiring itself.

## The Five Phase 6 Round 2 Jobs

`createPhase6SchedulerJobCatalog()` returns these five job definitions.
Every one of them has `noWrite: true`, `callsBrokerApi: false`, and
`tradingRelated: false`.

### 1. `PHASE6_PAPER_SIMULATION_STATUS_REVIEW`

- **Purpose**: periodically report the current state of paper order
  intents and simulated execution records (counts by status, most recent
  activity) so an operator can see paper/simulation activity without
  manually querying anything.
- **Required local state input**: `paperTradingStateSnapshot` -- a
  sanitized snapshot already produced by the paper-trading engine's own
  read path. This job never constructs an order, never touches
  `PaperOrderIntentPipeline.evaluate()`'s write path (there is none), and
  never produces a `BrokerWriteCommandGuardInput`.
- **No-write guarantee**: reports only; cannot create, modify, or cancel a
  paper order or a broker order.

### 2. `PHASE6_RECONCILIATION_REVIEW`

- **Purpose**: periodically surface the current
  `ReconciliationWorkflowResult` (`liveReadinessBlocked`,
  `blocksDependentTrading`, issue counts by classification) so an operator
  can see reconciliation health without running the review by hand.
- **Required local state input**: `reconciliationReportSnapshot`.
- **No-write guarantee**: reconciliation itself is already read-only
  end-to-end (`docs/phase6/reconciliation-snapshot-review.md`); this job
  only reports the already-computed result. `correctiveTradingAllowed` and
  `liveBrokerWriteAllowed` stay hardcoded `false` in the underlying
  reconciliation module regardless of what this job reports.

### 3. `PHASE6_KILL_SWITCH_STATE_REVIEW`

- **Purpose**: periodically surface current kill-switch scope states
  (GLOBAL/MARKET/PORTFOLIO/STRATEGY/ASSET) so an operator can see whether
  trading is currently paused or blocked.
- **Required local state input**: `killSwitchStateSnapshot`.
- **No-write guarantee**: this job only reads kill-switch state; it cannot
  call `KillSwitchControlService.activate`/`deactivate`.
- **Deliberately not trading-gated**: unlike a job that would place trades,
  this job's entire purpose is to observe kill-switch state, including an
  *active* kill switch. If it were gated behind
  `SchedulerSafetyState.killSwitchActive === false` the way a trading job
  is, it could never report the one condition it exists to report on. See
  "Why Review Jobs Are Not `tradingRelated`" below.

### 4. `PHASE6_ALERT_REPORT_GENERATION`

- **Purpose**: periodically generate a sanitized alert/report digest (for
  example: exceptions from the last interval, using the same "quiet
  during normal operation" principle as `docs/07_Trading_System.md`
  section 27 and `docs/11_AI_RULES.md` Rule 24) for operator consumption.
- **Required local state input**: `alertFeedSnapshot` -- a sanitized feed
  already produced by the alerting module owned by P6-006. This job does
  not import or reimplement alerting logic; it only wraps a periodic
  invocation contract around an already-sanitized feed.
- **No-write guarantee**: report generation only. It cannot send an order,
  and per `docs/11_AI_RULES.md` Rule 21 any generated report must redact
  authorization headers, access tokens, refresh tokens, secrets, and
  unnecessary account identifiers -- `containsSecretLikeOrRawBrokerData()`
  (exported from `scheduler-job-runner.ts`) is available for any caller
  that wants to scan generated report text before it is stored or sent.

### 5. `PHASE6_AUDIT_COVERAGE_REVIEW`

- **Purpose**: periodically confirm that audit records exist for recent
  paper/simulation decisions (per `docs/07_Trading_System.md` section 28's
  "every production order must be reconstructable" principle, applied here
  to paper/simulation records) and confirm whether local Phase 5 evidence
  state is known.
- **Required local state inputs**: `auditLogSnapshot` and
  `phase5LocalEvidenceStateKnown`.
- **No-write guarantee**: this job only reads and reports; it cannot alter
  an audit record.
- **Fail-closed handling for missing local Phase 5 state**: this is the
  one job in the catalog that ties into local Phase 5 evidence state
  (whether `.env` and `tmp/phase5/` local setup has been completed on the
  operating machine). It does **not** read `.env` or `tmp/phase5/*`
  itself -- doing so from inside this codebase's committed source would
  violate the Phase 6 round 2 boundary. Instead, the caller who wires this
  job to a real scheduler is expected to have already run a local,
  sanitized check (for example `npm run phase5:toss:doctor`, which itself
  performs no network calls and never prints secret values) and pass in a
  single boolean, `phase5LocalEvidenceStateKnown`. If that boolean is
  anything other than exactly `true` -- including if it is omitted
  entirely -- `SchedulerJobRunner.start()` fails the run closed with
  `required_local_state_missing_phase5LocalEvidenceStateKnown`, mirroring
  the fail-closed pattern `scripts/phase5-toss-doctor.mjs` already uses for
  a missing endpoint catalog, evidence manifest, or evidence intake file
  (`endpoint_catalog_file_missing`, `evidence_manifest_file_missing`,
  `evidence_intake_file_missing`). The run is `SKIPPED`, never
  silently treated as "unknown but probably fine."

## Universal Guarantees (Enforced In Code, Not Just By Convention)

`SchedulerJobRunner.start()` enforces the following for **every** job
definition, not only the five Phase 6 kinds above:

1. **No-write is enforced, not assumed.** If `definition.noWrite !== true`,
   the run is rejected with `scheduled_job_must_be_no_write` before it ever
   reaches `RUNNING`. A caller cannot start a job that claims to write.
2. **Broker API calls are enforced, not assumed, to be absent.** If
   `definition.callsBrokerApi === true`, the run is rejected with
   `scheduled_job_must_not_call_broker_api` before it ever reaches
   `RUNNING`. This includes real read-only Toss verification calls --
   those remain a human-operator-only, manually triggered action per
   `docs/phase5/local-toss-read-only-runbook.md`, never something this
   scheduler automates.
3. **Missing local state fails closed.** Any `requiredLocalStateInputs`
   entry not present and exactly `true` in
   `StartScheduledJobInput.localStateAvailability` produces a per-input
   `required_local_state_missing_<name>` reason code and a `SKIPPED` run.
   The runner never guesses, never proceeds with a default, and never
   silently treats "unknown" the same as "safe."
4. **No secret-like or raw-broker-data text survives into runner output.**
   `safeErrorSummary()` redacts API-key-shaped tokens, `token=`/`bearer `
   values, access/refresh tokens, client/app secrets, account-number-shaped
   text (including the Korean term `계좌번호`), and any run of 8 or more
   consecutive digits (a heuristic for account-number-shaped identifiers)
   before a failed run's error text is stored. `containsSecretLikeOrRawBrokerData()`
   is exported so any caller (or test) can independently scan generated
   output before treating it as safe to display or store.
5. **Singleton and retry semantics are unchanged from round 1.** A
   singleton job cannot have two concurrent `RUNNING` runs;
   `canRetry` only allows a retry while `attempt < maxAttempts` on a
   `FAILED` run. Neither of these existing guarantees was loosened.

`reviewPhase6SchedulerJobCatalogSafety(definitions)` is a pure,
store-independent check that proves the same three guarantees (no-write,
no broker API call, no secret-like/raw-broker-data text in the job's name
or schedule expression) hold for an entire catalog before any job in it is
ever started. It is used directly in
`tests/application/scheduler-job-runner.test.ts`.

## Why Review Jobs Are Not `tradingRelated`

`SchedulerSafetyState`-gated (`tradingRelated: true`) jobs exist for
actions that could affect trading (for example a hypothetical future
signal-generation job). Gating them behind kill-switch/reconciliation/
staleness state is correct: if trading is unsafe, a trading-affecting job
should not run.

The five Phase 6 round 2 jobs are status **reviews**, not trading actions.
Setting `tradingRelated: true` on, say, `PHASE6_KILL_SWITCH_STATE_REVIEW`
would mean the job refuses to run precisely when the kill switch is
active -- the exact moment an operator most needs to see that state. All
five jobs are therefore `tradingRelated: false` by design, and are
expected to keep running (and reporting) through paused or blocked trading
states. This matches `docs/07_Trading_System.md` section 27's guidance
that exceptions (kill switch activation, reconciliation mismatch, etc.)
must remain visible, and `docs/11_AI_RULES.md` Rule 24's "normal operation
should be quiet" principle only applies to notification volume during
*normal* operation -- it does not mean status jobs should stop reporting
during an exception.

## What This Round Does Not Add

- No cron/timer implementation. `SchedulerJobRunner` is triggered by a
  caller; it does not itself decide when time has passed.
- No real Toss API call of any kind, read-only or otherwise.
- No order submission, cancellation, or replacement job.
- No transfer, withdrawal, or currency-conversion job.
- No job that reads `.env` or real `tmp/phase5/*` receipts directly from
  this codebase's source.
- No change to `PaperOrderIntentPipeline`, `ReconciliationWorkflowResult`,
  `KillSwitchControlService`, `OrderApprovalEngine`, or
  `BrokerWriteCommandGuard` -- all Phase 6 round 1 modules and consumed
  read-only only, per this round's file-ownership rules.

## Test Coverage

`tests/application/scheduler-job-runner.test.ts` proves:

- singleton and retry semantics unchanged from round 1
- a job with `noWrite: false` is refused before `RUNNING`
- a job with `callsBrokerApi: true` is refused before `RUNNING`
- missing `requiredLocalStateInputs` produce per-input, fail-closed reason
  codes, including for `PHASE6_AUDIT_COVERAGE_REVIEW`'s
  `phase5LocalEvidenceStateKnown` input specifically
- Phase 6 review jobs proceed to `RUNNING` without a `SchedulerSafetyState`
  even when trading would otherwise be paused/blocked
- the five-job catalog matches the expected kinds and each definition's
  `noWrite`/`callsBrokerApi`/`tradingRelated` flags
- `reviewPhase6SchedulerJobCatalogSafety` accepts the real catalog and
  rejects a tampered one
- a full store (definitions and completed runs) serialized to JSON
  contains no secret-like or raw-broker-data-shaped text, even after
  redacted error text has been recorded
