# Phase 6 Operator Runbook (P6-007)

Version: 0.1.0
Status: Draft
Last Updated: 2026-07-29
Related Task: `docs/tasks/phase6_claude_worktree_tasks/P6-007_phase6_scheduler_and_runbooks.md`
Related Code: `src/application/scheduler/scheduler-job-runner.ts`,
`src/application/incident-runbooks/incident-runbook-review.ts`
Related Docs: `docs/phase6/phase6-scheduler-jobs.md`,
`docs/phase5/local-toss-read-only-runbook.md` (style precedent),
`docs/11_AI_RULES.md`, `docs/07_Trading_System.md`

## Purpose

This runbook is for a human operator monitoring Phase 6 paper/simulation
activity. It does not authorize live trading, order creation, order
cancellation, order modification, transfer, withdrawal, currency
conversion, or production capital use. Every check in this runbook is
read-only and no-write. None of it calls a real Toss API.

If any step in this runbook ever produces a result that looks like it
authorizes a real broker write, treat that as a stop condition (see "Stop
Conditions" below), not as a step to follow.

## Scope

This runbook covers day-to-day operator visibility into:

1. paper/simulation status
2. reconciliation status
3. kill-switch state
4. alerts and reports
5. audit coverage
6. what to do when local Phase 5 state (not this repository's state, the
   operator machine's local `.env` / `tmp/phase5/` state) is missing or
   unknown

It does not cover Phase 5 Toss read-only verification itself -- that
remains `docs/phase5/local-toss-read-only-runbook.md`, a separate,
manually-triggered, human-operator-only procedure. This runbook's
`PHASE6_AUDIT_COVERAGE_REVIEW` job only checks whether that other
runbook's local state is *known*, never triggers it.

## Daily Go/No-Go Checklist

Run through these five checks in order. Each check corresponds to one job
in `createPhase6SchedulerJobCatalog()` (`docs/phase6/phase6-scheduler-jobs.md`).
None of these calls a real API; they read already-computed, sanitized
state.

### Check 1: Paper/Simulation Status (`PHASE6_PAPER_SIMULATION_STATUS_REVIEW`)

- Confirm paper order intents are being produced and classified
  (`ACCEPTED` / `REJECTED` / `DEFERRED`) as expected for current market
  conditions.
- Confirm no unexpected spike in `REJECTED` paper candidates (could
  indicate a risk/money-check misconfiguration worth investigating, even
  though nothing here can reach a real broker).
- Go/No-Go: **Go** if the paper trading engine is producing status output
  at the expected cadence. **No-Go** (investigate before relying on the
  system for anything) if the status snapshot is stale, missing, or
  internally inconsistent.

### Check 2: Reconciliation Status (`PHASE6_RECONCILIATION_REVIEW`)

- Read the current `ReconciliationWorkflowResult`.
- If `liveReadinessBlocked: true`, note it and move on -- this is expected
  and does not require action in Phase 6 (Phase 6 never uses live
  readiness for anything). It exists as forward-looking information only.
- If `blocksDependentTrading: true`, this **does** matter for
  paper/simulation flow: dependent paper trading is expected to pause per
  `docs/07_Trading_System.md` section 20's reconciliation rules. Confirm
  the pause is actually observed in Check 1's output.
- Go/No-Go: **Go** if reconciliation issue counts match expectations for
  the current test data and any `blocksDependentTrading: true` state is
  actually being honored by paused paper trading. **No-Go** if a blocking
  discrepancy exists but paper trading appears to be proceeding anyway --
  escalate immediately per the `RECONCILIATION_MISMATCH` scenario below.

### Check 3: Kill-Switch State (`PHASE6_KILL_SWITCH_STATE_REVIEW`)

- Read current kill-switch scope states (GLOBAL/MARKET/PORTFOLIO/STRATEGY/
  ASSET).
- Confirm any `ACTIVE` state has a recorded activation reason and
  timestamp.
- Confirm no scope shows `UNKNOWN` (an unknown kill-switch state must be
  treated the same as active/blocking per `docs/11_AI_RULES.md` Rule 16
  and `KillSwitchControlService.evaluateAggregateTradingGate`'s fail-closed
  behavior).
- Go/No-Go: **Go** if all scopes are `INACTIVE`, or any `ACTIVE`/`UNKNOWN`
  scope is already understood and expected. **No-Go** if an `ACTIVE` or
  `UNKNOWN` scope is unexplained -- follow the `KILL_SWITCH_ACTIVATION`
  scenario below.

### Check 4: Alerts and Reports (`PHASE6_ALERT_REPORT_GENERATION`)

- Review the latest sanitized alert/report digest.
- Confirm the digest itself contains no secret-like or raw-broker-data
  text (`containsSecretLikeOrRawBrokerData()` from
  `scheduler-job-runner.ts` can be used to scan generated text before
  trusting or forwarding it).
- Go/No-Go: **Go** if the digest exists, is recent, and is sanitized.
  **No-Go** if the digest is stale, missing, or appears to contain
  anything secret-like or account-identifier-shaped -- treat that as a
  stop condition (see below), do not forward the digest anywhere.

### Check 5: Audit Coverage (`PHASE6_AUDIT_COVERAGE_REVIEW`)

- Confirm recent paper/simulation decisions have corresponding audit
  records (per `docs/07_Trading_System.md` section 28).
- Confirm the local Phase 5 evidence state flag
  (`phase5LocalEvidenceStateKnown`) is `true` before treating this check as
  complete. If it is not available, see "Fail-Closed Handling for Missing
  Local Phase 5 State" below -- this is expected on a fresh machine and is
  not itself an incident.
- Go/No-Go: **Go** if recent paper/simulation activity has matching audit
  records and the local Phase 5 evidence state flag is known (whatever its
  value). **No-Go** if audit coverage has a gap for recent activity --
  follow the `AUDIT_COVERAGE_GAP` scenario below.

## Fail-Closed Handling for Missing Local Phase 5 State

`PHASE6_AUDIT_COVERAGE_REVIEW` requires `phase5LocalEvidenceStateKnown` as
one of its `requiredLocalStateInputs`. This flag is **not** computed by
reading `.env` or `tmp/phase5/*` from inside this repository's committed
source -- an operator computes it separately, for example by running the
existing, already-safe Phase 5 doctor command on their own machine:

```bash
npm run phase5:toss:doctor
```

This command performs no network calls and never prints secret values (see
`docs/phase5/README.md`, "Doctor Command"). Whatever it reports --
`readyForReadOnlyVerification: true` or `false` -- either outcome is
"known." The operator then passes `phase5LocalEvidenceStateKnown: true`
into the scheduler run's `localStateAvailability` if and only if that
doctor command (or an equivalent sanitized check) was actually run
recently enough to trust.

If the operator has **not** run that check recently, or the local
`.env`/`tmp/phase5/` state is uncertain, leave
`phase5LocalEvidenceStateKnown` unset (or `false`). This is the expected,
normal state on a fresh checkout or a fresh worktree, exactly as
`docs/phase5/local-toss-read-only-runbook.md`'s "Expected Fail-Closed
States After `npm run check`" section documents for every Phase 5 command.
`SchedulerJobRunner.start()` will then reject the
`PHASE6_AUDIT_COVERAGE_REVIEW` run with
`required_local_state_missing_phase5LocalEvidenceStateKnown` (`SKIPPED`,
not `RUNNING`, not `FAILED`). This is correct behavior, not a bug:

- Do not "fix" this by guessing the flag is `true`.
- Do not "fix" this by reading `.env` or `tmp/phase5/*` directly from AI
  agent code or from a committed script.
- Do not treat a `SKIPPED` audit-coverage run as equivalent to a
  successful one when deciding whether audit coverage is actually
  confirmed for the day -- it is not confirmed; it is unknown, and unknown
  must be treated as not-yet-verified, per `docs/11_AI_RULES.md` Rule 22.

The same fail-closed principle applies to every other required local state
input in the catalog (`paperTradingStateSnapshot`,
`reconciliationReportSnapshot`, `killSwitchStateSnapshot`,
`alertFeedSnapshot`, `auditLogSnapshot`): if the sanitized snapshot a
caller would supply is not actually available, the job must not run, and
must not be treated as having silently succeeded.

## Incident Scenarios

Each scenario below is reviewable with
`IncidentRunbookReview.review(section)`
(`src/application/incident-runbooks/incident-runbook-review.ts`), which
rejects a section missing symptoms, immediate actions, investigation
steps, recovery steps, or postmortem notes; rejects a section whose
`tradingSafetyState` is `CLEAR` (an incident section must record an
explicitly restrictive state, `PAUSED` or `BLOCKED`); rejects a section
whose `prefersNoTrade` is not `true`; and rejects a section containing
secret-like or raw-broker-data-shaped text. `IncidentRunbookReview.reviewSet(sections)`
additionally confirms every scenario below is actually present in the
document, not just that present sections are complete.

`PHASE6_REQUIRED_RUNBOOK_SCENARIOS` (exported from
`incident-runbook-review.ts`) is the authoritative list:

```text
BROKER_API_FAILURE
UNKNOWN_ORDER_STATE
RECONCILIATION_MISMATCH
CLAUDE_API_FAILURE
NAVER_API_FAILURE
KILL_SWITCH_ACTIVATION
SCHEDULER_JOB_FAILURE
LOCAL_PHASE5_STATE_MISSING
AUDIT_COVERAGE_GAP
```

### BROKER_API_FAILURE

- **Symptoms**: broker-facing calls (any future real Toss integration)
  return errors or time out. Not applicable to any code that exists in
  this repository today (no `TossSecuritiesAdapter` implementation
  exists), but the scenario stays defined for when one eventually does.
- **Immediate actions**: pause dependent trading; do not blindly retry
  (`docs/11_AI_RULES.md` Rule 15).
- **Investigation**: check broker status page; check recent broker API
  changes; check local network/auth configuration (never paste secret
  values anywhere while doing this).
- **Recovery**: resume only after broker state is confirmed known and
  reconciliation has run.
- **Trading safety state**: `BLOCKED`.
- **Prefers no-trade under uncertainty**: `true`.
- **Postmortem notes**: record the broker failure window, affected
  simulation decisions, reconciliation evidence reviewed, and follow-up
  actions.

### UNKNOWN_ORDER_STATE

- **Symptoms**: an order's state cannot be confirmed as filled, rejected,
  or cancelled.
- **Immediate actions**: mark the order `UNKNOWN_REQUIRES_RECONCILIATION`
  (`docs/07_Trading_System.md` section 19); pause related trading.
- **Investigation**: query broker order status once, not in a retry loop;
  cross-check with fill query.
- **Recovery**: resume only after reconciliation resolves the order to a
  known terminal state.
- **Trading safety state**: `BLOCKED`.
- **Prefers no-trade under uncertainty**: `true`.
- **Postmortem notes**: record the unknown state, resolution evidence,
  impacted paper/simulation activity, and prevention action.

### RECONCILIATION_MISMATCH

- **Symptoms**: `PHASE6_RECONCILIATION_REVIEW` reports a `BLOCKING` or
  `REQUIRES_HUMAN_REVIEW` issue, or `blocksDependentTrading: true`.
- **Immediate actions**: pause dependent paper/simulation trading; do not
  attempt an automatic correction (none exists --
  `correctiveTradingAllowed` is hardcoded `false`).
- **Investigation**: review the sanitized `ReconciliationIssue.ref` values
  (already masked); identify whether the gap is a timing artifact or a
  real discrepancy.
- **Recovery**: `REQUIRES_HUMAN_REVIEW` issues are never auto-resolved --
  a human must record the resolution; resume only after the workflow
  result returns to a non-blocking state.
- **Trading safety state**: `BLOCKED`.
- **Prefers no-trade under uncertainty**: `true`.
- **Postmortem notes**: record the mismatch category, sanitized refs used
  for review, human resolution, and any test coverage added.

### CLAUDE_API_FAILURE

- **Symptoms**: Claude API calls fail, time out, or return invalid/
  unparseable output.
- **Immediate actions**: treat AI output as unavailable; do not let
  strategy signal generation proceed on stale or guessed AI output
  (`docs/11_AI_RULES.md` Rule 7).
- **Investigation**: check Claude API status; check recent prompt/schema
  changes; check API usage/rate-limit state (see P6-006's `api-usage`
  module, read-only).
- **Recovery**: resume once Claude API output is valid and schema-passing
  again.
- **Trading safety state**: `PAUSED`.
- **Prefers no-trade under uncertainty**: `true`.
- **Postmortem notes**: record the failure mode, schema or timeout
  evidence, affected strategy signals, and follow-up prompt/schema fix.

### NAVER_API_FAILURE

- **Symptoms**: Naver news/data API calls fail or return invalid data.
- **Immediate actions**: treat news input as unavailable; per
  `docs/07_Trading_System.md` section 10, news alone can never create an
  order anyway, so this failure degrades the News and Event Engine's
  input, not the trading path's safety gates directly -- but any strategy
  that leans on fresh news should pause until data resumes.
- **Investigation**: check Naver API status; check recent integration
  changes.
- **Recovery**: resume once news data is flowing and fresh again.
- **Trading safety state**: `PAUSED`.
- **Prefers no-trade under uncertainty**: `true`.
- **Postmortem notes**: record the outage window, stale-data impact, data
  freshness checks, and any fallback policy changes.

### KILL_SWITCH_ACTIVATION

- **Symptoms**: `PHASE6_KILL_SWITCH_STATE_REVIEW` reports an `ACTIVE` or
  `UNKNOWN` scope that was not already expected/understood.
- **Immediate actions**: confirm the activation reason and scope; do not
  attempt to deactivate without understanding why it activated
  (`docs/11_AI_RULES.md` Rule 23: no AI, UI, strategy, or worker may
  bypass an active kill switch).
- **Investigation**: review `KillSwitchControlService` command history for
  the scope; confirm no out-of-order command was involved
  (`kill_switch_command_out_of_order` from P6-003's hardening).
- **Recovery**: deactivation must be audited and human-approved; resume
  only after the underlying cause is resolved.
- **Trading safety state**: `BLOCKED`.
- **Prefers no-trade under uncertainty**: `true`.
- **Postmortem notes**: record the active scope, activation reason,
  approval evidence, and any guard or monitoring improvements.

### SCHEDULER_JOB_FAILURE

- **Symptoms**: a Phase 6 scheduler job (`SchedulerJobRunner.fail(...)`)
  reports `FAILED`, or a job that should be running on schedule has not
  produced a recent `SUCCEEDED` run.
- **Immediate actions**: check `run.safeErrorSummary` for the redacted
  failure reason; do not treat a failed status-review job as "trading is
  therefore fine" -- treat visibility itself as degraded.
- **Investigation**: check `run.attempt` against the job's `maxAttempts`;
  check whether `canRetry` still allows a retry; check whether the failure
  is a code bug versus a missing local state input (see the fail-closed
  section above -- a missing input produces `SKIPPED`, not `FAILED`, so a
  true `FAILED` status indicates something else went wrong while the job
  was actually running).
- **Recovery**: resume normal cadence once the underlying job code issue
  is fixed; confirm the next run actually reaches `SUCCEEDED`.
- **Trading safety state**: `PAUSED` (loss of visibility, not necessarily
  loss of a live-trading-relevant safety control, since none of these jobs
  can affect trading directly -- but reduced visibility still warrants
  caution).
- **Prefers no-trade under uncertainty**: `true`.
- **Postmortem notes**: record the failed job, sanitized error summary,
  retry decision, fix, and next successful run evidence.

### LOCAL_PHASE5_STATE_MISSING

- **Symptoms**: `PHASE6_AUDIT_COVERAGE_REVIEW` is `SKIPPED` with
  `required_local_state_missing_phase5LocalEvidenceStateKnown`, or an
  operator otherwise cannot confirm local `.env`/`tmp/phase5/` state.
- **Immediate actions**: none required for paper/simulation trading itself
  -- Phase 6 does not depend on Phase 5 local state to keep running. This
  scenario exists to prevent an operator from mistaking "unknown" for
  "fine" when reviewing audit coverage.
  See "Fail-Closed Handling for Missing Local Phase 5 State" above.
- **Investigation**: run `npm run phase5:toss:doctor` locally (no network
  calls, no secret values printed) to get a fresh, sanitized readiness
  report if audit coverage review needs to be re-attempted.
- **Recovery**: once a fresh sanitized local check has been run, supply
  `phase5LocalEvidenceStateKnown: true` for the next
  `PHASE6_AUDIT_COVERAGE_REVIEW` run.
- **Trading safety state**: `PAUSED` (for the audit-coverage check only;
  not a trading-path incident).
- **Prefers no-trade under uncertainty**: `true`.
- **Postmortem notes**: record when local state became known, which
  sanitized check was used, and why no local secret or raw receipt was
  copied into committed artifacts.

### AUDIT_COVERAGE_GAP

- **Symptoms**: `PHASE6_AUDIT_COVERAGE_REVIEW` finds recent
  paper/simulation activity without a corresponding audit record.
- **Immediate actions**: treat the gap as a signal that auditability
  (`docs/11_AI_RULES.md` Rule 30) may have been compromised; do not
  suppress or explain away a gap without a recorded investigation.
- **Investigation**: identify the specific decision(s) missing audit
  coverage; check whether `AuditLogService` or `PaperOrderIntentAuditContext`
  encountered an error around that time.
- **Recovery**: fix the underlying audit-writing gap; confirm subsequent
  activity is fully covered before considering the incident closed.
- **Trading safety state**: `BLOCKED` (an unreconstructable trading
  decision is treated the same severity as a reconciliation mismatch, per
  `docs/07_Trading_System.md` section 28's "if an order cannot be
  explained later, the trading system is not compliant" statement).
- **Prefers no-trade under uncertainty**: `true`.
- **Postmortem notes**: record the missing audit scope, root cause,
  remediation, backfill decision, and regression test coverage.

## Stop Conditions

Stop immediately, and do not proceed to the next check or step, if any of
the following appears at any point while using this runbook:

- any scheduler job report, alert digest, or runbook section shows
  `liveBrokerWriteAllowed: true` anywhere
- any scheduler job definition shows `callsBrokerApi: true` or
  `noWrite: false`
- a scheduled job's output contains what looks like a real access token,
  refresh token, client secret, or account number
  (`containsSecretLikeOrRawBrokerData()` returning `true` on output text
  that is expected to be sanitized is itself a stop condition to
  investigate, not something to silently discard and continue past)
- a kill switch shows `UNKNOWN` state that nobody can explain
- reconciliation shows a `BLOCKING` or `REQUIRES_HUMAN_REVIEW` issue that
  paper trading does not appear to be honoring (i.e., paper activity
  continuing despite `blocksDependentTrading: true`)
- any document or code change in this round appears to weaken an existing
  fail-closed check, guard, or test assertion to make something pass

If a stop condition triggers, do not paste the offending output anywhere,
escalate to a human reviewer, and follow the closest matching incident
scenario above.

## Final Rule

Every job and every check in this runbook is read-only and no-write. If a
future round ever proposes adding write capability to anything referenced
here, that is out of scope for this document and requires the explicit
human review process described in
`docs/reviews/Codex_Phase6_Simulation_Safety_Review.md`, "Remaining
Blockers Before Any Future Live-Capable Design Phase." When in doubt, do
not treat an unknown or missing state as safe -- fail closed and escalate.
