import type { AppEnvironment } from "../../config/index.js";
import {
  DeploymentEnvironmentSkeletonService,
  deploymentEnvironmentSkeletons,
  type DeploymentEnvironmentSkeleton
} from "./deployment-environment-skeleton.js";

/**
 * Phase 8 (P8-002): deployment readiness gate.
 *
 * This module is a PURE evaluator, in the same spirit as
 * `src/application/live-readiness/small-capital-readiness.ts`. It has no
 * network code, no filesystem access, no `process.env` reads, no
 * subprocess/exec calls, and no side effects of any kind. It never issues
 * a real cloud deployment command, never touches a real cloud provider,
 * and never enables live trading. It only reads already-computed,
 * caller-supplied signals (environment skeletons, runbook reference
 * facts, rollback/backup/observability reference facts, and secret
 * *references* — never secret values) and returns a report describing
 * whether the repository is currently in an OPERATIONAL, no-write
 * deployment-readiness state.
 *
 * Two concepts that must never be conflated (per `docs/phase8/README.md`,
 * "Forbidden in Phase 8": "treating dashboard/API status as live-trading
 * authorization"):
 *
 * 1. `readyToDeploy` — whether the *code and documentation* referenced by
 *    the supplied signals are in a deployable, no-write operational state
 *    (runbooks referenced, rollback plan referenced, backup/restore gate
 *    referenced, observability/alerting referenced, secrets present only
 *    as references, environment skeleton valid).
 * 2. Live-trading authorization — an entirely separate concept, governed
 *    by `src/application/live-readiness/small-capital-readiness.ts` and
 *    ultimately by human-recorded decisions in
 *    `docs/phase7/live-capable-blocker-register.md` and
 *    `docs/phase7/manual-live-approval-record.md`. This module exports no
 *    type or function that can grant, compute, or imply that
 *    authorization. `liveBrokerWriteAllowed` on the report below is a
 *    literal `false`, mirroring `ReconciliationWorkflowResult`,
 *    `Phase6OperatorSafetyStatus`, `AlertEvent`, and
 *    `SmallCapitalReadinessReport` elsewhere in this codebase, so no
 *    caller can mistake a clean `readyToDeploy: true` reading for live
 *    trading being enabled.
 *
 * Deliberate design choices that keep this evaluator from ever being able
 * to authorize itself or perform a real deployment action:
 *
 * - Every "reference exists" fact (runbook, rollback plan, backup/restore
 *   gate, observability/alerting, secret) is supplied by the caller as a
 *   plain data fact (`{ reference: string; exists: boolean }` or
 *   `{ name: string; reference: string }`). This module performs no
 *   filesystem stat, no `require.resolve`, and no network fetch to
 *   determine those facts itself — it only validates the *shape* of what
 *   it is given (non-blank, not secret-looking, matches the expected
 *   catalog) and fails closed when a fact is missing.
 * - Secret entries are validated as references only. This module never
 *   accepts, reads, or reports an actual secret value; any input that
 *   looks like a real secret/token/password is treated as a blocking
 *   condition, exactly like `deployment-environment-skeleton.ts` already
 *   does for skeleton secret references.
 * - `liveTradingEnabled` in the supplied signal must equal literal
 *   `false`; any other value blocks readiness rather than being passed
 *   through. This gate cannot flip `liveBrokerWriteAllowed` to `true`
 *   directly or indirectly, because it never reads that flag into its
 *   output at all — the output field is a hardcoded literal.
 * - Every check fails closed: a missing or malformed input is treated as
 *   a blocking condition, never as "assume ready."
 */

// ---------------------------------------------------------------------------
// Reference fact types (caller-supplied; this module performs no I/O)
// ---------------------------------------------------------------------------

/**
 * A caller-supplied fact about a single non-secret reference (a doc path,
 * an anchor, or similar locator). `exists` is a fact the caller determined
 * outside of this module (for example, by checking the repository on
 * disk); this evaluator never performs that check itself.
 */
