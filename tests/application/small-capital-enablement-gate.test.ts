import { describe, expect, it } from "vitest";
import {
  Currency,
  Money,
  REQUIRED_DEPLOYMENT_RUNBOOK_IDS,
  REQUIRED_DEPLOYMENT_SECRET_NAMES,
  REQUIRED_LIVE_CAPABLE_BLOCKER_IDS,
  REQUIRED_MANUAL_APPROVAL_ATTESTATION,
  REQUIRED_ROLLBACK_REHEARSAL_STEPS,
  evaluateBackupRestoreDrill,
  evaluateDeploymentReadiness,
  evaluateSmallCapitalEnablementGate,
  evaluateSmallCapitalReadiness,
  type BackupRestoreDrillInput,
  type DeploymentReadinessInput,
  type DeploymentReadinessReferenceFact,
  type DeploymentReadinessRunbookReference,
  type DeploymentReadinessSecretReference,
  type EvidenceReference,
  type LiveBlockerEvidenceSummaryEntry,
  type ManualLiveApprovalRecord,
  type RollbackRehearsalStepRecord,
  type SmallCapitalCapitalLimits,
  type SmallCapitalEnablementGateInput,
  type SmallCapitalEnablementOperationsSignal,
  type SmallCapitalKillSwitchSignal,
  type SmallCapitalOperatorSurfaceSignal,
  type SmallCapitalProposedOrder,
  type SmallCapitalReconciliationSignal
} from "../../src/index.js";
import type { ComplianceGateResult } from "../../src/application/compliance/index.js";

const NOW = new Date("2026-07-29T01:00:00Z");
const KRW = Currency.from("KRW");

function krw(amount: string): Money {
  return Money.fromMajor(amount, KRW);
}

// ---------------------------------------------------------------------------
// Phase 7 (small-capital readiness) fixtures
// ---------------------------------------------------------------------------

function cleanCapitalLimits(): SmallCapitalCapitalLimits {
  return {
    maxOrderValue: krw("300000"),
    maxDailyNotionalExposure: krw("900000"),
    maxTotalCapitalExposure: krw("3000000")
  };
}

function cleanProposedOrder(): SmallCapitalProposedOrder {
  return {
    market: "KR",
    assetType: "STOCK",
    orderType: "LIMIT",
    orderValue: krw("100000"),
    projectedDailyNotionalAfterOrder: krw("100000"),
    projectedTotalCapitalExposureAfterOrder: krw("100000"),
    withinRegularSessionWindow: true,
    isExtendedHours: false,
    isFractional: false
  };
}

function approvedManualApproval(): ManualLiveApprovalRecord {
  return {
    id: "approval-1",
    scopePortfolioId: "portfolio-1",
    scopeStrategyVersionId: "strategy-version-1",
    approvalStatus: "APPROVED",
    approvedByName: "Jun Kim",
    approvedByRole: "OWNER",
    acknowledgedRisksStatement: REQUIRED_MANUAL_APPROVAL_ATTESTATION,
    approvedAt: new Date("2026-07-01T00:00:00Z"),
    expiresAt: new Date("2026-08-01T00:00:00Z"),
    safetyType: "MANUAL_LIVE_APPROVAL_RECORD_HUMAN_OWNED"
  };
}

function cleanReconciliation(): SmallCapitalReconciliationSignal {
  return { liveReadinessBlocked: false, stale: false, reasonCodes: [] };
}

function cleanKillSwitch(): SmallCapitalKillSwitchSignal {
  return { allowed: true, blocksNewOrders: false, reasonCodes: [] };
}

function cleanOperatorSurface(): SmallCapitalOperatorSurfaceSignal {
  return {
    dashboardReachable: true,
    systemStatus: "OK",
    openCriticalAlertCount: 0,
    auditTrailRecorded: true
  };
}

function cleanCompliance(): ComplianceGateResult {
  return { allowed: true, reasons: [], limitations: [] };
}

