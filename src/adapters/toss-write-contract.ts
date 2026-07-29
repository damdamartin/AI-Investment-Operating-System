/**
 * Phase 7 design-readiness artifact — NOT a live-trading implementation.
 *
 * This file specifies the future `TossSecuritiesAdapter` write contract as
 * described in `docs/phase7/toss-write-contract-design.md`. Every write
 * operation below is typed with a `never` command parameter, which makes it
 * structurally impossible to call: there is no value of any type (including
 * `any`) that a caller can construct and pass in that TypeScript will accept
 * for a `never` parameter position. This mirrors the existing, already-
 * shipped `TossWriteAdapter` pattern in `src/adapters/contracts/toss.ts`
 * (`submitOrder(command: never): Promise<never>`), extended here with a
 * third operation and the surrounding design-only types called for by
 * `docs/tasks/phase7_claude_worktree_tasks/P7-002_toss_write_contract_design.md`.
 *
 * This file intentionally contains:
 * - no `fetch`, HTTP client, axios, undici, or any network code;
 * - no request body builder for a real order (not even unused);
 * - no `process.env` read;
 * - no `liveBrokerWriteAllowed: true` anywhere;
 * - no implementation of `BrokerWriteCommandGuard` and no changes to it.
 *
 * A later, separately reviewed implementation phase is the only place a real
 * command type, a real HTTP client, and a real adapter class may be added.
 * Nothing here should be imported by, or wired into, any code path that
 * performs a real broker call.
 */

import type { AdapterError, AdapterProvider } from "./contracts/index.js";

/**
 * The complete, closed set of write operations this contract will ever
 * describe. `docs/phase7/toss-write-contract-design.md` Section 2.1 lists
 * operations that must never be added to this union: `TRANSFER`,
 * `WITHDRAWAL`, `DEPOSIT`, `CURRENCY_EXCHANGE`. Those identifiers do not
 * appear anywhere in this file, on purpose.
 */
export type TossWriteContractOperation = "SUBMIT_ORDER" | "CANCEL_ORDER" | "REPLACE_ORDER";

/** Hardcoded (non-computed) allowed-operations list. See design doc Section 2. */
export const TOSS_FUTURE_WRITE_CONTRACT_ALLOWED_OPERATIONS = [
  "SUBMIT_ORDER",
  "CANCEL_ORDER",
  "REPLACE_ORDER"
] as const satisfies readonly TossWriteContractOperation[];

/**
 * Money-movement and account-movement operations that are explicitly and
 * permanently out of scope for `TossSecuritiesAdapter`. This type exists so
 * the exclusion is checkable in tests, not just asserted in prose. No other
 * type in this file may reference these identifiers as an operation value.
 */
export type TossWriteContractForbiddenOperation = "TRANSFER" | "WITHDRAWAL" | "DEPOSIT" | "CURRENCY_EXCHANGE";

export const TOSS_FUTURE_WRITE_CONTRACT_FORBIDDEN_OPERATIONS = [
  "TRANSFER",
  "WITHDRAWAL",
  "DEPOSIT",
  "CURRENCY_EXCHANGE"
] as const satisfies readonly TossWriteContractForbiddenOperation[];

/**
 * The minimal set of `OrderApproval`-derived fields a future write command
 * must carry, per design doc Section 3. This is a reference/id shape only —
 * it is not itself a request body, and it never appears as a callable
 * parameter type below (every write method still takes `never`).
 */
export interface TossWriteContractOrderApprovalReference {
  readonly orderApprovalId: string;
  readonly orderApprovalStatus: "APPROVED";
  readonly riskCheckId: string;
  readonly riskCheckPassed: true;
  readonly moneyCheckId: string;
  readonly moneyCheckApprovedQuantity: string;
  readonly moneyCheckApprovedAmount: string;
  readonly moneyCheckApprovedCurrency: "KRW" | "USD";
  readonly brokerAccountId: string;
  readonly portfolioBrokerAccountLinkId: string;
}

/**
 * Reference to a `BrokerWriteCommandGuard` decision (see
 * `src/application/broker-write-guard/broker-write-command-guard.ts`,
 * read-only input to this design). A future write command must carry proof
 * that the guard already ran and returned `allowed: true` for this exact
 * operation — this type only records that fact, it does not re-implement or
 * weaken the guard.
 */
export interface TossWriteContractGuardReference {
  readonly safetyType: "BROKER_WRITE_COMMAND_GUARD_DECISION";
  readonly commandType: "SUBMIT_ORDER" | "CANCEL_ORDER" | "REPLACE_ORDER";
  readonly allowed: true;
}

/**
 * Idempotency requirements, design doc Section 5. `clientOrderId` must be
 * deterministically derived from `orderApprovalId` + operation, not
 * regenerated per network attempt.
 */
export interface TossWriteContractIdempotency {
  readonly clientOrderId: string;
  readonly derivedFromOrderApprovalId: string;
  readonly derivedFromOperation: TossWriteContractOperation;
}

