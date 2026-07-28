import { describe, expect, it } from "vitest";
import {
  Asset,
  AssetType,
  BrokerAccount,
  BrokerOrder,
  Currency,
  DomainValidationError,
  EngineScoreSet,
  Market,
  Money,
  MoneyCheck,
  OrderApproval,
  OrderIntent,
  Price,
  Quantity,
  RiskCheck,
  Signal,
  StrategyVersion
} from "../../src/index.js";

function signal(): Signal {
  return new Signal({
    id: "signal-1",
    strategyVersion: new StrategyVersion({
      id: "version-1",
      strategyId: "strategy-1",
      version: "1.0.0",
      definitionHash: "hash-1"
    }),
    asset: new Asset({
      id: "asset-1",
      symbol: "AAPL",
      name: "Apple",
      market: Market.from("US"),
      assetType: AssetType.from("STOCK"),
      tradingStatus: "TRADABLE"
    }),
    direction: "BUY",
    scoreSet: new EngineScoreSet([{ engine: "market", score: 80, confidence: 0.9 }], "score-v1"),
    generatedAt: new Date("2026-01-01T00:00:00Z")
  });
}

function approvedIntent(): OrderIntent {
  const usd = Currency.from("USD");
  return new OrderIntent({
    id: "intent-1",
    signal: signal(),
    side: "BUY",
    quantity: Quantity.from("1"),
    limitPrice: Price.from("100.00", usd),
    status: "MONEY_CHECKED"
  }).transitionTo("APPROVED");
}

function passingRiskCheck(): RiskCheck {
  return new RiskCheck({
    id: "risk-check-1",
    subjectType: "ORDER_INTENT",
    subjectId: "intent-1",
    result: "PASS",
    riskLevel: "LOW",
    checkedAt: new Date("2026-01-01T00:00:00Z")
  });
}

function passingMoneyCheck(): MoneyCheck {
  const usd = Currency.from("USD");
  return new MoneyCheck({
    id: "money-check-1",
    orderIntentId: "intent-1",
    result: "PASS",
    approvedQuantity: Quantity.from("1"),
    approvedAmount: Money.fromMajor("100.00", usd),
    cashAfterOrder: Money.fromMajor("900.00", usd),
    checkedAt: new Date("2026-01-01T00:00:00Z")
  });
}

describe("safety regression harness", () => {
  it("proves a signal is not an order", () => {
    const candidate = signal();

    expect(candidate).toBeInstanceOf(Signal);
    expect(candidate).not.toBeInstanceOf(OrderIntent);
    expect(candidate).not.toBeInstanceOf(BrokerOrder);
  });

  it("blocks approved order approvals when risk fails", () => {
    const failedRisk = new RiskCheck({
      id: "risk-check-1",
      subjectType: "ORDER_INTENT",
      subjectId: "intent-1",
      result: "FAIL",
      riskLevel: "HIGH",
      failedLimitIds: ["limit-1"],
      checkedAt: new Date("2026-01-01T00:00:00Z")
    });

    expect(
      () =>
        new OrderApproval({
          id: "approval-1",
          orderIntent: approvedIntent(),
          riskCheck: failedRisk,
          moneyCheck: passingMoneyCheck(),
          status: "APPROVED",
          reasons: []
        })
    ).toThrow(DomainValidationError);
  });

  it("blocks approved order approvals when money fails", () => {
    const failedMoney = new MoneyCheck({
      id: "money-check-1",
      orderIntentId: "intent-1",
      result: "FAIL",
      reasons: ["insufficient_cash"],
      checkedAt: new Date("2026-01-01T00:00:00Z")
    });

    expect(
      () =>
        new OrderApproval({
          id: "approval-1",
          orderIntent: approvedIntent(),
          riskCheck: passingRiskCheck(),
          moneyCheck: failedMoney,
          status: "APPROVED",
          reasons: []
        })
    ).toThrow(DomainValidationError);
  });

  it("keeps unverified broker accounts live-write blocked", () => {
    const account = new BrokerAccount({
      id: "broker-account-1",
      broker: "TOSS_SECURITIES",
      externalAccountRef: "account-1",
      accountLabel: "Main",
      liveTradingEnabled: true
    });

    expect(account.canWriteLive()).toBe(false);
  });
});
