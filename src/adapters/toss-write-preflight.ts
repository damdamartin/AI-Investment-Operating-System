/**
 * Phase 9 round 1 no-write preflight artifact — NOT a live-trading
 * implementation, and NOT itself a write-adapter.
 *
 * This file adds a pure, no-write preflight evaluator that checks whether
 * the prerequisites described in `docs/phase7/toss-write-contract-design.md`
 * would be satisfied before any *future*, separately reviewed
 * `TossSecuritiesAdapter` write implementation could legitimately become
 * callable. It sits alongside the existing compile-time-uncallable design
 * contract in `src/adapters/toss-write-contract.ts` (not modified by this
 * file — see that file's header for why every write method there is typed
 * `command: never`).
 *
 * `evaluateTossWritePreflight` is a pure, synchronous, data-in/report-out
 * function:
 *
 * - Every input (live-blocker evidence summaries, the
 *   `BrokerWriteCommandGuard` result, kill-switch recheck state,
 *   reconciliation freshness, and the four policy attestations) is supplied
 *   by the caller as plain data. Nothing here fetches, computes, or infers
 *   any of these facts from a live source, a database, or the network.
 * - It never constructs, returns, or references a callable adapter, and it
 *   never calls Toss, under any flag or condition.
 * - It fails closed: any missing, malformed, or not-yet-satisfied input
 *   produces a non-empty `blockingReasons` list and `ready: false`. A
 *   permissive result requires every check to be explicitly satisfied by
 *   the caller-supplied data; there is no default-allow path.
 * - `liveBrokerWriteAllowed` in the returned result is a hardcoded literal
 *   `false`, exactly like the existing convention in
 *   `TossReadOnlyHttpClient`, `BrokerWriteCommandGuardResult`'s sibling
 *   contracts, and `TOSS_FUTURE_WRITE_CONTRACT_SAFETY_REPORT`. It is never
 *   computed from `ready`, so a caller cannot flip it to `true` by
 *   supplying favorable-looking evidence — this module has no branch that
 *   ever produces `liveBrokerWriteAllowed: true`.
 *
 * This file intentionally contains:
 * - no `fetch`, HTTP client, axios, undici, or any network code;
 * - no request body builder for a real order (not even unused);
 * - no `process.env` read;
 * - no `.env` or `tmp/phase5` read;
 * - no `liveBrokerWriteAllowed: true` anywhere;
 * - no weakening of, or alternate path around, `BrokerWriteCommandGuard`
 *   (that guard's result is only ever consumed here as caller-supplied
 *   input, never re-implemented, re-derived, or bypassed).
 *
 * `src/application/broker-write-guard/broker-write-command-guard.ts` and
 * `src/adapters/toss-write-contract.ts` are read-only inputs to this file
 * and are not modified by this task.
 */

import type { TossWriteContractKillSwitchRecheck } from "./toss-write-contract.js";
import type {
  BrokerWriteCommandGuardResult,
  BrokerWriteCommandType
} from "../application/broker-write-guard/broker-write-command-guard.js";
import type { ReconciliationReport } from "../application/reconciliation/reconciliation-service.js";

/**
 * The complete, closed set of live-capable blockers this preflight checks
 * for human-reviewed evidence, mirroring the summary table in
 * `docs/phase7/live-capable-blocker-register.md`. This list is hardcoded
 * and not derived from any file read at runtime — the register document is
 * a human-maintained artifact, not a data source this evaluator loads.
 */
export type TossWritePreflightLiveBlockerId =
  | "LCB-001"
  | "LCB-002"
  | "LCB-003"
  | "LCB-004"
  | "LCB-005"
  | "LCB-006"
  | "LCB-007"
  | "LCB-008";

export const TOSS_WRITE_PREFLIGHT_REQUIRED_LIVE_BLOCKER_IDS = [
  "LCB-001",
  "LCB-002",
  "LCB-003",
  "LCB-004",
  "LCB-005",
  "LCB-006",
  "LCB-007",
  "LCB-008"
] as const satisfies readonly TossWritePreflightLiveBlockerId[];

