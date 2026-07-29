import { redactSecret } from "../../config/index.js";
import type { TossPositionSnapshot, TossReadOnlyAdapter } from "../../adapters/contracts/index.js";

export type ReconciliationStatus = "CLEAN" | "MISMATCH" | "UNKNOWN";

export type ReconciliationIssueType =
  | "POSITION_MISMATCH"
  | "POSITION_MISSING_INTERNAL"
  | "POSITION_MISSING_BROKER"
  | "POSITION_MINOR_VARIANCE"
  | "CASH_MISMATCH"
  | "CASH_MISSING_INTERNAL"
  | "CASH_MISSING_BROKER"
  | "CASH_MINOR_VARIANCE"
  | "BROKER_STATE_UNKNOWN";

/**
 * Deterministic discrepancy classification.
 *
 * - `INFORMATIONAL`: a non-zero difference was observed but stayed within
 *   policy tolerance. Recorded for audit visibility only; never blocks
 *   dependent trading and never blocks a live-readiness signal by itself.
 * - `BLOCKING`: a tolerance-exceeding mismatch or an unknown broker state.
 *   Blocks dependent trading for the affected report.
 * - `REQUIRES_HUMAN_REVIEW`: a structural gap (a position or cash balance
 *   present on only one side). Requires a human decision and also blocks
 *   dependent trading — this system never auto-resolves gaps by inferring
 *   which side is correct.
 */
export type ReconciliationIssueClassification = "INFORMATIONAL" | "BLOCKING" | "REQUIRES_HUMAN_REVIEW";

export interface InternalPositionSnapshot {
  assetId: string;
  brokerSymbol: string;
  market: "KR" | "US";
  assetType: "STOCK" | "ETF";
  quantity: number;
  averagePrice: number;
  currency: "KRW" | "USD";
  updatedAt: Date;
}

export interface CashSnapshot {
  currency: "KRW" | "USD";
  available: number;
  reserved: number;
  unsettled: number;
  updatedAt: Date;
}

export interface BrokerCashSnapshot extends CashSnapshot {
  brokerAccountId: string;
  collectedAt: Date;
}

/**
 * A single reconciliation discrepancy.
 *
 * `ref` is a sanitized reference only: for positions it is the masked
 * broker symbol (see `maskSymbol`) combined with non-sensitive
 * classification fields (market, asset type, currency); for cash it is
 * just the currency code. It never carries a raw account identifier, a raw
 * unmasked symbol, a raw quantity, or a raw price. `reason` is a fixed,
 * deterministic reason code — never a formatted dump of the compared
 * values.
 */
export interface ReconciliationIssue {
  type: ReconciliationIssueType;
  classification: ReconciliationIssueClassification;
  ref: string;
  reason: string;
}

export interface ReconciliationIssueCounts {
  informational: number;
  blocking: number;
  requiresHumanReview: number;
}

export interface ReconciliationReport {
  id: string;
  status: ReconciliationStatus;
  positionIssues: ReconciliationIssue[];
  cashIssues: ReconciliationIssue[];
  /** Always populated by `reconcileSnapshots`; optional only so pre-existing
   * literals built outside this module keep compiling without edits. */
  issueCounts?: ReconciliationIssueCounts;
  unknownReasons: string[];
  blocksDependentTrading: boolean;
  checkedAt: Date;
  /** Always `false`, set by `reconcileSnapshots`. Optional for the same
   * backward-compatibility reason as `issueCounts`. */
  liveBrokerWriteAllowed?: false;
  safetyType: "RECONCILIATION_READ_ONLY_REPORT";
}

export interface ReconciliationPolicy {
  quantityTolerance: number;
  priceTolerance: number;
  cashTolerance: number;
}

export interface ReconciliationSnapshotInput {
  id: string;
  internalPositions: InternalPositionSnapshot[];
  brokerPositions: TossPositionSnapshot[];
  internalCash: CashSnapshot[];
  brokerCash: BrokerCashSnapshot[];
  checkedAt: Date;
  policy: ReconciliationPolicy;
  unknownReasons?: string[] | undefined;
}

export interface ReconciliationAdapterInput {
  id: string;
  adapter: TossReadOnlyAdapter;
  internalPositions: InternalPositionSnapshot[];
  internalCash: CashSnapshot[];
  brokerCash?: BrokerCashSnapshot[] | undefined;
  checkedAt: Date;
  policy: ReconciliationPolicy;
}

