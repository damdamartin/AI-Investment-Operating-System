import { describe, expect, it } from "vitest";
import { RestoreSafetyGate, type RestoreSafetyChecklist } from "../../src/index.js";

describe("RestoreSafetyGate", () => {
  it("allows trading resume only when all restore checks pass", () => {
    const result = new RestoreSafetyGate().evaluate({
      restoreId: "restore-1",
      checklist: passingChecklist(),
      checkedAt: now()
    });

    expect(result.status).toBe("READY");
    expect(result.tradingResumeAllowed).toBe(true);
    expect(result.reasonCodes).toEqual([]);
    expect(result.safetyType).toBe("RESTORE_SAFETY_GATE_DECISION_ONLY");
  });

  it("keeps trading disabled when restore verification is incomplete", () => {
    const result = new RestoreSafetyGate().evaluate({
      restoreId: "restore-1",
      checklist: {
        ...passingChecklist(),
        schemaVersionVerified: false,
        configVersionsVerified: false
      },
      checkedAt: now()
    });

    expect(result.status).toBe("BLOCKED");
    expect(result.tradingResumeAllowed).toBe(false);
    expect(result.reasonCodes).toEqual(["config_versions_not_verified", "schema_version_not_verified"]);
  });

  it("requires secrets to be handled separately from normal backups", () => {
    const result = new RestoreSafetyGate().evaluate({
      restoreId: "restore-1",
      checklist: {
        ...passingChecklist(),
        secretsHandledSeparately: false
      },
      checkedAt: now()
    });

    expect(result.tradingResumeAllowed).toBe(false);
    expect(result.reasonCodes).toContain("secrets_not_handled_separately");
  });

  it("blocks resume until broker reconciliation and data quality are clean", () => {
    const result = new RestoreSafetyGate().evaluate({
      restoreId: "restore-1",
      checklist: {
        ...passingChecklist(),
        reconciliationClean: false,
        dataQualityAllowsTrading: false
      },
      checkedAt: now()
    });

    expect(result.reasonCodes).toContain("reconciliation_not_clean_after_restore");
    expect(result.reasonCodes).toContain("data_quality_blocks_after_restore");
    expect(result.tradingResumeAllowed).toBe(false);
  });

  it("does not expose corrective trading commands", () => {
    const result = new RestoreSafetyGate().evaluate({
      restoreId: "restore-1",
      checklist: passingChecklist(),
      checkedAt: now()
    });

    expect(result).not.toHaveProperty("submitOrder");
    expect(result).not.toHaveProperty("correctiveTrade");
    expect(result).not.toHaveProperty("disableKillSwitch");
  });
});

function passingChecklist(): RestoreSafetyChecklist {
  return {
    backupManifestVerified: true,
    schemaVersionVerified: true,
    configVersionsVerified: true,
    auditContinuityVerified: true,
    secretsHandledSeparately: true,
    reconciliationClean: true,
    dataQualityAllowsTrading: true,
    killSwitchAvailable: true,
    operatorApprovalRecorded: true
  };
}

function now(): Date {
  return new Date("2026-01-01T00:00:00Z");
}