/** Default maximum age of a reconciliation report before it is treated as stale for preflight purposes. */
export const TOSS_WRITE_PREFLIGHT_DEFAULT_MAX_RECONCILIATION_AGE_MS = 5 * 60 * 1000;

/**
 * Default maximum age of a kill-switch recheck before it is treated as
 * stale. This is intentionally much shorter than the reconciliation window
 * because `docs/phase7/toss-write-contract-design.md` Section 6 requires
 * the kill-switch state to be re-read "immediately before" submission, not
 * merely within the last few minutes.
 */
export const TOSS_WRITE_PREFLIGHT_DEFAULT_MAX_KILL_SWITCH_RECHECK_AGE_MS = 5 * 1000;

/**
 * A caller-supplied summary of human-review status for a single `LCB-*`
 * blocker. This is deliberately a narrow, sanitized summary shape — it is
 * not the evidence register itself, and it must never carry account
 * identifiers, credentials, or raw broker payloads. Per
 * `docs/phase7/live-capable-blocker-register.md`, "Human Owner / Reviewer
 * Role: ... Always a human role, never 'AI' or 'Claude'", so
 * `reviewerRole` is checked accordingly (see `reviewerRoleLooksHuman`
 * below).
 */
export interface TossWritePreflightLiveBlockerEvidenceSummary {
  readonly blockerId: TossWritePreflightLiveBlockerId;
  readonly humanReviewed: boolean;
  readonly reviewerRole: string;
  readonly reviewedAt: Date;
}

/**
 * Policy-level attestation that a deterministic, uniquely-constrained
 * `clientOrderId` policy (design doc Section 5) is in place. This is a
 * statement about the *policy*, not a specific command's idempotency key —
 * this evaluator never constructs or inspects a real command.
 */
export interface TossWritePreflightIdempotencyPolicyEvidence {
  readonly policyDocumented: true;
  readonly deterministicPerApprovalPerOperation: boolean;
  readonly uniqueConstraintEnforced: boolean;
  readonly persistedBeforeNetworkAttempt: boolean;
  readonly regeneratedPerNetworkAttempt: boolean;
}

/** Policy-level attestation that redaction requirements (design doc Section 9) are in place. */
export interface TossWritePreflightRedactionPolicyEvidence {
  readonly policyDocumented: true;
  readonly reusesSharedRedactObject: boolean;
  readonly accountIdentifiersMaskedToLastFour: boolean;
  readonly rawPayloadNeverLoggedInline: boolean;
  readonly moneyAmountsCarryCurrency: boolean;
}

/** Policy-level attestation that timeout/no-blind-retry/error-normalization requirements (design doc Sections 7-8) are in place. */
export interface TossWritePreflightErrorNormalizationPolicyEvidence {
  readonly policyDocumented: true;
  readonly usesSharedNormalizedResultTaxonomy: boolean;
  readonly ambiguousOutcomeMapsToUnknown: boolean;
  readonly blindRetryPermitted: boolean;
  readonly requiresReconciliationForcedWhenAmbiguous: boolean;
}

/** Policy-level attestation that raw broker payloads are never stored unredacted (design doc Section 9). */
export interface TossWritePreflightRawPayloadPolicyEvidence {
  readonly policyDocumented: true;
  readonly rawPayloadStorageAllowed: false;
  readonly redactedBeforePersistence: boolean;
}

export interface TossWritePreflightInput {
  /** The time this preflight is being evaluated ("now"). Required to detect stale reconciliation/kill-switch evidence. */
  readonly now?: Date | undefined;
  readonly commandType: BrokerWriteCommandType;
  readonly liveBlockerEvidence?: readonly TossWritePreflightLiveBlockerEvidenceSummary[] | undefined;
  readonly guardResult?: BrokerWriteCommandGuardResult | undefined;
  readonly killSwitch?: TossWriteContractKillSwitchRecheck | undefined;
  readonly reconciliation?: ReconciliationReport | undefined;
  readonly maxReconciliationAgeMs?: number | undefined;
  readonly maxKillSwitchRecheckAgeMs?: number | undefined;
  readonly idempotencyPolicy?: TossWritePreflightIdempotencyPolicyEvidence | undefined;
  readonly redactionPolicy?: TossWritePreflightRedactionPolicyEvidence | undefined;
  readonly errorNormalizationPolicy?: TossWritePreflightErrorNormalizationPolicyEvidence | undefined;
  readonly rawPayloadPolicy?: TossWritePreflightRawPayloadPolicyEvidence | undefined;
}