/**
 * Kill-switch re-check requirement, design doc Section 6. This is a second,
 * fresh check distinct from whatever kill-switch state the guard observed at
 * enqueue time — `checkedImmediatelyBeforeSubmission` exists so a future
 * implementation cannot satisfy this type with a stale/cached read.
 */
export interface TossWriteContractKillSwitchRecheck {
  readonly checkedImmediatelyBeforeSubmission: true;
  readonly active: boolean;
  readonly scope: "GLOBAL" | "MARKET" | "PORTFOLIO" | "STRATEGY" | "ASSET";
  readonly checkedAt: Date;
}

/**
 * Outbox requirement, design doc Section 10. Field names intentionally match
 * `OutboxEventRecord` in `src/application/outbox/index.ts` so a future
 * implementation can map directly onto the existing, already-implemented
 * `OutboxWorkerService` rather than inventing a parallel mechanism.
 */
export interface TossWriteContractOutboxRequirement {
  readonly eventType: "TOSS_BROKER_WRITE_COMMAND";
  readonly aggregateType: "BROKER_ORDER";
  readonly aggregateId: string;
  readonly idempotencyKey: string;
  readonly persistedBeforeNetworkAttempt: true;
}

/**
 * Audit requirement, design doc Section 10. Mirrors the required transitions
 * a future implementation must record via `AuditLogService`
 * (`src/application/audit/audit-log.ts`).
 */
export type TossWriteContractAuditTransition =
  | "COMMAND_CONSTRUCTED"
  | "KILL_SWITCH_RECHECKED"
  | "SUBMISSION_ATTEMPTED"
  | "NORMALIZED_RESULT_RECEIVED"
  | "RECONCILIATION_OUTCOME_RECORDED";

/** No blind retry, design doc Section 7. `retryable` is always `false` for write operations. */
export interface TossWriteContractRetryPolicy {
  readonly operation: TossWriteContractOperation;
  readonly retryable: false;
  readonly onAmbiguousOutcome: "MARK_UNKNOWN_REQUIRES_RECONCILIATION";
  readonly blindRetryPermitted: false;
}

/** Normalized result values, design doc Section 8, matching `05_API_Architecture.md` Section 5.7. */
export type TossWriteContractNormalizedResult = "ACCEPTED" | "REJECTED" | "UNKNOWN" | "UNSUPPORTED" | "FAILED";

/**
 * Normalized response shape a future adapter's write methods must return.
 * `liveBrokerWriteAllowed` is a literal `false` here (this is a design-only
 * type, never a runtime value produced by a real call), matching the
 * hardcoded-not-computed convention already used by
 * `TossReadOnlyHttpClient`'s metadata/error shapes.
 */
export interface TossWriteContractNormalizedResponse {
  readonly result: TossWriteContractNormalizedResult;
  readonly clientOrderId: string;
  readonly brokerOrderId?: string;
  readonly normalizedState:
    | "SUBMITTED"
    | "BROKER_ACCEPTED"
    | "PARTIALLY_FILLED"
    | "FILLED"
    | "CANCELED"
    | "REJECTED"
    | "UNKNOWN_REQUIRES_RECONCILIATION";
  readonly rawPayloadId?: string;
  readonly liveBrokerWriteAllowed: false;
}

/** Normalized error shape a future adapter's write methods must return on failure. */
export interface TossWriteContractNormalizedError extends AdapterError {
  readonly provider: Extract<AdapterProvider, "TOSS_SECURITIES">;
  readonly liveBrokerWriteAllowed: false;
  readonly requiresReconciliation: boolean;
}

/**
 * The future write adapter surface. Every method takes `command: never` and
 * returns `Promise<never>`, so — exactly like the existing `TossWriteAdapter`
 * in `src/adapters/contracts/toss.ts` — no caller anywhere in this codebase
 * can construct an argument that satisfies these signatures. A later,
 * separately reviewed phase is the only place a real, narrowly-typed command
 * parameter may replace `never`.
 */
export interface TossFutureWriteAdapter {
  submitOrder(command: never): Promise<never>;
  cancelOrder(command: never): Promise<never>;
  replaceOrder(command: never): Promise<never>;
}

export interface TossFutureWriteContractSafetyReport {
  readonly liveBrokerWriteAllowed: false;
  readonly allowedOperations: readonly TossWriteContractOperation[];
  readonly forbiddenOperations: readonly TossWriteContractForbiddenOperation[];
  readonly safetyType: "TOSS_FUTURE_WRITE_CONTRACT_REPORT";
}

/** Hardcoded, non-computed safety report. Identical shape and values on every read. */
export const TOSS_FUTURE_WRITE_CONTRACT_SAFETY_REPORT: TossFutureWriteContractSafetyReport = Object.freeze({
  liveBrokerWriteAllowed: false,
  allowedOperations: TOSS_FUTURE_WRITE_CONTRACT_ALLOWED_OPERATIONS,
  forbiddenOperations: TOSS_FUTURE_WRITE_CONTRACT_FORBIDDEN_OPERATIONS,
  safetyType: "TOSS_FUTURE_WRITE_CONTRACT_REPORT"
});