export const defaultReconciliationPolicy: ReconciliationPolicy = {
  quantityTolerance: 0.000001,
  priceTolerance: 0.01,
  cashTolerance: 1
};

/**
 * Read-only comparison of paper/simulation state against sanitized broker
 * snapshot summaries. This service never calls a broker write endpoint,
 * never produces a correction command, and never mutates the compared
 * inputs. It only classifies and reports.
 */
export class ReconciliationService {
  async reconcileFromReadOnlyAdapter(input: ReconciliationAdapterInput): Promise<ReconciliationReport> {
    const account = await input.adapter.getAccountSnapshot();
    if (!account.ok) {
      return this.reconcileSnapshots({
        ...input,
        brokerPositions: [],
        brokerCash: input.brokerCash ?? [],
        unknownReasons: [`account_snapshot_unavailable:${account.error.code}`]
      });
    }

    if (!account.data.readOnlyEnabled) {
      return this.reconcileSnapshots({
        ...input,
        brokerPositions: [],
        brokerCash: input.brokerCash ?? [],
        unknownReasons: ["broker_read_only_access_disabled"]
      });
    }

    const positions = await input.adapter.getPositions();
    if (!positions.ok) {
      return this.reconcileSnapshots({
        ...input,
        brokerPositions: [],
        brokerCash: input.brokerCash ?? [],
        unknownReasons: [`broker_positions_unavailable:${positions.error.code}`]
      });
    }

    return this.reconcileSnapshots({
      ...input,
      brokerPositions: positions.data,
      brokerCash: input.brokerCash ?? []
    });
  }

  reconcileSnapshots(input: ReconciliationSnapshotInput): ReconciliationReport {
    const positionIssues = comparePositions(input.internalPositions, input.brokerPositions, input.policy);
    const cashIssues = compareCash(input.internalCash, input.brokerCash, input.policy);
    const unknownReasons = input.unknownReasons ?? [];
    const issueCounts = countByClassification([...positionIssues, ...cashIssues]);
    const hasUnresolvedIssue = issueCounts.blocking > 0 || issueCounts.requiresHumanReview > 0;
    const status: ReconciliationStatus = unknownReasons.length > 0
      ? "UNKNOWN"
      : (hasUnresolvedIssue ? "MISMATCH" : "CLEAN");

    return {
      id: input.id,
      status,
      positionIssues,
      cashIssues,
      issueCounts,
      unknownReasons,
      blocksDependentTrading: status !== "CLEAN",
      checkedAt: input.checkedAt,
      liveBrokerWriteAllowed: false,
      safetyType: "RECONCILIATION_READ_ONLY_REPORT"
    };
  }
}

function countByClassification(issues: ReconciliationIssue[]): ReconciliationIssueCounts {
  return {
    informational: issues.filter((issue) => issue.classification === "INFORMATIONAL").length,
    blocking: issues.filter((issue) => issue.classification === "BLOCKING").length,
    requiresHumanReview: issues.filter((issue) => issue.classification === "REQUIRES_HUMAN_REVIEW").length
  };
}

function classificationFor(type: ReconciliationIssueType): ReconciliationIssueClassification {
  if (type === "POSITION_MISMATCH" || type === "CASH_MISMATCH" || type === "BROKER_STATE_UNKNOWN") {
    return "BLOCKING";
  }

  if (
    type === "POSITION_MISSING_INTERNAL" ||
    type === "POSITION_MISSING_BROKER" ||
    type === "CASH_MISSING_INTERNAL" ||
    type === "CASH_MISSING_BROKER"
  ) {
    return "REQUIRES_HUMAN_REVIEW";
  }

  return "INFORMATIONAL";
}

function makeIssue(type: ReconciliationIssueType, ref: string, reason: string): ReconciliationIssue {
  return {
    type,
    classification: classificationFor(type),
    ref,
    reason
  };
}

