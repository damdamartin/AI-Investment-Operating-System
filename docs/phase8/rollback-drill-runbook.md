# Rollback Drill Runbook (P8-003)

Version: 0.1.0
Status: Draft
Last Updated: 2026-07-29
Related Task: `docs/tasks/phase8_claude_worktree_tasks/P8-003_backup_restore_and_rollback_drills.md`
Related Code: `src/application/backup-restore/backup-restore-drill.ts`
Related Docs: `docs/phase8/backup-restore-drill.md`,
`docs/runbooks/Backup_and_Restore_Runbook.md`,
`docs/runbooks/Incident_Runbooks.md`,
`docs/09_Operation_Deployment.md` (sections 16, 17, 18),
`docs/phase7/small-capital-readiness-gates.md` (section 11)

## Purpose

This runbook defines how to **rehearse** a deployment or restore rollback —
walking through the seven fixed steps below against mocked/simulated state,
recording evidence for each, and feeding that evidence into
`evaluateBackupRestoreDrill`'s rollback rehearsal check
(`RollbackRehearsalCheckInput`, `REQUIRED_ROLLBACK_REHEARSAL_STEPS`).

This is a **rehearsal** runbook, not a live incident runbook. It exists so
the rollback procedure is exercised and evidenced *before* it is ever
needed for real, per `docs/09_Operation_Deployment.md` section 26: "An
automated trading system that cannot be operated safely should not be
allowed to trade." For an actual in-progress incident, use
`docs/runbooks/Incident_Runbooks.md` and
`docs/runbooks/Backup_and_Restore_Runbook.md` directly — this document does
not replace either.

The seven steps here are the same ones already defined as a design
requirement in `docs/phase7/small-capital-readiness-gates.md` section 11,
restated here as an executable rehearsal checklist that Phase 8 can
actually evaluate.

## Core Rule

> A rollback that has never been rehearsed cannot be trusted the first time
> it matters.

Every step below must be rehearsed against non-production, mocked, or
simulated state — this runbook does not authorize or require any real
kill-switch activation against production, any real backup restore, or any
real broker call. The `BackupRestoreDrill` evaluator that consumes this
runbook's output never performs any of those actions either; it only reads
the evidence a human (or a test harness rehearsing the same steps) already
produced.

## The Seven Rehearsal Steps

Each step below corresponds to one `stepId` in
`REQUIRED_ROLLBACK_REHEARSAL_STEPS`. For each step, record a
`RollbackRehearsalStepRecord` (`stepId`, `rehearsed: true`, and an
`EvidenceReference` pointing at where the rehearsal evidence can be
verified — a test run id, a rehearsal log entry, a recorded drill session).
A step that was not actually rehearsed must be recorded as
`rehearsed: false` (or omitted) — never marked `true` on the assumption
that "it would obviously work."

### Step 1 — `immediate_stop_kill_switch`

Rehearse activating the `GLOBAL` kill switch
(`KillSwitchControlService.activate`, already merged in Phase 6) against a
test/mocked kill-switch state, and confirm the resulting
`KillSwitchTradingGate` reports `allowed: false` /
`blocksNewOrders: true` for new order intents in scope. Per
`docs/07_Trading_System.md` section 22 and
`docs/runbooks/Incident_Runbooks.md`'s "Kill Switch Activation" section,
this must be the first action in any real rollback.

Evidence: the test/rehearsal run id or log entry showing the kill switch
state transition and the resulting trading gate result.

### Step 2 — `preserve_evidence_logs_audit`

Confirm the rehearsal did not clear, truncate, or overwrite any log, alert,
or audit record. Per `docs/11_AI_RULES.md` Rule 30, cleanup or performance
work must never remove audit records, domain events, or approval evidence
— this applies doubly during an incident rehearsal. Confirm the rehearsal
environment's audit record count only increases, never decreases, across
the drill.

Evidence: before/after audit record counts or ids for the rehearsal
environment, showing no records were lost.

### Step 3 — `reconcile_before_resuming`