export interface DeploymentReadinessReferenceFact {
  /** Non-secret, human-readable locator, e.g. "docs/runbooks/Incident_Runbooks.md#rotate-api-secret". */
  reference: string;
  /** Caller-confirmed: does this reference currently resolve? */
  exists: boolean;
}

/**
 * Required operational runbook identifiers, matching
 * `docs/09_Operation_Deployment.md` Section 18 ("Operational Runbooks")
 * exactly. This catalog is a fixed module constant, not caller-supplied
 * policy, so a caller cannot weaken the gate by omitting an entry from a
 * shorter required list.
 */
export const REQUIRED_DEPLOYMENT_RUNBOOK_IDS = Object.freeze([
  "activate_global_kill_switch",
  "deactivate_kill_switch",
  "handle_unknown_broker_order_state",
  "handle_duplicate_order_risk",
  "handle_toss_api_outage",
  "handle_naver_api_outage",
  "handle_claude_api_outage",
  "handle_stale_market_data",
  "handle_reconciliation_mismatch",
  "rotate_api_secret",
  "restore_database_backup",
  "rollback_deployment",
  "pause_strategy",
  "retire_strategy",
  "increase_capital_limit"
] as const);
export type DeploymentReadinessRunbookId = (typeof REQUIRED_DEPLOYMENT_RUNBOOK_IDS)[number];

export interface DeploymentReadinessRunbookReference extends DeploymentReadinessReferenceFact {
  runbookId: DeploymentReadinessRunbookId;
}

/**
 * Required secret names, matching `ExternalSecrets` in
 * `src/config/environment.ts`. This gate never reads `process.env` and
 * never accepts an actual secret value here — only a reference string
 * (for example `"secret-ref:toss-client-secret-production"`), matching
 * the convention already used by
 * `deployment-environment-skeleton.ts`.
 */
export const REQUIRED_DEPLOYMENT_SECRET_NAMES = Object.freeze([
  "TOSS_CLIENT_ID",
  "TOSS_CLIENT_SECRET",
  "TOSS_ACCOUNT_REF",
  "NAVER_CLIENT_ID",
  "NAVER_CLIENT_SECRET",
  "CLAUDE_API_KEY"
] as const);
export type DeploymentReadinessSecretName = (typeof REQUIRED_DEPLOYMENT_SECRET_NAMES)[number];

export interface DeploymentReadinessSecretReference {
  name: DeploymentReadinessSecretName;
  /** A reference locator only, e.g. "secret-ref:claude-api-key-production". Never the secret value. */
  reference: string;
}

/** Mirrors the `liveTradingEnabled` shape of `AppConfig` without importing runtime config-loading behavior. */
export interface DeploymentReadinessLiveTradingSignal {
  liveTradingEnabled: boolean;
  appEnv: AppEnvironment;
}

/**
 * A caller-supplied summary of production live-trading blocker status,
 * expected to reference `docs/phase7/live-capable-blocker-register.md`.
 * This evaluator does not read that register itself and does not decide
 * whether any blocker is resolved — it only checks that an explicit,
 * recognizable blocker-status reference has been supplied for a
 * production deployment target.
 */
export interface DeploymentReadinessProductionBlockerStatus {
  registerReferenced: boolean;
  reference: string;
  /** Count of blocker entries not currently `RESOLVED`, per the register's status model. */
  openBlockerCount: number;
}

export interface DeploymentReadinessInput {
  /** Evaluation time. Required; used for report timestamping and freshness of the evaluation itself. */
  now: Date;
  targetEnvironment: AppEnvironment;
  /** Defaults to the real `deploymentEnvironmentSkeletons` catalog if omitted. */
  environmentSkeletons?: DeploymentEnvironmentSkeleton[] | undefined;
  liveTradingSignal?: DeploymentReadinessLiveTradingSignal | undefined;
  /** Required only when `targetEnvironment === "production"`. */
  productionBlockerStatus?: DeploymentReadinessProductionBlockerStatus | undefined;
  runbookReferences?: DeploymentReadinessRunbookReference[] | undefined;
  rollbackPlanReference?: DeploymentReadinessReferenceFact | undefined;
  backupRestoreGateReference?: DeploymentReadinessReferenceFact | undefined;
  observabilityAlertingReference?: DeploymentReadinessReferenceFact | undefined;
  secretReferences?: DeploymentReadinessSecretReference[] | undefined;
}

