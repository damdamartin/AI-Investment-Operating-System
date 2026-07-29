import { describe, expect, it } from "vitest";
import {
  Asset,
  AssetType,
  Currency,
  EngineScoreSet,
  KillSwitchState,
  Market,
  Money,
  OrderIntent,
  Price,
  Quantity,
  RiskEngine,
  Signal,
  StrategyVersion
} from "../../src/index.js";

const usd = Currency.from("USD");

describe("RiskEngine", () => {
  it("passes when all hard risk rules are within limits", () => {
    const output = new RiskEngine().evaluate(baseInput());

    expect(output.riskCheck.result).toBe("PASS");
    expect(output.riskCheck.allowsApproval()).toBe(true);
    expect(output.reasonCodes).toEqual([]);
    expect(output.safetyType).toBe("RISK_ENGINE_CHECK_ONLY");
  });

  it("fails when order amount exceeds the hard maximum", () => {
    const output = new RiskEngine().evaluate({
      ...baseInput(),
      orderAmount: Money.fromMajor("1500.00", usd)
    });

    expect(output.riskCheck.result).toBe("FAIL");
    expect(output.riskCheck.allowsApproval()).toBe(false);
    expect(output.reasonCodes).toContain("max_order_amount_exceeded");
    expect(output.riskCheck.failedLimitIds).toContain("max-order-amount");
  });

  it("fails position, strategy, and market exposure limits", () => {
    const output = new RiskEngine().evaluate({
      ...baseInput(),
      portfolio: {
        ...basePortfolio(),
        currentAssetExposure: Money.fromMajor("2600.00", usd),
        currentStrategyExposure: Money.fromMajor("4200.00", usd),
        currentMarketExposure: Money.fromMajor("7300.00", usd)
      }
    });

    expect(output.riskCheck.result).toBe("FAIL");
    expect(output.reasonCodes).toEqual(
      expect.arrayContaining([
        "max_position_exposure_exceeded",
        "max_strategy_exposure_exceeded",
        "max_market_exposure_exceeded"
      ])
    );
  });

  it("blocks when kill switch is active", () => {
    const output = new RiskEngine().evaluate({
      ...baseInput(),
      killSwitches: [
        new KillSwitchState({
          id: "kill-switch-1",
          scope: "ACCOUNT",
          active: true,
          reason: "manual stop"
        })
      ]
    });

    expect(output.riskCheck.result).toBe("BLOCKED");
    expect(output.riskCheck.riskLevel).toBe("CRITICAL");
    expect(output.reasonCodes).toContain("kill_switch_active");
    expect(output.riskCheck.failedLimitIds).toContain("kill-switch-1");
  });

  it("blocks when drawdown gate is exceeded", () => {
    const output = new RiskEngine().evaluate({
      ...baseInput(),
      portfolio: {
        ...basePortfolio(),
        currentDrawdownRatio: 0.21
      }
    });

    expect(output.riskCheck.result).toBe("BLOCKED");
    expect(output.reasonCodes).toContain("max_drawdown_exceeded");
    expect(output.riskCheck.failedLimitIds).toContain("max-drawdown");
  });

  it("blocks when the shared kill-switch control gate is not allowed, even with no local KillSwitchState", () => {
    const output = new RiskEngine().evaluate({
      ...baseInput(),
      killSwitchGate: {
        allowed: false,
        blocksNewOrders: true,
        reasonCodes: ["kill_switch_active_global"],
        brokerWriteGate: { active: true, scope: "GLOBAL", reason: "manual stop" },
        safetyType: "KILL_SWITCH_TRADING_GATE_ONLY"
      }
    });

    expect(output.riskCheck.result).toBe("BLOCKED");
    expect(output.riskCheck.riskLevel).toBe("CRITICAL");
    // The risk engine must reuse the kill-switch service's own reason code
    // rather than inventing a second, divergent vocabulary.
    expect(output.reasonCodes).toContain("kill_switch_active_global");
    expect(output.riskCheck.failedLimitIds).toContain("kill-switch-gate");
  });

  it("passes when the shared kill-switch control gate explicitly allows trading", () => {
    const output = new RiskEngine().evaluate({
      ...baseInput(),
      killSwitchGate: {
        allowed: true,
        blocksNewOrders: false,
        reasonCodes: [],
        brokerWriteGate: { active: false, scope: "GLOBAL" },
        safetyType: "KILL_SWITCH_TRADING_GATE_ONLY"
      }
    });

    expect(output.riskCheck.result).toBe("PASS");
    expect(output.reasonCodes).toEqual([]);
  });

  it("returns deterministically sorted, deduplicated reason codes and failed limit ids", () => {
    const output = new RiskEngine().evaluate({
      ...baseInput(),
      orderAmount: Money.fromMajor("1500.00", usd),
      killSwitches: [
        new KillSwitchState({ id: "kill-switch-1", scope: "ACCOUNT", active: true, reason: "manual stop" })
      ],
      portfolio: {
        ...basePortfolio(),
        currentDrawdownRatio: 0.21
      }
    });

    const sorted = [...output.reasonCodes].sort();
    expect(output.reasonCodes).toEqual(sorted);
    expect(output.reasonCodes).toEqual([...new Set(output.reasonCodes)]);

    const sortedLimits = [...output.riskCheck.failedLimitIds].sort();
    expect(output.riskCheck.failedLimitIds).toEqual(sortedLimits);
  });
});

function baseInput() {
  return {
    riskCheckId: "risk-check-1",
    orderIntent: orderIntent(),
    orderAmount: Money.fromMajor("500.00", usd),
    limits: {
      maxOrderAmount: Money.fromMajor("1000.00", usd),
      maxPositionExposureRatio: 0.3,
      maxStrategyExposureRatio: 0.45,
      maxMarketExposureRatio: 0.75,
      maxDrawdownRatio: 0.2
    },
    portfolio: basePortfolio(),
    checkedAt: new Date("2026-01-01T00:00:00Z")
  };
}

function basePortfolio() {
  return {
    totalEquity: Money.fromMajor("10000.00", usd),
    currentAssetExposure: Money.fromMajor("1000.00", usd),
    currentStrategyExposure: Money.fromMajor("2000.00", usd),
    currentMarketExposure: Money.fromMajor("5000.00", usd),
    currentDrawdownRatio: 0.05
  };
}

function orderIntent(): OrderIntent {
  return new OrderIntent({
    id: "intent-1",
    signal: new Signal({
      id: "signal-1",
      strategyVersion: new StrategyVersion({
        id: "version-1",
        strategyId: "strategy-1",
        version: "1.0.0",
        definitionHash: "hash-1"
      }),
      asset: new Asset({
        id: "asset-aapl",
        symbol: "AAPL",
        name: "Apple",
        market: Market.from("US"),
        assetType: AssetType.from("STOCK"),
        tradingStatus: "TRADABLE"
      }),
      direction: "BUY",
      scoreSet: new EngineScoreSet([{ engine: "STRATEGY_COMPOSITE", score: 70, confidence: 0.8 }], "score-v1"),
      generatedAt: new Date("2026-01-01T00:00:00Z")
    }),
    side: "BUY",
    quantity: Quantity.from("1"),
    limitPrice: Price.from("500.00", usd)
  });
}