function cleanPhase7Report() {
  return evaluateSmallCapitalReadiness({
    now: NOW,
    capitalLimits: cleanCapitalLimits(),
    proposedOrder: cleanProposedOrder(),
    manualApproval: approvedManualApproval(),
    reconciliation: cleanReconciliation(),
    killSwitch: cleanKillSwitch(),
    operatorSurface: cleanOperatorSurface(),
    compliance: cleanCompliance()
  });
}

// ---------------------------------------------------------------------------
// Phase 8 operations fixture (locally-defined duck-typed signal)
// ---------------------------------------------------------------------------

function cleanOperationsSignal(): SmallCapitalEnablementOperationsSignal {
  return {
    systemHealth: "OK",
    liveReadinessBlocked: false,
    killSwitchAllowed: true,
    killSwitchBlocksNewOrders: false,
    hasOpenCriticalAlert: false,
    unsafeSchedulerJobDefinitionCount: 0,
    liveBrokerWriteAllowed: false,
    reasonCodes: []
  };
}

// ---------------------------------------------------------------------------
// Phase 8 deployment readiness fixture
// ---------------------------------------------------------------------------

function cleanRunbookReferences(): DeploymentReadinessRunbookReference[] {
  return REQUIRED_DEPLOYMENT_RUNBOOK_IDS.map((runbookId) => ({
    runbookId,
    reference: `docs/runbooks/Incident_Runbooks.md#${runbookId.replace(/_/g, "-")}`,
    exists: true
  }));
}

function cleanReferenceFact(name: string): DeploymentReadinessReferenceFact {
  return { reference: `docs/phase8/${name}.md`, exists: true };
}

function cleanSecretReferences(env: string): DeploymentReadinessSecretReference[] {
  return REQUIRED_DEPLOYMENT_SECRET_NAMES.map((name) => ({
    name,
    reference: `secret-ref:${name.toLowerCase().replace(/_/g, "-")}-${env}`
  }));
}

function cleanDeploymentInput(overrides: Partial<DeploymentReadinessInput> = {}): DeploymentReadinessInput {
  return {
    now: NOW,
    targetEnvironment: "staging",
    liveTradingSignal: { liveTradingEnabled: false, appEnv: "staging" },
    runbookReferences: cleanRunbookReferences(),
    rollbackPlanReference: cleanReferenceFact("rollback-plan"),
    backupRestoreGateReference: cleanReferenceFact("backup-restore-drill"),
    observabilityAlertingReference: cleanReferenceFact("operations-status-api"),
    secretReferences: cleanSecretReferences("staging"),
    ...overrides
  };
}

function cleanDeploymentReport() {
  return evaluateDeploymentReadiness(cleanDeploymentInput());
}

// ---------------------------------------------------------------------------
// Phase 8 backup/restore drill fixture
// ---------------------------------------------------------------------------

function evidence(locator: string): EvidenceReference {
  return { description: "evidence", locator, capturedAt: NOW };
}

function passingRollbackSteps(): RollbackRehearsalStepRecord[] {
  return REQUIRED_ROLLBACK_REHEARSAL_STEPS.map((stepId) => ({
    stepId,
    rehearsed: true,
    evidence: evidence(`rollback-step://${stepId}`)
  }));
}