Rehearse running a full reconciliation
(`ReconciliationWorkflowService.evaluate`, already merged in Phase 6)
against a mocked or simulated broker snapshot, and confirm the rehearsal
produces `liveReadinessBlocked: false` and `stale: false` before any
further rehearsal step proceeds. This step is what the drill's
`reconciledAgainstBrokerSnapshot: true` attestation
(see `docs/phase8/backup-restore-drill.md`, "How Broker-State Inference Is
Prevented") should ultimately be evidenced by — it is not enough to assert
this happened; the evidence reference should point at the actual
reconciliation run.

Evidence: the reconciliation workflow run id, report id, or log entry
showing a clean, fresh result against a (mocked/simulated) broker snapshot.

### Step 4 — `revoke_not_expire_approval`

Rehearse revoking (not merely letting expire) the relevant approval record
— for a future live-capable phase this is `ManualLiveApprovalRecord`
(`docs/phase7/manual-live-approval-record.md`, "Revocation"); for this
drill's own operator-approval-before-resume check
(`BackupRestoreDrillOperatorApproval`), it means confirming a new,
independently-recorded approval is required for any subsequent resume
attempt, not a reused or auto-renewed one. An active incident always
revokes immediately rather than waiting for a natural expiry.

Evidence: the revocation record id, timestamp, and reason captured during
the rehearsal.

### Step 5 — `confirm_capital_exposure_known`

Rehearse cross-checking (mocked/simulated) broker-reported cash and
positions against internal records, and confirm the rehearsal explicitly
records the result as either "matched" or "known mismatch, accepted by
policy" — never "unknown." Per `docs/07_Trading_System.md` section 20 and
`docs/11_AI_RULES.md` Rule 25, recovery requires broker state to be
checked, not assumed.

Evidence: the reconciliation or position-comparison report id used to
confirm exposure during the rehearsal.

### Step 6 — `rerun_readiness_from_clean_state`

Rehearse re-running the relevant readiness evaluator from a clean state
after the previous five steps — for this repository today, that means
re-running `evaluateBackupRestoreDrill` itself (and, if small-capital-live
readiness is in scope for a future phase,
`evaluateSmallCapitalReadiness`) and confirming it reports zero blocking
reason codes using freshly-recorded inputs, not reused stale ones.

Evidence: the drill report id or evaluation output id showing zero
blocking reason codes on the re-run.

### Step 7 — `record_postmortem`

Rehearse writing a postmortem using the same structure already established
in `docs/phase6/phase6-operator-runbook.md`'s incident scenarios: symptoms,
immediate actions, investigation, recovery, root cause, and follow-up
action. For a rehearsal (as opposed to a real incident), the postmortem
should explicitly note it was a drill and record anything the rehearsal
revealed that the written procedure did not anticipate.

Evidence: the postmortem document reference or drill review note id.

## Feeding Rehearsal Results Into The Drill Evaluator

```text
RollbackRehearsalCheckInput.steps = [
  { stepId: "immediate_stop_kill_switch", rehearsed: true, evidence: {...} },
  { stepId: "preserve_evidence_logs_audit", rehearsed: true, evidence: {...} },
  { stepId: "reconcile_before_resuming", rehearsed: true, evidence: {...} },
  { stepId: "revoke_not_expire_approval", rehearsed: true, evidence: {...} },
  { stepId: "confirm_capital_exposure_known", rehearsed: true, evidence: {...} },
  { stepId: "rerun_readiness_from_clean_state", rehearsed: true, evidence: {...} },
  { stepId: "record_postmortem", rehearsed: true, evidence: {...} }
]
```

`evaluateBackupRestoreDrill` treats a missing step, an un-rehearsed step
(`rehearsed: false`), or a step missing its evidence reference as a
blocking condition (`rollback_rehearsal_step_missing_<stepId>`,
`rollback_rehearsal_step_not_rehearsed_<stepId>`,
`rollback_rehearsal_step_<stepId>_evidence_missing`) — the overall drill
cannot report `resumeAllowed: true` until all seven steps are rehearsed and
evidenced.

## What This Runbook Does Not Do

- It does not activate a real kill switch against production state.
- It does not perform a real database restore or a real destructive
  database operation.
- It does not call any real broker API, read-only or otherwise, outside of
  a mocked/simulated reconciliation run.
- It does not create, revoke, or expire a real
  `ManualLiveApprovalRecord` tied to actual live trading — no live trading
  capability exists anywhere in this repository to attach such a record to.
- Completing this rehearsal, and getting a passing
  `evaluateBackupRestoreDrill` report from it, is evidence that the
  rollback procedure has been exercised. It is not itself a rollback, a
  restore, or authorization for any live trading capability.
