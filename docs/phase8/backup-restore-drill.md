# Phase 8 Backup, Restore, and Rollback Drill (P8-003)

Version: 0.1.0
Status: Draft
Last Updated: 2026-07-29
Related Task: `docs/tasks/phase8_claude_worktree_tasks/P8-003_backup_restore_and_rollback_drills.md`
Related Code: `src/application/backup-restore/backup-restore-drill.ts`,
`tests/application/backup-restore-drill.test.ts`
Related Docs: `docs/phase8/README.md`,
`docs/phase8/rollback-drill-runbook.md`,
`docs/runbooks/Backup_and_Restore_Runbook.md`,
`docs/runbooks/Incident_Runbooks.md`,
`docs/04_Database_Architecture.md` (sections 21, 22),
`docs/09_Operation_Deployment.md` (sections 15, 16, 18, 20),
`docs/11_AI_RULES.md`,
`docs/phase7/small-capital-readiness-gates.md` (section 11, rollback procedure)

## Purpose

This document defines the backup/restore and rollback **drill evaluator** —
a pure, no-write checklist evaluator (`evaluateBackupRestoreDrill` /
`BackupRestoreDrill` in `src/application/backup-restore/backup-restore-drill.ts`)
that turns the requirements already described in
`docs/runbooks/Backup_and_Restore_Runbook.md` and
`docs/04_Database_Architecture.md` section 21 into a testable, evidence-based
readiness report.

This module does not perform a backup. It does not perform a restore. It
does not run any database statement, destructive or otherwise. It does not
call any cloud storage or backup provider API. It only reads
already-computed inputs — verification flags and evidence references
supplied by whoever ran the actual drill — and reports whether the drill,
as described, currently supports resuming **PAPER or SIMULATION operations
only**.

## Relationship To `RestoreSafetyGate`

`src/application/backup-restore/restore-safety-gate.ts` (pre-existing, not
modified by this task) already defines a smaller, boolean-only checklist
(`RestoreSafetyChecklist`) with the same nine post-restore trading gates
listed in the runbook. `BackupRestoreDrill` is a separate, additive
evaluator that:

- requires an **evidence reference** (`EvidenceReference`: description,
  locator, captured-at timestamp) for every check, not just a boolean —
  satisfying the P8-003 completion criterion "Drill fails closed on missing
  evidence references"
- adds checks the boolean gate does not have: rollback rehearsal step
  completion, and an explicit attestation that reconciliation happened
  against a real broker snapshot, not the database
- reports a `resumeMode` restricted to `"PAPER" | "SIMULATION"` only,
  instead of a generic `tradingResumeAllowed` boolean, so it can never be
  read as authorizing any other kind of resumption

The two modules are intentionally independent and can be run together. This
task does not change `restore-safety-gate.ts`.

## The Nine Checks

Each check below corresponds to one entry in `BackupRestoreDrillInput` and
one entry in the report's `checks` array
(`checkId`, `passed`, `reasonCodes`, `evidenceReferences`). A check that is
entirely omitted from the input is treated as failed
(`missing_<check>_check` / `missing_<check>_signal`), never as "assume
clean," per `docs/11_AI_RULES.md` Rule 22 ("Fail Closed").

### 1. Backup manifest verification

`BackupManifestCheckInput` — manifest verified, manifest id present, backup
completion time recorded, encryption verified, storage separate from the
primary database host, retention policy documented. Mirrors
`docs/runbooks/Backup_and_Restore_Runbook.md`'s "Backup Verification
Checklist."

Blocking reasons: `backup_manifest_not_verified`,
`backup_manifest_missing_manifest_id`,
`backup_manifest_missing_completed_at`, `backup_not_encrypted`,
`backup_storage_not_separate_from_primary`,
`backup_retention_policy_not_documented`.

### 2. Schema/config version verification

`SchemaConfigVersionCheckInput` — the restored schema migration version must
equal the expected version, and the set of active config version ids
(`ConfigVersionRecord` ids from `src/application/config-versioning/`) must
equal the expected set exactly (order-independent comparison).

