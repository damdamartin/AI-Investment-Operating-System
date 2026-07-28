import { describe, expect, it } from "vitest";
import { ShadowPortfolioEngine } from "../../src/index.js";

const costModel = {
  version: "shadow-cost-v1",
  commissionRate: 0.001,
  slippageRate: 0.01
};

describe("ShadowPortfolioEngine", () => {
  it("creates virtual portfolios isolated from production capital", () => {
    const state = new ShadowPortfolioEngine().createPortfolio({
      id: "shadow-1",
      candidateStrategyId: "candidate-strategy-1",
      initialCash: 1000,
      startedAt: new Date("2026-01-01T00:00:00Z")
    });

    expect(state).toMatchObject({
      id: "shadow-1",
      candidateStrategyId: "candidate-strategy-1",
      cash: 1000,
      positions: {},
      safetyType: "SHADOW_PORTFOLIO_VIRTUAL_ONLY"
    });
    expect(state).not.toHaveProperty("brokerAccountId");
    expect(state).not.toHaveProperty("liveTradingEnabled");
  });

  it("simulates buy fills with slippage and costs", () => {
    const engine = new ShadowPortfolioEngine();
    const state = engine.createPortfolio({
      id: "shadow-1",
      candidateStrategyId: "candidate-strategy-1",
      initialCash: 1000,
      startedAt: new Date("2026-01-01T00:00:00Z")
    });

    const result = engine.step({
      state,
      market: market(100, "market-ref-1"),
      instruction: { action: "BUY", allocationRatio: 0.5 },
      costModel,
      initialEquity: 1000
    });

    expect(result.state.cash).toBe(500);
    expect(result.state.positions["asset-aapl"]?.quantity).toBeCloseTo(4.9455, 4);
    expect(result.state.trades[0]).toMatchObject({
      action: "BUY",
      requestedPrice: 100,
      simulatedFillPrice: 101,
      grossAmount: 500,
      totalCost: 0.5,
      safetyType: "SHADOW_TRADE_SIMULATED_ONLY"
    });
    expect(result.performance.costModelVersion).toBe("shadow-cost-v1");
    expect(result.performance.inputReferences).toContain("market-ref-1");
  });

  it("simulates sell fills without creating broker orders", () => {
    const engine = new ShadowPortfolioEngine();
    const initial = engine.createPortfolio({
      id: "shadow-1",
      candidateStrategyId: "candidate-strategy-1",
      initialCash: 1000,
      startedAt: new Date("2026-01-01T00:00:00Z")
    });
    const bought = engine.step({
      state: initial,
      market: market(100, "market-ref-1"),
      instruction: { action: "BUY", allocationRatio: 1 },
      costModel,
      initialEquity: 1000
    }).state;

    const sold = engine.step({
      state: bought,
      market: market(110, "market-ref-2"),
      instruction: { action: "SELL", allocationRatio: 0.5 },
      costModel,
      initialEquity: 1000
    });

    expect(sold.state.trades).toHaveLength(2);
    expect(sold.state.trades[1]).toMatchObject({
      action: "SELL",
      requestedPrice: 110,
      simulatedFillPrice: 108.9,
      safetyType: "SHADOW_TRADE_SIMULATED_ONLY"
    });
    expect(sold.state.trades[1]).not.toHaveProperty("brokerOrderRef");
    expect(sold.performance.equity).toBeGreaterThan(1000);
  });

  it("keeps candidate strategies isolated in separate states", () => {
    const engine = new ShadowPortfolioEngine();
    const first = engine.createPortfolio({
      id: "shadow-1",
      candidateStrategyId: "candidate-1",
      initialCash: 1000,
      startedAt: new Date("2026-01-01T00:00:00Z")
    });
    const second = engine.createPortfolio({
      id: "shadow-2",
      candidateStrategyId: "candidate-2",
      initialCash: 2000,
      startedAt: new Date("2026-01-01T00:00:00Z")
    });

    const updatedFirst = engine.step({
      state: first,
      market: market(100, "market-ref-1"),
      instruction: { action: "BUY", allocationRatio: 1 },
      costModel,
      initialEquity: 1000
    }).state;

    expect(updatedFirst.cash).toBe(0);
    expect(second.cash).toBe(2000);
    expect(second.positions).toEqual({});
  });

  it("ignores HOLD instructions and remains virtual-only", () => {
    const engine = new ShadowPortfolioEngine();
    const state = engine.createPortfolio({
      id: "shadow-1",
      candidateStrategyId: "candidate-strategy-1",
      initialCash: 1000,
      startedAt: new Date("2026-01-01T00:00:00Z")
    });

    const result = engine.step({
      state,
      market: market(100, "market-ref-1"),
      instruction: { action: "HOLD", allocationRatio: 1 },
      costModel,
      initialEquity: 1000
    });

    expect(result.state.cash).toBe(1000);
    expect(result.state.trades).toEqual([]);
    expect(result.performance.safetyType).toBe("SHADOW_PERFORMANCE_RECORD_ONLY");
    expect(result).not.toHaveProperty("submitOrder");
  });
});

function market(price: number, inputReference: string) {
  return {
    assetId: "asset-aapl",
    symbol: "AAPL",
    price,
    timestamp: new Date("2026-01-01T00:00:00Z"),
    inputReference
  };
}
