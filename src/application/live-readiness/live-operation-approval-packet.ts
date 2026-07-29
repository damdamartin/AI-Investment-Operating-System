import {
  LIVE_BLOCKER_CATALOG,
  LIVE_BLOCKER_IDS,
  type LiveBlockerEvidenceRegisterBlockerStatus,
  type LiveBlockerEvidenceRegisterReview,
  type LiveBlockerId
} from "./live-blocker-evidence-intake.js";
import type {
  SmallCapitalEnablementBackupRestoreView,
  SmallCapitalEnablementDeploymentView,
  SmallCapitalEnablementGateReport,
  SmallCapitalEnablementLiveBlockerView,
  SmallCapitalEnablementOperationsView,
  SmallCapitalEnablementPhase7View
} from "./small-capital-enablement-gate.js";

/**
 * Phase 10 (P10-001): live operation approval packet.
 *
 * This module is a PURE evaluator, in the same spirit as every other
 * gate/report evaluator in this codebase
 * (`src/application/live-readiness/small-capital-enablement-gate.ts`,
 * `src/application/live-readiness/live-blocker-evidence-intake.ts`,
 * `src/application/operations/operations-status-read-model.ts`). It has no
 * network code, no filesystem access, no broker client, and no side
 * effects of any kind. It never constructs, submits, cancels, or replaces
 * a broker order, and it never enables live trading.
 *
 * It exists to answer one question for a human operator sitting down to
 * decide "is this repository's readiness evidence complete enough to even
 * start thinking about a future live-implementation phase?" -- by
 * gathering, into one sanitized, human-readable packet:
 *
 * - the Phase 7 live-capable blocker register status for `LCB-001` through
 *   `LCB-008` (via the caller-supplied Phase 9 P9-001
 *   `LiveBlockerEvidenceRegisterReview`),
 * - a human-review completeness summary across those same eight blockers,
 *   including this packet's OWN stricter evidence-freshness gate (see
 *   `MAX_HUMAN_EVIDENCE_AGE_DAYS_BEFORE_STALE` below),
 * - the Phase 8 operations/deployment/backup-restore readiness summary and
 *   the Phase 9 small-capital preparation-gate summary (both via the
 *   caller-supplied Phase 9 P9-003 `SmallCapitalEnablementGateReport`,
 *   which itself already folds in Phase 7 small-capital design-time
 *   readiness),
 * - and an explicit statement that none of the above is, or can become,
 *   live-trading authorization.
 *
 * This module accepts only already-sanitized, already-computed caller
 * inputs -- plain data, not fetched or imported behavior. It never reads
 * `.env`, never reads `tmp/phase5`, never performs a network call, and
 * never imports a broker adapter of any kind.
 *
 * Deliberate design choices that keep this evaluator from ever being able
 * to authorize itself, mirroring every other Phase 7/8/9 evaluator in this
 * codebase:
 *
 * - `readyForLiveOperation` is a literal `false` return value, written
 *   once at the single return site. It is never computed from
 *   `blockingReasonCodes`, `allEvidenceComplete`, or any combination of
 *   upstream reports. There is no branch, ternary, or expression anywhere
 *   in this file that can produce `true` for this field.
 * - `liveBrokerWriteAllowed` is the same: a literal `false` return value,
 *   mirroring `LiveBlockerEvidenceRegisterReview.liveBrokerWriteAllowed`
 *   and `SmallCapitalEnablementGateReport.liveBrokerWriteAllowed`.
 * - Even a "maximally clean" input -- every upstream report clean, every
 *   `LCB-*` blocker `HUMAN_REVIEWED` and fresh -- still returns
 *   `readyForLiveOperation: false` and `liveBrokerWriteAllowed: false`.
 *   `tests/application/live-operation-approval-packet.test.ts` asserts
 *   this directly with a dedicated "maximally clean input" fixture.
 * - This module never treats an upstream report's own no-live-write
 *   literal at face value: it re-checks
 *   `LiveBlockerEvidenceRegisterReview.liveBrokerWriteAllowed`,
 *   `LiveBlockerEvidenceRegisterReview.blockerRegisterResolutionAllowed`,
 *   `SmallCapitalEnablementGateReport.liveBrokerWriteAllowed`, and
 *   `SmallCapitalEnablementGateReport.readyForLiveBrokerWrites` and treats
 *   any unexpected value as a blocking, reportable condition -- this can
 *   never make this packet's own literals `true` either way; it only adds
 *   a blocking reason code.
 * - This module never writes, references a file path for, or produces the
 *   literal status value used exclusively by
 *   `docs/phase7/live-capable-blocker-register.md` to mark a blocker
 *   resolved by a human editing that file directly. The blocker status
 *   vocabulary this module reads and re-exposes
 *   (`LiveBlockerEvidenceRegisterBlockerStatus`, plus this module's own
 *   `"NOT_PROVIDED"`) structurally excludes that value; there is no
 *   reachable code path that can produce it.
 * - Every check fails closed: a missing upstream report, a missing
 *   `LCB-*` register entry, a missing human-evidence freshness date for an
 *   otherwise `HUMAN_REVIEWED` blocker, or an evidence-freshness date past
 *   this packet's own staleness window is always treated as blocking,
 *   never as "assume fine." Staleness beyond the upstream evidence-intake
 *   module's own (looser) warning threshold is surfaced as a warning;
 *   staleness beyond, or absence of, this packet's own (stricter)
 *   freshness window is a blocking reason code, because this packet is
 *   meant to be read as the final pre-live checkpoint.
 */

