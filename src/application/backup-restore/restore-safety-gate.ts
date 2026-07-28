export type RestoreSafetyStatus = "READY" | "BLOCKED";

export interface RestoreSafetyChecklist {
  backupManifestVerified: boolean;
  schemaVersionVerified: boolean;
  configVersionsVerified: boolean;
  auditContinuityVerified: boolean;
  secretsHandledSeparately: boolean;
  reconciliationClean: boolean;
  dataQualityAllowsTrading: boolean;
  killSwitchAvailable: boolean;
  operatorApprovalRecorded: boolean;
}

export interface RestoreSafetyGateInput {
  restoreId: string;
  checklist: RestoreSafetyChecklist;
  checkedAt: Date;
}

export interface RestoreSafetyGateResult {
  restoreId: string;
  status: RestoreSafetyStatus;
  tradingResumeAllowed: boolean;
  reasonCodes: string[];
  checkedAt: Date;
  safetyType: "RESTORE_SAFETY_GATE_DECISION_ONLY";
}

export class RestoreSafetyGate {
  evaluate(input: RestoreSafetyGateInput): RestoreSafetyGateResult {
    const reasonCodes = restoreBlocks(input.checklist);
    const tradingResumeAllowed = reasonCodes.length === 0;

    return {
      restoreId: input.restoreId,
      status: tradingResumeAllowed ? "READY" : "BLOCKED",
      tradingResumeAllowed,
      reasonCodes,
      checkedAt: input.checkedAt,
      safetyType: "RESTORE_SAFETY_GATE_DECISION_ONLY"
    };
  }
}

function restoreBlocks(checklist: RestoreSafetyChecklist): string[] {
  const reasonCodes: string[] = [];

  if (!checklist.backupManifestVerified) reasonCodes.push("backup_manifest_not_verified");
  if (!checklist.schemaVersionVerified) reasonCodes.push("schema_version_not_verified");
  if (!checklist.configVersionsVerified) reasonCodes.push("config_versions_not_verified");
  if (!checklist.auditContinuityVerified) reasonCodes.push("audit_continuity_not_verified");
  if (!checklist.secretsHandledSeparately) reasonCodes.push("secrets_not_handled_separately");
  if (!checklist.reconciliationClean) reasonCodes.push("reconciliation_not_clean_after_restore");
  if (!checklist.dataQualityAllowsTrading) reasonCodes.push("data_quality_blocks_after_restore");
  if (!checklist.killSwitchAvailable) reasonCodes.push("kill_switch_not_available_after_restore");
  if (!checklist.operatorApprovalRecorded) reasonCodes.push("operator_approval_not_recorded_after_restore");

  return reasonCodes.sort();
}
