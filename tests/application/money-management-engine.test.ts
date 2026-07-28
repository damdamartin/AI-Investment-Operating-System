import { describe, expect, it } from "vitest";
import {
  Asset,
  AssetType,
  CashBalance,
  Currency,
  EngineScoreSet,
  Market,
  Money,
  MoneyManagementEngine,
  OrderIntent,
  Price,
  Quantity,
  Signal,
  StrategyVersion
} from "../../src/index.js";

const usd = Currency.from("USD");

describe("MoneyManagementEngine", () => {
  it("passes when available cash and allocation limits are sufficient", () => {
    const output = new MoneyManagementEngine().evaluate(baseInput());

    expect(output.moneyCheck.result).toBe("PASS");
    expect(output.moneyCheck.allowsApproval()).toBe(true);
    expect(output.moneyCheck.approvedAmount?.toMajorString()).toBe("500.00");
    expect(output.cashAfterOrder?.toMajorString()).toBe("1500.00");
    expect(output.safetyType).toBe("MONEY_MANAGEMENT_CHECK_ONLY");
  });

  it("uses available cash only and does not treat reserved or unsettled cash as buying power", () => {
    const output = new MoneyManagementEngine().evaluate({
      ...baseInput(),
      requestedAmount: Money.fromMajor("600.00", usd),
      state: {
        ...baseInput().state,
        cashBalance: cashBalance({
          available: "500.00",
          reserved: "1000.00",
          unsettled: "1000.00"
        })
      }
    });

    expect(output.moneyCheck.result).toBe("FAIL");
    expect(output.reasonCodes).toContain("insufficient_available_cash");
    expect(output.moneyCheck.allowsApproval()).toBe(false);
  });

  it("fails when requested order exceeds per-order cap", () => {
    const output = new MoneyManagementEngine().evaluate({
      ...baseInput(),
      requestedAmount: Money.fromMajor("1200.00", usd)
    });

    expect(output.moneyCheck.result).toBe("FAIL");
    expect(output.reasonCodes).toContain("max_order_amount_exceeded");
  });

  it("fails when strategy allocation cap would be exceeded", () => {
    const output = new MoneyManagementEngine().evaluate({
      ...baseInput(),
      state: {
        ...baseInput().state,
        currentStrategyAllocation: Money.fromMajor("1800.00", usd)
      }
    });

    expect(output.moneyCheck.result).toBe("FAIL");
    expect(output.reasonCodes).toContain("max_strategy_allocation_exceeded");
  });

  it("fails when minimum cash after order would be breached", () => {
    const output = new MoneyManagementEngine().evaluate({
      ...baseInput(),
      requestedAmount: Money.fromMajor("1800.00", usd),
      limits: {
        ...baseInput().limits,
        maxOrderAmount: Money.fromMajor("2000.00", usd),
        maxStrategyAllocation: Money.fromMajor("3000.00", usd)
      }
    });

    expect(output.moneyCheck.result).toBe("FAIL");
    expect(output.reasonCodes).toContain("minimum_cash_after_order_breached");
  });
});

function baseInput() {
  return {
    moneyCheckId: "money-check-1",
    orderIntent: orderIntent(),
    requestedAmount: Money.fromMajor("500.00", usd),
    state: {
      cashBalance: cashBalance(),
      currentStrategyAllocation: Money.fromMajor("500.00", usd)
    },
    limits: {
      maxOrderAmount: Money.fromMajor("1000.00", usd),
      maxStrategyAllocation: Money.fromMajor("2000.00", usd),
      minCashAfterOrder: Money.fromMajor("300.00", usd)
    },
    checkedAt: new Date("2026-01-01T00:00:00Z")
  };
}

function cashBalance(overrides: { available?: string; reserved?: string; unsettled?: string } = {}): CashBalance {
  return new CashBalance({
    id: "cash-1",
    portfolioId: "portfolio-1",
    currency: usd,
    available: Money.fromMajor(overrides.available ?? "2000.00", usd),
    reserved: Money.fromMajor(overrides.reserved ?? "100.00", usd),
    unsettled: Money.fromMajor(overrides.unsettled ?? "50.00", usd),
    updatedAt: new Date("2026-01-01T00:00:00Z")
  });
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
