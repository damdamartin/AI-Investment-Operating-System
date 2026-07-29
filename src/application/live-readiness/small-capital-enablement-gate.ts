import type { DeploymentReadinessReport } from "../deployment/index.js";
import type { BackupRestoreDrillReport } from "../backup-restore/index.js";
import type { LiveBlockerEvidenceRegisterBlockerStatus } from "./live-blocker-evidence-intake.js";
import type { SmallCapitalReadinessReport } from "./small-capital-readiness.js";

/**
 * Phase 9 (P9-003): small-capital enablement gate.
 *
 * This module is a PURE evaluator, in the same spirit as every other
 * gate/report evaluator in this codebase
 * (`src/application/live-readiness/small-capital-readiness.ts`,
 * `src/application/deployment/deployment-readiness-gate.ts`,
 * `src/application/backup-restore/backup-restore-drill.ts`). It has no
 * network code, no filesystem access, no broker client, and no side
 * effects of any kind. It never constructs, submits, cancels, or replaces
 * a broker order, and it never enables live trading.
 *
 * It exists to answer exactly one question: "does the currently-available
 * evidence, taken as a whole across Phase 7 (small-capital readiness),
 * Phase 8 (operations/deployment/backup readiness), and Phase 9 (live
 * blocker evidence intake), show that small-capital LIVE TRADING
 * PREPARATION is complete?" It deliberately does NOT answer, and cannot be
 * made to answer, "is live trading authorized?" Those are two different
 * questions, and this module enforces that distinction structurally, not
 * just by convention:
 *
 * - `readyForLiveBrokerWrites` is a literal `false` return value. It is
 *   never computed from `blockingReasonCodes`, never computed from
 *   `readyForSmallCapitalPreparation`, and never computed from any
 *   combination of upstream reports. Search this file: there is no branch,
 *   ternary, or expression anywhere that can produce `true` for this
 *   field. It is written as the bare literal `false` at the single return
 *   site, exactly once.
 * - `liveBrokerWriteAllowed` is the same: a literal `false` return value,
 *   mirroring `SmallCapitalReadinessReport.liveBrokerWriteAllowed`,
 *   `DeploymentReadinessReport.liveBrokerWriteAllowed`,
 *   `BackupRestoreDrillReport.liveBrokerWriteAllowed`, and
 *   `OperationsStatusSummary.liveBrokerWriteAllowed` elsewhere in this
 *   codebase (Phase 6/7/8).
 * - Even a "maximally clean" input — every upstream report clean, every
 *   `LCB-*` blocker `HUMAN_REVIEWED` — still returns
 *   `readyForLiveBrokerWrites: false` and `liveBrokerWriteAllowed: false`.
 *   `tests/application/small-capital-enablement-gate.test.ts` asserts this
 *   directly, with a dedicated "maximally clean input" fixture, so this
 *   property is enforced by an automated test, not just by reading the
 *   source.
 * - This module exports no function that can construct, mutate, or
 *   "upgrade" a `LiveBlockerEvidenceSummaryEntry.status` to
 *   `"HUMAN_REVIEWED"`. That value can only arrive as caller-supplied
 *   input, populated by a human (via whatever P9-001 evidence-intake tool
 *   eventually produces it) outside of this codebase. This module never
 *   treats AI output, code output, or its own prior report as a substitute
 *   for that human review.
 * - Every check fails closed: a missing upstream report, a missing
 *   `LCB-*` evidence entry, or an unrecognized evidence status is always
 *   treated as a blocking condition, never as "assume clean."
 *
 * Deliberate non-import of Engineer 1's (P9-001) in-flight module:
 *
 * The gate consumes the P9-001 register-review status vocabulary as an
 * input type only. This remains a one-way, no-side-effect dependency: P9-003
 * never creates or upgrades evidence, never writes the blocker register, and
 * never treats `MISSING`, `REJECTED`, or `DUPLICATE` as safe. Those statuses
 * are explicitly mapped to blocking/not-started preparation states below.
 *
 * Deliberate non-import of Phase 8's `OperationsStatusSummary`:
 *
 * `src/application/operations/operations-status-read-model.ts` already
 * imports `SmallCapitalReadinessReport` from this module's sibling file
 * (`small-capital-readiness.ts`). Importing `OperationsStatusSummary` back
 * into this module would create an import cycle
 * (`live-readiness -> operations -> live-readiness`). Exactly like
 * `SmallCapitalOperatorSurfaceSignal` in `small-capital-readiness.ts` and
 * `BackupRestoreDrillReconciliationSignal` /
 * `BackupRestoreDrillDataQualitySignal` in `backup-restore-drill.ts`
 * already do for the same reason, this module instead consumes a small,
 * locally-defined, duck-typed `SmallCapitalEnablementOperationsSignal`
 * shape. Any real `OperationsStatusSummary` is structurally compatible
 * with it.
 */

