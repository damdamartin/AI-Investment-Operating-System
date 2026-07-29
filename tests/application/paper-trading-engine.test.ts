import { describe, expect, it } from "vitest";
import {
  Asset,
  AssetType,
  AuditLogService,
  BrokerAccount,
  Currency,
  EngineScoreSet,
  InMemoryAuditLogSink,
  Market,
  Money,
  MoneyCheck,
  OrderApproval,
  OrderIntent,
  PaperOrderIntentPipeline,
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

  it("keeps live broker write metadata false on every submit and event output", () => {
    const engine = new PaperTradingEngine();
    const submitted = engine.submit({
      paperOrderId: "paper-order-1",
      approval: approvedOrderApproval(),
      submittedAt: new Date("2026-01-01T00:00:00Z")
    });
    const followUp = engine.applyEvent({
      order: submitted.order,
      eventId: "paper-event-1",
      type: "ACCEPT",
      occurredAt: new Date("2026-01-01T00:00:01Z")
    });

    expect(submitted.liveBrokerWriteAllowed).toBe(false);
    expect(submitted.order.liveBrokerWriteAllowed).toBe(false);
    expect(followUp.liveBrokerWriteAllowed).toBe(false);
    expect(followUp.order.liveBrokerWriteAllowed).toBe(false);
  });

  it("never produces an output shaped like a Toss order payload", () => {
    const result = new PaperTradingEngine().submit({
      paperOrderId: "paper-order-1",
      approval: approvedOrderApproval(),
      submittedAt: new Date("2026-01-01T00:00:00Z")
    });

    const serialized = JSON.stringify(result);
    for (const forbiddenKey of ["submitOrder", "cancelOrder", "replaceOrder", "tossRequest", "brokerCommand"]) {
      expect(serialized).not.toContain(`"${forbiddenKey}"`);
    }
    expect(result.order).not.toHaveProperty("accountNo");
    expect(result.order).not.toHaveProperty("brokerOrderRef");
    expect(result.order).not.toHaveProperty("brokerAccountId");
  });
});

