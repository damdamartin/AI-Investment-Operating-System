import { TOSS_FUTURE_WRITE_CONTRACT_FORBIDDEN_OPERATIONS } from "../../adapters/toss-write-contract.js";
import type { TossFutureWriteContractSafetyReport } from "../../adapters/toss-write-contract.js";
import type { TossWritePreflightResult } from "../../adapters/toss-write-preflight.js";
import type { BrokerWriteCommandGuardResult } from "../broker-write-guard/broker-write-command-guard.js";
import type { SmallCapitalEnablementGateReport } from "./small-capital-enablement-gate.js";

/**
 * Phase 10 round 1 (P10-003) runtime lock and audit gate — NOT a live-trading
 * implementation, NOT itself a broker-write adapter, and NOT a replacement
 * for `BrokerWriteCommandGuard` or the Phase 7/9 write-contract artifacts.
 *
 * `evaluateRuntimeLiveLockGate` is a pure, synchronous, data-in/report-out
 * function. See `docs/phase10/runtime-live-lock-gate.md` for the full design
 * rationale. In one sentence: it exists to prove — and to keep proving on
 * every future call, via `tests/application/runtime-live-lock-gate.test.ts`
 * and `tests/safety/safety-regression.test.ts` — that the application
 * remains structurally unable to perform a live broker write, no matter how
 * favorable (or how deliberately tampered) the evidence handed to it is.
 *
 * Structural guarantees:
 *
 * - `runtimeWriteLockEngaged` is a literal `true` return value and
 *   `liveBrokerWriteAllowed` is a literal `false` return value. Neither is
 *   ever computed from `input`, from `blockingAnomalyReasonCodes`, or from
 *   any combination of upstream evidence. Search this file: there is no
 *   branch, ternary, or expression anywhere that can produce a different
 *   value for either field. They are written as bare literals at the single
 *   return site in `evaluateRuntimeLiveLockGate`, exactly once.
 * - This holds even when every upstream signal supplied to this gate is
 *   maximally favorable — including a real `BrokerWriteCommandGuard` result
 *   that itself legitimately evaluates to `allowed: true` under a
 *   permissive, fully-passing input. `BrokerWriteCommandGuard` is designed
 *   to return `allowed: true` once every one of its own gates genuinely
 *   passes (that is its whole purpose, for a future, separately approved
 *   live phase); this module treats that specific case as a reportable
 *   `blockingAnomalyReasonCodes` entry during Phase 10 round 1 (fail closed,
 *   `docs/11_AI_RULES.md` Rule 22; surface rather than hide, Rule 29), but
 *   it never lets that case change this gate's own hardcoded output.
 * - It also holds when a caller hands this gate a deliberately tampered
 *   `liveBrokerWriteAllowed: true`-shaped signal — whether that is a
 *   hand-constructed `TossFutureWriteContractSafetyReport`-lookalike, a
 *   `TossWritePreflightResult`-lookalike, a `SmallCapitalEnablementGateReport`-
 *   lookalike, or an arbitrary caller-supplied "runtime approval"-shaped
 *   object via `runtimeApprovalSignals`. Every one of these is checked
 *   defensively at runtime (never trusting the type system alone, exactly
 *   like the equivalent `(x as unknown) !== false` checks already
 *   established in `small-capital-enablement-gate.ts` and
 *   `toss-write-preflight.ts`), and any violation is recorded as a
 *   `blockingAnomalyReasonCodes` entry — detected and reported, never
 *   silently trusted — while this gate's own output stays the same
 *   hardcoded `false`/`true` pair regardless.
 * - This module never constructs, returns, or references a callable
 *   `TossSecuritiesAdapter` or any write method. It never imports or
 *   re-implements `BrokerWriteCommandGuard`'s own decision logic — a
 *   `BrokerWriteCommandGuardResult` is only ever consumed here as
 *   caller-supplied input, produced elsewhere by the real guard.
 * - Every check fails closed: a missing evaluation time, a missing
 *   `BrokerWriteCommandGuardResult`, or a missing
 *   `TossFutureWriteContractSafetyReport` is always a blocking condition,
 *   never "assume clean." `TossWritePreflightResult` and
 *   `SmallCapitalEnablementGateReport` are optional supplementary evidence —
 *   their absence is not itself an anomaly, but if supplied, they are still
 *   checked defensively.
 * - The returned `auditSummary` is sanitized and evidence-only: it carries
 *   only booleans and counts derived from the supplied evidence, never a raw
 *   upstream object, never an account identifier, never a secret, and never
 *   a function value. Both the top-level report and `auditSummary` are
 *   `Object.freeze`d before being returned, mirroring the same
 *   tamper-resistance convention already used by
 *   `TOSS_FUTURE_WRITE_CONTRACT_SAFETY_REPORT`.
 *
 * This file intentionally contains:
 * - no `fetch`, HTTP client, axios, undici, or any network code;
 * - no order endpoint call, request body builder for a real order (not even
 *   unused), or broker payload of any kind;
 * - no `process.env` read;
 * - no `.env` or `tmp/phase5` read;
 * - no `liveBrokerWriteAllowed: true` anywhere;
 * - no weakening of, or alternate path around, `BrokerWriteCommandGuard`,
 *   `src/adapters/toss-write-contract.ts`, or `src/adapters/toss-write-preflight.ts`
 *   (all three are read-only inputs to this file and are not modified by
 *   this task).
 *
 * `src/application/broker-write-guard/broker-write-command-guard.ts`,
 * `src/adapters/toss-write-contract.ts`, `src/adapters/toss-write-preflight.ts`,
 * and `src/application/live-readiness/small-capital-enablement-gate.ts` are
 * read-only inputs to this file and are not modified by this task.
 */

