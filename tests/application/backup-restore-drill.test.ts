import { describe, expect, it } from "vitest";
import {
  BackupRestoreDrill,
  evaluateBackupRestoreDrill,
  REQUIRED_ROLLBACK_REHEARSAL_STEPS,
  type BackupRestoreDrillInput,
  type EvidenceReference,
  type RollbackRehearsalStepRecord
} from "../../src/index.js";

describe("evaluateBackupRestoreDrill", () => {
  it("allows PAPER resume only when every check passes with evidence", () => {
    const report = evaluateBackupRestoreDrill(passingInput());

    expect(report.status).toBe("READY");
    expect(report.resumeAllowed).toBe(true);
    expect(report.resumeMode).toBe("PAPER");
    expect(report.blockingReasonCodes).toEqual([]);
    expect(report.liveBrokerWriteAllowed).toBe(false);
    expect(report.correctiveTradingAllowed).toBe(false);
    expect(report.safetyType).toBe("BACKUP_RESTORE_DRILL_REPORT_EVALUATION_ONLY");
    expect(report.checks).toHaveLength(9);
    expect(report.checks.every((c) => c.passed)).toBe(true);
    expect(report.checks.every((c) => c.evidenceReferences.length > 0)).toBe(true);
  });

  it("allows SIMULATION resume when explicitly requested and all checks pass", () => {
    const report = evaluateBackupRestoreDrill({ ...passingInput(), requestedResumeMode: "SIMULATION" });

    expect(report.resumeAllowed).toBe(true);
    expect(report.resumeMode).toBe("SIMULATION");
  });

  it("never accepts a live/production resume mode, even if forced past the type system", () => {
    const input = { ...passingInput(), requestedResumeMode: "PRODUCTION" } as unknown as BackupRestoreDrillInput;
    const report = evaluateBackupRestoreDrill(input);

    expect(report.resumeAllowed).toBe(false);
    expect(report.resumeMode).toBeNull();
    expect(report.blockingReasonCodes).toContain("resume_mode_not_allowed_production");
    expect(report.liveBrokerWriteAllowed).toBe(false);
  });

  it("fails closed when a required check is entirely missing", () => {
    const input = { ...passingInput() };
    delete (input as Partial<BackupRestoreDrillInput>).backupManifest;

    const report = evaluateBackupRestoreDrill(input);

    expect(report.resumeAllowed).toBe(false);
    expect(report.blockingReasonCodes).toContain("missing_backup_manifest_check");
    const manifestCheck = report.checks.find((c) => c.checkId === "backup_manifest");
    expect(manifestCheck?.passed).toBe(false);
    expect(manifestCheck?.evidenceReferences).toEqual([]);
  });

  it("fails closed when a check is present but its evidence reference is missing", () => {
    const input = passingInput();
    input.backupManifest = { ...input.backupManifest!, evidence: undefined };

    const report = evaluateBackupRestoreDrill(input);

    expect(report.resumeAllowed).toBe(false);
    expect(report.blockingReasonCodes).toContain("backup_manifest_evidence_missing");
  });

  it("fails closed when an evidence reference is malformed", () => {
    const input = passingInput();
    input.auditContinuity = {
      ...input.auditContinuity!,
      evidence: { description: "", locator: "", capturedAt: new Date("invalid") }
    };

    const report = evaluateBackupRestoreDrill(input);

    expect(report.blockingReasonCodes).toContain("audit_continuity_evidence_missing_description");
    expect(report.blockingReasonCodes).toContain("audit_continuity_evidence_missing_locator");
    expect(report.blockingReasonCodes).toContain("audit_continuity_evidence_missing_captured_at");
  });

  it("blocks resume when schema version does not match what was restored", () => {
    const input = passingInput();
    input.schemaConfigVersion = {
      ...input.schemaConfigVersion!,
      restoredSchemaVersion: "20260101000000_old_migration"
    };

    const report = evaluateBackupRestoreDrill(input);

    expect(report.blockingReasonCodes).toContain("schema_version_mismatch");
  });

  it("blocks resume when active config version ids do not match expected", () => {
    const input = passingInput();
    input.schemaConfigVersion = {
      ...input.schemaConfigVersion!,
      activeConfigVersionIds: ["risk-v1"]
    };

    const report = evaluateBackupRestoreDrill(input);

    expect(report.blockingReasonCodes).toContain("config_version_mismatch");
  });

  it("blocks resume when audit continuity has a detected gap", () => {
    const input = passingInput();
    input.auditContinuity = { ...input.auditContinuity!, gapDetected: true };

    const report = evaluateBackupRestoreDrill(input);

    expect(report.blockingReasonCodes).toContain("audit_continuity_gap_detected");
  });

  it("documents secrets as handled separately and blocks when not confirmed", () => {
    const input = passingInput();
    input.secretsHandledSeparately = {
      ...input.secretsHandledSeparately!,
      confirmedNotInBackupArtifact: false
    };

    const report = evaluateBackupRestoreDrill(input);

    expect(report.blockingReasonCodes).toContain("secrets_not_confirmed_separate_from_backup");
  });

  it("refuses a secrets reference that looks like a pasted raw secret rather than a pointer", () => {
    const input = passingInput();
    input.secretsHandledSeparately = {
      ...input.secretsHandledSeparately!,
      secretsManagerReference: "s".repeat(500)
    };

    const report = evaluateBackupRestoreDrill(input);

    expect(report.blockingReasonCodes).toContain("secrets_manager_reference_looks_like_raw_secret");
  });

  it("never reads actual secret content — only a reference/flag is checked", () => {
    const report = evaluateBackupRestoreDrill(passingInput());
    const secretsCheck = report.checks.find((c) => c.checkId === "secrets_handled_separately");

    expect(secretsCheck?.passed).toBe(true);
    expect(JSON.stringify(secretsCheck)).not.toContain("TOSS_API_KEY");
    expect(JSON.stringify(secretsCheck)).not.toContain("sk-");
  });

  it("blocks resume when reconciliation is not confirmed against a broker snapshot, even if otherwise clean", () => {
    const input = passingInput();
    input.reconciliation = {
      ...input.reconciliation!,
      reconciledAgainstBrokerSnapshot: false,
      liveReadinessBlocked: false,
      stale: false,
      tradingSafetyState: "CLEAR"
    };

    const report = evaluateBackupRestoreDrill(input);

    expect(report.resumeAllowed).toBe(false);
    expect(report.blockingReasonCodes).toContain("reconciliation_not_confirmed_against_broker_snapshot");
  });

  it("blocks resume when the reconciliation signal is stale or unresolved", () => {
    const input = passingInput();
    input.reconciliation = { ...input.reconciliation!, stale: true, liveReadinessBlocked: true };

    const report = evaluateBackupRestoreDrill(input);

    expect(report.blockingReasonCodes).toContain("reconciliation_stale_after_restore");
    expect(report.blockingReasonCodes).toContain("reconciliation_not_fully_resolved_after_restore");
  });

  it("blocks resume when data quality is RED or explicitly blocks trading", () => {
    const input = passingInput();
    input.dataQuality = { ...input.dataQuality!, status: "RED", blocksTrading: true };

    const report = evaluateBackupRestoreDrill(input);

    expect(report.blockingReasonCodes).toContain("data_quality_blocks_resume");
  });

  it("treats YELLOW data quality as a non-blocking warning", () => {
    const input = passingInput();
    input.dataQuality = { ...input.dataQuality!, status: "YELLOW", blocksTrading: false };

    const report = evaluateBackupRestoreDrill(input);

    expect(report.resumeAllowed).toBe(true);
    expect(report.warnings).toContain("data_quality_yellow_after_restore");
  });

  it("blocks resume when kill switch availability is not confirmed", () => {
    const input = passingInput();
    input.killSwitch = { ...input.killSwitch!, allowed: false, blocksNewOrders: true };

    const report = evaluateBackupRestoreDrill(input);

    expect(report.blockingReasonCodes).toContain("kill_switch_not_available_after_restore");
  });

  it("requires operator approval before resume, with an allowed role and timestamp", () => {
    const input = passingInput();
    input.operatorApproval = { ...input.operatorApproval!, approved: false };

    const report = evaluateBackupRestoreDrill(input);

    expect(report.blockingReasonCodes).toContain("operator_approval_not_approved");
  });

  it("rejects operator approval from a disallowed role", () => {
    const input = passingInput();
    input.operatorApproval = { ...input.operatorApproval!, approvedByRole: "VIEWER" };

    const report = evaluateBackupRestoreDrill(input);

    expect(report.blockingReasonCodes).toContain("operator_approval_role_not_allowed");
  });

  it("requires every rollback rehearsal step to be present, rehearsed, and evidenced", () => {
    for (const stepId of REQUIRED_ROLLBACK_REHEARSAL_STEPS) {
      const input = passingInput();
      input.rollbackRehearsal = {
        steps: passingRollbackSteps().filter((s) => s.stepId !== stepId)
      };

      const report = evaluateBackupRestoreDrill(input);

      expect(report.resumeAllowed).toBe(false);
      expect(report.blockingReasonCodes).toContain(`rollback_rehearsal_step_missing_${stepId}`);
    }
  });

  it("blocks resume when a rollback rehearsal step is present but not actually rehearsed", () => {
    const input = passingInput();
    input.rollbackRehearsal = {
      steps: passingRollbackSteps().map((s) =>
        s.stepId === "immediate_stop_kill_switch" ? { ...s, rehearsed: false } : s
      )
    };

    const report = evaluateBackupRestoreDrill(input);

    expect(report.blockingReasonCodes).toContain("rollback_rehearsal_step_not_rehearsed_immediate_stop_kill_switch");
  });

  it("does not expose any corrective trading, broker order, or live-enable commands", () => {
    const report = evaluateBackupRestoreDrill(passingInput());

    expect(report).not.toHaveProperty("submitOrder");
    expect(report).not.toHaveProperty("correctiveTrade");
    expect(report).not.toHaveProperty("disableKillSwitch");
    expect(report).not.toHaveProperty("enableLiveTrading");
    expect(report.liveBrokerWriteAllowed).toBe(false);
    expect(report.correctiveTradingAllowed).toBe(false);
  });

  it("supports the class-based BackupRestoreDrill wrapper with identical behavior", () => {
    const drill = new BackupRestoreDrill();
    const report = drill.evaluate(passingInput());

    expect(report.resumeAllowed).toBe(true);
    expect(report.resumeMode).toBe("PAPER");
  });

  it("fails closed when evaluation time is missing or invalid", () => {
    const input = { ...passingInput(), now: new Date("not-a-date") };
    const report = evaluateBackupRestoreDrill(input);

    expect(report.blockingReasonCodes).toContain("missing_or_invalid_evaluation_time");
  });
});

function evidence(locator: string): EvidenceReference {
  return {
    description: `evidence for ${locator}`,
    locator,
    capturedAt: now()
  };
}

function passingRollbackSteps(): RollbackRehearsalStepRecord[] {
  return REQUIRED_ROLLBACK_REHEARSAL_STEPS.map((stepId) => ({
    stepId,
    rehearsed: true,
    evidence: evidence(`rollback-rehearsal-log://${stepId}`)
  }));
}

function passingInput(): BackupRestoreDrillInput {
  return {
    drillId: "drill-1",
    now: now(),
    requestedResumeMode: "PAPER",
    backupManifest: {
      manifestVerified: true,
      manifestId: "manifest-2026-07-27",
      backupCompletedAt: now(),
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
      approvedAt: now(),
      evidence: evidence("approval-record://drill-1")
    },
    rollbackRehearsal: {
      steps: passingRollbackSteps()
    }
  };
}

function now(): Date {
  return new Date("2026-07-27T00:00:00Z");
}