describe("PaperOrderIntentPipeline", () => {
  it("accepts a candidate order intent when risk and money checks pass and no live broker account is attached", () => {
    const pipeline = new PaperOrderIntentPipeline();
    const result = pipeline.evaluate({
      candidateId: "candidate-1",
      approvalId: "approval-1",
      paperOrderId: "paper-order-1",
      orderIntent: candidateOrderIntent(),
      riskCheck: passingRiskCheck(),
      moneyCheck: passingMoneyCheck(),
      evaluatedAt: new Date("2026-01-01T00:00:00Z")
    });

    expect(result.decision).toBe("ACCEPTED");
    expect(result.reasonCodes).toEqual([]);
    expect(result.paperTrading.order.status).toBe("SUBMITTED");
    expect(result.paperTrading.order.safetyType).toBe("PAPER_ORDER_SIMULATED_ONLY");
    expect(result.auditContext.decision).toBe("ACCEPTED");
    expect(result.auditContext.reasonCodes).toEqual([]);
  });

  it("defers a candidate intent when risk and money checks were never supplied", () => {
    const pipeline = new PaperOrderIntentPipeline();
    const result = pipeline.evaluate({
      candidateId: "candidate-1",
      approvalId: "approval-1",
      paperOrderId: "paper-order-1",
      orderIntent: candidateOrderIntent(),
      evaluatedAt: new Date("2026-01-01T00:00:00Z")
    });

    expect(result.decision).toBe("DEFERRED");
    expect(result.reasonCodes).toEqual(["missing_risk_check", "missing_money_check"]);
    expect(result.auditContext.decision).toBe("DEFERRED");
    expect(result.paperTrading.order.status).toBe("REJECTED");
  });

  it("defers when only the money check is missing but the risk check passes", () => {
    const pipeline = new PaperOrderIntentPipeline();
    const result = pipeline.evaluate({
      candidateId: "candidate-1",
      approvalId: "approval-1",
      paperOrderId: "paper-order-1",
      orderIntent: candidateOrderIntent(),
      riskCheck: passingRiskCheck(),
      evaluatedAt: new Date("2026-01-01T00:00:00Z")
    });

    expect(result.decision).toBe("DEFERRED");
    expect(result.reasonCodes).toEqual(["missing_money_check"]);
  });

  it("rejects a candidate intent when the risk engine actively vetoes it", () => {
    const pipeline = new PaperOrderIntentPipeline();
    const result = pipeline.evaluate({
      candidateId: "candidate-1",
      approvalId: "approval-1",
      paperOrderId: "paper-order-1",
      orderIntent: candidateOrderIntent(),
      riskCheck: failingRiskCheck(),
      moneyCheck: passingMoneyCheck(),
      evaluatedAt: new Date("2026-01-01T00:00:00Z")
    });

    expect(result.decision).toBe("REJECTED");
    expect(result.reasonCodes).toContain("risk_check_not_passing");
    expect(result.paperTrading.order.status).toBe("REJECTED");
  });

  it("rejects (never defers) when a live-write-capable broker account is attached", () => {
    const pipeline = new PaperOrderIntentPipeline();
    const result = pipeline.evaluate({
      candidateId: "candidate-1",
      approvalId: "approval-1",
      paperOrderId: "paper-order-1",
      orderIntent: candidateOrderIntent(),
      brokerAccount: new BrokerAccount({
        id: "broker-account-1",
        broker: "TOSS_SECURITIES",
        externalAccountRef: "1234567890",
        accountLabel: "Main",
        permissionStatus: "LIVE_TRADING_ALLOWED",
        readOnlyEnabled: true,
        liveTradingEnabled: true
      }),
      evaluatedAt: new Date("2026-01-01T00:00:00Z")
    });

    expect(result.decision).toBe("REJECTED");
    expect(result.reasonCodes).toContain("live_broker_account_not_allowed_for_paper_trading");
    expect(result.auditContext.brokerAccountMaskedRef).toBe("12****90");
    expect(result.auditContext.brokerAccountMaskedRef).not.toContain("1234567890");
  });

  it("keeps liveBrokerWriteAllowed false and marks every output non-broker, paper-only, and not live executable", () => {
    const pipeline = new PaperOrderIntentPipeline();
    const accepted = pipeline.evaluate({
      candidateId: "candidate-1",
      approvalId: "approval-1",
      paperOrderId: "paper-order-1",
      orderIntent: candidateOrderIntent(),
      riskCheck: passingRiskCheck(),
      moneyCheck: passingMoneyCheck(),
      evaluatedAt: new Date("2026-01-01T00:00:00Z")
    });

    expect(accepted.liveBrokerWriteAllowed).toBe(false);
    expect(accepted.nonBrokerPaperOnly).toBe(true);
    expect(accepted.notLiveExecutable).toBe(true);
    expect(accepted.paperTrading.liveBrokerWriteAllowed).toBe(false);
    expect(accepted.paperTrading.order.liveBrokerWriteAllowed).toBe(false);
    expect(accepted.auditContext.liveBrokerWriteAllowed).toBe(false);
    expect(accepted.safetyType).toBe("PAPER_ORDER_INTENT_PIPELINE_RESULT_ONLY");
  });

  it("never produces an output shaped like a Toss order payload", () => {
    const pipeline = new PaperOrderIntentPipeline();
    const result = pipeline.evaluate({
      candidateId: "candidate-1",
      approvalId: "approval-1",
      paperOrderId: "paper-order-1",
      orderIntent: candidateOrderIntent(),
      riskCheck: passingRiskCheck(),
      moneyCheck: passingMoneyCheck(),
      evaluatedAt: new Date("2026-01-01T00:00:00Z")
    });

    const serialized = JSON.stringify(result);
    for (const forbiddenKey of ["submitOrder", "cancelOrder", "replaceOrder", "tossRequest", "brokerCommand"]) {
      expect(serialized).not.toContain(`"${forbiddenKey}"`);
    }
    expect(result.auditContext).not.toHaveProperty("accountRef");
    expect(result.auditContext).not.toHaveProperty("rawPayload");
  });

  it("preserves decision lineage in an audit context that AuditLogService can store without secrets", async () => {
    const pipeline = new PaperOrderIntentPipeline();
    const result = pipeline.evaluate({
      candidateId: "candidate-1",
      approvalId: "approval-1",
      paperOrderId: "paper-order-1",
      orderIntent: candidateOrderIntent(),
      riskCheck: failingRiskCheck(),
      moneyCheck: passingMoneyCheck(),
      evaluatedAt: new Date("2026-01-01T00:00:00Z")
    });

    const sink = new InMemoryAuditLogSink();
    const auditLog = new AuditLogService(sink);
    const record = await auditLog.record({
      id: "audit-1",
      actor: "paper_order_intent_pipeline",
      action: `PAPER_ORDER_INTENT_${result.decision}`,
      resourceType: "ORDER_INTENT",
      resourceId: result.auditContext.orderIntentId,
      reason: result.reasonCodes.join(","),
      metadata: { ...result.auditContext },
      createdAt: new Date("2026-01-01T00:00:00Z")
    });

    expect(record.action).toBe("PAPER_ORDER_INTENT_REJECTED");
    expect(record.metadata.decision).toBe("REJECTED");
    expect(record.metadata.reasonCodes).toEqual(["risk_check_not_passing"]);
    expect(record.metadata.strategyId).toBe("strategy-1");
    expect(record.metadata).not.toHaveProperty("apiKey");
    expect(record.metadata).not.toHaveProperty("accessToken");
  });
});

function candidateOrderIntent(): OrderIntent {
  return new OrderIntent({
    id: "intent-1",
    signal: signal(),
    side: "BUY",
    quantity: Quantity.from("1"),
    limitPrice: Price.from("100.00", Currency.from("USD")),
    status: "CREATED"
  });
}

function failingRiskCheck(): RiskCheck {
  return new RiskCheck({
    id: "risk-check-1",
    subjectType: "ORDER_INTENT",
    subjectId: "intent-1",
    result: "FAIL",
    riskLevel: "HIGH",
    failedLimitIds: ["max_daily_loss"],
    checkedAt: new Date("2026-01-01T00:00:00Z")
  });
}

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
