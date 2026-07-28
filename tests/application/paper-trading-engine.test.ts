import { describe, expect, it } from "vitest";
import {
  Asset,
  AssetType,
  BrokerAccount,
  Currency,
  EngineScoreSet,
  Market,
  Money,
  MoneyCheck,
  OrderApproval,
  OrderIntent,
  PaperTradingEngine,
  Price,
  Quantity,
  RiskCheck,
  Signal,
  StrategyVersion
} from "../../src/index.js";

describe("PaperTradingEngine", () => {
  it("submits approved orders into a paper-only lifecycle", () => {
    const result = new PaperTradingEngine().submit({
      paperOrderId: "paper-order-1",
      approval: approvedOrderApproval(),
      submittedAt: new Date("2026-01-01T00:00:00Z")
    });

    expect(result.order.status).toBe("SUBMITTED");
    expect(result.order.safetyType).toBe("PAPER_ORDER_SIMULATED_ONLY");
    expect(result.safetyType).toBe("PAPER_TRADING_RESULT_SIMULATED_ONLY");
    expect(result.order).not.toHaveProperty("brokerOrderRef");
    expect(result.order).not.toHaveProperty("brokerAccountId");
  });

  it("simulates accepted, partial fill, and filled states", () => {
    const engine = new PaperTradingEngine();
    const submitted = engine.submit({
      paperOrderId: "paper-order-1",
      approval: approvedOrderApproval(),
      submittedAt: new Date("2026-01-01T00:00:00Z")
    }).order;
    const accepted = engine.applyEvent({
      order: submitted,
      eventId: "paper-event-1",
      type: "ACCEPT",
      occurredAt: new Date("2026-01-01T00:00:01Z")
    }).order;
    const partial = engine.applyEvent({
      order: accepted,
      eventId: "paper-event-2",
      type: "PARTIAL_FILL",
      occurredAt: new Date("2026-01-01T00:00:02Z"),
      fillQuantity: 0.4,
      fillPrice: 101
    });
    const filled = engine.applyEvent({
      order: partial.order,
      eventId: "paper-event-3",
      type: "FILL",
      occurredAt: new Date("2026-01-01T00:00:03Z"),
      fillPrice: 102
    });

    expect(accepted.status).toBe("ACCEPTED");
    expect(partial.order.status).toBe("PARTIALLY_FILLED");
    expect(partial.fills[0]?.safetyType).toBe("PAPER_FILL_SIMULATED_ONLY");
    expect(filled.order.status).toBe("FILLED");
    expect(filled.order.filledQuantity).toBe(1);
    expect(filled.order.averageFillPrice).toBe(101.6);
  });

  it("keeps rejected approvals out of the simulated order lifecycle", () => {
    const result = new PaperTradingEngine().submit({
      paperOrderId: "paper-order-1",
      approval: rejectedOrderApproval(),
      submittedAt: new Date("2026-01-01T00:00:00Z")
    });

    expect(result.order.status).toBe("REJECTED");
    expect(result.order.rejectionReasons).toContain("approval_not_approved");
  });

  it("blocks live broker write-enabled accounts from paper trading", () => {
    const result = new PaperTradingEngine().submit({
      paperOrderId: "paper-order-1",
      approval: approvedOrderApproval(),
      submittedAt: new Date("2026-01-01T00:00:00Z"),
      brokerAccount: new BrokerAccount({
        id: "broker-account-1",
        broker: "TOSS_SECURITIES",
        externalAccountRef: "account-1",
        accountLabel: "Main",
        permissionStatus: "LIVE_TRADING_ALLOWED",
        readOnlyEnabled: true,
        liveTradingEnabled: true
      })
    });

    expect(result.order.status).toBe("REJECTED");
    expect(result.order.rejectionReasons).toContain("live_broker_account_not_allowed_for_paper_trading");
  });

  it("marks unknown paper broker state as blocking dependent trading", () => {
    const engine = new PaperTradingEngine();
    const submitted = engine.submit({
      paperOrderId: "paper-order-1",
      approval: approvedOrderApproval(),
      submittedAt: new Date("2026-01-01T00:00:00Z")
    }).order;
    const unknown = engine.applyEvent({
      order: submitted,
      eventId: "paper-event-unknown",
      type: "UNKNOWN",
      occurredAt: new Date("2026-01-01T00:00:01Z"),
      reason: "paper_broker_timeout"
    });

    expect(unknown.order.status).toBe("UNKNOWN");
    expect(unknown.blocksDependentTrading).toBe(true);
    expect(unknown.order.rejectionReasons).toContain("paper_broker_timeout");
  });
});

function approvedOrderApproval(): OrderApproval {
  return new OrderApproval({
    id: "approval-1",
    orderIntent: approvedOrderIntent(),
    riskCheck: passingRiskCheck(),
    moneyCheck: passingMoneyCheck(),
    status: "APPROVED",
    reasons: []
  });
}

function rejectedOrderApproval(): OrderApproval {
  return new OrderApproval({
    id: "approval-1",
    orderIntent: approvedOrderIntent(),
    riskCheck: passingRiskCheck(),
    moneyCheck: passingMoneyCheck(),
    status: "REJECTED",
    reasons: ["manual_test_rejection"]
  });
}

function approvedOrderIntent(): OrderIntent {
  return new OrderIntent({
    id: "intent-1",
    signal: signal(),
    side: "BUY",
    quantity: Quantity.from("1"),
    limitPrice: Price.from("100.00", Currency.from("USD")),
    status: "MONEY_CHECKED"
  }).transitionTo("APPROVED");
}

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
      id: "asset-aapl",
      symbol: "AAPL",
      name: "Apple",
      market: Market.from("US"),
      assetType: AssetType.from("STOCK"),
      tradingStatus: "TRADABLE"
    }),
    direction: "BUY",
    scoreSet: new EngineScoreSet([{ engine: "STRATEGY_COMPOSITE", score: 75, confidence: 0.8 }], "score-v1"),
    generatedAt: new Date("2026-01-01T00:00:00Z")
  });
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
  return new MoneyCheck({
    id: "money-check-1",
    orderIntentId: "intent-1",
    result: "PASS",
    approvedQuantity: Quantity.from("1"),
    approvedAmount: Money.fromMajor("100.00", Currency.from("USD")),
    cashAfterOrder: Money.fromMajor("900.00", Currency.from("USD")),
    checkedAt: new Date("2026-01-01T00:00:00Z")
  });
}