function cleanBackupRestoreInput(): BackupRestoreDrillInput {
  return {
    drillId: "drill-1",
    now: NOW,
    requestedResumeMode: "PAPER",
    backupManifest: {
      manifestVerified: true,
      manifestId: "manifest-2026-07-27",
      backupCompletedAt: NOW,
      encryptionVerified: true,
      storageSeparateFromPrimary: true,
      retentionPolicyDocumented: true,
      evidence: evidence("backup-manifest://manifest-2026-07-27")
    },
    schemaConfigVersion: {
      schemaVersionVerified: true,
      expectedSchemaVersion: "20260727000000_latest_migration",
      restoredSchemaVersion: "20260727000000_latest_migration",
      configVersionsVerified: true,
      expectedConfigVersionIds: ["risk-v3", "strategy-v7"],
      activeConfigVersionIds: ["strategy-v7", "risk-v3"],
      evidence: evidence("config-version-report://drill-1")
    },
    auditContinuity: {
      continuityVerified: true,
      lastAuditRecordIdBeforeRestore: "audit-1000",
      firstAuditRecordIdAfterRestore: "audit-1001",
      gapDetected: false,
      evidence: evidence("audit-continuity-report://drill-1")
    },
    secretsHandledSeparately: {
      confirmedNotInBackupArtifact: true,
      secretsManagerReference: "secret-manager://toss/api-credentials",
      rotatedOrValidatedSeparately: true,
      evidence: evidence("secret-rotation-ticket://SEC-1234")
    },
    reconciliation: {
      liveReadinessBlocked: false,
      stale: false,
      tradingSafetyState: "CLEAR",
      reconciledAgainstBrokerSnapshot: true,
      reasonCodes: [],
      evidence: evidence("reconciliation-workflow-report://drill-1")
    },
    dataQuality: {
      status: "GREEN",
      blocksTrading: false,
      reasonCodes: [],
      evidence: evidence("data-quality-report://drill-1")
    },
    killSwitch: {
      allowed: true,
      blocksNewOrders: false,
      reasonCodes: [],
      evidence: evidence("kill-switch-state://GLOBAL")
    },
    operatorApproval: {
      approved: true,
      approvedByName: "Operator One",
      approvedByRole: "OPERATOR",
      approvedAt: NOW,
      evidence: evidence("approval-record://drill-1")
    },
    rollbackRehearsal: {
      steps: passingRollbackSteps()
    }
  };
}

function cleanBackupRestoreReport() {
  return evaluateBackupRestoreDrill(cleanBackupRestoreInput());
}

// ---------------------------------------------------------------------------
// Phase 9 (P9-001-shaped) live blocker evidence fixture
// ---------------------------------------------------------------------------

function humanReviewedBlockerEvidence(): LiveBlockerEvidenceSummaryEntry[] {
  return REQUIRED_LIVE_CAPABLE_BLOCKER_IDS.map((blockerId) => ({
    blockerId,
    status: "HUMAN_REVIEWED",
    humanReviewerName: "Compliance Reviewer",
    humanReviewedAt: NOW
  }));
}

function readyForHumanReviewBlockerEvidence(): LiveBlockerEvidenceSummaryEntry[] {
  return REQUIRED_LIVE_CAPABLE_BLOCKER_IDS.map((blockerId) => ({
    blockerId,
    status: "READY_FOR_HUMAN_REVIEW"
  }));
}

// ---------------------------------------------------------------------------
// Composed input
// ---------------------------------------------------------------------------

function fullyCleanInput(): SmallCapitalEnablementGateInput {
  return {
    now: NOW,
    smallCapitalReadiness: cleanPhase7Report(),
    operations: cleanOperationsSignal(),
    deploymentReadiness: cleanDeploymentReport(),
    backupRestoreDrill: cleanBackupRestoreReport(),
    liveBlockerEvidence: readyForHumanReviewBlockerEvidence()
  };
}

/**
 * The single most demanding fixture in this file: every upstream report is
 * clean AND every LCB-* blocker is HUMAN_REVIEWED. Used specifically to
 * prove `readyForLiveBrokerWrites` / `liveBrokerWriteAllowed` cannot be
 * flipped to `true` even under the most favorable input this gate can ever
 * receive.
 */
function maximallyCleanInput(): SmallCapitalEnablementGateInput {
  return {
    ...fullyCleanInput(),
    liveBlockerEvidence: humanReviewedBlockerEvidence()
  };
}