// ---------------------------------------------------------------------------
// Live-capable blocker evidence input types (locally defined; see module
// docstring for why this does not import Engineer 1's P9-001 module)
// ---------------------------------------------------------------------------

/**
 * Canonical `LCB-001`..`LCB-008` blocker ids, matching
 * `docs/phase7/live-capable-blocker-register.md` exactly. Fixed module
 * constant, not caller-supplied policy, so a caller cannot weaken this gate
 * by omitting an entry from a shorter required list.
 */
export const REQUIRED_LIVE_CAPABLE_BLOCKER_IDS = Object.freeze([
  "LCB-001",
  "LCB-002",
  "LCB-003",
  "LCB-004",
  "LCB-005",
  "LCB-006",
  "LCB-007",
  "LCB-008"
] as const);
export type RequiredLiveCapableBlockerId = (typeof REQUIRED_LIVE_CAPABLE_BLOCKER_IDS)[number];

/**
 * Machine-checkable statuses this gate accepts from the P9-001 evidence
 * intake layer, plus a local `NOT_STARTED` value for callers that have not
 * yet run that layer. There is deliberately no `"RESOLVED"` member here:
 * this gate never treats any blocker as resolved, and no code path in this
 * module can produce or accept that value.
 */
export const LIVE_BLOCKER_REVIEW_STATUSES = Object.freeze([
  "NOT_STARTED",
  "MISSING",
  "DUPLICATE",
  "REJECTED",
  "READY_FOR_HUMAN_REVIEW",
  "HUMAN_REVIEWED"
] as const);
export type LiveBlockerReviewStatus = "NOT_STARTED" | LiveBlockerEvidenceRegisterBlockerStatus;

/**
 * A single blocker's evidence-intake summary, shaped like a reasonable
 * reading of "P9-001 evidence intake output" without importing Engineer
 * 1's actual module (see module docstring). `status` can never be set by
 * this codebase to `"HUMAN_REVIEWED"` — that value must arrive as
 * caller-supplied input, populated by a human reviewer outside of this
 * codebase, exactly like `ManualLiveApprovalRecord.approvalStatus` in
 * `small-capital-readiness.ts`.
 */
export interface LiveBlockerEvidenceSummaryEntry {
  blockerId: string;
  status: LiveBlockerReviewStatus;
  /** Human reviewer name, required for a genuine `HUMAN_REVIEWED` status; validated below. */
  humanReviewerName?: string | undefined;
  /** When the human review was recorded, required for a genuine `HUMAN_REVIEWED` status; validated below. */
  humanReviewedAt?: Date | undefined;
}

// ---------------------------------------------------------------------------
// Phase 8 operations signal (locally defined; see module docstring for why
// this does not import `OperationsStatusSummary` directly)
// ---------------------------------------------------------------------------

export type SmallCapitalEnablementOperationsSystemHealth = "OK" | "WARNING" | "ERROR" | "BLOCKED";

