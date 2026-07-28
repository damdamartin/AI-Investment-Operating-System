export type FillApplicationSide = "BUY" | "SELL";

export type FillApplicationSource = "SIMULATED_EXECUTION" | "RECONCILIATION";

export interface CashLedgerBalance {
  currency: string;
  available: number;
  reserved: number;
  unsettled: number;
}

export interface InternalPositionLedgerPosition {
  assetId: string;
  symbol: string;
  currency: string;
  quantity: number;
  averagePrice: number;
  realizedPnl: number;
  unrealizedPnlPlaceholder: number;
}

export interface InternalPositionLedgerState {
  portfolioId: string;
  cash: Record<string, CashLedgerBalance>;
  positions: Record<string, InternalPositionLedgerPosition>;
  appliedFillIds: string[];
  safetyType: "FILL_LEDGER_STATE_SIMULATED_OR_RECONCILED_ONLY";
}

export interface FillApplication {
  fillId: string;
  orderIntentId: string;
  assetId: string;
  symbol: string;
  side: FillApplicationSide;
  quantity: number;
  price: number;
  currency: string;
  reservedCashRelease?: number;
  fee?: number;
  filledAt: Date;
  source: FillApplicationSource;
}

export interface CashLedgerAdjustment {
  currency: string;
  availableDelta: number;
  reservedDelta: number;
  unsettledDelta: number;
}

export interface FillApplicationResult {
  state: InternalPositionLedgerState;
  applied: boolean;
  idempotentSkip: boolean;
  blocked: boolean;
  reasonCodes: string[];
  cashAdjustments: CashLedgerAdjustment[];
  positionChanged: boolean;
  safetyType: "FILL_APPLICATION_RESULT_ONLY";
}

export function createInternalPositionLedgerState(
  portfolioId: string,
  cash: Record<string, CashLedgerBalance> = {},
  positions: Record<string, InternalPositionLedgerPosition> = {}
): InternalPositionLedgerState {
  return {
    portfolioId,
    cash: cloneCash(cash),
    positions: clonePositions(positions),
    appliedFillIds: [],
    safetyType: "FILL_LEDGER_STATE_SIMULATED_OR_RECONCILED_ONLY"
  };
}

export class FillProcessingService {
  applyFill(state: InternalPositionLedgerState, fill: FillApplication): FillApplicationResult {
    const nextState = cloneState(state);

    if (nextState.appliedFillIds.includes(fill.fillId)) {
      return result(nextState, {
        applied: false,
        idempotentSkip: true,
        blocked: false,
        reasonCodes: [],
        cashAdjustments: [],
        positionChanged: false
      });
    }

    const validationErrors = validateFill(fill);
    if (validationErrors.length > 0) {
      return result(nextState, {
        applied: false,
        idempotentSkip: false,
        blocked: true,
        reasonCodes: validationErrors,
        cashAdjustments: [],
        positionChanged: false
      });
    }

    if (fill.side === "SELL") {
      const position = nextState.positions[fill.assetId];
      if (!position || roundQuantity(position.quantity) < roundQuantity(fill.quantity)) {
        return result(nextState, {
          applied: false,
          idempotentSkip: false,
          blocked: true,
          reasonCodes: ["sell_fill_exceeds_position_quantity"],
          cashAdjustments: [],
          positionChanged: false
        });
      }
    }

    const cashAdjustment = fill.side === "BUY" ? applyBuy(nextState, fill) : applySell(nextState, fill);
    nextState.appliedFillIds.push(fill.fillId);

    return result(nextState, {
      applied: true,
      idempotentSkip: false,
      blocked: false,
      reasonCodes: [],
      cashAdjustments: [cashAdjustment],
      positionChanged: true
    });
  }
}