Blocking reasons: `schema_version_not_verified`,
`schema_version_mismatch`, `config_versions_not_verified`,
`config_version_mismatch`.

### 3. Audit continuity

`AuditContinuityCheckInput` — continuity explicitly verified, no gap
detected, and both the last audit record id before the restore and the
first audit record id after the restore are recorded, so a human can walk
the boundary. Per `docs/11_AI_RULES.md` Rule 30, audit records must never
be silently lost across a restore.

Blocking reasons: `audit_continuity_not_verified`,
`audit_continuity_gap_detected`,
`audit_continuity_missing_last_record_before_restore`,
`audit_continuity_missing_first_record_after_restore`.

### 4. Secrets handled separately

`SecretsHandledSeparatelyCheckInput` — this check exists to *document*, not
to *inspect*, that secrets are never part of a normal backup artifact, per
`docs/runbooks/Backup_and_Restore_Runbook.md`'s "Backup Scope" section and
`docs/11_AI_RULES.md` Rule 18/19. It checks three flags and a short
reference pointer (e.g. a secret-manager path or a rotation ticket id) —
**never actual secret content**. If the supplied reference string is
implausibly long (over 200 characters), the check refuses it rather than
storing or comparing it, on the assumption that a pasted token or credential
was supplied by mistake instead of a pointer.

Blocking reasons: `secrets_not_confirmed_separate_from_backup`,
`secrets_manager_reference_missing`,
`secrets_manager_reference_looks_like_raw_secret`,
`secrets_not_rotated_or_validated`.

### 5. Post-restore reconciliation

`BackupRestoreDrillReconciliationSignal` — structurally compatible with
`ReconciliationWorkflowResult` from
`src/application/reconciliation/reconciliation-workflow-service.ts`
(already merged in Phase 6), the same pattern
`SmallCapitalReconciliationSignal` already uses in Phase 7. This check adds
one field with no equivalent on the real reconciliation result:
`reconciledAgainstBrokerSnapshot`, which must be `true` and must have been
set by whoever ran an actual `ReconciliationWorkflowService.evaluate()` call
(or equivalent read-only broker query) — **never** inferred from the
restored database alone. See "How Broker-State Inference Is Prevented"
below.

Blocking reasons: `reconciliation_not_confirmed_against_broker_snapshot`,
`reconciliation_not_fully_resolved_after_restore`,
`reconciliation_stale_after_restore`,
`reconciliation_trading_safety_state_not_clear_<state>`.

### 6. Data quality

`BackupRestoreDrillDataQualitySignal` — structurally compatible with
`DataQualityReport` from `src/application/data-quality/data-quality-monitor.ts`.
`RED`/`BLOCKED` status or an explicit `blocksTrading: true` blocks resume.
`YELLOW` is recorded as a non-blocking warning
(`data_quality_yellow_after_restore`) rather than a block, because this
drill only ever gates PAPER/SIMULATION resumption, not real capital
exposure.

Blocking reason: `data_quality_blocks_resume`.

### 7. Kill-switch availability

`BackupRestoreDrillKillSwitchSignal` — structurally compatible with
`KillSwitchTradingGate` from
`src/application/kill-switch/kill-switch-control-service.ts`. The kill
switch must be confirmed available (`allowed: true`,
`blocksNewOrders: false`) after restore, per
`docs/runbooks/Backup_and_Restore_Runbook.md` step 15 of the restore
procedure.

Blocking reason: `kill_switch_not_available_after_restore`.

### 8. Operator approval before resume

`BackupRestoreDrillOperatorApproval` — requires `approved: true`, a
non-empty approver name, an allowed role
(`BACKUP_RESTORE_DRILL_APPROVAL_ALLOWED_ROLES` = `OWNER` or `OPERATOR`, per
`docs/09_Operation_Deployment.md` section 22 — `OPERATOR` may "run
reconciliation" and this drill only ever resumes paper/simulation
operations, not production), and a recorded approval timestamp.

Blocking reasons: `operator_approval_not_approved`,
`operator_approval_missing_approver_name`,
`operator_approval_role_not_allowed`,
`operator_approval_missing_approved_at`.

