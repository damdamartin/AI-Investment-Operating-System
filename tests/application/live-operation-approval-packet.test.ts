import { describe, expect, it } from "vitest";
import {
  Currency,
  LIVE_BLOCKER_CATALOG,
  LIVE_BLOCKER_IDS,
  LiveBlockerEvidenceRegisterReviewer,
  MAX_HUMAN_EVIDENCE_AGE_DAYS_BEFORE_STALE,
  Money,
  REQUIRED_DEPLOYMENT_RUNBOOK_IDS,
  REQUIRED_DEPLOYMENT_SECRET_NAMES,
  REQUIRED_LIVE_BLOCKER_EVIDENCE_REVIEWER_ATTESTATION,
  REQUIRED_MANUAL_APPROVAL_ATTESTATION,
  REQUIRED_ROLLBACK_REHEARSAL_STEPS,
  evaluateBackupRestoreDrill,
  evaluateDeploymentReadiness,
  evaluateLiveOperationApprovalPacket,
  evaluateSmallCapitalEnablementGate,
  evaluateSmallCapitalReadiness,
  type BackupRestoreDrillInput,
  type DeploymentReadinessInput,
  type DeploymentReadinessReferenceFact,
  type DeploymentReadinessRunbookReference,
  type DeploymentReadinessSecretReference,
  type EvidenceReference,
  type LiveBlockerEvidenceRecord,
  type LiveBlockerId,
  type LiveOperationApprovalPacketInput,
  type LiveOperationHumanEvidenceFreshnessEntry,
  type ManualLiveApprovalRecord,
  type RollbackRehearsalStepRecord,
  type SmallCapitalCapitalLimits,
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
// Phase 9 (P9-001) blocker register review fixtures
// ---------------------------------------------------------------------------

function cleanRecord(overrides: Partial<LiveBlockerEvidenceRecord> = {}): LiveBlockerEvidenceRecord {
  return {
    blockerId: "LCB-001",
    evidenceSourceReferences: ["docs/phase5/toss-official-api-source-notes.md#automated-trading-clause"],
    result: "UNVERIFIED",
    limitations: "Covers KR market documentation only; US market terms not yet reviewed.",
    humanReviewerName: "Jun Kim",
    humanReviewerRole: "Compliance/legal reviewer",
    reviewDate: new Date("2026-07-20T00:00:00Z"),
    humanReviewed: true,
    humanReviewerAttestation: REQUIRED_LIVE_BLOCKER_EVIDENCE_REVIEWER_ATTESTATION,
    ...overrides
  };
}

function humanReviewedRecordFor(blockerId: LiveBlockerId): LiveBlockerEvidenceRecord {
  return cleanRecord({ blockerId });
}

function cleanRegisterReview() {
  return new LiveBlockerEvidenceRegisterReviewer().review({
    now: NOW,
    records: LIVE_BLOCKER_IDS.map((id) => humanReviewedRecordFor(id))
  });
}

function freshFreshnessEntries(): LiveOperationHumanEvidenceFreshnessEntry[] {
  return LIVE_BLOCKER_IDS.map((blockerId) => ({ blockerId, reviewedAt: new Date("2026-07-20T00:00:00Z") }));
}

// ---------------------------------------------------------------------------
// Phase 7/8/9 enablement gate fixtures (mirrors
// tests/application/small-capital-enablement-gate.test.ts)
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

function readyForHumanReviewBlockerEvidence() {
  return LIVE_BLOCKER_IDS.map((blockerId) => ({
    blockerId,
    status: "READY_FOR_HUMAN_REVIEW" as const
  }));
}

function humanReviewedBlockerEvidence() {
  return LIVE_BLOCKER_IDS.map((blockerId) => ({
    blockerId,
    status: "HUMAN_REVIEWED" as const,
    humanReviewerName: "Compliance Reviewer",
    humanReviewedAt: NOW
  }));
}

function cleanEnablementGate(maximallyClean = false) {
  return evaluateSmallCapitalEnablementGate({
    now: NOW,
    smallCapitalReadiness: cleanPhase7Report(),
    operations: cleanOperationsSignal(),
    deploymentReadiness: cleanDeploymentReport(),
    backupRestoreDrill: cleanBackupRestoreReport(),
    liveBlockerEvidence: maximallyClean ? humanReviewedBlockerEvidence() : readyForHumanReviewBlockerEvidence()
  });
}

// ---------------------------------------------------------------------------
// Composed packet input fixtures
// ---------------------------------------------------------------------------

function fullyCleanInput(): LiveOperationApprovalPacketInput {
  return {
    now: NOW,
    blockerRegisterReview: cleanRegisterReview(),
    enablementGate: cleanEnablementGate(true),
    humanEvidenceFreshness: freshFreshnessEntries()
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("evaluateLiveOperationApprovalPacket", () => {
  it("summarizes all 8 LCB blockers, in LIVE_BLOCKER_IDS order, with catalog title/role", () => {
    const packet = evaluateLiveOperationApprovalPacket(fullyCleanInput());

    expect(packet.blockerSummary.map((entry) => entry.blockerId)).toEqual(LIVE_BLOCKER_IDS as unknown as string[]);
    for (const entry of packet.blockerSummary) {
      const catalogEntry = LIVE_BLOCKER_CATALOG[entry.blockerId];
      expect(entry.title).toBe(catalogEntry.title);
      expect(entry.humanOwnerRole).toBe(catalogEntry.humanOwnerRole);
    }
  });

  it("reports allEvidenceComplete true on a fully clean, maximally favorable input", () => {
    const packet = evaluateLiveOperationApprovalPacket(fullyCleanInput());

    expect(packet.blockingReasonCodes).toEqual([]);
    expect(packet.humanReviewSummary.allBlockersHumanReviewedAndFresh).toBe(true);
    expect(packet.humanReviewSummary.humanReviewedAndFreshCount).toBe(LIVE_BLOCKER_IDS.length);
    expect(packet.phase8Summary.status).toBe("OK");
    expect(packet.phase9Summary.status).toBe("OK");
    expect(packet.phase9Summary.readyForSmallCapitalPreparation).toBe(true);
    expect(packet.allEvidenceComplete).toBe(true);
    expect(packet.safetyType).toBe("LIVE_OPERATION_APPROVAL_PACKET_EVIDENCE_ONLY");
  });

  describe("readyForLiveOperation and liveBrokerWriteAllowed can never become true", () => {
    it("are false on a fully empty (maximally dirty) input", () => {
      const packet = evaluateLiveOperationApprovalPacket({ now: NOW });
      expect(packet.readyForLiveOperation).toBe(false);
      expect(packet.liveBrokerWriteAllowed).toBe(false);
      expect(packet.allEvidenceComplete).toBe(false);
    });

    it("are false even on the maximally clean input: every upstream report clean AND every LCB-* blocker HUMAN_REVIEWED and fresh", () => {
      const packet = evaluateLiveOperationApprovalPacket(fullyCleanInput());

      // Sanity: this really is the most favorable input this packet can see.
      expect(packet.allEvidenceComplete).toBe(true);

      // The property under test.
      expect(packet.readyForLiveOperation).toBe(false);
      expect(packet.liveBrokerWriteAllowed).toBe(false);
      expect(JSON.stringify(packet)).not.toMatch(/"readyForLiveOperation":true/);
      expect(JSON.stringify(packet)).not.toMatch(/"liveBrokerWriteAllowed":true/);
    });

    it("cannot be forced to true even by a hand-constructed object that violates the packet's own type", () => {
      const tampered = {
        ...evaluateLiveOperationApprovalPacket(fullyCleanInput()),
        readyForLiveOperation: true,
        liveBrokerWriteAllowed: true
      };
      expect(tampered.readyForLiveOperation).toBe(true); // caller-side mutation, not evaluator output
      const rerun = evaluateLiveOperationApprovalPacket(fullyCleanInput());
      expect(rerun.readyForLiveOperation).toBe(false);
      expect(rerun.liveBrokerWriteAllowed).toBe(false);
    });

    it("stays false even when an upstream register review is tampered to claim liveBrokerWriteAllowed: true", () => {
      const tamperedRegisterReview = {
        ...cleanRegisterReview(),
        liveBrokerWriteAllowed: true as unknown as false
      };
      const packet = evaluateLiveOperationApprovalPacket({
        now: NOW,
        blockerRegisterReview: tamperedRegisterReview,
        enablementGate: cleanEnablementGate(true),
        humanEvidenceFreshness: freshFreshnessEntries()
      });

      expect(packet.readyForLiveOperation).toBe(false);
      expect(packet.liveBrokerWriteAllowed).toBe(false);
      expect(packet.blockingReasonCodes).toContain("blocker_register_review_live_broker_write_allowed_not_false");
      expect(packet.allEvidenceComplete).toBe(false);
    });

    it("stays false even when the enablement gate is tampered to claim readyForLiveBrokerWrites: true", () => {
      const tamperedGate = {
        ...cleanEnablementGate(true),
        readyForLiveBrokerWrites: true as unknown as false
      };
      const packet = evaluateLiveOperationApprovalPacket({
        now: NOW,
        blockerRegisterReview: cleanRegisterReview(),
        enablementGate: tamperedGate,
        humanEvidenceFreshness: freshFreshnessEntries()
      });

      expect(packet.readyForLiveOperation).toBe(false);
      expect(packet.liveBrokerWriteAllowed).toBe(false);
      expect(packet.blockingReasonCodes).toContain("enablement_gate_ready_for_live_broker_writes_not_false");
    });
  });

  it("never exposes a resolved-blocker status anywhere in the packet", () => {
    const packet = evaluateLiveOperationApprovalPacket(fullyCleanInput());
    const serialized = JSON.stringify(packet);
    expect(serialized).not.toContain("RESOLVED");
  });

  it("includes the not-authorization statement verbatim and mentions no LCB-* blocker can be marked resolved by this packet", () => {
    const packet = evaluateLiveOperationApprovalPacket(fullyCleanInput());
    expect(packet.approvalStatement).toMatch(/NOT live-trading authorization/);
    expect(packet.approvalStatement).toMatch(/hardcoded literal false/);
  });

  it("fails closed on a fully empty input", () => {
    const packet = evaluateLiveOperationApprovalPacket({ now: NOW });

    expect(packet.allEvidenceComplete).toBe(false);
    expect(packet.blockingReasonCodes).toEqual(
      expect.arrayContaining(["missing_blocker_register_review", "missing_enablement_gate_report"])
    );
    expect(packet.blockerSummary.every((entry) => entry.status === "NOT_PROVIDED")).toBe(true);
    expect(packet.humanReviewSummary.missingBlockerIds).toEqual(LIVE_BLOCKER_IDS as unknown as string[]);
    expect(packet.phase8Summary.status).toBe("MISSING");
    expect(packet.phase9Summary.status).toBe("MISSING");
  });

  it("rejects a missing or invalid evaluation time", () => {
    const packet = evaluateLiveOperationApprovalPacket({ now: new Date(Number.NaN) });
    expect(packet.blockingReasonCodes).toContain("missing_or_invalid_evaluation_time");
  });

  describe("human evidence freshness (this packet's own stricter staleness gate)", () => {
    it("fails closed when a HUMAN_REVIEWED blocker has no freshness date supplied at all", () => {
      const packet = evaluateLiveOperationApprovalPacket({
        now: NOW,
        blockerRegisterReview: cleanRegisterReview(),
        enablementGate: cleanEnablementGate(true)
        // humanEvidenceFreshness intentionally omitted
      });

      const lcb001 = packet.blockerSummary.find((entry) => entry.blockerId === "LCB-001");
      expect(lcb001?.status).toBe("HUMAN_REVIEWED");
      expect(lcb001?.evidenceStale).toBe(true);
      expect(lcb001?.humanReviewComplete).toBe(false);
      expect(lcb001?.reasonCodes).toContain("human_evidence_freshness_not_provided");
      expect(packet.blockingReasonCodes).toContain("stale_human_evidence_lcb_001");
      expect(packet.allEvidenceComplete).toBe(false);
    });

    it("flags evidence older than MAX_HUMAN_EVIDENCE_AGE_DAYS_BEFORE_STALE as stale and blocks", () => {
      const staleDate = new Date(NOW.getTime() - (MAX_HUMAN_EVIDENCE_AGE_DAYS_BEFORE_STALE + 5) * 86_400_000);
      const freshness = LIVE_BLOCKER_IDS.map((blockerId) => ({ blockerId, reviewedAt: staleDate }));

      const packet = evaluateLiveOperationApprovalPacket({
        now: NOW,
        blockerRegisterReview: cleanRegisterReview(),
        enablementGate: cleanEnablementGate(true),
        humanEvidenceFreshness: freshness
      });

      expect(packet.humanReviewSummary.staleHumanReviewBlockerIds).toEqual(LIVE_BLOCKER_IDS as unknown as string[]);
      expect(packet.humanReviewSummary.allBlockersHumanReviewedAndFresh).toBe(false);
      expect(packet.allEvidenceComplete).toBe(false);
    });

    it("accepts evidence exactly at the staleness boundary as fresh", () => {
      const boundaryDate = new Date(NOW.getTime() - MAX_HUMAN_EVIDENCE_AGE_DAYS_BEFORE_STALE * 86_400_000);
      const freshness = LIVE_BLOCKER_IDS.map((blockerId) => ({ blockerId, reviewedAt: boundaryDate }));

      const packet = evaluateLiveOperationApprovalPacket({
        now: NOW,
        blockerRegisterReview: cleanRegisterReview(),
        enablementGate: cleanEnablementGate(true),
        humanEvidenceFreshness: freshness
      });

      expect(packet.humanReviewSummary.staleHumanReviewBlockerIds).toEqual([]);
      expect(packet.humanReviewSummary.allBlockersHumanReviewedAndFresh).toBe(true);
    });

    it("fails closed when a freshness date is in the future", () => {
      const futureDate = new Date(NOW.getTime() + 86_400_000);
      const freshness: LiveOperationHumanEvidenceFreshnessEntry[] = [{ blockerId: "LCB-001", reviewedAt: futureDate }];

      const packet = evaluateLiveOperationApprovalPacket({
        now: NOW,
        blockerRegisterReview: cleanRegisterReview(),
        enablementGate: cleanEnablementGate(true),
        humanEvidenceFreshness: freshness
      });

      const lcb001 = packet.blockerSummary.find((entry) => entry.blockerId === "LCB-001");
      expect(lcb001?.evidenceStale).toBe(true);
      expect(lcb001?.reasonCodes).toContain("human_evidence_reviewed_at_in_future");
    });

    it("does not require a freshness date for a blocker that is not yet HUMAN_REVIEWED", () => {
      const notYetReviewed = new LiveBlockerEvidenceRegisterReviewer().review({
        now: NOW,
        records: LIVE_BLOCKER_IDS.map((id) =>
          cleanRecord({ blockerId: id, humanReviewed: false, humanReviewerAttestation: undefined })
        )
      });

      const packet = evaluateLiveOperationApprovalPacket({
        now: NOW,
        blockerRegisterReview: notYetReviewed,
        enablementGate: cleanEnablementGate(true)
        // no humanEvidenceFreshness supplied
      });

      for (const entry of packet.blockerSummary) {
        expect(entry.status).toBe("READY_FOR_HUMAN_REVIEW");
        expect(entry.evidenceStale).toBe(false);
        expect(entry.reasonCodes).not.toContain("human_evidence_freshness_not_provided");
      }
    });
  });

  describe("human review completeness summary categorization", () => {
    it("categorizes a MISSING blocker (no evidence record) as missing, not not-yet-reviewed", () => {
      const recordsMissingOne = LIVE_BLOCKER_IDS.filter((id) => id !== "LCB-008").map((id) =>
        humanReviewedRecordFor(id)
      );
      const registerReview = new LiveBlockerEvidenceRegisterReviewer().review({
        now: NOW,
        records: recordsMissingOne
      });

      const packet = evaluateLiveOperationApprovalPacket({
        now: NOW,
        blockerRegisterReview: registerReview,
        enablementGate: cleanEnablementGate(true),
        humanEvidenceFreshness: freshFreshnessEntries()
      });

      expect(packet.humanReviewSummary.missingBlockerIds).toEqual(["LCB-008"]);
      expect(packet.humanReviewSummary.notYetHumanReviewedBlockerIds).not.toContain("LCB-008");
      const lcb008 = packet.blockerSummary.find((entry) => entry.blockerId === "LCB-008");
      expect(lcb008?.status).toBe("MISSING");
      expect(packet.allEvidenceComplete).toBe(false);
    });

    it("categorizes a REJECTED blocker as not-yet-human-reviewed and propagates its reason codes", () => {
      const records = LIVE_BLOCKER_IDS.map((id) =>
        id === "LCB-005" ? { ...humanReviewedRecordFor(id), limitations: "" } : humanReviewedRecordFor(id)
      );
      const registerReview = new LiveBlockerEvidenceRegisterReviewer().review({ now: NOW, records });

      const packet = evaluateLiveOperationApprovalPacket({
        now: NOW,
        blockerRegisterReview: registerReview,
        enablementGate: cleanEnablementGate(true),
        humanEvidenceFreshness: freshFreshnessEntries()
      });

      expect(packet.humanReviewSummary.notYetHumanReviewedBlockerIds).toContain("LCB-005");
      expect(packet.blockingReasonCodes).toContain("lcb_005_missing_limitations");
      const lcb005 = packet.blockerSummary.find((entry) => entry.blockerId === "LCB-005");
      expect(lcb005?.status).toBe("REJECTED");
      expect(lcb005?.humanReviewComplete).toBe(false);
    });
  });

  describe("Phase 8 / Phase 9 composition", () => {
    it("surfaces Phase 8 operations/deployment/backup-restore views from the enablement gate", () => {
      const packet = evaluateLiveOperationApprovalPacket(fullyCleanInput());
      expect(packet.phase8Summary.operations?.status).toBe("OK");
      expect(packet.phase8Summary.deployment?.status).toBe("OK");
      expect(packet.phase8Summary.backupRestore?.status).toBe("OK");
    });

    it("marks phase8Summary BLOCKED and propagates reason codes when deployment is not ready", () => {
      const dirtyGate = evaluateSmallCapitalEnablementGate({
        now: NOW,
        smallCapitalReadiness: cleanPhase7Report(),
        operations: cleanOperationsSignal(),
        deploymentReadiness: evaluateDeploymentReadiness(cleanDeploymentInput({ runbookReferences: [] })),
        backupRestoreDrill: cleanBackupRestoreReport(),
        liveBlockerEvidence: humanReviewedBlockerEvidence()
      });

      const packet = evaluateLiveOperationApprovalPacket({
        now: NOW,
        blockerRegisterReview: cleanRegisterReview(),
        enablementGate: dirtyGate,
        humanEvidenceFreshness: freshFreshnessEntries()
      });

      expect(packet.phase8Summary.status).toBe("BLOCKED");
      expect(packet.phase8Summary.reasonCodes.length).toBeGreaterThan(0);
      expect(packet.allEvidenceComplete).toBe(false);
    });

    it("surfaces phase7Readiness and liveBlockerEvidence inside phase9Summary", () => {
      const packet = evaluateLiveOperationApprovalPacket(fullyCleanInput());
      expect(packet.phase9Summary.phase7Readiness?.readyForSmallCapitalLive).toBe(true);
      expect(packet.phase9Summary.liveBlockerEvidence?.humanReviewedBlockerIds).toHaveLength(LIVE_BLOCKER_IDS.length);
    });
  });

  it("does not contain secret-like or account-like content in a fully clean packet", () => {
    const packet = evaluateLiveOperationApprovalPacket(fullyCleanInput());
    const serialized = JSON.stringify(packet);

    expect(serialized).not.toMatch(/access[_-]?token/i);
    expect(serialized).not.toMatch(/client[_-]?secret/i);
    expect(serialized).not.toMatch(/api[_-]?key/i);
    expect(serialized).not.toMatch(/account_number/i);
    expect(serialized).not.toMatch(/\.env\b/);
    expect(serialized).not.toMatch(/tmp\/phase5/);
    expect(serialized).not.toMatch(/\b\d{6,}\b/);
  });
});
