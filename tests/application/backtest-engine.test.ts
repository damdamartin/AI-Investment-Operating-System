import { describe, expect, it } from "vitest";
import { BacktestEngine, type BacktestStrategy, type HistoricalBar } from "../../src/index.js";

const buyAndHold: BacktestStrategy = (bar, previous) => ({
  action: previous ? "HOLD" : "BUY",
  allocationRatio: 1
});

describe("BacktestEngine", () => {
  it("requires a cost model version", () => {
    const result = new BacktestEngine().run({
      strategyVersionId: "strategy-version-1",
      data: bars(),
      initialCash: 1000,
      strategy: buyAndHold
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.refusal.reasons).toContain("missing_cost_model_version");
  });

  it("applies cost model and records data range and input references", () => {
    const result = new BacktestEngine().run({
      strategyVersionId: "strategy-version-1",
      data: bars(),
      initialCash: 1000,
      costModel: {
        version: "cost-v1",
        commissionRate: 0.001,
        slippageRate: 0.001
      },
      strategy: buyAndHold
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.result.costModelVersion).toBe("cost-v1");
    expect(result.ok && result.result.startedAt.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(result.ok && result.result.endedAt.toISOString()).toBe("2026-01-03T00:00:00.000Z");
    expect(result.ok && result.result.inputReferences).toEqual(["bar-1", "bar-2", "bar-3"]);
    expect(result.ok && result.result.trades[0]?.totalCost).toBe(2);
    expect(result.ok && result.result.finalEquity).toBe(1197.6);
    expect(result.ok && result.result.safetyType).toBe("BACKTEST_RESULT_ONLY");
    expect(result.ok && result.result).not.toHaveProperty("promoteStrategy");
    expect(result.ok && result.result).not.toHaveProperty("order");
  });

  it("flags missing corporate action data when not blocking", () => {
    const result = new BacktestEngine().run({
      strategyVersionId: "strategy-version-1",
      data: bars({ corporateActionChecked: false }),
      initialCash: 1000,
      costModel: {
        version: "cost-v1",
        commissionRate: 0,
        slippageRate: 0
      },
      strategy: buyAndHold
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.result.warnings).toContain("missing_corporate_action_data");
    expect(result.ok && result.result.blocked).toBe(false);
  });

  it("blocks when missing corporate action data is configured as blocking", () => {
    const result = new BacktestEngine().run({
      strategyVersionId: "strategy-version-1",
      data: bars({ corporateActionChecked: false }),
      initialCash: 1000,
      costModel: {
        version: "cost-v1",
        commissionRate: 0,
        slippageRate: 0
      },
      strategy: buyAndHold,
      blockOnMissingCorporateActions: true
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.refusal.reasons).toContain("missing_corporate_action_data");
  });

  it("calculates max drawdown from simulated equity", () => {
    const result = new BacktestEngine().run({
      strategyVersionId: "strategy-version-1",
      data: [
        bar("bar-1", "2026-01-01T00:00:00Z", 100),
        bar("bar-2", "2026-01-02T00:00:00Z", 80),
        bar("bar-3", "2026-01-03T00:00:00Z", 120)
      ],
      initialCash: 1000,
      costModel: {
        version: "cost-v1",
        commissionRate: 0,
        slippageRate: 0
      },
      strategy: buyAndHold
    });

    expect(result.ok && result.result.maxDrawdownRatio).toBe(0.2);
  });
});

function bars(options: { corporateActionChecked?: boolean } = {}): HistoricalBar[] {
  return [
    bar("bar-1", "2026-01-01T00:00:00Z", 100, options.corporateActionChecked),
    bar("bar-2", "2026-01-02T00:00:00Z", 110, options.corporateActionChecked),
    bar("bar-3", "2026-01-03T00:00:00Z", 120, options.corporateActionChecked)
  ];
}

function bar(
  inputReference: string,
  timestamp: string,
  close: number,
  corporateActionChecked = true
): HistoricalBar {
  return {
    assetId: "asset-aapl",
    symbol: "AAPL",
    timestamp: new Date(timestamp),
    close,
    volume: 1_000_000,
    inputReference,
    corporateActionChecked
  };
}
