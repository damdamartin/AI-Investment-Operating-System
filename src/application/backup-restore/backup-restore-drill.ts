/**
 * Phase 8 (P8-003): backup, restore, and rollback drill evaluator.
 *
 * This module is a PURE evaluator, alongside (not a replacement for)
 * `RestoreSafetyGate` in `restore-safety-gate.ts`. It has no network code,
 * no filesystem access, no database client, no cloud-storage client, and no
 * side effects of any kind. It never performs a real backup, never performs
 * a real restore, never runs a destructive database operation, never
 * creates a corrective trade, and never enables live trading. It only reads
 * already-computed inputs — evidence references, verification flags, and
 * status signals structurally compatible with already-merged Phase 6/7
 * modules — and returns a report describing whether a backup/restore/
 * rollback drill currently supports resuming PAPER or SIMULATION
 * operations only.
 *
 * `resumeAllowed: true` from this evaluator is NOT authorization to enable
 * live trading and is NOT itself a restore or rollback action. It is only
 * evidence that the drill checklist defined in
 * `docs/phase8/backup-restore-drill.md` currently passes, for PAPER or
 * SIMULATION resumption. Enabling any real broker write path is out of
 * scope for this module and for Phase 8 entirely (see
 * `docs/phase8/README.md`).
 *
 * Deliberate design choices that keep this evaluator from ever being able
 * to authorize live trading or a broker-state correction:
 *
 * - `requestedResumeMode` is restricted, both at the type level and at
 *   runtime, to `"PAPER" | "SIMULATION"`. There is no code path in this
 *   module that can produce or accept a `"PRODUCTION"` / `"LIVE"` resume
 *   mode. A caller cannot widen this by passing an unexpected string; an
 *   unrecognized mode is treated as a blocking condition, never a default.
 * - `liveBrokerWriteAllowed` and `correctiveTradingAllowed` on the report
 *   are literal `false`, never computed values, mirroring
 *   `ReconciliationWorkflowResult` and `SmallCapitalReadinessReport`
 *   elsewhere in this codebase (Phase 6/7).
 * - Post-restore broker reconciliation is consumed as a caller-supplied
 *   signal (`BackupRestoreDrillReconciliationSignal`) that must explicitly
 *   attest `reconciledAgainstBrokerSnapshot: true`. This module contains no
 *   database query code and cannot itself decide broker state — it can
 *   only report whether the caller *claims* an actual reconciliation
 *   (`ReconciliationWorkflowService.evaluate`, already merged in Phase 6)
 *   was run against a real broker snapshot. A signal that omits this
 *   attestation, or sets it `false`, blocks the drill
 *   (`reconciliation_not_confirmed_against_broker_snapshot`) regardless of
 *   how clean the rest of the reconciliation signal looks.
 * - Every check fails closed: a missing input, a missing evidence
 *   reference, or an unverifiable evidence reference is treated as a
 *   blocking condition, never as "assume safe."
 * - This module exports no function that submits, cancels, or replaces a
 *   broker order, no function that transfers or restores a real backup,
 *   and no function that runs a destructive database statement.
 */

// ---------------------------------------------------------------------------
// Shared evidence type
// ---------------------------------------------------------------------------

/**
 * A pointer to where a human or system can verify a claim was actually
 * done — a report id, a runbook step id, a ticket reference, a log query,
 * a dashboard snapshot id. `locator` must never contain secret content,
 * credentials, tokens, or raw account identifiers; it is a reference, not a
 * payload. This module does not attempt to resolve or fetch the locator —
 * it only requires one to be present and well-formed so a human reviewer
 * has somewhere to look.
 */
export interface EvidenceReference {
  description: string;
  locator: string;
  capturedAt: Date;
}

/** Evidence locators this long are far more likely to be a pasted secret/token than a reference pointer. */
const MAX_EVIDENCE_LOCATOR_LENGTH = 200;
const MAX_SECRETS_REFERENCE_LENGTH = 200;

// ---------------------------------------------------------------------------
// Fixed (non-caller-configurable) drill policy
// ---------------------------------------------------------------------------

/**
 * This drill may only ever report readiness to resume these two operation
 * modes. There is deliberately no `"PRODUCTION"` or `"LIVE"` member.
 */
export const BACKUP_RESTORE_DRILL_ALLOWED_RESUME_MODES = Object.freeze(["PAPER", "SIMULATION"] as const);
export type BackupRestoreDrillOperationMode = (typeof BACKUP_RESTORE_DRILL_ALLOWED_RESUME_MODES)[number];

