import type { TossPositionSnapshot, TossReadOnlyAdapter } from "../../adapters/contracts/index.js";

export type ReconciliationStatus = "CLEAN" | "MISMATCH" | "UNKNOWN";
export type ReconciliationIssueType =
  | "POSITION_MISMATCH"
  | "POSITION_MISSING_INTERNAL"
  | "POSITION_MISSING_BROKER"
  | "CASH_MISMATCH"
  | "CASH_MISSING_INTERNAL"
  | "CASH_MISSING_BROKER"
  | "BROKER_STATE_UNKNOWN";

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

export interface ReconciliationIssue {
  type: ReconciliationIssueType;
  key: string;
  internalValue: string | undefined;
  brokerValue: string | undefined;
  reason: string;
}

export interface ReconciliationReport {
  id: string;
  status: ReconciliationStatus;
  positionIssues: ReconciliationIssue[];
  cashIssues: ReconciliationIssue[];
  unknownReasons: string[];
  blocksDependentTrading: boolean;
  checkedAt: Date;
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
    const status = unknownReasons.length > 0
      ? "UNKNOWN"
      : (positionIssues.length > 0 || cashIssues.length > 0 ? "MISMATCH" : "CLEAN");

    return {
      id: input.id,
      status,
      positionIssues,
      cashIssues,
      unknownReasons,
      blocksDependentTrading: status !== "CLEAN",
      checkedAt: input.checkedAt,
      safetyType: "RECONCILIATION_READ_ONLY_REPORT"
    };
  }
}

function comparePositions(
  internalPositions: InternalPositionSnapshot[],
  brokerPositions: TossPositionSnapshot[],
  policy: ReconciliationPolicy
): ReconciliationIssue[] {
  const issues: ReconciliationIssue[] = [];
  const internalByKey = new Map(internalPositions.map((position) => [positionKey(position), position]));
  const brokerByKey = new Map(brokerPositions.map((position) => [positionKey(position), position]));
  const keys = new Set([...internalByKey.keys(), ...brokerByKey.keys()]);

  for (const key of [...keys].sort()) {
    const internal = internalByKey.get(key);
    const broker = brokerByKey.get(key);

    if (!internal) {
      issues.push(issue("POSITION_MISSING_INTERNAL", key, undefined, positionValue(broker), "broker_position_not_in_internal_state"));
      continue;
    }

    if (!broker) {
      issues.push(issue("POSITION_MISSING_BROKER", key, positionValue(internal), undefined, "internal_position_not_in_broker_state"));
      continue;
    }

    const quantityDelta = Math.abs(internal.quantity - Number(broker.quantity));
    const priceDelta = Math.abs(internal.averagePrice - Number(broker.averagePrice));
    if (quantityDelta > policy.quantityTolerance || priceDelta > policy.priceTolerance) {
      issues.push(issue("POSITION_MISMATCH", key, positionValue(internal), positionValue(broker), "position_quantity_or_price_mismatch"));
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
      issues.push(issue("CASH_MISSING_INTERNAL", currency, undefined, cashValue(broker), "broker_cash_not_in_internal_state"));
      continue;
    }

    if (!broker) {
      issues.push(issue("CASH_MISSING_BROKER", currency, cashValue(internal), undefined, "internal_cash_not_in_broker_state"));
      continue;
    }

    const availableDelta = Math.abs(internal.available - broker.available);
    const reservedDelta = Math.abs(internal.reserved - broker.reserved);
    const unsettledDelta = Math.abs(internal.unsettled - broker.unsettled);
    if (
      availableDelta > policy.cashTolerance ||
      reservedDelta > policy.cashTolerance ||
      unsettledDelta > policy.cashTolerance
    ) {
      issues.push(issue("CASH_MISMATCH", currency, cashValue(internal), cashValue(broker), "cash_balance_mismatch"));
    }
  }

  return issues;
}

function issue(
  type: ReconciliationIssueType,
  key: string,
  internalValue: string | undefined,
  brokerValue: string | undefined,
  reason: string
): ReconciliationIssue {
  return {
    type,
    key,
    internalValue,
    brokerValue,
    reason
  };
}

function positionKey(position: InternalPositionSnapshot | TossPositionSnapshot): string {
  return `${position.market}:${position.assetType}:${position.brokerSymbol}:${position.currency}`;
}

function positionValue(position: InternalPositionSnapshot | TossPositionSnapshot | undefined): string | undefined {
  if (!position) return undefined;
  return `quantity=${position.quantity};averagePrice=${position.averagePrice};currency=${position.currency}`;
}

function cashValue(cash: CashSnapshot | BrokerCashSnapshot | undefined): string | undefined {
  if (!cash) return undefined;
  return `available=${cash.available};reserved=${cash.reserved};unsettled=${cash.unsettled};currency=${cash.currency}`;
}