// ---------------------------------------------------------------------------
// Output type
// ---------------------------------------------------------------------------

export interface DeploymentReadinessReport {
  /**
   * True only when every no-write operational deployment-readiness gate
   * currently passes. This is a design-time readiness signal about code
   * and documentation state ONLY. It is NOT live-trading authorization
   * and never triggers any deployment action on its own — this evaluator
   * never runs a deployment command.
   */
  readyToDeploy: boolean;
  targetEnvironment: AppEnvironment;
  blockingReasonCodes: string[];
  warnings: string[];
  /**
   * Always literal `false`. This field exists specifically so no caller
   * can mistake a clean `readyToDeploy: true` reading for live trading
   * being enabled. See the module docstring for why this evaluator can
   * never compute anything other than `false` here.
   */
  liveBrokerWriteAllowed: false;
  generatedAt: Date;
  safetyType: "DEPLOYMENT_READINESS_REPORT_EVALUATION_ONLY";
}

// ---------------------------------------------------------------------------
// Evaluator
// ---------------------------------------------------------------------------

export function evaluateDeploymentReadiness(input: DeploymentReadinessInput): DeploymentReadinessReport {
  const blockingReasonCodes = new Set<string>();
  const warnings: string[] = [];

  if (!input.now || Number.isNaN(input.now.getTime())) {
    blockingReasonCodes.add("missing_or_invalid_evaluation_time");
  }

  const skeletons = input.environmentSkeletons ?? deploymentEnvironmentSkeletons;
  const targetSkeleton = checkEnvironmentSkeleton(input.targetEnvironment, skeletons, blockingReasonCodes);
  checkLiveTradingSignal(input.targetEnvironment, input.liveTradingSignal, blockingReasonCodes);
  checkProductionBlockerStatus(
    input.targetEnvironment,
    input.productionBlockerStatus,
    blockingReasonCodes,
    warnings
  );
  checkRunbookReferences(input.runbookReferences, blockingReasonCodes);
  checkReferenceFact(input.rollbackPlanReference, "rollback_plan", blockingReasonCodes);
  checkReferenceFact(input.backupRestoreGateReference, "backup_restore_gate", blockingReasonCodes);
  checkReferenceFact(input.observabilityAlertingReference, "observability_alerting", blockingReasonCodes);
  checkSecretReferences(targetSkeleton?.requiresRealSecrets ?? true, input.secretReferences, blockingReasonCodes);

  return {
    readyToDeploy: blockingReasonCodes.size === 0,
    targetEnvironment: input.targetEnvironment,
    blockingReasonCodes: [...blockingReasonCodes].sort(),
    warnings,
    liveBrokerWriteAllowed: false,
    generatedAt: input.now,
    safetyType: "DEPLOYMENT_READINESS_REPORT_EVALUATION_ONLY"
  };
}

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

function checkEnvironmentSkeleton(
  targetEnvironment: AppEnvironment,
  skeletons: DeploymentEnvironmentSkeleton[],
  reasons: Set<string>
): DeploymentEnvironmentSkeleton | undefined {
  const validation = new DeploymentEnvironmentSkeletonService().validate(skeletons);
  if (!validation.ok) {
    for (const code of validation.reasonCodes) reasons.add(`skeleton_${code}`);
  }

  const target = skeletons.find((item) => item.name === targetEnvironment);
  if (!target) {
    reasons.add(`missing_environment_skeleton_${targetEnvironment}`);
    return undefined;
  }

  return target;
}

function checkLiveTradingSignal(
  targetEnvironment: AppEnvironment,
  signal: DeploymentReadinessLiveTradingSignal | undefined,
  reasons: Set<string>
): void {
  if (!signal) {
    reasons.add("missing_live_trading_signal");
    return;
  }

  if (signal.liveTradingEnabled !== false) {
    reasons.add("live_trading_enabled_blocks_deployment_readiness");
  }

  if (signal.appEnv !== targetEnvironment) {
    reasons.add("live_trading_signal_environment_mismatch");
  }
}