/** Roles allowed to record the operator-approval-before-resume check, per docs/09_Operation_Deployment.md section 22. */
export const BACKUP_RESTORE_DRILL_APPROVAL_ALLOWED_ROLES = Object.freeze(["OWNER", "OPERATOR"] as const);
export type BackupRestoreDrillApprovalRole = (typeof BACKUP_RESTORE_DRILL_APPROVAL_ALLOWED_ROLES)[number];

/**
 * Fixed rollback rehearsal step ids, mirroring the seven-step rollback
 * procedure already documented in
 * `docs/phase7/small-capital-readiness-gates.md` section 11 and restated in
 * `docs/phase8/rollback-drill-runbook.md`. This list is a module constant,
 * not caller-supplied policy, so a caller cannot weaken the drill by
 * omitting a step from the required set.
 */
export const REQUIRED_ROLLBACK_REHEARSAL_STEPS = Object.freeze([
  "immediate_stop_kill_switch",
  "preserve_evidence_logs_audit",
  "reconcile_before_resuming",
  "revoke_not_expire_approval",
  "confirm_capital_exposure_known",
  "rerun_readiness_from_clean_state",
  "record_postmortem"
] as const);
export type RollbackRehearsalStepId = (typeof REQUIRED_ROLLBACK_REHEARSAL_STEPS)[number];

// ---------------------------------------------------------------------------
// Per-check input types
// ---------------------------------------------------------------------------

export interface BackupManifestCheckInput {
  manifestVerified: boolean;
  manifestId: string;
  backupCompletedAt: Date;
  encryptionVerified: boolean;
  storageSeparateFromPrimary: boolean;
  retentionPolicyDocumented: boolean;
  evidence?: EvidenceReference | undefined;
}

export interface SchemaConfigVersionCheckInput {
  schemaVersionVerified: boolean;
  expectedSchemaVersion: string;
  restoredSchemaVersion: string;
  configVersionsVerified: boolean;
  expectedConfigVersionIds: string[];
  activeConfigVersionIds: string[];
  evidence?: EvidenceReference | undefined;
}

export interface AuditContinuityCheckInput {
  continuityVerified: boolean;
  lastAuditRecordIdBeforeRestore: string;
  firstAuditRecordIdAfterRestore: string;
  gapDetected: boolean;
  evidence?: EvidenceReference | undefined;
}

/**
 * Documents that secrets are never part of a normal backup artifact. This
 * checks a reference/flag only — it never reads, stores, or compares actual
 * secret content, and `secretsManagerReference` must be a short pointer
 * (e.g. a secret-manager path or rotation ticket id), not the secret value
 * itself.
 */
export interface SecretsHandledSeparatelyCheckInput {
  confirmedNotInBackupArtifact: boolean;
  secretsManagerReference: string;
  rotatedOrValidatedSeparately: boolean;
  evidence?: EvidenceReference | undefined;
}

/**
 * Post-restore broker reconciliation signal. This is deliberately shaped to
 * be structurally compatible with `ReconciliationWorkflowResult` from
 * `src/application/reconciliation/reconciliation-workflow-service.ts`
 * (already merged in Phase 6), the same pattern
 * `SmallCapitalReconciliationSignal` already uses in
 * `src/application/live-readiness/small-capital-readiness.ts`. This module
 * deliberately does not import the reconciliation module directly, to stay
 * import-cycle-free and to make explicit that this drill only *consumes* a
 * result, it never *performs* reconciliation itself.
 *
 * `reconciledAgainstBrokerSnapshot` has no equivalent field on
 * `ReconciliationWorkflowResult` — it exists purely so this drill can
 * distinguish "an actual broker reconciliation ran" from "someone read the
 * database and assumed it matched." A caller must never set this `true`
 * from a database-only check.
 */
export interface BackupRestoreDrillReconciliationSignal {
  /** Mirrors `ReconciliationWorkflowResult.liveReadinessBlocked`. */
  liveReadinessBlocked: boolean;
  /** Mirrors `ReconciliationWorkflowResult.stale`. */
  stale: boolean;
  /** Mirrors `ReconciliationWorkflowResult.tradingSafetyState`. */
  tradingSafetyState: "CLEAR" | "WATCH" | "BLOCKED";
  /**
   * Must be `true` only when this signal was produced by an actual
   * `ReconciliationWorkflowService.evaluate()` run against a real broker
   * snapshot (or equivalent read-only broker query) — never inferred from
   * the restored database alone.
   */
  reconciledAgainstBrokerSnapshot: boolean;
  reasonCodes: string[];
  evidence?: EvidenceReference | undefined;
}

