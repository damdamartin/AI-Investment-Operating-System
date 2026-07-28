export interface HistoricalBar {
  assetId: string;
  symbol: string;
  timestamp: Date;
  close: number;
  volume: number;
  inputReference: string;
  corporateActionChecked: boolean;
}

export interface CostModel {
  version: string;
  commissionRate: number;
  slippageRate: number;
}

export interface BacktestStrategyDecision {
  action: "BUY" | "SELL" | "HOLD";
  allocationRatio: number;
}

export type BacktestStrategy = (bar: HistoricalBar, previousBar: HistoricalBar | undefined) => BacktestStrategyDecision;

export interface BacktestEngineInput {
  strategyVersionId: string;
  data: HistoricalBar[];
  initialCash: number;
  costModel?: CostModel | undefined;
  strategy: BacktestStrategy;
  blockOnMissingCorporateActions?: boolean;
}

export interface BacktestTrade {
  action: "BUY" | "SELL";
  timestamp: Date;
  price: number;
  quantity: number;
  grossAmount: number;
  totalCost: number;
}

export interface BacktestResult {
  strategyVersionId: string;
  costModelVersion: string;
  startedAt: Date;
  endedAt: Date;
  inputReferences: string[];
  trades: BacktestTrade[];
  finalEquity: number;
  totalReturnRatio: number;
  maxDrawdownRatio: number;
  warnings: string[];
  blocked: boolean;
  blockReasons: string[];
  safetyType: "BACKTEST_RESULT_ONLY";
}

export interface BacktestRefusal {
  refused: true;
  reasons: string[];
  safetyType: "BACKTEST_REFUSAL_ONLY";
}

export type BacktestEngineResult =
  | {
      ok: true;
      result: BacktestResult;
    }
  | {
      ok: false;
      refusal: BacktestRefusal;
    };

export class BacktestEngine {
  run(input: BacktestEngineInput): BacktestEngineResult {
    if (!input.costModel?.version) {
      return refused(["missing_cost_model_version"]);
    }

    const data = [...input.data].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    if (data.length === 0) {
      return refused(["missing_historical_data"]);
    }

    const missingCorporateActions = data.some((bar) => !bar.corporateActionChecked);
    if (missingCorporateActions && input.blockOnMissingCorporateActions === true) {
      return refused(["missing_corporate_action_data"]);
    }

    let cash = input.initialCash;
    let quantity = 0;
    let peakEquity = input.initialCash;
    let maxDrawdownRatio = 0;
    const trades: BacktestTrade[] = [];
    const warnings = missingCorporateActions ? ["missing_corporate_action_data"] : [];

    for (let index = 0; index < data.length; index += 1) {
      const bar = data[index]!;
      const previousBar = index === 0 ? undefined : data[index - 1];
      const decision = input.strategy(bar, previousBar);

      if (decision.action === "BUY" && cash > 0 && decision.allocationRatio > 0) {
        const grossAmount = cash * clampRatio(decision.allocationRatio);
        const totalCost = costFor(grossAmount, input.costModel);
        const netAmount = Math.max(0, grossAmount - totalCost);
        const boughtQuantity = netAmount / bar.close;
        cash -= grossAmount;
        quantity += boughtQuantity;
        trades.push({
          action: "BUY",
          timestamp: bar.timestamp,
          price: bar.close,
          quantity: boughtQuantity,
          grossAmount,
          totalCost
        });
      }

      if (decision.action === "SELL" && quantity > 0) {
        const sellQuantity = quantity * clampRatio(decision.allocationRatio);
        const grossAmount = sellQuantity * bar.close;
        const totalCost = costFor(grossAmount, input.costModel);
        cash += grossAmount - totalCost;
        quantity -= sellQuantity;
        trades.push({
          action: "SELL",
          timestamp: bar.timestamp,
          price: bar.close,
          quantity: sellQuantity,
          grossAmount,
          totalCost
        });
      }

      const equity = cash + quantity * bar.close;
      peakEquity = Math.max(peakEquity, equity);
      maxDrawdownRatio = Math.max(maxDrawdownRatio, peakEquity === 0 ? 0 : (peakEquity - equity) / peakEquity);
    }

    const last = data[data.length - 1]!;
    const finalEquity = cash + quantity * last.close;

    return {
      ok: true,
      result: {
        strategyVersionId: input.strategyVersionId,
        costModelVersion: input.costModel.version,
        startedAt: data[0]!.timestamp,
        endedAt: last.timestamp,
        inputReferences: data.map((bar) => bar.inputReference),
        trades,
        finalEquity: roundCurrency(finalEquity),
        totalReturnRatio: input.initialCash === 0 ? 0 : roundRatio((finalEquity - input.initialCash) / input.initialCash),
        maxDrawdownRatio: roundRatio(maxDrawdownRatio),
        warnings,
        blocked: false,
        blockReasons: [],
        safetyType: "BACKTEST_RESULT_ONLY"
      }
    };
  }
}

function refused(reasons: string[]): BacktestEngineResult {
  return {
    ok: false,
    refusal: {
      refused: true,
      reasons,
      safetyType: "BACKTEST_REFUSAL_ONLY"
    }
  };
}

function costFor(grossAmount: number, costModel: CostModel): number {
  return grossAmount * (costModel.commissionRate + costModel.slippageRate);
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundRatio(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