export interface TossWritePreflightResult {
  readonly ready: boolean;
  readonly commandType: BrokerWriteCommandType;
  readonly blockingReasons: readonly string[];
  readonly checkedAt: Date | undefined;
  /**
   * Hardcoded literal `false`. Never computed from `ready` or any other
   * field. A "ready: true" preflight result is a statement that supplied
   * evidence looks complete — it is never, and must never become, an
   * authorization to perform a live broker write.
   */
  readonly liveBrokerWriteAllowed: false;
  readonly safetyType: "TOSS_WRITE_PREFLIGHT_RESULT";
}

/**
 * Pure, synchronous, no-write preflight evaluator. Never throws on missing
 * or malformed input — every gap is reported as a blocking reason instead,
 * so callers cannot accidentally treat an exception-free call as success.
 */
export function evaluateTossWritePreflight(input: TossWritePreflightInput): TossWritePreflightResult {
  const reasons = [
    ...evaluationTimeReasons(input.now),
    ...liveBlockerEvidenceReasons(input.liveBlockerEvidence, input.now),
    ...guardResultReasons(input.guardResult, input.commandType),
    ...killSwitchReasons(input.killSwitch, input.now, input.maxKillSwitchRecheckAgeMs),
    ...reconciliationReasons(input.reconciliation, input.now, input.maxReconciliationAgeMs),
    ...idempotencyPolicyReasons(input.idempotencyPolicy),
    ...redactionPolicyReasons(input.redactionPolicy),
    ...errorNormalizationPolicyReasons(input.errorNormalizationPolicy),
    ...rawPayloadPolicyReasons(input.rawPayloadPolicy)
  ];

  const blockingReasons = [...new Set(reasons)].sort();

  return {
    ready: blockingReasons.length === 0,
    commandType: input.commandType,
    blockingReasons,
    checkedAt: input.now,
    liveBrokerWriteAllowed: false,
    safetyType: "TOSS_WRITE_PREFLIGHT_RESULT"
  };
}

function evaluationTimeReasons(now: Date | undefined): string[] {
  if (!now || Number.isNaN(now.getTime())) {
    return ["missing_evaluation_time"];
  }
  return [];
}

function liveBlockerEvidenceReasons(
  evidence: readonly TossWritePreflightLiveBlockerEvidenceSummary[] | undefined,
  now: Date | undefined
): string[] {
  if (!evidence || evidence.length === 0) {
    return ["missing_live_blocker_evidence"];
  }

  const reasons: string[] = [];
  const byId = new Map<string, TossWritePreflightLiveBlockerEvidenceSummary>();
  for (const entry of evidence) {
    byId.set(entry.blockerId, entry);
  }

  for (const requiredId of TOSS_WRITE_PREFLIGHT_REQUIRED_LIVE_BLOCKER_IDS) {
    const entry = byId.get(requiredId);
    const prefix = `live_blocker_${requiredId.toLowerCase()}`;

    if (!entry) {
      reasons.push(`${prefix}_missing`);
      continue;
    }
    if (entry.humanReviewed !== true) {
      reasons.push(`${prefix}_not_human_reviewed`);
    }
    if (!entry.reviewerRole || entry.reviewerRole.trim().length === 0) {
      reasons.push(`${prefix}_missing_reviewer_role`);
    } else if (!reviewerRoleLooksHuman(entry.reviewerRole)) {
      reasons.push(`${prefix}_reviewer_role_not_human`);
    }
    if (!entry.reviewedAt || Number.isNaN(entry.reviewedAt.getTime())) {
      reasons.push(`${prefix}_missing_reviewed_at`);
    } else if (now && !Number.isNaN(now.getTime()) && entry.reviewedAt.getTime() > now.getTime()) {
      reasons.push(`${prefix}_reviewed_at_in_future`);
    }
  }

  return reasons;
}