/**
 * Structurally compatible with `DataQualityReport` from
 * `src/application/data-quality/data-quality-monitor.ts` (already merged).
 * Consumed as a duck-typed signal for the same import-cycle-avoidance
 * reason as the reconciliation signal above.
 */
export interface BackupRestoreDrillDataQualitySignal {
  status: "GREEN" | "YELLOW" | "RED" | "BLOCKED";
  blocksTrading: boolean;
  reasonCodes: string[];
  evidence?: EvidenceReference | undefined;
}

/**
 * Structurally compatible with `KillSwitchTradingGate` from
 * `src/application/kill-switch/kill-switch-control-service.ts` (already
 * merged), mirroring `SmallCapitalKillSwitchSignal`.
 */
export interface BackupRestoreDrillKillSwitchSignal {
  allowed: boolean;
  blocksNewOrders: boolean;
  reasonCodes: string[];
  evidence?: EvidenceReference | undefined;
}

export interface BackupRestoreDrillOperatorApproval {
  approved: boolean;
  approvedByName?: string | undefined;
  approvedByRole?: string | undefined;
  approvedAt?: Date | undefined;
  evidence?: EvidenceReference | undefined;
}

export interface RollbackRehearsalStepRecord {
  stepId: RollbackRehearsalStepId;
  rehearsed: boolean;
  evidence?: EvidenceReference | undefined;
}

export interface RollbackRehearsalCheckInput {
  steps: RollbackRehearsalStepRecord[];
}

// ---------------------------------------------------------------------------
// Drill input / output
// ---------------------------------------------------------------------------

export interface BackupRestoreDrillInput {
  drillId: string;
  now: Date;
  /** The resume mode being drilled for. Only PAPER or SIMULATION are ever accepted. */
  requestedResumeMode: BackupRestoreDrillOperationMode;
  backupManifest?: BackupManifestCheckInput | undefined;
  schemaConfigVersion?: SchemaConfigVersionCheckInput | undefined;
  auditContinuity?: AuditContinuityCheckInput | undefined;
  secretsHandledSeparately?: SecretsHandledSeparatelyCheckInput | undefined;
  reconciliation?: BackupRestoreDrillReconciliationSignal | undefined;
  dataQuality?: BackupRestoreDrillDataQualitySignal | undefined;
  killSwitch?: BackupRestoreDrillKillSwitchSignal | undefined;
  operatorApproval?: BackupRestoreDrillOperatorApproval | undefined;
  rollbackRehearsal?: RollbackRehearsalCheckInput | undefined;
}

export type BackupRestoreDrillStatus = "READY" | "BLOCKED";

export interface BackupRestoreDrillCheckResult {
  checkId: string;
  passed: boolean;
  reasonCodes: string[];
  evidenceReferences: EvidenceReference[];
}

export interface BackupRestoreDrillReport {
  drillId: string;
  status: BackupRestoreDrillStatus;
  /** True only when every check passes for the requested resume mode. */
  resumeAllowed: boolean;
  /** Echoes `requestedResumeMode` only when `resumeAllowed` is true; `null` otherwise. */
  resumeMode: BackupRestoreDrillOperationMode | null;
  blockingReasonCodes: string[];
  warnings: string[];
  checks: BackupRestoreDrillCheckResult[];
  /**
   * Always `false`. This drill cannot enable a live broker write under any
   * combination of inputs.
   */
  liveBrokerWriteAllowed: false;
  /**
   * Always `false`. This drill never creates, proposes, or authorizes a
   * corrective trade of any kind, per
   * `docs/runbooks/Backup_and_Restore_Runbook.md` ("Never place corrective
   * trades as part of database restore.").
   */
  correctiveTradingAllowed: false;
  generatedAt: Date;
  safetyType: "BACKUP_RESTORE_DRILL_REPORT_EVALUATION_ONLY";
}

// ---------------------------------------------------------------------------
// Evaluator
// ---------------------------------------------------------------------------