/**
 * A single caller-supplied "runtime approval"-shaped claim — for example the
 * kind of object a future, separately reviewed live-operation approval
 * packet or first-trade operating protocol record might resemble. This type
 * is intentionally narrow and local (see the module docstring above): it is
 * not coupled to any other engineer's in-flight Phase 10 module, so this
 * file never imports, and never needs to import, `live-operation-approval-
 * packet.ts` or `first-trade-operating-protocol.ts`. Any object that is
 * structurally compatible with this shape can be passed in, tampered or not.
 */
export interface RuntimeLiveLockGateApprovalSignal {
  /**
   * Caller-supplied claim about live-broker-write authorization. Never
   * trusted. Checked defensively at runtime and must be strictly `false` —
   * anything else (including `true`, `"true"`, `1`, or a missing value) is
   * treated as tampered evidence and recorded in
   * `blockingAnomalyReasonCodes`.
   */
  readonly claimedLiveBrokerWriteAllowed: unknown;
  /**
   * Caller-supplied claim that "everything is resolved" (e.g. every
   * `LCB-*` blocker, every approval step). Never trusted as an
   * authorization signal and never affects this gate's output; recorded
   * only as an informational warning for audit visibility.
   */
  readonly claimedFullyResolved?: unknown;
}

export interface RuntimeLiveLockGateInput {
  /** Evaluation time. Required; used for report timestamping and fail-closed checks. */
  readonly now: Date;
  /**
   * A `BrokerWriteCommandGuardResult` already produced elsewhere by the real
   * `BrokerWriteCommandGuard.evaluate(...)`. Never re-derived, re-implemented,
   * or bypassed here — this gate only consumes an already-computed result.
   */
  readonly brokerWriteGuardResult?: BrokerWriteCommandGuardResult | undefined;
  /**
   * The hardcoded safety report exported by `src/adapters/toss-write-contract.ts`
   * (`TOSS_FUTURE_WRITE_CONTRACT_SAFETY_REPORT`), proving the future Toss
   * write contract remains a design-only, uncallable (`command: never`)
   * surface.
   */
  readonly tossFutureWriteContractSafetyReport?: TossFutureWriteContractSafetyReport | undefined;
  /** Optional Phase 9 no-write preflight result (`src/adapters/toss-write-preflight.ts`). Supplementary evidence only. */
  readonly tossWritePreflightResult?: TossWritePreflightResult | undefined;
  /** Optional Phase 9 small-capital enablement gate report. Supplementary evidence only. */
  readonly smallCapitalEnablementReport?: SmallCapitalEnablementGateReport | undefined;
  /**
   * Zero or more caller-supplied "runtime approval"-shaped signals. Every
   * entry is checked defensively; none can ever flip this gate's own
   * hardcoded output. See `RuntimeLiveLockGateApprovalSignal`.
   */
  readonly runtimeApprovalSignals?: readonly RuntimeLiveLockGateApprovalSignal[] | undefined;
}