const FORBIDDEN_REVIEWER_ROLE_TOKENS = new Set([
  "ai",
  "claude",
  "bot",
  "assistant",
  "gpt",
  "chatgpt",
  "llm",
  "codex"
]);

/**
 * Defensive check that a reviewer role reads as a human role, matching
 * `docs/phase7/live-capable-blocker-register.md`'s requirement that the
 * Human Owner / Reviewer Role is "Always a human role, never 'AI' or
 * 'Claude'". Tokenizes on non-alphanumeric characters so this cannot be
 * satisfied by embedding a forbidden word inside an otherwise human-looking
 * role string.
 */
function reviewerRoleLooksHuman(role: string): boolean {
  const tokens = role.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every((token) => !FORBIDDEN_REVIEWER_ROLE_TOKENS.has(token));
}

function guardResultReasons(
  guardResult: BrokerWriteCommandGuardResult | undefined,
  commandType: BrokerWriteCommandType
): string[] {
  if (!guardResult) {
    return ["missing_broker_write_command_guard_result"];
  }

  const reasons: string[] = [];
  if (guardResult.safetyType !== "BROKER_WRITE_COMMAND_GUARD_DECISION") {
    reasons.push("guard_result_wrong_safety_type");
  }
  if (guardResult.commandType !== commandType) {
    reasons.push("guard_result_command_type_mismatch");
  }
  if (guardResult.allowed !== true) {
    reasons.push("guard_result_not_allowed");
  }
  if (guardResult.reasonCodes.length > 0) {
    reasons.push("guard_result_has_reason_codes");
  }
  return reasons;
}

function killSwitchReasons(
  killSwitch: TossWriteContractKillSwitchRecheck | undefined,
  now: Date | undefined,
  maxAgeMsOverride: number | undefined
): string[] {
  if (!killSwitch) {
    return ["missing_kill_switch_recheck"];
  }

  const reasons: string[] = [];
  if (killSwitch.checkedImmediatelyBeforeSubmission !== true) {
    reasons.push("kill_switch_not_rechecked_immediately_before_submission");
  }
  if (killSwitch.active) {
    reasons.push(`kill_switch_active_${killSwitch.scope.toLowerCase()}`);
  }

  if (!killSwitch.checkedAt || Number.isNaN(killSwitch.checkedAt.getTime())) {
    reasons.push("kill_switch_recheck_missing_checked_at");
  } else if (now && !Number.isNaN(now.getTime())) {
    const ageMs = now.getTime() - killSwitch.checkedAt.getTime();
    const maxAgeMs = maxAgeMsOverride ?? TOSS_WRITE_PREFLIGHT_DEFAULT_MAX_KILL_SWITCH_RECHECK_AGE_MS;
    if (ageMs < 0) reasons.push("kill_switch_recheck_timestamp_in_future");
    else if (ageMs > maxAgeMs) reasons.push("kill_switch_recheck_stale");
  }

  return reasons;
}

function reconciliationReasons(
  reconciliation: ReconciliationReport | undefined,
  now: Date | undefined,
  maxAgeMsOverride: number | undefined
): string[] {
  if (!reconciliation) {
    return ["missing_reconciliation_state"];
  }

  const reasons: string[] = [];
  if (reconciliation.status !== "CLEAN") {
    reasons.push(`reconciliation_${reconciliation.status.toLowerCase()}_not_clean`);
  }
  if (reconciliation.blocksDependentTrading) {
    reasons.push("reconciliation_blocks_dependent_trading");
  }

  if (!reconciliation.checkedAt || Number.isNaN(reconciliation.checkedAt.getTime())) {
    reasons.push("reconciliation_missing_checked_at");
  } else if (now && !Number.isNaN(now.getTime())) {
    const ageMs = now.getTime() - reconciliation.checkedAt.getTime();
    const maxAgeMs = maxAgeMsOverride ?? TOSS_WRITE_PREFLIGHT_DEFAULT_MAX_RECONCILIATION_AGE_MS;
    if (ageMs < 0) reasons.push("reconciliation_timestamp_in_future");
    else if (ageMs > maxAgeMs) reasons.push("reconciliation_stale");
  }

  return reasons;
}