export function evaluateBackupRestoreDrill(input: BackupRestoreDrillInput): BackupRestoreDrillReport {
  const blockingReasonCodes = new Set<string>();
  const warnings: string[] = [];
  const checks: BackupRestoreDrillCheckResult[] = [];

  if (!input.now || Number.isNaN(input.now.getTime())) {
    blockingReasonCodes.add("missing_or_invalid_evaluation_time");
  }

  if (!(BACKUP_RESTORE_DRILL_ALLOWED_RESUME_MODES as readonly string[]).includes(input.requestedResumeMode)) {
    blockingReasonCodes.add(`resume_mode_not_allowed_${String(input.requestedResumeMode).toLowerCase()}`);
  }

  checks.push(checkBackupManifest(input.backupManifest, blockingReasonCodes));
  checks.push(checkSchemaConfigVersion(input.schemaConfigVersion, blockingReasonCodes));
  checks.push(checkAuditContinuity(input.auditContinuity, blockingReasonCodes));
  checks.push(checkSecretsHandledSeparately(input.secretsHandledSeparately, blockingReasonCodes));
  checks.push(checkPostRestoreReconciliation(input.reconciliation, blockingReasonCodes));
  checks.push(checkDataQuality(input.dataQuality, blockingReasonCodes, warnings));
  checks.push(checkKillSwitch(input.killSwitch, blockingReasonCodes));
  checks.push(checkOperatorApproval(input.operatorApproval, blockingReasonCodes));
  checks.push(checkRollbackRehearsal(input.rollbackRehearsal, blockingReasonCodes));

  const sortedBlockingReasonCodes = [...blockingReasonCodes].sort();
  const resumeAllowed = sortedBlockingReasonCodes.length === 0;

  return {
    drillId: input.drillId,
    status: resumeAllowed ? "READY" : "BLOCKED",
    resumeAllowed,
    resumeMode: resumeAllowed ? input.requestedResumeMode : null,
    blockingReasonCodes: sortedBlockingReasonCodes,
    warnings,
    checks,
    liveBrokerWriteAllowed: false,
    correctiveTradingAllowed: false,
    generatedAt: input.now,
    safetyType: "BACKUP_RESTORE_DRILL_REPORT_EVALUATION_ONLY"
  };
}

/** Thin class wrapper mirroring `RestoreSafetyGate`'s call shape for callers that prefer an instance API. */
export class BackupRestoreDrill {
  evaluate(input: BackupRestoreDrillInput): BackupRestoreDrillReport {
    return evaluateBackupRestoreDrill(input);
  }
}

// ---------------------------------------------------------------------------
// Evidence validation
// ---------------------------------------------------------------------------

function collectEvidence(
  evidence: EvidenceReference | undefined,
  checkId: string,
  reasons: string[]
): EvidenceReference[] {
  if (!evidence) {
    reasons.push(`${checkId}_evidence_missing`);
    return [];
  }

  if (!evidence.description || !evidence.description.trim()) {
    reasons.push(`${checkId}_evidence_missing_description`);
  }

  if (!evidence.locator || !evidence.locator.trim()) {
    reasons.push(`${checkId}_evidence_missing_locator`);
  } else if (evidence.locator.length > MAX_EVIDENCE_LOCATOR_LENGTH) {
    reasons.push(`${checkId}_evidence_locator_too_long`);
  }

  if (!evidence.capturedAt || Number.isNaN(evidence.capturedAt.getTime())) {
    reasons.push(`${checkId}_evidence_missing_captured_at`);
  }

  return [evidence];
}

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

function checkBackupManifest(
  input: BackupManifestCheckInput | undefined,
  blocking: Set<string>
): BackupRestoreDrillCheckResult {
  const checkId = "backup_manifest";
  const reasons: string[] = [];

  if (!input) {
    reasons.push("missing_backup_manifest_check");
    return finalizeCheck(checkId, reasons, [], blocking);
  }

  if (!input.manifestVerified) reasons.push("backup_manifest_not_verified");
  if (!input.manifestId || !input.manifestId.trim()) reasons.push("backup_manifest_missing_manifest_id");
  if (!input.backupCompletedAt || Number.isNaN(input.backupCompletedAt.getTime())) {
    reasons.push("backup_manifest_missing_completed_at");
  }
  if (!input.encryptionVerified) reasons.push("backup_not_encrypted");
  if (!input.storageSeparateFromPrimary) reasons.push("backup_storage_not_separate_from_primary");
  if (!input.retentionPolicyDocumented) reasons.push("backup_retention_policy_not_documented");

  const evidence = collectEvidence(input.evidence, checkId, reasons);
  return finalizeCheck(checkId, reasons, evidence, blocking);
}