function comparePositions(
  internalPositions: InternalPositionSnapshot[],
  brokerPositions: TossPositionSnapshot[],
  policy: ReconciliationPolicy
): ReconciliationIssue[] {
  const issues: ReconciliationIssue[] = [];
  const internalByKey = new Map(internalPositions.map((position) => [matchKey(position), position]));
  const brokerByKey = new Map(brokerPositions.map((position) => [matchKey(position), position]));
  const keys = new Set([...internalByKey.keys(), ...brokerByKey.keys()]);

  for (const key of [...keys].sort()) {
    const internal = internalByKey.get(key);
    const broker = brokerByKey.get(key);

    if (!internal) {
      issues.push(
        makeIssue("POSITION_MISSING_INTERNAL", maskedPositionRef(broker!), "broker_position_missing_from_internal_state")
      );
      continue;
    }

    if (!broker) {
      issues.push(
        makeIssue("POSITION_MISSING_BROKER", maskedPositionRef(internal), "internal_position_missing_from_broker_state")
      );
      continue;
    }

    const ref = maskedPositionRef(internal);
    const quantityDelta = Math.abs(internal.quantity - Number(broker.quantity));
    const priceDelta = Math.abs(internal.averagePrice - Number(broker.averagePrice));
    const quantityExceeds = quantityDelta > policy.quantityTolerance;
    const priceExceeds = priceDelta > policy.priceTolerance;

    if (quantityExceeds && priceExceeds) {
      issues.push(makeIssue("POSITION_MISMATCH", ref, "position_quantity_and_price_mismatch"));
    } else if (quantityExceeds) {
      issues.push(makeIssue("POSITION_MISMATCH", ref, "position_quantity_mismatch"));
    } else if (priceExceeds) {
      issues.push(makeIssue("POSITION_MISMATCH", ref, "position_price_mismatch"));
    } else if (quantityDelta > 0 || priceDelta > 0) {
      issues.push(makeIssue("POSITION_MINOR_VARIANCE", ref, "position_within_tolerance_variance"));
    }
  }

  return issues;
}

function compareCash(
  internalCash: CashSnapshot[],
  brokerCash: BrokerCashSnapshot[],
  policy: ReconciliationPolicy
): ReconciliationIssue[] {
  const issues: ReconciliationIssue[] = [];
  const internalByCurrency = new Map(internalCash.map((cash) => [cash.currency, cash]));
  const brokerByCurrency = new Map(brokerCash.map((cash) => [cash.currency, cash]));
  const currencies = new Set([...internalByCurrency.keys(), ...brokerByCurrency.keys()]);

  for (const currency of [...currencies].sort()) {
    const internal = internalByCurrency.get(currency);
    const broker = brokerByCurrency.get(currency);

    if (!internal) {
      issues.push(makeIssue("CASH_MISSING_INTERNAL", currency, "broker_cash_missing_from_internal_state"));
      continue;
    }

    if (!broker) {
      issues.push(makeIssue("CASH_MISSING_BROKER", currency, "internal_cash_missing_from_broker_state"));
      continue;
    }

    const availableExceeds = Math.abs(internal.available - broker.available) > policy.cashTolerance;
    const reservedExceeds = Math.abs(internal.reserved - broker.reserved) > policy.cashTolerance;
    const unsettledExceeds = Math.abs(internal.unsettled - broker.unsettled) > policy.cashTolerance;

    if (availableExceeds || reservedExceeds || unsettledExceeds) {
      const dimensions = [
        availableExceeds ? "available" : undefined,
        reservedExceeds ? "reserved" : undefined,
        unsettledExceeds ? "unsettled" : undefined
      ].filter((dimension): dimension is string => dimension !== undefined);
      issues.push(makeIssue("CASH_MISMATCH", currency, `cash_${dimensions.join("_and_")}_mismatch`));
      continue;
    }

    const anyDelta =
      internal.available !== broker.available ||
      internal.reserved !== broker.reserved ||
      internal.unsettled !== broker.unsettled;
    if (anyDelta) {
      issues.push(makeIssue("CASH_MINOR_VARIANCE", currency, "cash_within_tolerance_variance"));
    }
  }

  return issues;
}

function matchKey(position: InternalPositionSnapshot | TossPositionSnapshot): string {
  return `${position.market}:${position.assetType}:${position.brokerSymbol}:${position.currency}`;
}

/**
 * Builds a sanitized position reference for reporting: the broker symbol is
 * masked (see `redactSecret`) and combined with non-sensitive classifier
 * fields. Never includes quantity or price.
 */
function maskedPositionRef(position: InternalPositionSnapshot | TossPositionSnapshot): string {
  return `${position.market}:${position.assetType}:${maskSymbol(position.brokerSymbol)}:${position.currency}`;
}

function maskSymbol(symbol: string): string {
  return redactSecret(symbol) ?? "****";
}
