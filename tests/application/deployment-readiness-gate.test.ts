import { describe, expect, it } from "vitest";
import {
  REQUIRED_DEPLOYMENT_RUNBOOK_IDS,
  REQUIRED_DEPLOYMENT_SECRET_NAMES,
  deploymentEnvironmentSkeletons,
  evaluateDeploymentReadiness,
  type DeploymentReadinessInput,
  type DeploymentReadinessProductionBlockerStatus,
  type DeploymentReadinessReferenceFact,
  type DeploymentReadinessRunbookReference,
  type DeploymentReadinessSecretReference
} from "../../src/index.js";

const NOW = new Date("2026-07-29T01:00:00Z");

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

function cleanProductionBlockerStatus(): DeploymentReadinessProductionBlockerStatus {
  return {
    registerReferenced: true,
    reference: "docs/phase7/live-capable-blocker-register.md",
    openBlockerCount: 8
  };
}

function cleanInput(overrides: Partial<DeploymentReadinessInput> = {}): DeploymentReadinessInput {
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

describe("evaluateDeploymentReadiness", () => {
  it("returns readyToDeploy true when every no-write gate passes", () => {
    const report = evaluateDeploymentReadiness(cleanInput());

    expect(report.readyToDeploy).toBe(true);
    expect(report.blockingReasonCodes).toEqual([]);
    expect(report.liveBrokerWriteAllowed).toBe(false);
    expect(report.safetyType).toBe("DEPLOYMENT_READINESS_REPORT_EVALUATION_ONLY");
  });

  it("always returns liveBrokerWriteAllowed: false, even when readyToDeploy is true", () => {
    const report = evaluateDeploymentReadiness(cleanInput());
    // Structural guarantee: this field is a literal in the implementation,
    // not a computed pass-through of any input value.
    expect(report.liveBrokerWriteAllowed).toBe(false);
    expect(Object.keys(report)).not.toContain("liveTradingAuthorized");
    expect(Object.keys(report)).not.toContain("liveTradingEnabled");
  });

  it("is pure: identical input produces an identical report and never mutates input", () => {
    const input = cleanInput();
    const frozenRunbooks = JSON.stringify(input.runbookReferences);

    const first = evaluateDeploymentReadiness(input);
    const second = evaluateDeploymentReadiness(input);

    expect(first).toEqual(second);
    expect(JSON.stringify(input.runbookReferences)).toBe(frozenRunbooks);
  });

  it("fails closed on missing or invalid evaluation time", () => {
    const report = evaluateDeploymentReadiness(cleanInput({ now: new Date("invalid") }));

    expect(report.readyToDeploy).toBe(false);
    expect(report.blockingReasonCodes).toContain("missing_or_invalid_evaluation_time");
  });

  it("fails closed when the environment skeleton is missing for the target environment", () => {
    const report = evaluateDeploymentReadiness(
      cleanInput({
        environmentSkeletons: deploymentEnvironmentSkeletons.filter((item) => item.name !== "staging")
      })
    );

    expect(report.readyToDeploy).toBe(false);
    expect(report.blockingReasonCodes).toContain("missing_environment_skeleton_staging");
  });

  it("fails closed when a supplied environment skeleton has live trading enabled by default", () => {
    const unsafeSkeletons = deploymentEnvironmentSkeletons.map((item) =>
      item.name === "staging" ? { ...item, liveTradingEnabled: true as false } : item
    );
    const report = evaluateDeploymentReadiness(cleanInput({ environmentSkeletons: unsafeSkeletons }));

    expect(report.readyToDeploy).toBe(false);
    expect(report.blockingReasonCodes).toContain("skeleton_staging_live_trading_enabled_by_default");
  });

  it("fails closed when the live trading signal is missing", () => {
    const report = evaluateDeploymentReadiness(cleanInput({ liveTradingSignal: undefined }));

    expect(report.readyToDeploy).toBe(false);
    expect(report.blockingReasonCodes).toContain("missing_live_trading_signal");
  });

  it("fails closed when the live trading signal reports live trading enabled", () => {
    const report = evaluateDeploymentReadiness(
      cleanInput({ liveTradingSignal: { liveTradingEnabled: true, appEnv: "staging" } })
    );

    expect(report.readyToDeploy).toBe(false);
    expect(report.blockingReasonCodes).toContain("live_trading_enabled_blocks_deployment_readiness");
  });

  it("fails closed when the live trading signal environment does not match the target environment", () => {
    const report = evaluateDeploymentReadiness(
      cleanInput({ liveTradingSignal: { liveTradingEnabled: false, appEnv: "production" } })
    );

    expect(report.readyToDeploy).toBe(false);
    expect(report.blockingReasonCodes).toContain("live_trading_signal_environment_mismatch");
  });

  it("requires an explicit, recognizable production blocker status reference for a production target", () => {
    const missing = evaluateDeploymentReadiness(
      cleanInput({
        targetEnvironment: "production",
        liveTradingSignal: { liveTradingEnabled: false, appEnv: "production" },
        secretReferences: cleanSecretReferences("production")
      })
    );
    expect(missing.readyToDeploy).toBe(false);
    expect(missing.blockingReasonCodes).toContain("missing_production_blocker_status_reference");

    const unrecognized = evaluateDeploymentReadiness(
      cleanInput({
        targetEnvironment: "production",
        liveTradingSignal: { liveTradingEnabled: false, appEnv: "production" },
        secretReferences: cleanSecretReferences("production"),
        productionBlockerStatus: {
          registerReferenced: true,
          reference: "docs/some-other-file.md",
          openBlockerCount: 8
        }
      })
    );
    expect(unrecognized.readyToDeploy).toBe(false);
    expect(unrecognized.blockingReasonCodes).toContain("production_blocker_status_reference_not_recognized");

    const ready = evaluateDeploymentReadiness(
      cleanInput({
        targetEnvironment: "production",
        liveTradingSignal: { liveTradingEnabled: false, appEnv: "production" },
        secretReferences: cleanSecretReferences("production"),
        productionBlockerStatus: cleanProductionBlockerStatus()
      })
    );
    expect(ready.readyToDeploy).toBe(true);
  });

  it("does not require a production blocker status reference for a non-production target", () => {
    const report = evaluateDeploymentReadiness(cleanInput({ targetEnvironment: "staging" }));

    expect(report.blockingReasonCodes).not.toContain("missing_production_blocker_status_reference");
  });

  it("fails closed on every missing required runbook reference", () => {
    for (const runbookId of REQUIRED_DEPLOYMENT_RUNBOOK_IDS) {
      const runbookReferences = cleanRunbookReferences().filter((item) => item.runbookId !== runbookId);
      const report = evaluateDeploymentReadiness(cleanInput({ runbookReferences }));

      expect(report.readyToDeploy).toBe(false);
      expect(report.blockingReasonCodes).toContain(`missing_runbook_reference_${runbookId}`);
    }
  });

  it("fails closed when a runbook reference is marked as not found", () => {
    const runbookReferences = cleanRunbookReferences().map((item) =>
      item.runbookId === "rollback_deployment" ? { ...item, exists: false } : item
    );
    const report = evaluateDeploymentReadiness(cleanInput({ runbookReferences }));

    expect(report.readyToDeploy).toBe(false);
    expect(report.blockingReasonCodes).toContain("runbook_rollback_deployment_reference_not_found");
  });

  it("fails closed when a runbook reference looks like a secret value instead of a path", () => {
    const runbookReferences = cleanRunbookReferences().map((item) =>
      item.runbookId === "rotate_api_secret" ? { ...item, reference: "token=abc123def456" } : item
    );
    const report = evaluateDeploymentReadiness(cleanInput({ runbookReferences }));

    expect(report.readyToDeploy).toBe(false);
    expect(report.blockingReasonCodes).toContain("runbook_rotate_api_secret_reference_looks_like_secret_value");
  });

  it("fails closed when the rollback plan reference is missing", () => {
    const report = evaluateDeploymentReadiness(cleanInput({ rollbackPlanReference: undefined }));

    expect(report.readyToDeploy).toBe(false);
    expect(report.blockingReasonCodes).toContain("missing_rollback_plan_reference");
  });

  it("fails closed when the rollback plan reference does not resolve", () => {
    const report = evaluateDeploymentReadiness(
      cleanInput({ rollbackPlanReference: { reference: "docs/phase8/rollback-drill-runbook.md", exists: false } })
    );

    expect(report.readyToDeploy).toBe(false);
    expect(report.blockingReasonCodes).toContain("rollback_plan_reference_not_found");
  });

  it("fails closed when the backup/restore gate reference is missing", () => {
    const report = evaluateDeploymentReadiness(cleanInput({ backupRestoreGateReference: undefined }));

    expect(report.readyToDeploy).toBe(false);
    expect(report.blockingReasonCodes).toContain("missing_backup_restore_gate_reference");
  });

  it("fails closed when the observability/alerting reference is missing", () => {
    const report = evaluateDeploymentReadiness(cleanInput({ observabilityAlertingReference: undefined }));

    expect(report.readyToDeploy).toBe(false);
    expect(report.blockingReasonCodes).toContain("missing_observability_alerting_reference");
  });

  it("fails closed when required secret references are missing entirely for an environment that requires real secrets", () => {
    const report = evaluateDeploymentReadiness(cleanInput({ secretReferences: undefined }));

    expect(report.readyToDeploy).toBe(false);
    expect(report.blockingReasonCodes).toContain("missing_secret_references");
  });

  it("fails closed on every individually missing required secret reference", () => {
    for (const name of REQUIRED_DEPLOYMENT_SECRET_NAMES) {
      const secretReferences = cleanSecretReferences("staging").filter((item) => item.name !== name);
      const report = evaluateDeploymentReadiness(cleanInput({ secretReferences }));

      expect(report.readyToDeploy).toBe(false);
      expect(report.blockingReasonCodes).toContain(`missing_secret_reference_${name.toLowerCase()}`);
    }
  });

  it("fails closed when a secret reference looks like an actual secret value rather than a reference", () => {
    const secretReferences = cleanSecretReferences("staging").map((item) =>
      item.name === "CLAUDE_API_KEY" ? { ...item, reference: "sk-realLookingClaudeKeyValue123" } : item
    );
    const report = evaluateDeploymentReadiness(cleanInput({ secretReferences }));

    expect(report.readyToDeploy).toBe(false);
    expect(report.blockingReasonCodes).toContain("secret_reference_looks_like_secret_value_claude_api_key");
  });

  it("does not require secret references for an environment whose skeleton does not require real secrets", () => {
    const report = evaluateDeploymentReadiness(
      cleanInput({
        targetEnvironment: "development",
        liveTradingSignal: { liveTradingEnabled: false, appEnv: "development" },
        secretReferences: undefined
      })
    );

    expect(report.blockingReasonCodes).not.toContain("missing_secret_references");
  });

  it("never sets readyToDeploy to true when any blocking reason code is present", () => {
    const report = evaluateDeploymentReadiness(cleanInput({ rollbackPlanReference: undefined }));

    expect(report.blockingReasonCodes.length).toBeGreaterThan(0);
    expect(report.readyToDeploy).toBe(false);
  });

  it("sorts blocking reason codes deterministically", () => {
    const report = evaluateDeploymentReadiness(
      cleanInput({ rollbackPlanReference: undefined, backupRestoreGateReference: undefined })
    );

    const sorted = [...report.blockingReasonCodes].sort();
    expect(report.blockingReasonCodes).toEqual(sorted);
  });
});