function idempotencyPolicyReasons(policy: TossWritePreflightIdempotencyPolicyEvidence | undefined): string[] {
  if (!policy) {
    return ["missing_idempotency_policy"];
  }

  const reasons: string[] = [];
  if (policy.policyDocumented !== true) reasons.push("idempotency_policy_not_documented");
  if (policy.deterministicPerApprovalPerOperation !== true) reasons.push("idempotency_policy_not_deterministic");
  if (policy.uniqueConstraintEnforced !== true) reasons.push("idempotency_policy_unique_constraint_missing");
  if (policy.persistedBeforeNetworkAttempt !== true) {
    reasons.push("idempotency_policy_not_persisted_before_network_attempt");
  }
  if (policy.regeneratedPerNetworkAttempt !== false) reasons.push("idempotency_policy_regenerates_per_attempt");
  return reasons;
}

function redactionPolicyReasons(policy: TossWritePreflightRedactionPolicyEvidence | undefined): string[] {
  if (!policy) {
    return ["missing_redaction_policy"];
  }

  const reasons: string[] = [];
  if (policy.policyDocumented !== true) reasons.push("redaction_policy_not_documented");
  if (policy.reusesSharedRedactObject !== true) reasons.push("redaction_policy_does_not_reuse_shared_redaction");
  if (policy.accountIdentifiersMaskedToLastFour !== true) {
    reasons.push("redaction_policy_account_identifiers_not_masked");
  }
  if (policy.rawPayloadNeverLoggedInline !== true) {
    reasons.push("redaction_policy_raw_payload_may_be_logged_inline");
  }
  if (policy.moneyAmountsCarryCurrency !== true) reasons.push("redaction_policy_money_amounts_missing_currency");
  return reasons;
}

function errorNormalizationPolicyReasons(
  policy: TossWritePreflightErrorNormalizationPolicyEvidence | undefined
): string[] {
  if (!policy) {
    return ["missing_error_normalization_policy"];
  }

  const reasons: string[] = [];
  if (policy.policyDocumented !== true) reasons.push("error_normalization_policy_not_documented");
  if (policy.usesSharedNormalizedResultTaxonomy !== true) {
    reasons.push("error_normalization_policy_does_not_use_shared_taxonomy");
  }
  if (policy.ambiguousOutcomeMapsToUnknown !== true) {
    reasons.push("error_normalization_policy_ambiguous_outcome_not_mapped_to_unknown");
  }
  if (policy.blindRetryPermitted !== false) reasons.push("error_normalization_policy_permits_blind_retry");
  if (policy.requiresReconciliationForcedWhenAmbiguous !== true) {
    reasons.push("error_normalization_policy_does_not_force_reconciliation_requirement");
  }
  return reasons;
}

function rawPayloadPolicyReasons(policy: TossWritePreflightRawPayloadPolicyEvidence | undefined): string[] {
  if (!policy) {
    return ["missing_raw_payload_policy"];
  }

  const reasons: string[] = [];
  if (policy.policyDocumented !== true) reasons.push("raw_payload_policy_not_documented");
  // Defensive runtime check: the type is a literal `false`, but a caller
  // could still bypass the type checker (e.g. via `as` casts from
  // untyped input). Fail closed if the runtime value is not strictly
  // `false`, never trusting the type alone.
  if ((policy.rawPayloadStorageAllowed as unknown) !== false) {
    reasons.push("raw_payload_storage_allowed");
  }
  if (policy.redactedBeforePersistence !== true) reasons.push("raw_payload_policy_not_redacted_before_persistence");
  return reasons;
}