const PRODUCTION_BLOCKER_REGISTER_REFERENCE_MARKER = "live-capable-blocker-register";

function checkProductionBlockerStatus(
  targetEnvironment: AppEnvironment,
  status: DeploymentReadinessProductionBlockerStatus | undefined,
  reasons: Set<string>,
  warnings: string[]
): void {
  if (targetEnvironment !== "production") {
    if (status && (!status.registerReferenced || !status.reference?.trim())) {
      warnings.push("production_blocker_status_reference_incomplete_non_production");
    }
    return;
  }

  if (!status) {
    reasons.add("missing_production_blocker_status_reference");
    return;
  }

  if (!status.registerReferenced || !status.reference || !status.reference.trim()) {
    reasons.add("production_blocker_status_reference_missing");
  } else if (!status.reference.includes(PRODUCTION_BLOCKER_REGISTER_REFERENCE_MARKER)) {
    reasons.add("production_blocker_status_reference_not_recognized");
  }

  if (!Number.isFinite(status.openBlockerCount) || status.openBlockerCount < 0) {
    reasons.add("production_blocker_status_invalid_open_blocker_count");
  }
}

function checkRunbookReferences(
  entries: DeploymentReadinessRunbookReference[] | undefined,
  reasons: Set<string>
): void {
  const byId = new Map((entries ?? []).map((entry) => [entry.runbookId, entry]));

  for (const runbookId of REQUIRED_DEPLOYMENT_RUNBOOK_IDS) {
    const entry = byId.get(runbookId);
    if (!entry) {
      reasons.add(`missing_runbook_reference_${runbookId}`);
      continue;
    }
    checkReferenceFact(entry, `runbook_${runbookId}`, reasons);
  }
}

function checkReferenceFact(
  fact: DeploymentReadinessReferenceFact | undefined,
  label: string,
  reasons: Set<string>
): void {
  if (!fact) {
    reasons.add(`missing_${label}_reference`);
    return;
  }

  if (!fact.reference || !fact.reference.trim()) {
    reasons.add(`${label}_reference_blank`);
  } else if (looksLikeSecretValue(fact.reference)) {
    reasons.add(`${label}_reference_looks_like_secret_value`);
  }

  if (!fact.exists) {
    reasons.add(`${label}_reference_not_found`);
  }
}

function checkSecretReferences(
  requiresRealSecrets: boolean,
  secretReferences: DeploymentReadinessSecretReference[] | undefined,
  reasons: Set<string>
): void {
  if (!requiresRealSecrets) return;

  if (!secretReferences || secretReferences.length === 0) {
    reasons.add("missing_secret_references");
    return;
  }

  const byName = new Map(secretReferences.map((entry) => [entry.name, entry]));

  for (const requiredName of REQUIRED_DEPLOYMENT_SECRET_NAMES) {
    const entry = byName.get(requiredName);
    if (!entry) {
      reasons.add(`missing_secret_reference_${requiredName.toLowerCase()}`);
      continue;
    }
    if (!entry.reference || !entry.reference.trim()) {
      reasons.add(`secret_reference_blank_${requiredName.toLowerCase()}`);
    } else if (looksLikeSecretValue(entry.reference)) {
      reasons.add(`secret_reference_looks_like_secret_value_${requiredName.toLowerCase()}`);
    }
  }
}

/**
 * Heuristic-only guard against an actual secret value being passed as a
 * "reference". Mirrors the equivalent private check in
 * `deployment-environment-skeleton.ts`; duplicated locally (rather than
 * imported) because that module does not export it and this task does not
 * modify that file. Kept intentionally conservative and read-only: it
 * never reads `process.env`, never reads a real secret, and only pattern
 * matches the string it was given.
 */
function looksLikeSecretValue(value: string): boolean {
  return (
    /sk-[A-Za-z0-9_-]+|token[=:]|password[=:]|bearer\s+[A-Za-z0-9._-]+/i.test(value) ||
    /^[A-Za-z0-9+/]{32,}={0,2}$/.test(value.trim())
  );
}