export interface SmallCapitalEnablementOperationsSignal {
  systemHealth: SmallCapitalEnablementOperationsSystemHealth;
  liveReadinessBlocked: boolean;
  killSwitchAllowed: boolean;
  killSwitchBlocksNewOrders: boolean;
  hasOpenCriticalAlert: boolean;
  /** Mirrors `OperationsSchedulerHealthSummary.unsafeJobDefinitionCount`. */
  unsafeSchedulerJobDefinitionCount: number;
  /** Always literal `false` on a genuine `OperationsStatusSummary`; validated below. */
  liveBrokerWriteAllowed: boolean;
  reasonCodes: string[];
}

// ---------------------------------------------------------------------------
// Composed input
// ---------------------------------------------------------------------------

export interface SmallCapitalEnablementGateInput {
  /** Evaluation time. Required; used for report timestamping. */
  now: Date;
  /** Phase 7 (P7-003) small-capital readiness report. */
  smallCapitalReadiness?: SmallCapitalReadinessReport | undefined;
  /** Phase 8 (P8-001) operations status signal. See module docstring for the shape rationale. */
  operations?: SmallCapitalEnablementOperationsSignal | undefined;
  /** Phase 8 (P8-002) deployment readiness report. */
  deploymentReadiness?: DeploymentReadinessReport | undefined;
  /** Phase 8 (P8-003) backup/restore/rollback drill report. */
  backupRestoreDrill?: BackupRestoreDrillReport | undefined;
  /** Phase 9 (P9-001-shaped) live blocker evidence-intake summary, one entry expected per `LCB-*` id. */
  liveBlockerEvidence?: LiveBlockerEvidenceSummaryEntry[] | undefined;
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export type SmallCapitalEnablementSourceStatus = "OK" | "BLOCKED" | "MISSING";

export interface SmallCapitalEnablementPhase7View {
  status: SmallCapitalEnablementSourceStatus;
  readyForSmallCapitalLive: boolean;
  reasonCodes: string[];
  safetyType: "SMALL_CAPITAL_ENABLEMENT_PHASE7_VIEW";
}

export interface SmallCapitalEnablementOperationsView {
  status: SmallCapitalEnablementSourceStatus;
  systemHealth: SmallCapitalEnablementOperationsSystemHealth | null;
  reasonCodes: string[];
  safetyType: "SMALL_CAPITAL_ENABLEMENT_OPERATIONS_VIEW";
}

export interface SmallCapitalEnablementDeploymentView {
  status: SmallCapitalEnablementSourceStatus;
  readyToDeploy: boolean;
  reasonCodes: string[];
  safetyType: "SMALL_CAPITAL_ENABLEMENT_DEPLOYMENT_VIEW";
}

export interface SmallCapitalEnablementBackupRestoreView {
  status: SmallCapitalEnablementSourceStatus;
  resumeAllowed: boolean;
  reasonCodes: string[];
  safetyType: "SMALL_CAPITAL_ENABLEMENT_BACKUP_RESTORE_VIEW";
}

export interface SmallCapitalEnablementLiveBlockerView {
  status: SmallCapitalEnablementSourceStatus;
  totalRequiredBlockerCount: number;
  notStartedBlockerIds: string[];
  readyForHumanReviewBlockerIds: string[];
  humanReviewedBlockerIds: string[];
  missingBlockerIds: string[];
  /** Every required blocker id whose status is not `HUMAN_REVIEWED` (includes missing/invalid entries). */
  humanReviewMissingReasonCodes: string[];
  reasonCodes: string[];
  safetyType: "SMALL_CAPITAL_ENABLEMENT_LIVE_BLOCKER_VIEW";
}

/**
 * The single sentence this gate exists to enforce. Restated verbatim as
 * data on every report, not only in documentation, so a caller reading only
 * the JSON output (for example a dashboard rendering this report, or a log
 * line) still sees it.
 */
export const SMALL_CAPITAL_ENABLEMENT_GATE_EVIDENCE_STATEMENT =
  "This report is preparation EVIDENCE ONLY. It is not, and can never become, " +
  "authorization for real Toss broker writes, live order submission, order " +
  "cancellation or replacement, or any capital-moving action. " +
  "readyForLiveBrokerWrites and liveBrokerWriteAllowed are hardcoded literal " +
  "false values in this evaluator's implementation; no combination of clean " +
  "input evidence can change them. A separate, later, human-reviewed " +
  "implementation phase is required before any real broker write becomes " +
  "possible.";

export interface SmallCapitalEnablementGateReport {
  /**
   * True only when every readiness/evidence signal below currently passes.
   * This is preparation-evidence readiness ONLY. It is not, and cannot
   * become, live-trading authorization — see `evidenceOnlyStatement`.
   */
  readyForSmallCapitalPreparation: boolean;
  /**
   * Always literal `false`. See the module docstring: this field is never
   * computed from any input, including a maximally clean one.
   */
  readyForLiveBrokerWrites: false;
  /**
   * Always literal `false`. Mirrors the same field on
   * `SmallCapitalReadinessReport`, `DeploymentReadinessReport`,
   * `BackupRestoreDrillReport`, and `OperationsStatusSummary`.
   */
  liveBrokerWriteAllowed: false;
  /** Combined, namespaced blocking reason codes from every domain below. */
  blockingReasonCodes: string[];
  /**
   * Every `LCB-*` id that is not yet `HUMAN_REVIEWED`, namespaced
   * `human_review_missing_<id>`. Populated even when
   * `readyForSmallCapitalPreparation` is `true` — preparation completeness
   * and "a human has actually reviewed every blocker" are different
   * conditions, and this array exists so the second one is never lost
   * inside the first.
   */
  humanReviewMissingReasonCodes: string[];
  warnings: string[];
  phase7Readiness: SmallCapitalEnablementPhase7View;
  operationsReadiness: SmallCapitalEnablementOperationsView;
  deploymentReadiness: SmallCapitalEnablementDeploymentView;
  backupRestoreReadiness: SmallCapitalEnablementBackupRestoreView;
  liveBlockerEvidence: SmallCapitalEnablementLiveBlockerView;
  /** Verbatim copy of `SMALL_CAPITAL_ENABLEMENT_GATE_EVIDENCE_STATEMENT`. */
  evidenceOnlyStatement: string;
  generatedAt: Date;
  safetyType: "SMALL_CAPITAL_ENABLEMENT_GATE_REPORT_EVIDENCE_ONLY";
}

// ---------------------------------------------------------------------------
// Evaluator
// ---------------------------------------------------------------------------

export function evaluateSmallCapitalEnablementGate(
  input: SmallCapitalEnablementGateInput
): SmallCapitalEnablementGateReport {
  const blockingReasonCodes = new Set<string>();
  const warnings: string[] = [];

  if (!input.now || Number.isNaN(input.now.getTime())) {
    blockingReasonCodes.add("missing_or_invalid_evaluation_time");
  }

  const phase7Readiness = evaluatePhase7View(input.smallCapitalReadiness, blockingReasonCodes, warnings);
  const operationsReadiness = evaluateOperationsView(input.operations, blockingReasonCodes, warnings);
  const deploymentReadiness = evaluateDeploymentView(input.deploymentReadiness, blockingReasonCodes, warnings);
  const backupRestoreReadiness = evaluateBackupRestoreView(input.backupRestoreDrill, blockingReasonCodes, warnings);
  const liveBlockerEvidence = evaluateLiveBlockerEvidenceView(input.liveBlockerEvidence, blockingReasonCodes);

  const sortedBlockingReasonCodes = [...blockingReasonCodes].sort();

  return {
    readyForSmallCapitalPreparation: sortedBlockingReasonCodes.length === 0,
    // Literal `false`, always. Never derived from `blockingReasonCodes`,
    // never derived from `readyForSmallCapitalPreparation`, never derived
    // from any upstream report field. See module docstring.
    readyForLiveBrokerWrites: false,
    // Literal `false`, always. See module docstring.
    liveBrokerWriteAllowed: false,
    blockingReasonCodes: sortedBlockingReasonCodes,
    humanReviewMissingReasonCodes: [...liveBlockerEvidence.humanReviewMissingReasonCodes].sort(),
    warnings,
    phase7Readiness,
    operationsReadiness,
    deploymentReadiness,
    backupRestoreReadiness,
    liveBlockerEvidence,
    evidenceOnlyStatement: SMALL_CAPITAL_ENABLEMENT_GATE_EVIDENCE_STATEMENT,
    generatedAt: input.now,
    safetyType: "SMALL_CAPITAL_ENABLEMENT_GATE_REPORT_EVIDENCE_ONLY"
  };
}

// ---------------------------------------------------------------------------
// Per-domain views
// ---------------------------------------------------------------------------

function evaluatePhase7View(
  report: SmallCapitalReadinessReport | undefined,
  blocking: Set<string>,
  warnings: string[]
): SmallCapitalEnablementPhase7View {
  if (!report) {
    blocking.add("missing_phase7_small_capital_readiness");
    return {
      status: "MISSING",
      readyForSmallCapitalLive: false,
      reasonCodes: [],
      safetyType: "SMALL_CAPITAL_ENABLEMENT_PHASE7_VIEW"
    };
  }

  // Defense in depth: this evaluator never trusts an upstream report's own
  // no-live-write literal at face value. A caller passing a tampered or
  // hand-constructed object that violates the upstream type is itself a
  // blocking, reportable condition, never silently accepted. This can
  // never make `readyForLiveBrokerWrites` / `liveBrokerWriteAllowed` on
  // *this* report `true` either way — those remain hardcoded literals
  // regardless of what this check finds.
  if ((report.liveBrokerWriteAllowed as unknown) !== false) {
    blocking.add("phase7_report_live_broker_write_allowed_not_false");
  }

  const reasonCodes = report.blockingReasonCodes.map((code) => `phase7_${code}`);
  for (const code of reasonCodes) blocking.add(code);
  for (const warning of report.warnings) warnings.push(`phase7_${warning}`);

  return {
    status: reasonCodes.length === 0 ? "OK" : "BLOCKED",
    readyForSmallCapitalLive: report.readyForSmallCapitalLive,
    reasonCodes: [...reasonCodes].sort(),
    safetyType: "SMALL_CAPITAL_ENABLEMENT_PHASE7_VIEW"
  };
}

function evaluateOperationsView(
  signal: SmallCapitalEnablementOperationsSignal | undefined,
  blocking: Set<string>,
  warnings: string[]
): SmallCapitalEnablementOperationsView {
  if (!signal) {
    blocking.add("missing_phase8_operations_signal");
    return {
      status: "MISSING",
      systemHealth: null,
      reasonCodes: [],
      safetyType: "SMALL_CAPITAL_ENABLEMENT_OPERATIONS_VIEW"
    };
  }

  if ((signal.liveBrokerWriteAllowed as unknown) !== false) {
    blocking.add("phase8_operations_report_live_broker_write_allowed_not_false");
  }

  const reasonCodes = new Set<string>();

  if (signal.systemHealth !== "OK") {
    reasonCodes.add(`phase8_operations_system_health_not_ok_${signal.systemHealth.toLowerCase()}`);
  }
  if (signal.liveReadinessBlocked) {
    reasonCodes.add("phase8_operations_live_readiness_blocked");
  }
  if (!signal.killSwitchAllowed || signal.killSwitchBlocksNewOrders) {
    reasonCodes.add("phase8_operations_kill_switch_blocks_new_orders");
  }
  if (signal.hasOpenCriticalAlert) {
    reasonCodes.add("phase8_operations_open_critical_alerts_present");
  }
  if (signal.unsafeSchedulerJobDefinitionCount > 0) {
    reasonCodes.add("phase8_operations_unsafe_scheduler_job_definitions_present");
  }

  for (const code of reasonCodes) blocking.add(code);
  for (const code of signal.reasonCodes) warnings.push(`phase8_operations_upstream_${code}`);

  return {
    status: reasonCodes.size === 0 ? "OK" : "BLOCKED",
    systemHealth: signal.systemHealth,
    reasonCodes: [...reasonCodes].sort(),
    safetyType: "SMALL_CAPITAL_ENABLEMENT_OPERATIONS_VIEW"
  };
}

function evaluateDeploymentView(
  report: DeploymentReadinessReport | undefined,
  blocking: Set<string>,
  warnings: string[]
): SmallCapitalEnablementDeploymentView {
  if (!report) {
    blocking.add("missing_phase8_deployment_readiness");
    return {
      status: "MISSING",
      readyToDeploy: false,
      reasonCodes: [],
      safetyType: "SMALL_CAPITAL_ENABLEMENT_DEPLOYMENT_VIEW"
    };
  }

  if ((report.liveBrokerWriteAllowed as unknown) !== false) {
    blocking.add("phase8_deployment_report_live_broker_write_allowed_not_false");
  }

  const reasonCodes = report.blockingReasonCodes.map((code) => `phase8_deployment_${code}`);
  for (const code of reasonCodes) blocking.add(code);
  for (const warning of report.warnings) warnings.push(`phase8_deployment_${warning}`);

  return {
    status: reasonCodes.length === 0 ? "OK" : "BLOCKED",
    readyToDeploy: report.readyToDeploy,
    reasonCodes: [...reasonCodes].sort(),
    safetyType: "SMALL_CAPITAL_ENABLEMENT_DEPLOYMENT_VIEW"
  };
}

function evaluateBackupRestoreView(
  report: BackupRestoreDrillReport | undefined,
  blocking: Set<string>,
  warnings: string[]
): SmallCapitalEnablementBackupRestoreView {
  if (!report) {
    blocking.add("missing_phase8_backup_restore_drill");
    return {
      status: "MISSING",
      resumeAllowed: false,
      reasonCodes: [],
      safetyType: "SMALL_CAPITAL_ENABLEMENT_BACKUP_RESTORE_VIEW"
    };
  }

  if ((report.liveBrokerWriteAllowed as unknown) !== false) {
    blocking.add("phase8_backup_restore_report_live_broker_write_allowed_not_false");
  }
  if ((report.correctiveTradingAllowed as unknown) !== false) {
    blocking.add("phase8_backup_restore_report_corrective_trading_allowed_not_false");
  }

  const reasonCodes = report.blockingReasonCodes.map((code) => `phase8_backup_restore_${code}`);
  for (const code of reasonCodes) blocking.add(code);
  for (const warning of report.warnings) warnings.push(`phase8_backup_restore_${warning}`);

  return {
    status: reasonCodes.length === 0 ? "OK" : "BLOCKED",
    resumeAllowed: report.resumeAllowed,
    reasonCodes: [...reasonCodes].sort(),
    safetyType: "SMALL_CAPITAL_ENABLEMENT_BACKUP_RESTORE_VIEW"
  };
}

function normalizeBlockerIdForReasonCode(blockerId: string): string {
  return blockerId.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function evaluateLiveBlockerEvidenceView(
  entries: LiveBlockerEvidenceSummaryEntry[] | undefined,
  blocking: Set<string>
): SmallCapitalEnablementLiveBlockerView {
  if (!entries) {
    blocking.add("missing_live_blocker_evidence_summary");
    return {
      status: "MISSING",
      totalRequiredBlockerCount: REQUIRED_LIVE_CAPABLE_BLOCKER_IDS.length,
      notStartedBlockerIds: [],
      readyForHumanReviewBlockerIds: [],
      humanReviewedBlockerIds: [],
      missingBlockerIds: [...REQUIRED_LIVE_CAPABLE_BLOCKER_IDS],
      humanReviewMissingReasonCodes: REQUIRED_LIVE_CAPABLE_BLOCKER_IDS.map(
        (id) => `human_review_missing_${normalizeBlockerIdForReasonCode(id)}`
      ),
      reasonCodes: ["live_blocker_evidence_summary_not_supplied"],
      safetyType: "SMALL_CAPITAL_ENABLEMENT_LIVE_BLOCKER_VIEW"
    };
  }

  const reasonCodes = new Set<string>();
  const humanReviewMissingReasonCodes: string[] = [];
  const notStartedBlockerIds: string[] = [];
  const readyForHumanReviewBlockerIds: string[] = [];
  const humanReviewedBlockerIds: string[] = [];
  const missingBlockerIds: string[] = [];

  const entriesById = new Map<string, LiveBlockerEvidenceSummaryEntry[]>();
  for (const entry of entries) {
    const bucket = entriesById.get(entry.blockerId);
    if (bucket) {
      bucket.push(entry);
    } else {
      entriesById.set(entry.blockerId, [entry]);
    }
  }

  for (const blockerId of REQUIRED_LIVE_CAPABLE_BLOCKER_IDS) {
    const slug = normalizeBlockerIdForReasonCode(blockerId);
    const matches = entriesById.get(blockerId);

    if (!matches || matches.length === 0) {
      reasonCodes.add(`live_blocker_evidence_missing_${slug}`);
      humanReviewMissingReasonCodes.push(`human_review_missing_${slug}`);
      missingBlockerIds.push(blockerId);
      continue;
    }

    if (matches.length > 1) {
      // Ambiguous evidence (more than one entry for the same blocker id)
      // fails closed rather than silently picking one, per
      // docs/11_AI_RULES.md Rule 22.
      reasonCodes.add(`live_blocker_evidence_duplicate_entries_${slug}`);
    }

    const entry = matches[0]!;

    if (!(LIVE_BLOCKER_REVIEW_STATUSES as readonly string[]).includes(entry.status)) {
      reasonCodes.add(`live_blocker_evidence_invalid_status_${slug}`);
      humanReviewMissingReasonCodes.push(`human_review_missing_${slug}`);
      continue;
    }

    if (entry.status === "NOT_STARTED" || entry.status === "MISSING") {
      reasonCodes.add(`live_blocker_evidence_not_started_${slug}`);
      notStartedBlockerIds.push(blockerId);
      humanReviewMissingReasonCodes.push(`human_review_missing_${slug}`);
      continue;
    }

    if (entry.status === "REJECTED") {
      reasonCodes.add(`live_blocker_evidence_rejected_${slug}`);
      notStartedBlockerIds.push(blockerId);
      humanReviewMissingReasonCodes.push(`human_review_missing_${slug}`);
      continue;
    }

    if (entry.status === "DUPLICATE") {
      reasonCodes.add(`live_blocker_evidence_duplicate_entries_${slug}`);
      notStartedBlockerIds.push(blockerId);
      humanReviewMissingReasonCodes.push(`human_review_missing_${slug}`);
      continue;
    }

    if (entry.status === "READY_FOR_HUMAN_REVIEW") {
      readyForHumanReviewBlockerIds.push(blockerId);
      humanReviewMissingReasonCodes.push(`human_review_missing_${slug}`);
      continue;
    }

    // entry.status === "HUMAN_REVIEWED"
    if (!entry.humanReviewerName || !entry.humanReviewerName.trim()) {
      reasonCodes.add(`live_blocker_evidence_human_reviewed_missing_reviewer_name_${slug}`);
      humanReviewMissingReasonCodes.push(`human_review_missing_${slug}`);
      continue;
    }
    if (!entry.humanReviewedAt || Number.isNaN(entry.humanReviewedAt.getTime())) {
      reasonCodes.add(`live_blocker_evidence_human_reviewed_missing_reviewed_at_${slug}`);
      humanReviewMissingReasonCodes.push(`human_review_missing_${slug}`);
      continue;
    }

    humanReviewedBlockerIds.push(blockerId);
  }

  for (const code of reasonCodes) blocking.add(code);

  return {
    status: reasonCodes.size === 0 ? "OK" : "BLOCKED",
    totalRequiredBlockerCount: REQUIRED_LIVE_CAPABLE_BLOCKER_IDS.length,
    notStartedBlockerIds,
    readyForHumanReviewBlockerIds,
    humanReviewedBlockerIds,
    missingBlockerIds,
    humanReviewMissingReasonCodes,
    reasonCodes: [...reasonCodes].sort(),
    safetyType: "SMALL_CAPITAL_ENABLEMENT_LIVE_BLOCKER_VIEW"
  };
}
