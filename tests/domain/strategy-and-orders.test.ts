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
  Strategy,
  StrategyVersion
} from "../../src/index.js";

function testAsset(): Asset {
  return new Asset({
    id: "asset-1",
    symbol: "AAPL",
    name: "Apple",
    market: Market.from("US"),
    assetType: AssetType.from("STOCK"),
    tradingStatus: "TRADABLE"
  });
}

function testSignal(): Signal {
  const strategy = new Strategy({ id: "strategy-1", name: "Baseline" });
  const strategyVersion = new StrategyVersion({
    id: "version-1",
    strategyId: strategy.id,
    version: "1.0.0",
    definitionHash: "hash-1"
  });

  return new Signal({
    id: "signal-1",
    strategyVersion,
    asset: testAsset(),
    direction: "BUY",
    scoreSet: new EngineScoreSet([{ engine: "market", score: 70, confidence: 0.8 }], "score-v1"),
    generatedAt: new Date("2026-01-01T00:00:00Z")
  });
}

function approvedOrderIntent(): OrderIntent {
  const usd = Currency.from("USD");
  return new OrderIntent({
    id: "intent-1",
    signal: testSignal(),
    side: "BUY",
    quantity: Quantity.from("1"),
    limitPrice: Price.from("100.00", usd),
    status: "MONEY_CHECKED"
  }).transitionTo("APPROVED");
}

function passingRiskCheck(subjectId = "intent-1"): RiskCheck {
  return new RiskCheck({
    id: "risk-check-1",
    subjectType: "ORDER_INTENT",
    subjectId,
    result: "PASS",
    riskLevel: "LOW",
    checkedAt: new Date("2026-01-01T00:00:00Z")
  });
}

function passingMoneyCheck(orderIntentId = "intent-1"): MoneyCheck {
  const usd = Currency.from("USD");
  return new MoneyCheck({
    id: "money-check-1",
    orderIntentId,
    result: "PASS",
    approvedQuantity: Quantity.from("1"),
    approvedAmount: Money.fromMajor("100.00", usd),
    cashAfterOrder: Money.fromMajor("900.00", usd),
    checkedAt: new Date("2026-01-01T00:00:00Z")
  });
}

describe("strategy and signal domain model", () => {
  it("prevents strategy versions from skipping validation stages", () => {
    const version = new StrategyVersion({
      id: "version-1",
      strategyId: "strategy-1",
      version: "1.0.0",
      definitionHash: "hash-1"
    });

    expect(() => version.transitionTo("PRODUCTION_ACTIVE")).toThrow(DomainValidationError);
    expect(version.transitionTo("BACKTESTED").status).toBe("BACKTESTED");
  });

  it("keeps approved strategy versions immutable by returning transitioned copies", () => {
    const draft = new StrategyVersion({
      id: "version-1",
      strategyId: "strategy-1",
      version: "1.0.0",
      definitionHash: "hash-1"
    });
    const backtested = draft.transitionTo("BACKTESTED");

    expect(draft.status).toBe("DRAFT");
    expect(backtested.status).toBe("BACKTESTED");
  });

  it("validates engine score ranges", () => {
    expect(() => new EngineScoreSet([{ engine: "market", score: 101, confidence: 0.8 }], "v1")).toThrow(
      DomainValidationError
    );
    expect(() => new EngineScoreSet([{ engine: "market", score: 50, confidence: 1.1 }], "v1")).toThrow(
      DomainValidationError
    );
  });

  it("creates signals without creating orders", () => {
    const signal = testSignal();

    expect(signal.direction).toBe("BUY");
    expect(signal).not.toHaveProperty("brokerOrderRef");
  });
});