// ---------------------------------------------------------------------------
// Human evidence freshness (this packet's own staleness gate)
// ---------------------------------------------------------------------------

/**
 * How old a `HUMAN_REVIEWED` blocker's most recent human review may be,
 * in days, before this packet treats it as stale and blocks
 * `allEvidenceComplete` for that blocker. Deliberately stricter than
 * `live-blocker-evidence-intake.ts`'s own 180-day, warning-only staleness
 * threshold: that module is evidence intake for ongoing work, while this
 * packet is meant to be read as the final pre-live checkpoint, so a
 * tighter, blocking window is appropriate here. This is a fixed module
 * constant, not caller-supplied policy, so a caller cannot weaken this
 * packet by passing a longer window.
 */
export const MAX_HUMAN_EVIDENCE_AGE_DAYS_BEFORE_STALE = 120;

function daysBetween(earlier: Date, later: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / 86_400_000);
}

function blockerIdSlug(blockerId: LiveBlockerId): string {
  return blockerId.toLowerCase().replace(/-/g, "_");
}

/**
 * Sanitized, caller-supplied evidence of when a human most recently
 * completed review for a given blocker. This is a bare date, never a
 * reviewer name, evidence source reference, or any other free-text field
 * -- those already live, and are already scanned for prohibited content,
 * inside `LiveBlockerEvidenceRecord` (see `live-blocker-evidence-intake.ts`).
 * This packet only needs the date to run its own stricter freshness check.
 */