/**
 * Sanitized, evidence-only audit summary. Every field is a boolean or a
 * count derived from the supplied evidence — never a raw upstream object,
 * never an account identifier, never a secret, never a function value.
 */
export interface RuntimeLiveLockGateAuditSummary {
  readonly brokerWriteGuardChecked: boolean;
  /** `true` when the supplied guard result currently denies writes, `false` when it currently allows them, `null` when no usable guard result was supplied. */
  readonly brokerWriteGuardCurrentlyDenies: boolean | null;
  readonly tossFutureWriteContractChecked: boolean;
  readonly tossFutureWriteContractNonCallableConfirmed: boolean;
  readonly tossWritePreflightChecked: boolean;
  readonly smallCapitalEnablementChecked: boolean;
  readonly approvalSignalCount: number;
  readonly tamperedApprovalSignalCount: number;
  readonly blockingAnomalyCount: number;
  readonly warningCount: number;
  readonly safetyType: "RUNTIME_LIVE_LOCK_GATE_AUDIT_SUMMARY_EVIDENCE_ONLY";
}

/**
 * The single sentence this gate exists to enforce. Restated verbatim as data
 * on every report, not only in documentation, so a caller reading only the
 * JSON output (for example a dashboard rendering this report, or a log
 * line) still sees it.
 */
export const RUNTIME_LIVE_LOCK_GATE_EVIDENCE_STATEMENT =
  "This report is a runtime evidence check only. It proves the application's " +
  "current write-side gates (BrokerWriteCommandGuard, the future Toss write " +
  "contract) remain checkable and, on the evidence supplied, correctly " +
  "shaped. It is not, and can never become, authorization for a real Toss " +
  "broker write, live order submission, order cancellation or replacement, " +
  "or any capital-moving action. runtimeWriteLockEngaged and " +
  "liveBrokerWriteAllowed are hardcoded literal values in this evaluator's " +
  "implementation; no combination of input evidence -- including a tampered " +
  "or fully 'resolved'-claiming approval signal -- can change them. A " +
  "separate, later, human-reviewed implementation phase is required before " +
  "any real broker write becomes possible.";

export interface RuntimeLiveLockGateReport {
  /**
   * Always literal `true`. Never derived from `input`. See module
   * docstring: this is the runtime lock the module exists to prove is
   * engaged, restated as data on every report.
   */
  readonly runtimeWriteLockEngaged: true;
  /**
   * Always literal `false`. Never derived from `input`, including a
   * maximally clean input or a tampered input claiming `true`. See module
   * docstring.
   */
  readonly liveBrokerWriteAllowed: false;
  /** Namespaced, deduplicated, sorted anomaly reason codes — missing evidence, malformed evidence, or detected tampering. */
  readonly blockingAnomalyReasonCodes: readonly string[];
  /** Informational-only notes that do not block or change this gate's output (e.g. a currently-permissive guard evaluation, or a "fully resolved" claim). */
  readonly warnings: readonly string[];
  readonly auditSummary: RuntimeLiveLockGateAuditSummary;
  /** Verbatim copy of `RUNTIME_LIVE_LOCK_GATE_EVIDENCE_STATEMENT`. */
  readonly evidenceOnlyStatement: string;
  readonly generatedAt: Date;
  readonly safetyType: "RUNTIME_LIVE_LOCK_GATE_REPORT_EVIDENCE_ONLY";
}