function applyBuy(state: InternalPositionLedgerState, fill: FillApplication): CashLedgerAdjustment {
  const gross = roundMoney(fill.quantity * fill.price);
  const fee = fill.fee ?? 0;
  const totalCost = roundMoney(gross + fee);
  const cash = ensureCash(state, fill.currency);
  const releaseRequest = fill.reservedCashRelease ?? totalCost;
  const reservedRelease = Math.min(cash.reserved, roundMoney(releaseRequest));
  const availableDelta = roundMoney(reservedRelease - totalCost);

  cash.reserved = roundMoney(cash.reserved - reservedRelease);
  cash.available = roundMoney(cash.available + availableDelta);

  const existing = state.positions[fill.assetId];
  if (existing) {
    const newQuantity = roundQuantity(existing.quantity + fill.quantity);
    existing.averagePrice = roundPrice(
      (existing.averagePrice * existing.quantity + fill.price * fill.quantity) / newQuantity
    );
    existing.quantity = newQuantity;
  } else {
    state.positions[fill.assetId] = {
      assetId: fill.assetId,
      symbol: fill.symbol,
      currency: fill.currency,
      quantity: roundQuantity(fill.quantity),
      averagePrice: roundPrice(fill.price),
      realizedPnl: 0,
      unrealizedPnlPlaceholder: 0
    };
  }

  return {
    currency: fill.currency,
    availableDelta,
    reservedDelta: roundMoney(-reservedRelease),
    unsettledDelta: 0
  };
}

function applySell(state: InternalPositionLedgerState, fill: FillApplication): CashLedgerAdjustment {
  const gross = roundMoney(fill.quantity * fill.price);
  const fee = fill.fee ?? 0;
  const proceeds = roundMoney(gross - fee);
  const cash = ensureCash(state, fill.currency);
  const position = state.positions[fill.assetId];
  if (!position) throw new Error("Expected position to exist after sell validation.");

  const realizedPnl = roundMoney((fill.price - position.averagePrice) * fill.quantity - fee);
  const remainingQuantity = roundQuantity(position.quantity - fill.quantity);

  cash.available = roundMoney(cash.available + proceeds);
  position.realizedPnl = roundMoney(position.realizedPnl + realizedPnl);

  if (remainingQuantity <= 0) {
    delete state.positions[fill.assetId];
  } else {
    position.quantity = remainingQuantity;
  }

  return {
    currency: fill.currency,
    availableDelta: proceeds,
    reservedDelta: 0,
    unsettledDelta: 0
  };
}

function validateFill(fill: FillApplication): string[] {
  const errors: string[] = [];

  if (!fill.fillId.trim()) errors.push("fill_id_required");
  if (!fill.orderIntentId.trim()) errors.push("order_intent_id_required");
  if (!fill.assetId.trim()) errors.push("asset_id_required");
  if (!fill.symbol.trim()) errors.push("symbol_required");
  if (fill.quantity <= 0) errors.push("fill_quantity_must_be_positive");
  if (fill.price <= 0) errors.push("fill_price_must_be_positive");
  if (!fill.currency.trim()) errors.push("currency_required");
  if (fill.fee !== undefined && fill.fee < 0) errors.push("fill_fee_cannot_be_negative");
  if (fill.reservedCashRelease !== undefined && fill.reservedCashRelease < 0) {
    errors.push("reserved_cash_release_cannot_be_negative");
  }

  return errors;
}

function ensureCash(state: InternalPositionLedgerState, currency: string): CashLedgerBalance {
  state.cash[currency] ??= {
    currency,
    available: 0,
    reserved: 0,
    unsettled: 0
  };

  return state.cash[currency];
}

function result(
  state: InternalPositionLedgerState,
  fields: Omit<FillApplicationResult, "state" | "safetyType">
): FillApplicationResult {
  return {
    state,
    ...fields,
    safetyType: "FILL_APPLICATION_RESULT_ONLY"
  };
}

function cloneState(state: InternalPositionLedgerState): InternalPositionLedgerState {
  return {
    portfolioId: state.portfolioId,
    cash: cloneCash(state.cash),
    positions: clonePositions(state.positions),
    appliedFillIds: [...state.appliedFillIds],
    safetyType: "FILL_LEDGER_STATE_SIMULATED_OR_RECONCILED_ONLY"
  };
}

function cloneCash(cash: Record<string, CashLedgerBalance>): Record<string, CashLedgerBalance> {
  return Object.fromEntries(Object.entries(cash).map(([currency, balance]) => [currency, { ...balance }]));
}

function clonePositions(
  positions: Record<string, InternalPositionLedgerPosition>
): Record<string, InternalPositionLedgerPosition> {
  return Object.fromEntries(Object.entries(positions).map(([assetId, position]) => [assetId, { ...position }]));
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundPrice(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

function roundQuantity(value: number): number {
  return Math.round((value + Number.EPSILON) * 100_000_000) / 100_000_000;
}