function checkSchemaConfigVersion(
  input: SchemaConfigVersionCheckInput | undefined,
  blocking: Set<string>
): BackupRestoreDrillCheckResult {
  const checkId = "schema_config_version";
  const reasons: string[] = [];

  if (!input) {
    reasons.push("missing_schema_config_version_check");
    return finalizeCheck(checkId, reasons, [], blocking);
  }

  if (!input.schemaVersionVerified) reasons.push("schema_version_not_verified");
  if (input.expectedSchemaVersion !== input.restoredSchemaVersion) reasons.push("schema_version_mismatch");
  if (!input.configVersionsVerified) reasons.push("config_versions_not_verified");

  const expected = [...input.expectedConfigVersionIds].sort();
  const active = [...input.activeConfigVersionIds].sort();
  const configVersionsMatch = expected.length === active.length && expected.every((id, i) => id === active[i]);
  if (!configVersionsMatch) reasons.push("config_version_mismatch");

  const evidence = collectEvidence(input.evidence, checkId, reasons);
  return finalizeCheck(checkId, reasons, evidence, blocking);
}

function checkAuditContinuity(
  input: AuditContinuityCheckInput | undefined,
  blocking: Set<string>
): BackupRestoreDrillCheckResult {
  const checkId = "audit_continuity";
  const reasons: string[] = [];

  if (!input) {
    reasons.push("missing_audit_continuity_check");
    return finalizeCheck(checkId, reasons, [], blocking);
  }

  if (!input.continuityVerified) reasons.push("audit_continuity_not_verified");
  if (input.gapDetected) reasons.push("audit_continuity_gap_detected");
  if (!input.lastAuditRecordIdBeforeRestore || !input.lastAuditRecordIdBeforeRestore.trim()) {
    reasons.push("audit_continuity_missing_last_record_before_restore");
  }
  if (!input.firstAuditRecordIdAfterRestore || !input.firstAuditRecordIdAfterRestore.trim()) {
    reasons.push("audit_continuity_missing_first_record_after_restore");
  }

  const evidence = collectEvidence(input.evidence, checkId, reasons);
  return finalizeCheck(checkId, reasons, evidence, blocking);
}

function checkSecretsHandledSeparately(
  input: SecretsHandledSeparatelyCheckInput | undefined,
  blocking: Set<string>
): BackupRestoreDrillCheckResult {
  const checkId = "secrets_handled_separately";
  const reasons: string[] = [];

  if (!input) {
    reasons.push("missing_secrets_handled_separately_check");
    return finalizeCheck(checkId, reasons, [], blocking);
  }

  if (!input.confirmedNotInBackupArtifact) reasons.push("secrets_not_confirmed_separate_from_backup");

  if (!input.secretsManagerReference || !input.secretsManagerReference.trim()) {
    reasons.push("secrets_manager_reference_missing");
  } else if (input.secretsManagerReference.length > MAX_SECRETS_REFERENCE_LENGTH) {
    // A legitimate reference is a short pointer (path, id, ticket number).
    // Anything this long is far more likely to be an accidentally pasted
    // secret or token than a reference, so this drill refuses it rather
    // than storing or comparing it.
    reasons.push("secrets_manager_reference_looks_like_raw_secret");
  }

  if (!input.rotatedOrValidatedSeparately) reasons.push("secrets_not_rotated_or_validated");

  const evidence = collectEvidence(input.evidence, checkId, reasons);
  return finalizeCheck(checkId, reasons, evidence, blocking);
}

function checkPostRestoreReconciliation(
  input: BackupRestoreDrillReconciliationSignal | undefined,
  blocking: Set<string>
): BackupRestoreDrillCheckResult {
  const checkId = "post_restore_reconciliation";
  const reasons: string[] = [];

  if (!input) {
    reasons.push("missing_post_restore_reconciliation_signal");
    return finalizeCheck(checkId, reasons, [], blocking);
  }

  if (!input.reconciledAgainstBrokerSnapshot) {
    // This is the single most important reason code in this module: it is
    // the only thing standing between "reconciliation actually happened
    // against the broker" and "someone assumed the database was correct."
    reasons.push("reconciliation_not_confirmed_against_broker_snapshot");
  }
  if (input.liveReadinessBlocked) reasons.push("reconciliation_not_fully_resolved_after_restore");
  if (input.stale) reasons.push("reconciliation_stale_after_restore");
  if (input.tradingSafetyState !== "CLEAR") {
    reasons.push(`reconciliation_trading_safety_state_not_clear_${input.tradingSafetyState.toLowerCase()}`);
  }

  const evidence = collectEvidence(input.evidence, checkId, reasons);
  return finalizeCheck(checkId, reasons, evidence, blocking);
}

