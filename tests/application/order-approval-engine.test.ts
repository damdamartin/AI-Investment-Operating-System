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
  OrderApprovalEngine,
  OrderIntent,
  Price,
  Quantity,
  RiskCheck,
  Signal,
  StrategyVersion,
  TossCapabilityRegistry
} from "../../src/index.js";

const usd = Currency.from("USD");

describe("OrderApprovalEngine", () => {
  it("creates approved OrderApproval only when every prerequisite passes", () => {
    const output = new OrderApprovalEngine().evaluate({
      approvalId: "approval-1",
      orderIntent: orderIntent(),
      riskCheck: passingRiskCheck(),
      moneyCheck: passingMoneyCheck(),
      brokerAccount: liveBrokerAccount(),
      compliance: { allowed: true, reasons: [], limitations: [] },
      capabilityRegistry: supportedCapabilities(),
      requiredCapability: "US_STOCK_LIMIT_ORDER"
    });

    expect(output.approval.status).toBe("APPROVED");
    expect(output.approval.isApproved()).toBe(true);
    expect(output.reasonCodes).toEqual([]);
    expect(output.safetyType).toBe("ORDER_APPROVAL_RECORD_ONLY");
    expect(output.approval).not.toHaveProperty("brokerOrderRef");
  });

  it("rejects when risk or money check is missing or not passing", () => {
    const missing = new OrderApprovalEngine().evaluate({
      approvalId: "approval-1",
      orderIntent: orderIntent(),
      brokerAccount: liveBrokerAccount(),
      compliance: { allowed: true, reasons: [], limitations: [] },
      capabilityRegistry: supportedCapabilities(),
      requiredCapability: "US_STOCK_LIMIT_ORDER"
    });
    const failing = new OrderApprovalEngine().evaluate({
      approvalId: "approval-2",
      orderIntent: orderIntent(),
      riskCheck: new RiskCheck({
        id: "risk-check-1",
        subjectType: "ORDER_INTENT",
        subjectId: "intent-1",
        result: "FAIL",
        riskLevel: "HIGH",
        failedLimitIds: ["max-order-amount"],
        checkedAt: new Date("2026-01-01T00:00:00Z")
      }),
      moneyCheck: passingMoneyCheck(),
      brokerAccount: liveBrokerAccount(),
      compliance: { allowed: true, reasons: [], limitations: [] },
      capabilityRegistry: supportedCapabilities(),
      requiredCapability: "US_STOCK_LIMIT_ORDER"
    });

    expect(missing.approval.status).toBe("REJECTED");
    expect(missing.reasonCodes).toEqual(expect.arrayContaining(["missing_risk_check", "missing_money_check"]));
    expect(failing.approval.status).toBe("REJECTED");
    expect(failing.reasonCodes).toContain("risk_check_not_passing");
  });

  it("rejects when broker account, compliance, or capability is unknown or blocked", () => {
    const output = new OrderApprovalEngine().evaluate({
      approvalId: "approval-1",
      orderIntent: orderIntent(),
      riskCheck: passingRiskCheck(),
      moneyCheck: passingMoneyCheck(),
      brokerAccount: new BrokerAccount({
        id: "broker-account-1",
        broker: "TOSS_SECURITIES",
        externalAccountRef: "acct-1",
        accountLabel: "Main",
        permissionStatus: "READ_ONLY",
        readOnlyEnabled: true,
        liveTradingEnabled: false
      }),
      compliance: { allowed: false, reasons: ["missing_review_toss_api_terms"], limitations: [] },
      capabilityRegistry: new TossCapabilityRegistry([]),
      requiredCapability: "US_STOCK_LIMIT_ORDER"
    });

    expect(output.approval.status).toBe("REJECTED");
    expect(output.reasonCodes).toEqual(
      expect.arrayContaining([
        "broker_account_live_trading_not_allowed",
        "compliance_missing_review_toss_api_terms",
        "capability_us_stock_limit_order_unverified"
      ])
    );
  });

  it("rejects AI-shaped objects because they are not real approval dependencies", () => {
    const output = new OrderApprovalEngine().evaluate({
      approvalId: "approval-1",
      orderIntent: orderIntent(),
      riskCheck: undefined,
      moneyCheck: undefined,
      brokerAccount: liveBrokerAccount(),
      compliance: { allowed: true, reasons: [], limitations: [] },
      capabilityRegistry: supportedCapabilities(),
      requiredCapability: "US_STOCK_LIMIT_ORDER"
    });

    expect(output.approval.status).toBe("REJECTED");
    expect(output.reasonCodes).toEqual(expect.arrayContaining(["missing_risk_check", "missing_money_check"]));
  });
});

function liveBrokerAccount(): BrokerAccount {
  return new BrokerAccount({
    id: "broker-account-1",
    broker: "TOSS_SECURITIES",
    externalAccountRef: "acct-1",
    accountLabel: "Main",
    permissionStatus: "LIVE_TRADING_ALLOWED",
    readOnlyEnabled: true,
    liveTradingEnabled: true
  });
}

function supportedCapabilities(): TossCapabilityRegistry {
  return new TossCapabilityRegistry([
    {
      capability: "US_STOCK_LIMIT_ORDER",
      status: "SUPPORTED",
      checkedAt: new Date("2026-01-01T00:00:00Z")
    }
  ]);
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
    approvedAmount: Money.fromMajor("500.00", usd),
    cashAfterOrder: Money.fromMajor("1500.00", usd),
    checkedAt: new Date("2026-01-01T00:00:00Z")
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
