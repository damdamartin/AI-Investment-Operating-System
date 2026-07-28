import type { CostModel } from "../backtest/index.js";

export interface ShadowPortfolioState {
  id: string;
  candidateStrategyId: string;
  cash: number;
  positions: Record<string, ShadowPosition>;
  trades: ShadowTrade[];
  startedAt: Date;
  updatedAt: Date;
  safetyType: "SHADOW_PORTFOLIO_VIRTUAL_ONLY";
}

export interface ShadowPosition {
  assetId: string;
  symbol: string;
  quantity: number;
  averagePrice: number;
}

export interface ShadowMarketInput {
  assetId: string;
  symbol: string;
  price: number;
  timestamp: Date;
  inputReference: string;
}

export interface ShadowOrderInstruction {
  action: "BUY" | "SELL" | "HOLD";
  allocationRatio: number;
}

export interface ShadowTrade {
  strategyId: string;
  assetId: string;
  symbol: string;
  action: "BUY" | "SELL";
  timestamp: Date;
  requestedPrice: number;
  simulatedFillPrice: number;
  quantity: number;
  grossAmount: number;
  totalCost: number;
  inputReference: string;
  safetyType: "SHADOW_TRADE_SIMULATED_ONLY";
}

export interface ShadowPerformanceRecord {
  portfolioId: string;
  candidateStrategyId: string;
  cash: number;
  positionValue: number;
  equity: number;
  totalReturnRatio: number;
  tradeCount: number;
  costModelVersion: string;
  inputReferences: string[];
  recordedAt: Date;
  safetyType: "SHADOW_PERFORMANCE_RECORD_ONLY";
}

export interface ShadowPortfolioStepInput {
  state: ShadowPortfolioState;
  market: ShadowMarketInput;
  instruction: ShadowOrderInstruction;
  costModel: CostModel;
  initialEquity: number;
}

export interface ShadowPortfolioStepResult {
  state: ShadowPortfolioState;
  performance: ShadowPerformanceRecord;
}

export class ShadowPortfolioEngine {
  createPortfolio(input: {
    id: string;
    candidateStrategyId: string;
    initialCash: number;
    startedAt: Date;
  }): ShadowPortfolioState {
    return {
      id: input.id,
      candidateStrategyId: input.candidateStrategyId,
      cash: roundCurrency(input.initialCash),
      positions: {},
      trades: [],
      startedAt: input.startedAt,
      updatedAt: input.startedAt,
      safetyType: "SHADOW_PORTFOLIO_VIRTUAL_ONLY"
    };
  }

  step(input: ShadowPortfolioStepInput): ShadowPortfolioStepResult {
    const state = cloneState(input.state);
    const instruction = normalizeInstruction(input.instruction);

    if (instruction.action === "BUY" && instruction.allocationRatio > 0 && state.cash > 0) {
      const grossAmount = state.cash * instruction.allocationRatio;
      const simulatedFillPrice = input.market.price * (1 + input.costModel.slippageRate);
      const totalCost = grossAmount * input.costModel.commissionRate;
      const netAmount = Math.max(0, grossAmount - totalCost);
      const quantity = simulatedFillPrice <= 0 ? 0 : netAmount / simulatedFillPrice;

      if (quantity > 0) {
        state.cash = roundCurrency(state.cash - grossAmount);
        state.positions[input.market.assetId] = mergePosition(
          state.positions[input.market.assetId],
          input.market,
          quantity,
          simulatedFillPrice
        );
        state.trades.push(trade(input, "BUY", simulatedFillPrice, quantity, grossAmount, totalCost));
      }
    }

    if (instruction.action === "SELL" && instruction.allocationRatio > 0) {
      const position = state.positions[input.market.assetId];
      if (position && position.quantity > 0) {
        const quantity = position.quantity * instruction.allocationRatio;
        const simulatedFillPrice = input.market.price * (1 - input.costModel.slippageRate);
        const grossAmount = quantity * simulatedFillPrice;
        const totalCost = grossAmount * input.costModel.commissionRate;
        state.cash = roundCurrency(state.cash + grossAmount - totalCost);
        const remainingQuantity = position.quantity - quantity;

        if (remainingQuantity <= 0.00000001) {
          delete state.positions[input.market.assetId];
        } else {
          state.positions[input.market.assetId] = {
            ...position,
            quantity: remainingQuantity
          };
        }

        state.trades.push(trade(input, "SELL", simulatedFillPrice, quantity, grossAmount, totalCost));
      }
    }

    state.updatedAt = input.market.timestamp;

    return {
      state,
      performance: performanceRecord(state, input.market, input.costModel.version, input.initialEquity)
    };
  }
}

function normalizeInstruction(instruction: ShadowOrderInstruction): ShadowOrderInstruction {
  return {
    action: instruction.action,
    allocationRatio: Math.max(0, Math.min(1, Number.isFinite(instruction.allocationRatio) ? instruction.allocationRatio : 0))
  };
}

function mergePosition(
  existing: ShadowPosition | undefined,
  market: ShadowMarketInput,
  quantity: number,
  fillPrice: number
): ShadowPosition {
  if (!existing) {
    return {
      assetId: market.assetId,
      symbol: market.symbol,
      quantity,
      averagePrice: fillPrice
    };
  }

  const totalQuantity = existing.quantity + quantity;
  return {
    ...existing,
    quantity: totalQuantity,
    averagePrice: ((existing.averagePrice * existing.quantity) + (fillPrice * quantity)) / totalQuantity
  };
}

function trade(
  input: ShadowPortfolioStepInput,
  action: "BUY" | "SELL",
  simulatedFillPrice: number,
  quantity: number,
  grossAmount: number,
  totalCost: number
): ShadowTrade {
  return {
    strategyId: input.state.candidateStrategyId,
    assetId: input.market.assetId,
    symbol: input.market.symbol,
    action,
    timestamp: input.market.timestamp,
    requestedPrice: input.market.price,
    simulatedFillPrice: roundCurrency(simulatedFillPrice),
    quantity,
    grossAmount: roundCurrency(grossAmount),
    totalCost: roundCurrency(totalCost),
    inputReference: input.market.inputReference,
    safetyType: "SHADOW_TRADE_SIMULATED_ONLY"
  };
}

function performanceRecord(
  state: ShadowPortfolioState,
  market: ShadowMarketInput,
  costModelVersion: string,
  initialEquity: number
): ShadowPerformanceRecord {
  const positionValue = Object.values(state.positions).reduce((sum, position) => {
    if (position.assetId !== market.assetId) return sum;
    return sum + position.quantity * market.price;
  }, 0);
  const equity = state.cash + positionValue;

  return {
    portfolioId: state.id,
    candidateStrategyId: state.candidateStrategyId,
    cash: roundCurrency(state.cash),
    positionValue: roundCurrency(positionValue),
    equity: roundCurrency(equity),
    totalReturnRatio: initialEquity === 0 ? 0 : roundRatio((equity - initialEquity) / initialEquity),
    tradeCount: state.trades.length,
    costModelVersion,
    inputReferences: [...new Set(state.trades.map((item) => item.inputReference).concat(market.inputReference))],
    recordedAt: market.timestamp,
    safetyType: "SHADOW_PERFORMANCE_RECORD_ONLY"
  };
}

function cloneState(state: ShadowPortfolioState): ShadowPortfolioState {
  return {
    ...state,
    positions: Object.fromEntries(Object.entries(state.positions).map(([key, value]) => [key, { ...value }])),
    trades: state.trades.map((tradeItem) => ({ ...tradeItem }))
  };
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundRatio(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