/**
 * Pure, synchronous, no-write runtime lock and audit evaluator. Never
 * throws on missing or malformed input — every gap or anomaly is reported
 * in `blockingAnomalyReasonCodes` instead. Makes no network call, reads no
 * file, and reads no environment variable; it only inspects the plain data
 * handed to it by the caller.
 */
export function evaluateRuntimeLiveLockGate(input: RuntimeLiveLockGateInput): RuntimeLiveLockGateReport {
  const blocking = new Set<string>();
  const warnings: string[] = [];

  if (!input.now || Number.isNaN(input.now.getTime())) {
    blocking.add("missing_or_invalid_evaluation_time");
  }

  const guardView = evaluateGuardEvidence(input.brokerWriteGuardResult, blocking);
  const contractView = evaluateContractEvidence(input.tossFutureWriteContractSafetyReport, blocking);
  evaluatePreflightEvidence(input.tossWritePreflightResult, blocking);
  evaluateEnablementEvidence(input.smallCapitalEnablementReport, blocking);
  const approvalView = evaluateApprovalSignals(input.runtimeApprovalSignals, blocking, warnings);

  const blockingAnomalyReasonCodes = Object.freeze([...blocking].sort());
  const sortedWarnings = Object.freeze([...warnings].sort());

  const auditSummary: RuntimeLiveLockGateAuditSummary = Object.freeze({
    brokerWriteGuardChecked: input.brokerWriteGuardResult !== undefined,
    brokerWriteGuardCurrentlyDenies: guardView.currentlyDenies,
    tossFutureWriteContractChecked: input.tossFutureWriteContractSafetyReport !== undefined,
    tossFutureWriteContractNonCallableConfirmed: contractView.nonCallableConfirmed,
    tossWritePreflightChecked: input.tossWritePreflightResult !== undefined,
    smallCapitalEnablementChecked: input.smallCapitalEnablementReport !== undefined,
    approvalSignalCount: approvalView.total,
    tamperedApprovalSignalCount: approvalView.tampered,
    blockingAnomalyCount: blockingAnomalyReasonCodes.length,
    warningCount: sortedWarnings.length,
    safetyType: "RUNTIME_LIVE_LOCK_GATE_AUDIT_SUMMARY_EVIDENCE_ONLY"
  });

  return Object.freeze({
    runtimeWriteLockEngaged: true,
    liveBrokerWriteAllowed: false,
    blockingAnomalyReasonCodes,
    warnings: sortedWarnings,
    auditSummary,
    evidenceOnlyStatement: RUNTIME_LIVE_LOCK_GATE_EVIDENCE_STATEMENT,
    generatedAt: input.now,
    safetyType: "RUNTIME_LIVE_LOCK_GATE_REPORT_EVIDENCE_ONLY"
  });
}

function evaluateGuardEvidence(
  guardResult: BrokerWriteCommandGuardResult | undefined,
  blocking: Set<string>
): { currentlyDenies: boolean | null } {
  if (!guardResult) {
    blocking.add("missing_broker_write_guard_result");
    return { currentlyDenies: null };
  }

  if (guardResult.safetyType !== "BROKER_WRITE_COMMAND_GUARD_DECISION") {
    blocking.add("broker_write_guard_result_wrong_safety_type");
  }

  if (typeof guardResult.allowed !== "boolean") {
    blocking.add("broker_write_guard_result_allowed_not_boolean");
    return { currentlyDenies: null };
  }

  if (guardResult.allowed) {
    // Not itself proof of a defect: BrokerWriteCommandGuard is designed to
    // return `allowed: true` once every one of its own gates genuinely
    // passes, which is expected behavior in a future, separately approved
    // live phase. During Phase 10 round 1 this is still surfaced as a
    // blocking anomaly so a human reviewer sees it (docs/11_AI_RULES.md
    // Rule 22 fail-closed, Rule 29 do-not-hide-behavior) -- it never changes
    // this gate's own hardcoded `liveBrokerWriteAllowed` / `runtimeWriteLockEngaged` output.
    blocking.add("broker_write_guard_currently_allows_writes");
  }

  return { currentlyDenies: !guardResult.allowed };
}

