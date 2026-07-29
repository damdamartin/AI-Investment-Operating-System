import type { ComplianceGateResult } from "../compliance/index.js";
import { Money } from "../../domain/value-objects/index.js";

/**
 * Phase 7 (P7-003): small-capital live readiness gate.
 *
 * This module is a PURE evaluator. It has no network code, no filesystem
 * access, no broker client, and no side effects of any kind. It never
 * constructs, submits, cancels, or replaces a broker order, and it never
 * enables live trading. It only reads already-computed inputs (numeric
 * limits, a proposed order description, and status signals from the
 * already-merged Phase 6 safety chain) and returns a report describing
 * whether small-capital live trading readiness gates currently pass.
 *
 * `readyForSmallCapitalLive: true` from this evaluator is NOT authorization
 * to enable live trading. It is only evidence that the design-time gates
 * defined in `docs/phase7/small-capital-readiness-gates.md` are currently
 * satisfied. Enabling any real broker write path is explicitly out of
 * scope for Phase 7 (see `docs/phase7/README.md`) and requires a separate,
 * later, human-reviewed implementation phase.
 *
 * Deliberate design choices that keep this evaluator from ever being able
 * to authorize itself:
 *
 * - `liveBrokerWriteAllowed` on the report is a literal `false`, never a
 *   computed value, mirroring `ReconciliationWorkflowResult`,
 *   `Phase6OperatorSafetyStatus`, and `AlertEvent` elsewhere in this
 *   codebase (Phase 6 round 1/2).
 * - The manual approval record (`ManualLiveApprovalRecord`) is consumed as
 *   an input only. This module exports no function that can construct an
 *   `APPROVED` record. A human must populate `approvalStatus: "APPROVED"`,
 *   `approvedByName`, `approvedByRole`, `acknowledgedRisksStatement`
 *   (matched verbatim against `REQUIRED_MANUAL_APPROVAL_ATTESTATION`), and
 *   `approvedAt` outside of this codebase (see
 *   `docs/phase7/manual-live-approval-record.md`) before this evaluator
 *   will treat the approval gate as satisfied.
 * - Allowed markets, asset types, order types, and session/extended-hours/
 *   fractional-order policy are hardcoded module constants, not caller-
 *   supplied policy. A caller cannot weaken this gate by passing a more
 *   permissive policy object.
 * - Every check fails closed: a missing input is treated as a blocking
 *   condition, never as "assume safe."
 */

// ---------------------------------------------------------------------------
// Fixed (non-caller-configurable) small-capital policy
// ---------------------------------------------------------------------------

/** V1 allowed markets, per docs/07_Trading_System.md section 6. */
export const SMALL_CAPITAL_ALLOWED_MARKETS = Object.freeze(["KR", "US"] as const);
export type SmallCapitalAllowedMarket = (typeof SMALL_CAPITAL_ALLOWED_MARKETS)[number];

/**
 * V1 allowed asset types, per docs/07_Trading_System.md section 6.
 * Cryptocurrency, futures, options, margin products, and short-selling
 * instruments are excluded for V1 and therefore never allowed here.
 */
export const SMALL_CAPITAL_ALLOWED_ASSET_TYPES = Object.freeze(["STOCK", "ETF"] as const);
export type SmallCapitalAllowedAssetType = (typeof SMALL_CAPITAL_ALLOWED_ASSET_TYPES)[number];

/**
 * V1 allowed order types, per docs/07_Trading_System.md section 25: "use
 * limit orders by default, avoid market orders until explicitly verified
 * and approved." Small-capital live mode never verifies or approves market
 * orders on its own, so LIMIT is the only allowed order type here.
 */
export const SMALL_CAPITAL_ALLOWED_ORDER_TYPES = Object.freeze(["LIMIT"] as const);
export type SmallCapitalAllowedOrderType = (typeof SMALL_CAPITAL_ALLOWED_ORDER_TYPES)[number];

/** Required verbatim human attestation. See docs/phase7/manual-live-approval-record.md. */
export const REQUIRED_MANUAL_APPROVAL_ATTESTATION =
  "I have reviewed the small-capital readiness gates and the current numeric limits, " +
  "and I personally accept responsibility for enabling real broker writes under these limits.";