describe("evaluateSmallCapitalEnablementGate", () => {
  it("is ready for preparation only when every domain signal is clean", () => {
    const report = evaluateSmallCapitalEnablementGate(fullyCleanInput());

    expect(report.readyForSmallCapitalPreparation).toBe(true);
    expect(report.blockingReasonCodes).toEqual([]);
    expect(report.safetyType).toBe("SMALL_CAPITAL_ENABLEMENT_GATE_REPORT_EVIDENCE_ONLY");
  });

  it("fails closed on a fully empty input", () => {
    const report = evaluateSmallCapitalEnablementGate({ now: NOW });

    expect(report.readyForSmallCapitalPreparation).toBe(false);
    expect(report.blockingReasonCodes).toEqual(
      expect.arrayContaining([
        "missing_phase7_small_capital_readiness",
        "missing_phase8_operations_signal",
        "missing_phase8_deployment_readiness",
        "missing_phase8_backup_restore_drill",
        "missing_live_blocker_evidence_summary"
      ])
    );
  });

  describe("readyForLiveBrokerWrites and liveBrokerWriteAllowed can never become true", () => {
    it("are false on a fully empty (maximally dirty) input", () => {
      const report = evaluateSmallCapitalEnablementGate({ now: NOW });
      expect(report.readyForLiveBrokerWrites).toBe(false);
      expect(report.liveBrokerWriteAllowed).toBe(false);
    });

    it("are false on a fully clean, ready-for-preparation input", () => {
      const report = evaluateSmallCapitalEnablementGate(fullyCleanInput());
      expect(report.readyForSmallCapitalPreparation).toBe(true);
      expect(report.readyForLiveBrokerWrites).toBe(false);
      expect(report.liveBrokerWriteAllowed).toBe(false);
    });

    it("are false even on the maximally clean input: every upstream report clean AND every LCB-* blocker HUMAN_REVIEWED", () => {
      const input = maximallyCleanInput();
      const report = evaluateSmallCapitalEnablementGate(input);

      // Sanity: this really is the most favorable input this gate can see.
      expect(report.phase7Readiness.readyForSmallCapitalLive).toBe(true);
      expect(report.operationsReadiness.status).toBe("OK");
      expect(report.deploymentReadiness.readyToDeploy).toBe(true);
      expect(report.backupRestoreReadiness.resumeAllowed).toBe(true);
      expect(report.liveBlockerEvidence.humanReviewedBlockerIds).toHaveLength(
        REQUIRED_LIVE_CAPABLE_BLOCKER_IDS.length
      );
      expect(report.readyForSmallCapitalPreparation).toBe(true);
      expect(report.humanReviewMissingReasonCodes).toEqual([]);

      // The property under test.
      expect(report.readyForLiveBrokerWrites).toBe(false);
      expect(report.liveBrokerWriteAllowed).toBe(false);
      expect(JSON.stringify(report)).not.toMatch(/"readyForLiveBrokerWrites":true/);
      expect(JSON.stringify(report)).not.toMatch(/"liveBrokerWriteAllowed":true/);
    });

    it("cannot be forced to true even by a hand-constructed object that violates the report's own type", () => {
      const tampered = {
        ...evaluateSmallCapitalEnablementGate(maximallyCleanInput()),
        readyForLiveBrokerWrites: true,
        liveBrokerWriteAllowed: true
      };
      // This assignment only proves the *report shape* can be mutated by a
      // careless caller after the fact -- the evaluator itself never
      // produces this. Re-running the evaluator on the same clean input
      // always re-derives literal false, which is the actual guarantee.
      expect(tampered.readyForLiveBrokerWrites).toBe(true); // caller-side mutation, not evaluator output
      const rerun = evaluateSmallCapitalEnablementGate(maximallyCleanInput());
      expect(rerun.readyForLiveBrokerWrites).toBe(false);
      expect(rerun.liveBrokerWriteAllowed).toBe(false);
    });
  });

  it("includes the evidence-not-authorization statement verbatim", () => {
    const report = evaluateSmallCapitalEnablementGate(fullyCleanInput());
    expect(report.evidenceOnlyStatement).toMatch(/EVIDENCE ONLY/);
    expect(report.evidenceOnlyStatement).toMatch(/not, and can never become, authorization/i);
  });

  it("rejects a fully empty evaluation time", () => {
    const report = evaluateSmallCapitalEnablementGate({ now: new Date(Number.NaN) });
    expect(report.blockingReasonCodes).toContain("missing_or_invalid_evaluation_time");
  });

  describe("Phase 7 composition", () => {
    it("namespaces and passes through Phase 7 blocking reason codes", () => {
      const dirtyPhase7 = evaluateSmallCapitalReadiness({ now: NOW });
      const report = evaluateSmallCapitalEnablementGate({
        ...fullyCleanInput(),
        smallCapitalReadiness: dirtyPhase7
      });

      expect(report.readyForSmallCapitalPreparation).toBe(false);
      expect(report.phase7Readiness.status).toBe("BLOCKED");
      expect(report.blockingReasonCodes).toContain("phase7_missing_manual_live_approval_record");
      expect(report.blockingReasonCodes).toContain("phase7_missing_reconciliation_signal");
    });

    it("flags a tampered Phase 7 report whose liveBrokerWriteAllowed is not false", () => {
      const tamperedPhase7 = { ...cleanPhase7Report(), liveBrokerWriteAllowed: true as unknown as false };
      const report = evaluateSmallCapitalEnablementGate({
        ...fullyCleanInput(),
        smallCapitalReadiness: tamperedPhase7
      });

      expect(report.blockingReasonCodes).toContain("phase7_report_live_broker_write_allowed_not_false");
      expect(report.readyForSmallCapitalPreparation).toBe(false);
      expect(report.liveBrokerWriteAllowed).toBe(false);
      expect(report.readyForLiveBrokerWrites).toBe(false);
    });
  });

  describe("Phase 8 operations composition", () => {
    it("blocks when system health is not OK", () => {
      const report = evaluateSmallCapitalEnablementGate({
        ...fullyCleanInput(),
        operations: { ...cleanOperationsSignal(), systemHealth: "WARNING" }
      });

      expect(report.blockingReasonCodes).toContain("phase8_operations_system_health_not_ok_warning");
      expect(report.readyForSmallCapitalPreparation).toBe(false);
    });

    it("blocks when operations live-readiness is blocked", () => {
      const report = evaluateSmallCapitalEnablementGate({
        ...fullyCleanInput(),
        operations: { ...cleanOperationsSignal(), liveReadinessBlocked: true }
      });

      expect(report.blockingReasonCodes).toContain("phase8_operations_live_readiness_blocked");
    });

    it("blocks when the operations kill switch signal disallows new orders", () => {
      const report = evaluateSmallCapitalEnablementGate({
        ...fullyCleanInput(),
        operations: { ...cleanOperationsSignal(), killSwitchAllowed: false }
      });

      expect(report.blockingReasonCodes).toContain("phase8_operations_kill_switch_blocks_new_orders");
    });

    it("blocks when there is an open critical alert", () => {
      const report = evaluateSmallCapitalEnablementGate({
        ...fullyCleanInput(),
        operations: { ...cleanOperationsSignal(), hasOpenCriticalAlert: true }
      });

      expect(report.blockingReasonCodes).toContain("phase8_operations_open_critical_alerts_present");
    });

    it("blocks when there are unsafe scheduler job definitions", () => {
      const report = evaluateSmallCapitalEnablementGate({
        ...fullyCleanInput(),
        operations: { ...cleanOperationsSignal(), unsafeSchedulerJobDefinitionCount: 2 }
      });

      expect(report.blockingReasonCodes).toContain("phase8_operations_unsafe_scheduler_job_definitions_present");
    });

    it("flags a tampered operations signal whose liveBrokerWriteAllowed is not false", () => {
      const report = evaluateSmallCapitalEnablementGate({
        ...fullyCleanInput(),
        operations: { ...cleanOperationsSignal(), liveBrokerWriteAllowed: true }
      });

      expect(report.blockingReasonCodes).toContain("phase8_operations_report_live_broker_write_allowed_not_false");
      expect(report.liveBrokerWriteAllowed).toBe(false);
    });
  });

  describe("Phase 8 deployment composition", () => {
    it("namespaces and passes through deployment blocking reason codes", () => {
      const dirtyDeployment = evaluateDeploymentReadiness({ now: NOW, targetEnvironment: "staging" });
      const report = evaluateSmallCapitalEnablementGate({
        ...fullyCleanInput(),
        deploymentReadiness: dirtyDeployment
      });

      expect(report.readyForSmallCapitalPreparation).toBe(false);
      expect(report.deploymentReadiness.status).toBe("BLOCKED");
      expect(report.blockingReasonCodes).toContain("phase8_deployment_missing_live_trading_signal");
    });
  });

  describe("Phase 8 backup/restore composition", () => {
    it("namespaces and passes through backup/restore blocking reason codes", () => {
      const dirtyBackup = evaluateBackupRestoreDrill({ drillId: "drill-2", now: NOW, requestedResumeMode: "PAPER" });
      const report = evaluateSmallCapitalEnablementGate({
        ...fullyCleanInput(),
        backupRestoreDrill: dirtyBackup
      });

      expect(report.readyForSmallCapitalPreparation).toBe(false);
      expect(report.backupRestoreReadiness.status).toBe("BLOCKED");
      expect(report.blockingReasonCodes).toContain("phase8_backup_restore_missing_backup_manifest_check");
    });
  });

  describe("Phase 9 live blocker evidence composition", () => {
    it("fails closed when the evidence summary array is entirely missing", () => {
      const { liveBlockerEvidence: _omit, ...rest } = fullyCleanInput();
      const report = evaluateSmallCapitalEnablementGate(rest);

      expect(report.liveBlockerEvidence.status).toBe("MISSING");
      expect(report.blockingReasonCodes).toContain("missing_live_blocker_evidence_summary");
      expect(report.humanReviewMissingReasonCodes).toHaveLength(REQUIRED_LIVE_CAPABLE_BLOCKER_IDS.length);
    });

    it("fails closed when a required LCB-* id has no entry at all", () => {
      const entries = readyForHumanReviewBlockerEvidence().filter((entry) => entry.blockerId !== "LCB-008");
      const report = evaluateSmallCapitalEnablementGate({ ...fullyCleanInput(), liveBlockerEvidence: entries });

      expect(report.blockingReasonCodes).toContain("live_blocker_evidence_missing_lcb_008");
      expect(report.humanReviewMissingReasonCodes).toContain("human_review_missing_lcb_008");
      expect(report.readyForSmallCapitalPreparation).toBe(false);
    });

    it("blocks preparation readiness when any blocker is NOT_STARTED", () => {
      const entries = readyForHumanReviewBlockerEvidence().map((entry) =>
        entry.blockerId === "LCB-004" ? { ...entry, status: "NOT_STARTED" as const } : entry
      );
      const report = evaluateSmallCapitalEnablementGate({ ...fullyCleanInput(), liveBlockerEvidence: entries });

      expect(report.blockingReasonCodes).toContain("live_blocker_evidence_not_started_lcb_004");
      expect(report.liveBlockerEvidence.notStartedBlockerIds).toContain("LCB-004");
      expect(report.readyForSmallCapitalPreparation).toBe(false);
    });

    it("does NOT block preparation readiness merely because a blocker is READY_FOR_HUMAN_REVIEW (not yet HUMAN_REVIEWED)", () => {
      const report = evaluateSmallCapitalEnablementGate({
        ...fullyCleanInput(),
        liveBlockerEvidence: readyForHumanReviewBlockerEvidence()
      });

      expect(report.readyForSmallCapitalPreparation).toBe(true);
      expect(report.liveBlockerEvidence.readyForHumanReviewBlockerIds).toHaveLength(
        REQUIRED_LIVE_CAPABLE_BLOCKER_IDS.length
      );
      // But the human-review-missing signal is still surfaced, distinctly.
      expect(report.humanReviewMissingReasonCodes).toHaveLength(REQUIRED_LIVE_CAPABLE_BLOCKER_IDS.length);
    });

    it("still reports human-review-missing reason codes even when preparation readiness is true", () => {
      const report = evaluateSmallCapitalEnablementGate(fullyCleanInput());
      expect(report.readyForSmallCapitalPreparation).toBe(true);
      expect(report.humanReviewMissingReasonCodes.length).toBeGreaterThan(0);
    });

    it("clears human-review-missing reason codes only once every blocker is genuinely HUMAN_REVIEWED", () => {
      const report = evaluateSmallCapitalEnablementGate(maximallyCleanInput());
      expect(report.humanReviewMissingReasonCodes).toEqual([]);
      expect(report.liveBlockerEvidence.humanReviewedBlockerIds).toHaveLength(
        REQUIRED_LIVE_CAPABLE_BLOCKER_IDS.length
      );
    });

    it("blocks a HUMAN_REVIEWED entry missing the reviewer name (cannot be silently trusted)", () => {
      const entries = humanReviewedBlockerEvidence().map((entry) =>
        entry.blockerId === "LCB-004" ? { ...entry, humanReviewerName: "" } : entry
      );
      const report = evaluateSmallCapitalEnablementGate({ ...fullyCleanInput(), liveBlockerEvidence: entries });

      expect(report.blockingReasonCodes).toContain("live_blocker_evidence_human_reviewed_missing_reviewer_name_lcb_004");
      expect(report.readyForSmallCapitalPreparation).toBe(false);
    });

    it("blocks a HUMAN_REVIEWED entry missing humanReviewedAt", () => {
      const entries = humanReviewedBlockerEvidence().map((entry) =>
        entry.blockerId === "LCB-004" ? { ...entry, humanReviewedAt: undefined } : entry
      );
      const report = evaluateSmallCapitalEnablementGate({ ...fullyCleanInput(), liveBlockerEvidence: entries });

      expect(report.blockingReasonCodes).toContain("live_blocker_evidence_human_reviewed_missing_reviewed_at_lcb_004");
    });

    it("blocks an unrecognized status value rather than trusting it (fails closed against a widened type)", () => {
      const entries = readyForHumanReviewBlockerEvidence().map((entry) =>
        entry.blockerId === "LCB-004" ? { ...entry, status: "RESOLVED" as unknown as "NOT_STARTED" } : entry
      );
      const report = evaluateSmallCapitalEnablementGate({ ...fullyCleanInput(), liveBlockerEvidence: entries });

      expect(report.blockingReasonCodes).toContain("live_blocker_evidence_invalid_status_lcb_004");
      expect(report.readyForSmallCapitalPreparation).toBe(false);
    });

    it("blocks on duplicate entries for the same blocker id rather than silently picking one", () => {
      const entries = [...readyForHumanReviewBlockerEvidence(), { blockerId: "LCB-004", status: "NOT_STARTED" as const }];
      const report = evaluateSmallCapitalEnablementGate({ ...fullyCleanInput(), liveBlockerEvidence: entries });

      expect(report.blockingReasonCodes).toContain("live_blocker_evidence_duplicate_entries_lcb_004");
    });
  });

  it("is a pure function: calling it twice with equivalent input produces the same result", () => {
    const first = evaluateSmallCapitalEnablementGate(fullyCleanInput());
    const second = evaluateSmallCapitalEnablementGate(fullyCleanInput());
    expect(first).toEqual(second);
  });

  it("does not mutate its input", () => {
    const input = fullyCleanInput();
    const snapshotBefore = JSON.stringify(input, (_key, value) => (typeof value === "bigint" ? value.toString() : value));
    evaluateSmallCapitalEnablementGate(input);
    const snapshotAfter = JSON.stringify(input, (_key, value) => (typeof value === "bigint" ? value.toString() : value));
    expect(snapshotAfter).toBe(snapshotBefore);
  });
});