describe("order state machines", () => {
  it("requires ordered transitions for order intents", () => {
    const usd = Currency.from("USD");
    const intent = new OrderIntent({
      id: "intent-1",
      signal: testSignal(),
      side: "BUY",
      quantity: Quantity.from("1"),
      limitPrice: Price.from("100.00", usd)
    });

    expect(() => intent.transitionTo("APPROVED")).toThrow(DomainValidationError);
    expect(intent.transitionTo("RISK_CHECKED").transitionTo("MONEY_CHECKED").transitionTo("APPROVED").status).toBe(
      "APPROVED"
    );
  });

  it("does not allow approved OrderApproval without approved OrderIntent", () => {
    const usd = Currency.from("USD");
    const intent = new OrderIntent({
      id: "intent-1",
      signal: testSignal(),
      side: "BUY",
      quantity: Quantity.from("1"),
      limitPrice: Price.from("100.00", usd)
    });

    expect(
      () =>
        new OrderApproval({
          id: "approval-1",
          orderIntent: intent,
          riskCheck: passingRiskCheck(),
          moneyCheck: passingMoneyCheck(),
          status: "APPROVED",
          reasons: []
        })
    ).toThrow(DomainValidationError);
  });

  it("does not allow broker orders without approved approvals", () => {
    const rejectedApproval = new OrderApproval({
      id: "approval-1",
      orderIntent: approvedOrderIntent(),
      riskCheck: new RiskCheck({
        id: "risk-check-1",
        subjectType: "ORDER_INTENT",
        subjectId: "intent-1",
        result: "FAIL",
        riskLevel: "HIGH",
        failedLimitIds: ["limit-1"],
        checkedAt: new Date("2026-01-01T00:00:00Z")
      }),
      moneyCheck: passingMoneyCheck(),
      status: "REJECTED",
      reasons: ["risk_failed"]
    });

    expect(
      () =>
        new BrokerOrder({
          id: "broker-order-1",
          approval: rejectedApproval,
          brokerAccount: new BrokerAccount({
            id: "broker-account-1",
            broker: "TOSS_SECURITIES",
            externalAccountRef: "account-1",
            accountLabel: "Main"
          })
        })
    ).toThrow(DomainValidationError);
  });

  it("represents unknown broker state as blocking dependent trading", () => {
    const approval = new OrderApproval({
      id: "approval-1",
      orderIntent: approvedOrderIntent(),
      riskCheck: passingRiskCheck(),
      moneyCheck: passingMoneyCheck(),
      status: "APPROVED",
      reasons: []
    });
    const brokerOrder = new BrokerOrder({
      id: "broker-order-1",
      approval,
      brokerAccount: new BrokerAccount({
        id: "broker-account-1",
        broker: "TOSS_SECURITIES",
        externalAccountRef: "account-1",
        accountLabel: "Main"
      }),
      status: "UNKNOWN"
    });

    expect(brokerOrder.blocksDependentTrading()).toBe(true);
  });

  it("still keeps money arithmetic available for later money checks", () => {
    const usd = Currency.from("USD");

    expect(Money.fromMajor("1.00", usd).add(Money.fromMajor("2.00", usd)).toMajorString()).toBe("3.00");
  });

  it("does not allow approved OrderApproval with failed risk or money checks", () => {
    const failedRisk = new RiskCheck({
      id: "risk-check-1",
      subjectType: "ORDER_INTENT",
      subjectId: "intent-1",
      result: "FAIL",
      riskLevel: "HIGH",
      failedLimitIds: ["limit-1"],
      checkedAt: new Date("2026-01-01T00:00:00Z")
    });
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
          orderIntent: approvedOrderIntent(),
          riskCheck: failedRisk,
          moneyCheck: passingMoneyCheck(),
          status: "APPROVED",
          reasons: []
        })
    ).toThrow(DomainValidationError);

    expect(
      () =>
        new OrderApproval({
          id: "approval-2",
          orderIntent: approvedOrderIntent(),
          riskCheck: passingRiskCheck(),
          moneyCheck: failedMoney,
          status: "APPROVED",
          reasons: []
        })
    ).toThrow(DomainValidationError);
  });
});