/** Roles allowed to sign a manual live approval record. Only OWNER, per docs/09_Operation_Deployment.md section 22. */
export const SMALL_CAPITAL_APPROVAL_ALLOWED_ROLES = Object.freeze(["OWNER"] as const);
export type SmallCapitalApprovalAllowedRole = (typeof SMALL_CAPITAL_APPROVAL_ALLOWED_ROLES)[number];

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface SmallCapitalCapitalLimits {
  /** Maximum value of a single order. */
  maxOrderValue: Money;
  /** Maximum cumulative notional exposure opened in a single trading day. */
  maxDailyNotionalExposure: Money;
  /** Maximum total capital exposure across all small-capital-live positions at once. */
  maxTotalCapitalExposure: Money;
}

export interface SmallCapitalProposedOrder {
  market: string;
  assetType: string;
  orderType: string;
  orderValue: Money;
  /** Cumulative daily notional exposure this order would produce, including this order. */
  projectedDailyNotionalAfterOrder: Money;
  /** Total capital exposure this order would produce, including this order. */
  projectedTotalCapitalExposureAfterOrder: Money;
  /** True only when the order falls inside the relevant market's regular trading session. */
  withinRegularSessionWindow: boolean;
  /** True when the order targets a pre-market or after-hours session. */
  isExtendedHours: boolean;
  /** True when the order requests fractional share quantity. */
  isFractional: boolean;
}

export type ManualLiveApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "REVOKED";

/**
 * A human-owned approval artifact. See
 * `docs/phase7/manual-live-approval-record.md` for the full field-by-field
 * completion procedure. This codebase never constructs an `APPROVED`
 * instance of this type; it only reads one supplied by the caller.
 */
export interface ManualLiveApprovalRecord {
  id: string;
  scopePortfolioId: string;
  scopeStrategyVersionId: string;
  approvalStatus: ManualLiveApprovalStatus;
  approvedByName?: string | undefined;
  approvedByRole?: string | undefined;
  /** Must equal `REQUIRED_MANUAL_APPROVAL_ATTESTATION` verbatim to count as a genuine sign-off. */
  acknowledgedRisksStatement?: string | undefined;
  approvedAt?: Date | undefined;
  /** Approval must expire. A missing or past expiry blocks readiness. */
  expiresAt?: Date | undefined;
  revokedAt?: Date | undefined;
  revokedReason?: string | undefined;
  safetyType: "MANUAL_LIVE_APPROVAL_RECORD_HUMAN_OWNED";
}

export interface SmallCapitalReconciliationSignal {
  /** Mirrors `ReconciliationWorkflowResult.liveReadinessBlocked`. */
  liveReadinessBlocked: boolean;
  /** Mirrors `ReconciliationWorkflowResult.stale`. */
  stale: boolean;
  reasonCodes: string[];
}

export interface SmallCapitalKillSwitchSignal {
  /** Mirrors `KillSwitchTradingGate.allowed`. */
  allowed: boolean;
  /** Mirrors `KillSwitchTradingGate.blocksNewOrders`. */
  blocksNewOrders: boolean;
  reasonCodes: string[];
}

export type SmallCapitalDashboardSystemStatus = "OK" | "WARNING" | "ERROR" | "BLOCKED";

/**
 * Required alert/dashboard state, sourced from the read-only Phase 6
 * operator dashboard (`ReadOnlyDashboardService`,
 * `Phase6OperatorSafetyDashboardService`) and alerting
 * (`OperationalAlertingService`) modules. This gate deliberately consumes a
 * small, locally-defined duck-typed shape (not the full dashboard/alert
 * types) so this module never needs to import from
 * `src/application/dashboard` or `src/application/alerting` and can never
 * accidentally create a dependency cycle or drift out of sync with fields
 * this gate does not use. Any real `DashboardReadOnlyStatus` /
 * `Phase6OperatorSafetyStatus` / alert summary is structurally compatible
 * with this shape.
 */
export interface SmallCapitalOperatorSurfaceSignal {
  /** False if the dashboard/status surface could not be produced at all. */
  dashboardReachable: boolean;
  systemStatus: SmallCapitalDashboardSystemStatus;
  /** Count of currently open CRITICAL-severity alerts. */
  openCriticalAlertCount: number;
  /** Caller-confirmed: was the audit record for the evaluated period actually persisted? */
  auditTrailRecorded: boolean;
}