function evaluateContractEvidence(
  report: TossFutureWriteContractSafetyReport | undefined,
  blocking: Set<string>
): { nonCallableConfirmed: boolean } {
  if (!report) {
    blocking.add("missing_toss_future_write_contract_safety_report");
    return { nonCallableConfirmed: false };
  }

  let confirmed = true;

  if (report.safetyType !== "TOSS_FUTURE_WRITE_CONTRACT_REPORT") {
    blocking.add("toss_future_write_contract_report_wrong_safety_type");
    confirmed = false;
  }

  // Defensive runtime check: the field's type is a literal `false`, but a
  // caller could still bypass the type checker (e.g. via `as` casts from
  // untyped input). Fail closed if the runtime value is not strictly
  // `false`, never trusting the type alone -- mirrors the same pattern
  // already used in src/adapters/toss-write-preflight.ts.
  if ((report.liveBrokerWriteAllowed as unknown) !== false) {
    blocking.add("toss_future_write_contract_report_live_broker_write_allowed_not_false");
    confirmed = false;
  }

  const forbidden = new Set<string>(TOSS_FUTURE_WRITE_CONTRACT_FORBIDDEN_OPERATIONS);
  const allowedOperations = Array.isArray(report.allowedOperations) ? report.allowedOperations : [];
  for (const operation of allowedOperations) {
    if (forbidden.has(operation as unknown as string)) {
      blocking.add(
        `toss_future_write_contract_allowed_operations_contains_forbidden_operation_${String(operation).toLowerCase()}`
      );
      confirmed = false;
    }
  }

  return { nonCallableConfirmed: confirmed };
}

function evaluatePreflightEvidence(result: TossWritePreflightResult | undefined, blocking: Set<string>): void {
  if (!result) return; // optional supplementary evidence; absence alone is not an anomaly

  if (result.safetyType !== "TOSS_WRITE_PREFLIGHT_RESULT") {
    blocking.add("toss_write_preflight_result_wrong_safety_type");
  }
  if ((result.liveBrokerWriteAllowed as unknown) !== false) {
    blocking.add("toss_write_preflight_result_live_broker_write_allowed_not_false");
  }
}

function evaluateEnablementEvidence(report: SmallCapitalEnablementGateReport | undefined, blocking: Set<string>): void {
  if (!report) return; // optional supplementary evidence; absence alone is not an anomaly

  if (report.safetyType !== "SMALL_CAPITAL_ENABLEMENT_GATE_REPORT_EVIDENCE_ONLY") {
    blocking.add("small_capital_enablement_report_wrong_safety_type");
  }
  if ((report.liveBrokerWriteAllowed as unknown) !== false) {
    blocking.add("small_capital_enablement_report_live_broker_write_allowed_not_false");
  }
  if ((report.readyForLiveBrokerWrites as unknown) !== false) {
    blocking.add("small_capital_enablement_report_ready_for_live_broker_writes_not_false");
  }
}

function evaluateApprovalSignals(
  signals: readonly RuntimeLiveLockGateApprovalSignal[] | undefined,
  blocking: Set<string>,
  warnings: string[]
): { total: number; tampered: number } {
  if (!signals || signals.length === 0) {
    return { total: 0, tampered: 0 };
  }

  let tampered = 0;

  signals.forEach((signal, index) => {
    if ((signal.claimedLiveBrokerWriteAllowed as unknown) !== false) {
      blocking.add(`approval_signal_${index}_claims_live_broker_write_allowed_not_false`);
      tampered += 1;
    }
    if (signal.claimedFullyResolved) {
      // Informational only: an approval signal claiming "everything is
      // resolved" is never treated as authorization by this gate, and never
      // changes runtimeWriteLockEngaged / liveBrokerWriteAllowed. Recorded
      // so a human reviewer can still see the claim was made.
      warnings.push(`approval_signal_${index}_claims_fully_resolved`);
    }
  });

  return { total: signals.length, tampered };
}