function checkDataQuality(
  input: BackupRestoreDrillDataQualitySignal | undefined,
  blocking: Set<string>,
  warnings: string[]
): BackupRestoreDrillCheckResult {
  const checkId = "data_quality";
  const reasons: string[] = [];

  if (!input) {
    reasons.push("missing_data_quality_signal");
    return finalizeCheck(checkId, reasons, [], blocking);
  }

  if (input.blocksTrading || input.status === "RED" || input.status === "BLOCKED") {
    reasons.push("data_quality_blocks_resume");
  } else if (input.status === "YELLOW") {
    warnings.push("data_quality_yellow_after_restore");
  }

  const evidence = collectEvidence(input.evidence, checkId, reasons);
  return finalizeCheck(checkId, reasons, evidence, blocking);
}

function checkKillSwitch(
  input: BackupRestoreDrillKillSwitchSignal | undefined,
  blocking: Set<string>
): BackupRestoreDrillCheckResult {
  const checkId = "kill_switch";
  const reasons: string[] = [];

  if (!input) {
    reasons.push("missing_kill_switch_signal");
    return finalizeCheck(checkId, reasons, [], blocking);
  }

  if (!input.allowed || input.blocksNewOrders) reasons.push("kill_switch_not_available_after_restore");

  const evidence = collectEvidence(input.evidence, checkId, reasons);
  return finalizeCheck(checkId, reasons, evidence, blocking);
}

function checkOperatorApproval(
  input: BackupRestoreDrillOperatorApproval | undefined,
  blocking: Set<string>
): BackupRestoreDrillCheckResult {
  const checkId = "operator_approval";
  const reasons: string[] = [];

  if (!input) {
    reasons.push("missing_operator_approval");
    return finalizeCheck(checkId, reasons, [], blocking);
  }

  if (!input.approved) reasons.push("operator_approval_not_approved");
  if (!input.approvedByName || !input.approvedByName.trim()) reasons.push("operator_approval_missing_approver_name");
  if (
    !input.approvedByRole ||
    !(BACKUP_RESTORE_DRILL_APPROVAL_ALLOWED_ROLES as readonly string[]).includes(input.approvedByRole)
  ) {
    reasons.push("operator_approval_role_not_allowed");
  }
  if (!input.approvedAt || Number.isNaN(input.approvedAt.getTime())) {
    reasons.push("operator_approval_missing_approved_at");
  }

  const evidence = collectEvidence(input.evidence, checkId, reasons);
  return finalizeCheck(checkId, reasons, evidence, blocking);
}

function checkRollbackRehearsal(
  input: RollbackRehearsalCheckInput | undefined,
  blocking: Set<string>
): BackupRestoreDrillCheckResult {
  const checkId = "rollback_rehearsal";
  const reasons: string[] = [];
  const evidence: EvidenceReference[] = [];

  if (!input || !input.steps) {
    reasons.push("missing_rollback_rehearsal_steps");
    return finalizeCheck(checkId, reasons, evidence, blocking);
  }

  for (const stepId of REQUIRED_ROLLBACK_REHEARSAL_STEPS) {
    const record = input.steps.find((s) => s.stepId === stepId);

    if (!record) {
      reasons.push(`rollback_rehearsal_step_missing_${stepId}`);
      continue;
    }

    if (!record.rehearsed) {
      reasons.push(`rollback_rehearsal_step_not_rehearsed_${stepId}`);
    }

    evidence.push(...collectEvidence(record.evidence, `rollback_rehearsal_step_${stepId}`, reasons));
  }

  return finalizeCheck(checkId, reasons, evidence, blocking);
}

function finalizeCheck(
  checkId: string,
  reasons: string[],
  evidenceReferences: EvidenceReference[],
  blocking: Set<string>
): BackupRestoreDrillCheckResult {
  for (const reason of reasons) blocking.add(reason);

  return {
    checkId,
    passed: reasons.length === 0,
    reasonCodes: [...reasons].sort(),
    evidenceReferences
  };
}