export interface SmallCapitalReadinessInput {
  /** Evaluation time. Required; used for approval expiry and freshness checks. */
  now: Date;
  capitalLimits?: SmallCapitalCapitalLimits | undefined;
  /**
   * The specific order being evaluated, if any. If omitted, only the
   * non-order-specific gates (approval, reconciliation, kill switch,
   * dashboard/alert state, compliance) are evaluated, and a warning is
   * added noting that no specific order was checked against the numeric
   * limits.
   */
  proposedOrder?: SmallCapitalProposedOrder | undefined;
  manualApproval?: ManualLiveApprovalRecord | undefined;
  reconciliation?: SmallCapitalReconciliationSignal | undefined;
  killSwitch?: SmallCapitalKillSwitchSignal | undefined;
  operatorSurface?: SmallCapitalOperatorSurfaceSignal | undefined;
  compliance?: ComplianceGateResult | undefined;
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface SmallCapitalReadinessReport {
  /**
   * True only when every readiness gate currently passes. This is a
   * design-time readiness signal, not live-trading authorization, and it
   * never triggers any action on its own.
   */
  readyForSmallCapitalLive: boolean;
  blockingReasonCodes: string[];
  warnings: string[];
  /**
   * Always literal `false`. This evaluator cannot enable a live broker
   * write under any combination of inputs. It exists so no caller can
   * mistake a clean `readyForSmallCapitalLive: true` reading for live
   * trading being enabled.
   */
  liveBrokerWriteAllowed: false;
  generatedAt: Date;
  safetyType: "SMALL_CAPITAL_READINESS_REPORT_EVALUATION_ONLY";
}

// ---------------------------------------------------------------------------
// Evaluator
// ---------------------------------------------------------------------------

export function evaluateSmallCapitalReadiness(input: SmallCapitalReadinessInput): SmallCapitalReadinessReport {
  const blockingReasonCodes = new Set<string>();
  const warnings: string[] = [];

  if (!input.now || Number.isNaN(input.now.getTime())) {
    blockingReasonCodes.add("missing_or_invalid_evaluation_time");
  }

  checkCapitalLimitsAndOrder(input, blockingReasonCodes, warnings);
  checkManualApproval(input.manualApproval, input.now, blockingReasonCodes);
  checkReconciliation(input.reconciliation, blockingReasonCodes);
  checkKillSwitch(input.killSwitch, blockingReasonCodes);
  checkOperatorSurface(input.operatorSurface, blockingReasonCodes);
  checkCompliance(input.compliance, blockingReasonCodes);

  return {
    readyForSmallCapitalLive: blockingReasonCodes.size === 0,
    blockingReasonCodes: [...blockingReasonCodes].sort(),
    warnings,
    liveBrokerWriteAllowed: false,
    generatedAt: input.now,
    safetyType: "SMALL_CAPITAL_READINESS_REPORT_EVALUATION_ONLY"
  };
}

function checkCapitalLimitsAndOrder(
  input: SmallCapitalReadinessInput,
  reasons: Set<string>,
  warnings: string[]
): void {
  if (!input.capitalLimits) {
    reasons.add("missing_capital_limits");
    return;
  }

  const limits = input.capitalLimits;
  for (const [name, amount] of [
    ["max_order_value", limits.maxOrderValue],
    ["max_daily_notional_exposure", limits.maxDailyNotionalExposure],
    ["max_total_capital_exposure", limits.maxTotalCapitalExposure]
  ] as const) {
    if (amount.isNegative() || amount.compare(Money.zero(amount.currency)) === 0) {
      reasons.add(`invalid_capital_limit_${name}`);
    }
  }

  if (!input.proposedOrder) {
    warnings.push("no_proposed_order_evaluated_against_numeric_limits");
    return;
  }

  const order = input.proposedOrder;

  if (!(SMALL_CAPITAL_ALLOWED_MARKETS as readonly string[]).includes(order.market)) {
    reasons.add(`market_not_allowed_${order.market.toLowerCase()}`);
  }

  if (!(SMALL_CAPITAL_ALLOWED_ASSET_TYPES as readonly string[]).includes(order.assetType)) {
    reasons.add(`asset_type_not_allowed_${order.assetType.toLowerCase()}`);
  }

  if (!(SMALL_CAPITAL_ALLOWED_ORDER_TYPES as readonly string[]).includes(order.orderType)) {
    reasons.add(`order_type_not_allowed_${order.orderType.toLowerCase()}`);
  }

  if (!order.withinRegularSessionWindow) {
    reasons.add("order_outside_regular_session_window");
  }

  if (order.isExtendedHours) {
    reasons.add("extended_hours_orders_not_allowed");
  }

  if (order.isFractional) {
    reasons.add("fractional_orders_not_allowed");
  }

  compareAgainstLimit(order.orderValue, limits.maxOrderValue, "order_value_exceeds_max_order_value", reasons);
  compareAgainstLimit(
    order.projectedDailyNotionalAfterOrder,
    limits.maxDailyNotionalExposure,
    "daily_notional_exposure_exceeds_max",
    reasons
  );
  compareAgainstLimit(
    order.projectedTotalCapitalExposureAfterOrder,
    limits.maxTotalCapitalExposure,
    "total_capital_exposure_exceeds_max",
    reasons
  );
}

function compareAgainstLimit(amount: Money, limit: Money, reasonCode: string, reasons: Set<string>): void {
  try {
    if (amount.isGreaterThan(limit)) reasons.add(reasonCode);
  } catch {
    // Money.compare throws DomainValidationError on a currency mismatch.
    // A pure evaluator must never throw out of a report-only call; a
    // currency mismatch is itself a blocking, reportable condition.
    reasons.add(`${reasonCode}_currency_mismatch`);
  }
}

function checkManualApproval(
  record: ManualLiveApprovalRecord | undefined,
  now: Date,
  reasons: Set<string>
): void {
  if (!record) {
    reasons.add("missing_manual_live_approval_record");
    return;
  }

  if (record.approvalStatus !== "APPROVED") {
    reasons.add(`manual_live_approval_status_${record.approvalStatus.toLowerCase()}`);
    return;
  }

  if (record.revokedAt) {
    reasons.add("manual_live_approval_revoked");
    return;
  }

  if (!record.approvedByName || !record.approvedByName.trim()) {
    reasons.add("manual_live_approval_missing_approver_name");
  }

  if (
    !record.approvedByRole ||
    !(SMALL_CAPITAL_APPROVAL_ALLOWED_ROLES as readonly string[]).includes(record.approvedByRole)
  ) {
    reasons.add("manual_live_approval_role_not_owner");
  }

  if (record.acknowledgedRisksStatement !== REQUIRED_MANUAL_APPROVAL_ATTESTATION) {
    reasons.add("manual_live_approval_attestation_mismatch");
  }

  if (!record.approvedAt || Number.isNaN(record.approvedAt.getTime())) {
    reasons.add("manual_live_approval_missing_approved_at");
  }

  if (!record.expiresAt || Number.isNaN(record.expiresAt.getTime())) {
    reasons.add("manual_live_approval_missing_expiry");
  } else if (now.getTime() >= record.expiresAt.getTime()) {
    reasons.add("manual_live_approval_expired");
  }
}

function checkReconciliation(signal: SmallCapitalReconciliationSignal | undefined, reasons: Set<string>): void {
  if (!signal) {
    reasons.add("missing_reconciliation_signal");
    return;
  }

  if (signal.liveReadinessBlocked) reasons.add("reconciliation_not_fully_resolved");
  if (signal.stale) reasons.add("reconciliation_stale");
}

function checkKillSwitch(signal: SmallCapitalKillSwitchSignal | undefined, reasons: Set<string>): void {
  if (!signal) {
    reasons.add("missing_kill_switch_signal");
    return;
  }

  if (!signal.allowed || signal.blocksNewOrders) reasons.add("kill_switch_blocks_new_orders");
}

function checkOperatorSurface(signal: SmallCapitalOperatorSurfaceSignal | undefined, reasons: Set<string>): void {
  if (!signal) {
    reasons.add("missing_operator_surface_signal");
    return;
  }

  if (!signal.dashboardReachable) reasons.add("dashboard_unreachable");
  if (signal.systemStatus !== "OK") reasons.add(`dashboard_system_status_not_ok_${signal.systemStatus.toLowerCase()}`);
  if (signal.openCriticalAlertCount > 0) reasons.add("open_critical_alerts_present");
  if (!signal.auditTrailRecorded) reasons.add("audit_trail_not_recorded");
}

function checkCompliance(gate: ComplianceGateResult | undefined, reasons: Set<string>): void {
  if (!gate) {
    reasons.add("missing_compliance_gate");
    return;
  }

  if (!gate.allowed) {
    for (const reason of gate.reasons) reasons.add(`compliance_${reason}`);
  }
}