export interface LiveOperationHumanEvidenceFreshnessEntry {
  blockerId: LiveBlockerId;
  /** When the human reviewer most recently recorded this blocker's review. */
  reviewedAt: Date;
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface LiveOperationApprovalPacketInput {
  /** Evaluation time. Required; used for report timestamping and staleness checks. */
  now: Date;
  /**
   * Phase 9 (P9-001) register-level review across all `LCB-001`..`LCB-008`
   * blockers, as produced by `LiveBlockerEvidenceRegisterReviewer`.
   */
  blockerRegisterReview?: LiveBlockerEvidenceRegisterReview | undefined;
  /**
   * Phase 9 (P9-003) small-capital enablement gate report, as produced by
   * `evaluateSmallCapitalEnablementGate`. This report already folds in
   * Phase 7 small-capital design-time readiness and Phase 8
   * operations/deployment/backup-restore readiness, so this packet reuses
   * it rather than re-deriving that composition.
   */
  enablementGate?: SmallCapitalEnablementGateReport | undefined;
  /**
   * This packet's own stricter human-evidence freshness dates, one entry
   * per blocker that the caller believes is `HUMAN_REVIEWED`. A blocker
   * whose register status is `HUMAN_REVIEWED` but has no matching entry
   * here fails closed (treated as stale), rather than assumed fresh.
   */
  humanEvidenceFreshness?: LiveOperationHumanEvidenceFreshnessEntry[] | undefined;
}

// ---------------------------------------------------------------------------
// Output: per-blocker summary
// ---------------------------------------------------------------------------

/**
 * Status vocabulary for a single blocker inside this packet. Adds
 * `"NOT_PROVIDED"` to `LiveBlockerEvidenceRegisterBlockerStatus` for when
 * no register review was supplied at all. Deliberately does not, and can
 * never, include the human-only resolved-status literal that belongs
 * exclusively to `docs/phase7/live-capable-blocker-register.md`.
 */
export type LiveOperationApprovalPacketBlockerStatus = LiveBlockerEvidenceRegisterBlockerStatus | "NOT_PROVIDED";

export interface LiveOperationApprovalPacketBlockerSummaryEntry {
  blockerId: LiveBlockerId;
  /** Short, original paraphrase of the blocker title, from `LIVE_BLOCKER_CATALOG`. */
  title: string;
  /** Always a human role, from `LIVE_BLOCKER_CATALOG`. Never "AI", "Claude", or "System". */
  humanOwnerRole: string;
  status: LiveOperationApprovalPacketBlockerStatus;
  /**
   * True only when `status === "HUMAN_REVIEWED"` AND this packet's own
   * freshness check (see `MAX_HUMAN_EVIDENCE_AGE_DAYS_BEFORE_STALE`) also
   * passes. This is the single field a reader should check per blocker;
   * `status === "HUMAN_REVIEWED"` alone is not sufficient because the
   * review may be stale.
   */
  humanReviewComplete: boolean;
  /** True when a `HUMAN_REVIEWED` blocker's evidence is missing a freshness date, has an invalid/future date, or is older than the staleness window. */
  evidenceStale: boolean;
  reasonCodes: string[];
  warnings: string[];
  safetyType: "LIVE_OPERATION_APPROVAL_PACKET_BLOCKER_SUMMARY_ENTRY";
}

// ---------------------------------------------------------------------------
// Output: human review completeness summary
// ---------------------------------------------------------------------------

export interface LiveOperationApprovalPacketHumanReviewSummary {
  totalBlockerCount: number;
  /** Count of blockers that are both `HUMAN_REVIEWED` and fresh per this packet's own window. */
  humanReviewedAndFreshCount: number;
  /** Blockers with no register entry at all, or no register review supplied. */
  missingBlockerIds: string[];
  /** Blockers with evidence present but not yet a completed, valid human review (`READY_FOR_HUMAN_REVIEW`, `REJECTED`, or `DUPLICATE`). */
  notYetHumanReviewedBlockerIds: string[];
  /** Blockers whose human review evidence is stale per this packet's own freshness window. */
  staleHumanReviewBlockerIds: string[];
  /** True only when every one of the eight blockers is `HUMAN_REVIEWED` and fresh. */
  allBlockersHumanReviewedAndFresh: boolean;
  reasonCodes: string[];
  safetyType: "LIVE_OPERATION_APPROVAL_PACKET_HUMAN_REVIEW_SUMMARY";
}

// ---------------------------------------------------------------------------
// Output: Phase 8 operations/deployment/backup-restore summary
// ---------------------------------------------------------------------------

export type LiveOperationApprovalPacketSourceStatus = "OK" | "BLOCKED" | "MISSING";

export interface LiveOperationApprovalPacketPhase8Summary {
  status: LiveOperationApprovalPacketSourceStatus;
  operations: SmallCapitalEnablementOperationsView | null;
  deployment: SmallCapitalEnablementDeploymentView | null;
  backupRestore: SmallCapitalEnablementBackupRestoreView | null;
  reasonCodes: string[];
  safetyType: "LIVE_OPERATION_APPROVAL_PACKET_PHASE8_SUMMARY";
}

// ---------------------------------------------------------------------------
// Output: Phase 9 preparation gate summary
// ---------------------------------------------------------------------------

export interface LiveOperationApprovalPacketPhase9Summary {
  status: LiveOperationApprovalPacketSourceStatus;
  readyForSmallCapitalPreparation: boolean;
  /** Phase 7 small-capital design-time readiness view, as folded into the Phase 9 gate report. */
  phase7Readiness: SmallCapitalEnablementPhase7View | null;
  /** The Phase 9 gate's own (independently caller-supplied) live-blocker view, kept as a cross-reference alongside this packet's register-based blocker summary. */
  liveBlockerEvidence: SmallCapitalEnablementLiveBlockerView | null;
  humanReviewMissingReasonCodes: string[];
  reasonCodes: string[];
  safetyType: "LIVE_OPERATION_APPROVAL_PACKET_PHASE9_SUMMARY";
}

// ---------------------------------------------------------------------------
// Output: top-level packet
// ---------------------------------------------------------------------------

/**
 * The single statement this packet exists to enforce. Restated verbatim as
 * data on every packet, not only in documentation, so a caller reading
 * only the JSON output (for example a dashboard rendering this packet, or
 * a log line) still sees it.
 */
export const LIVE_OPERATION_APPROVAL_PACKET_STATEMENT =
  "This packet is a sanitized, evidence-only SUMMARY of existing Phase 7/8/9 " +
  "readiness outputs. It is NOT live-trading authorization, NOT a broker-write " +
  "approval, and NOT a substitute for the human decisions required by " +
  "docs/phase7/live-capable-blocker-register.md, " +
  "docs/phase7/manual-live-approval-record.md, and " +
  "docs/13_Compliance_and_Legal_Review.md Section 9. Every field named " +
  "'ready' or 'complete' below describes machine-checkable EVIDENCE only, " +
  "never a decision. No LCB-* blocker is, or can ever be, marked resolved by " +
  "this packet -- that decision happens only when a human edits the canonical " +
  "blocker register directly. readyForLiveOperation and liveBrokerWriteAllowed " +
  "are hardcoded literal false values in this evaluator's implementation; no " +
  "combination of clean input evidence, however complete, can change them. A " +
  "separate, later, human-reviewed implementation phase is required before " +
  "any real broker write becomes possible.";

export interface LiveOperationApprovalPacket {
  generatedAt: Date;
  /** All eight `LCB-*` blockers, in `LIVE_BLOCKER_IDS` order, even when no evidence was supplied for one. */
  blockerSummary: LiveOperationApprovalPacketBlockerSummaryEntry[];
  humanReviewSummary: LiveOperationApprovalPacketHumanReviewSummary;
  phase8Summary: LiveOperationApprovalPacketPhase8Summary;
  phase9Summary: LiveOperationApprovalPacketPhase9Summary;
  /**
   * True only when every blocker is `HUMAN_REVIEWED` and fresh, Phase 8
   * operations/deployment/backup-restore readiness is `OK`, and the Phase 9
   * preparation gate reports `readyForSmallCapitalPreparation: true`. This
   * is preparation-EVIDENCE completeness only -- see `approvalStatement`.
   * It is never authorization, and it never implies any blocker is
   * resolved.
   */
  allEvidenceComplete: boolean;
  blockingReasonCodes: string[];
  warnings: string[];
  /**
   * Always literal `false`. See module docstring: this field is never
   * derived from `blockingReasonCodes`, `allEvidenceComplete`, or any
   * upstream report field.
   */
  readyForLiveOperation: false;
  /**
   * Always literal `false`. Mirrors
   * `LiveBlockerEvidenceRegisterReview.liveBrokerWriteAllowed` and
   * `SmallCapitalEnablementGateReport.liveBrokerWriteAllowed`.
   */
  liveBrokerWriteAllowed: false;
  /** Verbatim copy of `LIVE_OPERATION_APPROVAL_PACKET_STATEMENT`. */
  approvalStatement: string;
  safetyType: "LIVE_OPERATION_APPROVAL_PACKET_EVIDENCE_ONLY";
}

// ---------------------------------------------------------------------------
// Evaluator
// ---------------------------------------------------------------------------

/**
 * Builds a single sanitized, human-readable live-operation approval packet
 * from already-computed Phase 7/8/9 evidence outputs. Pure: no I/O, no
 * mutation of inputs, no network calls, no broker client of any kind.
 */
export function evaluateLiveOperationApprovalPacket(
  input: LiveOperationApprovalPacketInput
): LiveOperationApprovalPacket {
  const blockingReasonCodes = new Set<string>();
  const warnings: string[] = [];

  if (!input.now || Number.isNaN(input.now.getTime())) {
    blockingReasonCodes.add("missing_or_invalid_evaluation_time");
  }

  const blockerSummary = buildBlockerSummary(input, blockingReasonCodes, warnings);
  const humanReviewSummary = buildHumanReviewSummary(blockerSummary);
  const phase8Summary = buildPhase8Summary(input.enablementGate, blockingReasonCodes);
  const phase9Summary = buildPhase9Summary(input.enablementGate, blockingReasonCodes);

  const allEvidenceComplete =
    blockingReasonCodes.size === 0 &&
    humanReviewSummary.allBlockersHumanReviewedAndFresh &&
    phase8Summary.status === "OK" &&
    phase9Summary.status === "OK" &&
    phase9Summary.readyForSmallCapitalPreparation === true;

  return {
    generatedAt: input.now,
    blockerSummary,
    humanReviewSummary,
    phase8Summary,
    phase9Summary,
    allEvidenceComplete,
    blockingReasonCodes: [...blockingReasonCodes].sort(),
    warnings: [...new Set(warnings)].sort(),
    // Literal `false`, always. Never derived from any input. See module docstring.
    readyForLiveOperation: false,
    // Literal `false`, always. See module docstring.
    liveBrokerWriteAllowed: false,
    approvalStatement: LIVE_OPERATION_APPROVAL_PACKET_STATEMENT,
    safetyType: "LIVE_OPERATION_APPROVAL_PACKET_EVIDENCE_ONLY"
  };
}

// ---------------------------------------------------------------------------
// Per-blocker summary
// ---------------------------------------------------------------------------

function buildBlockerSummary(
  input: LiveOperationApprovalPacketInput,
  blocking: Set<string>,
  warnings: string[]
): LiveOperationApprovalPacketBlockerSummaryEntry[] {
  const registerReview = input.blockerRegisterReview;

  if (registerReview) {
    // Defense in depth: never trust an upstream report's own no-live-write
    // literals at face value. A caller passing a tampered or
    // hand-constructed object that violates the upstream type is itself a
    // blocking, reportable condition. This can never flip this packet's
    // own literals to `true` either way -- those remain hardcoded.
    if ((registerReview.liveBrokerWriteAllowed as unknown) !== false) {
      blocking.add("blocker_register_review_live_broker_write_allowed_not_false");
    }
    if ((registerReview.blockerRegisterResolutionAllowed as unknown) !== false) {
      blocking.add("blocker_register_review_resolution_allowed_not_false");
    }
  } else {
    blocking.add("missing_blocker_register_review");
  }

  const freshnessById = new Map<LiveBlockerId, Date>();
  for (const entry of input.humanEvidenceFreshness ?? []) {
    if ((LIVE_BLOCKER_IDS as readonly string[]).includes(entry.blockerId)) {
      freshnessById.set(entry.blockerId, entry.reviewedAt);
    }
  }

  return LIVE_BLOCKER_IDS.map((blockerId) => {
    const catalogEntry = LIVE_BLOCKER_CATALOG[blockerId];
    const slug = blockerIdSlug(blockerId);

    if (!registerReview) {
      const reasonCode = `blocker_register_review_not_provided_${slug}`;
      blocking.add(reasonCode);
      return {
        blockerId,
        title: catalogEntry.title,
        humanOwnerRole: catalogEntry.humanOwnerRole,
        status: "NOT_PROVIDED",
        humanReviewComplete: false,
        evidenceStale: false,
        reasonCodes: [reasonCode],
        warnings: [],
        safetyType: "LIVE_OPERATION_APPROVAL_PACKET_BLOCKER_SUMMARY_ENTRY"
      };
    }

    const matching = registerReview.blockers.find((entry) => entry.blockerId === blockerId);
    if (!matching) {
      // Defensive: `LiveBlockerEvidenceRegisterReview` always emits exactly
      // `LIVE_BLOCKER_IDS`. This path exists only in case a caller
      // hand-constructs a partial object that violates that contract.
      // Fails closed rather than assuming MISSING silently.
      const reasonCode = `blocker_register_entry_absent_${slug}`;
      blocking.add(reasonCode);
      return {
        blockerId,
        title: catalogEntry.title,
        humanOwnerRole: catalogEntry.humanOwnerRole,
        status: "MISSING",
        humanReviewComplete: false,
        evidenceStale: false,
        reasonCodes: [reasonCode],
        warnings: [],
        safetyType: "LIVE_OPERATION_APPROVAL_PACKET_BLOCKER_SUMMARY_ENTRY"
      };
    }

    const reasonCodes = [...matching.reasonCodes];
    const entryWarnings = [...matching.warnings];

    let evidenceStale = false;
    if (matching.status === "HUMAN_REVIEWED") {
      const reviewedAt = freshnessById.get(blockerId);
      if (!reviewedAt || Number.isNaN(reviewedAt.getTime())) {
        evidenceStale = true;
        reasonCodes.push("human_evidence_freshness_not_provided");
      } else if (reviewedAt.getTime() > input.now.getTime()) {
        evidenceStale = true;
        reasonCodes.push("human_evidence_reviewed_at_in_future");
      } else if (daysBetween(reviewedAt, input.now) > MAX_HUMAN_EVIDENCE_AGE_DAYS_BEFORE_STALE) {
        evidenceStale = true;
        reasonCodes.push("stale_human_evidence");
      }
    }

    const humanReviewComplete = matching.status === "HUMAN_REVIEWED" && !evidenceStale;

    if (matching.status !== "HUMAN_REVIEWED") {
      blocking.add(`blocker_not_human_reviewed_${slug}`);
    }
    if (matching.status === "REJECTED") {
      for (const code of matching.reasonCodes) blocking.add(`${slug}_${code}`);
    }
    if (evidenceStale) {
      blocking.add(`stale_human_evidence_${slug}`);
    }
    for (const warning of entryWarnings) warnings.push(`${slug}_${warning}`);

    return {
      blockerId,
      title: catalogEntry.title,
      humanOwnerRole: catalogEntry.humanOwnerRole,
      status: matching.status,
      humanReviewComplete,
      evidenceStale,
      reasonCodes: [...new Set(reasonCodes)].sort(),
      warnings: [...new Set(entryWarnings)].sort(),
      safetyType: "LIVE_OPERATION_APPROVAL_PACKET_BLOCKER_SUMMARY_ENTRY"
    };
  });
}

// ---------------------------------------------------------------------------
// Human review completeness summary
// ---------------------------------------------------------------------------

function buildHumanReviewSummary(
  blockerSummary: LiveOperationApprovalPacketBlockerSummaryEntry[]
): LiveOperationApprovalPacketHumanReviewSummary {
  const missingBlockerIds = blockerSummary
    .filter((entry) => entry.status === "MISSING" || entry.status === "NOT_PROVIDED")
    .map((entry) => entry.blockerId);

  const notYetHumanReviewedBlockerIds = blockerSummary
    .filter(
      (entry) => entry.status === "READY_FOR_HUMAN_REVIEW" || entry.status === "REJECTED" || entry.status === "DUPLICATE"
    )
    .map((entry) => entry.blockerId);

  const staleHumanReviewBlockerIds = blockerSummary
    .filter((entry) => entry.evidenceStale)
    .map((entry) => entry.blockerId);

  const humanReviewedAndFreshCount = blockerSummary.filter((entry) => entry.humanReviewComplete).length;
  const allBlockersHumanReviewedAndFresh = humanReviewedAndFreshCount === LIVE_BLOCKER_IDS.length;

  const reasonCodes: string[] = [];
  if (!allBlockersHumanReviewedAndFresh) {
    reasonCodes.push("not_all_blockers_human_reviewed_and_fresh");
  }

  return {
    totalBlockerCount: LIVE_BLOCKER_IDS.length,
    humanReviewedAndFreshCount,
    missingBlockerIds,
    notYetHumanReviewedBlockerIds,
    staleHumanReviewBlockerIds,
    allBlockersHumanReviewedAndFresh,
    reasonCodes,
    safetyType: "LIVE_OPERATION_APPROVAL_PACKET_HUMAN_REVIEW_SUMMARY"
  };
}

// ---------------------------------------------------------------------------
// Phase 8 operations/deployment/backup-restore summary
// ---------------------------------------------------------------------------

function buildPhase8Summary(
  enablementGate: SmallCapitalEnablementGateReport | undefined,
  blocking: Set<string>
): LiveOperationApprovalPacketPhase8Summary {
  if (!enablementGate) {
    blocking.add("missing_enablement_gate_report");
    return {
      status: "MISSING",
      operations: null,
      deployment: null,
      backupRestore: null,
      reasonCodes: ["missing_enablement_gate_report"],
      safetyType: "LIVE_OPERATION_APPROVAL_PACKET_PHASE8_SUMMARY"
    };
  }

  const reasonCodes = [
    ...enablementGate.operationsReadiness.reasonCodes,
    ...enablementGate.deploymentReadiness.reasonCodes,
    ...enablementGate.backupRestoreReadiness.reasonCodes
  ];
  for (const code of reasonCodes) blocking.add(code);

  const allOk =
    enablementGate.operationsReadiness.status === "OK" &&
    enablementGate.deploymentReadiness.status === "OK" &&
    enablementGate.backupRestoreReadiness.status === "OK";

  return {
    status: allOk ? "OK" : "BLOCKED",
    operations: enablementGate.operationsReadiness,
    deployment: enablementGate.deploymentReadiness,
    backupRestore: enablementGate.backupRestoreReadiness,
    reasonCodes: [...new Set(reasonCodes)].sort(),
    safetyType: "LIVE_OPERATION_APPROVAL_PACKET_PHASE8_SUMMARY"
  };
}

// ---------------------------------------------------------------------------
// Phase 9 preparation gate summary
// ---------------------------------------------------------------------------

function buildPhase9Summary(
  enablementGate: SmallCapitalEnablementGateReport | undefined,
  blocking: Set<string>
): LiveOperationApprovalPacketPhase9Summary {
  if (!enablementGate) {
    blocking.add("missing_enablement_gate_report");
    return {
      status: "MISSING",
      readyForSmallCapitalPreparation: false,
      phase7Readiness: null,
      liveBlockerEvidence: null,
      humanReviewMissingReasonCodes: [],
      reasonCodes: ["missing_enablement_gate_report"],
      safetyType: "LIVE_OPERATION_APPROVAL_PACKET_PHASE9_SUMMARY"
    };
  }

  // Defense in depth, mirroring `buildBlockerSummary`'s check on
  // `LiveBlockerEvidenceRegisterReview`: never trust the upstream report's
  // own no-live-write literals at face value.
  if ((enablementGate.liveBrokerWriteAllowed as unknown) !== false) {
    blocking.add("enablement_gate_live_broker_write_allowed_not_false");
  }
  if ((enablementGate.readyForLiveBrokerWrites as unknown) !== false) {
    blocking.add("enablement_gate_ready_for_live_broker_writes_not_false");
  }

  for (const code of enablementGate.blockingReasonCodes) blocking.add(code);

  return {
    status: enablementGate.readyForSmallCapitalPreparation ? "OK" : "BLOCKED",
    readyForSmallCapitalPreparation: enablementGate.readyForSmallCapitalPreparation,
    phase7Readiness: enablementGate.phase7Readiness,
    liveBlockerEvidence: enablementGate.liveBlockerEvidence,
    humanReviewMissingReasonCodes: [...enablementGate.humanReviewMissingReasonCodes],
    reasonCodes: [...new Set(enablementGate.blockingReasonCodes)].sort(),
    safetyType: "LIVE_OPERATION_APPROVAL_PACKET_PHASE9_SUMMARY"
  };
}