### 9. Rollback rehearsal steps

`RollbackRehearsalCheckInput` — every one of the seven fixed steps in
`REQUIRED_ROLLBACK_REHEARSAL_STEPS` must be present, marked `rehearsed:
true`, and carry its own evidence reference. See
`docs/phase8/rollback-drill-runbook.md` for the full step-by-step
description of what "rehearsed" means for each step.

Blocking reasons: `rollback_rehearsal_step_missing_<stepId>`,
`rollback_rehearsal_step_not_rehearsed_<stepId>`, plus the standard
evidence-missing reasons per step.

## Evidence References

Every check accepts an optional `evidence?: EvidenceReference` field
(`description`, `locator`, `capturedAt`). A missing evidence reference
blocks the check (`<checkId>_evidence_missing`); a present-but-malformed
reference blocks with a specific reason
(`<checkId>_evidence_missing_description`,
`<checkId>_evidence_missing_locator`, `<checkId>_evidence_locator_too_long`,
`<checkId>_evidence_missing_captured_at`). `locator` is a pointer (a report
id, a runbook step id, a ticket reference, a log query, a dashboard
snapshot id) for a human reviewer to verify against — this module never
resolves, fetches, or validates the locator's target itself.

## How Broker-State Inference Is Prevented

Per the P8-003 task requirements and
`docs/runbooks/Backup_and_Restore_Runbook.md`'s "Recovery Notes" ("Never
infer broker state from restored database alone. Broker state must be
reconciled from read-only broker APIs."), this drill cannot substitute a
database read for a real reconciliation:

1. This module contains no database client, no ORM, no SQL, and no
   connection string handling of any kind. It cannot query the database
   even if it wanted to.
2. The reconciliation check requires a caller-supplied
   `BackupRestoreDrillReconciliationSignal`, structurally compatible with
   the real `ReconciliationWorkflowResult` (Phase 6, already merged,
   unmodified by this task).
3. That signal must additionally set `reconciledAgainstBrokerSnapshot:
   true`. This field has no equivalent on the real reconciliation result —
   it exists purely so a caller must make an explicit, auditable claim that
   an actual reconciliation ran against a real broker snapshot. If this
   field is `false` or missing, the drill blocks
   (`reconciliation_not_confirmed_against_broker_snapshot`) even when every
   other field on the signal looks clean.
4. This drill provides no function, method, or code path that computes,
   derives, or infers this signal from any other input. It is accepted only
   as a fully-formed value from the caller.

## Resume Scope Is Fixed To PAPER/SIMULATION

`BackupRestoreDrillInput.requestedResumeMode` is typed as
`"PAPER" | "SIMULATION"` (`BACKUP_RESTORE_DRILL_ALLOWED_RESUME_MODES`).
There is no `"PRODUCTION"` or `"LIVE"` member anywhere in this module. Even
if a caller bypasses the TypeScript type system (e.g. a value arriving from
untyped JSON), the evaluator re-checks the value at runtime and blocks any
unrecognized mode (`resume_mode_not_allowed_<mode>`) rather than defaulting
to anything permissive. `report.resumeMode` is `null` whenever the drill is
not fully passing, and is otherwise never anything other than the two
allowed literals.

## What This Drill Never Does

- It never performs a real backup upload or download. No S3/GCS/cloud
  storage client code exists in this module.
- It never runs a destructive database statement — no `DROP`, `TRUNCATE`,
  or `DELETE` against any database, real or test.
- It never creates a corrective trade. `report.correctiveTradingAllowed` is
  a literal `false` on every report, regardless of input.
- It never enables live trading. `report.liveBrokerWriteAllowed` is a
  literal `false` on every report, regardless of input, and
  `requestedResumeMode` structurally cannot express a live/production
  value.
- It never reads, prints, or compares actual secret content — the secrets
  check only accepts a short reference pointer and flags, per "Secrets
  handled separately" above.
- `resumeAllowed: true` is evidence that the drill checklist passes for
  PAPER/SIMULATION resumption. It is not, and can never become, live
  trading authorization, a real restore action, or a real rollback action
  on its own.
