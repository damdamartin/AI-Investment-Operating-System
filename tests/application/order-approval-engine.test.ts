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
  TossCapabilityRegistry,
  type KillSwitchTradingGate,
  type ReconciliationReport
} from "../../src/index.js";

const usd = Currency.from("USD");
const checkedAt = new Date("2026-01-01T00:00:00Z");

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
      requiredCapability: "US_STOCK_LIMIT_ORDER",
      killSwitchGate: passingKillSwitchGate(),
      reconciliation: cleanReconciliation(),
      evaluatedAt: checkedAt
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
      requiredCapability: "US_STOCK_LIMIT_ORDER",
      killSwitchGate: passingKillSwitchGate(),
      reconciliation: cleanReconciliation(),
      evaluatedAt: checkedAt
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
        checkedAt
      }),
      moneyCheck: passingMoneyCheck(),
      brokerAccount: liveBrokerAccount(),
      compliance: { allowed: true, reasons: [], limitations: [] },
      capabilityRegistry: supportedCapabilities(),
      requiredCapability: "US_STOCK_LIMIT_ORDER",
      killSwitchGate: passingKillSwitchGate(),
      reconciliation: cleanReconciliation(),
      evaluatedAt: checkedAt
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
      requiredCapability: "US_STOCK_LIMIT_ORDER",
      killSwitchGate: passingKillSwitchGate(),
      reconciliation: cleanReconciliation(),
      evaluatedAt: checkedAt
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
      requiredCapability: "US_STOCK_LIMIT_ORDER",
      killSwitchGate: passingKillSwitchGate(),
      reconciliation: cleanReconciliation(),
      evaluatedAt: checkedAt
    });

    expect(output.approval.status).toBe("REJECTED");
    expect(output.reasonCodes).toEqual(expect.arrayContaining(["missing_risk_check", "missing_money_check"]));
  });

  it("rejects when the kill-switch gate is missing, unknown, or active, using the shared reason vocabulary", () => {
    const missingGate = new OrderApprovalEngine().evaluate(fullyPassingInput({ killSwitchGate: undefined }));
    const blockedGate = new OrderApprovalEngine().evaluate(
      fullyPassingInput({
        killSwitchGate: {
          allowed: false,
          blocksNewOrders: true,
          reasonCodes: ["kill_switch_active_portfolio"],
          brokerWriteGate: { active: true, scope: "PORTFOLIO", reason: "manual stop" },
          safetyType: "KILL_SWITCH_TRADING_GATE_ONLY"
        }
      })
    );

    expect(missingGate.approval.status).toBe("REJECTED");
    expect(missingGate.reasonCodes).toContain("missing_kill_switch_gate");

    expect(blockedGate.approval.status).toBe("REJECTED");
    expect(blockedGate.reasonCodes).toContain("kill_switch_active_portfolio");
  });

  it("rejects when reconciliation state is missing or blocks dependent trading", () => {
    const missingReconciliation = new OrderApprovalEngine().evaluate(fullyPassingInput({ reconciliation: undefined }));
    const mismatchedReconciliation = new OrderApprovalEngine().evaluate(
      fullyPassingInput({
        reconciliation: {
          ...cleanReconciliation(),
          status: "MISMATCH",
          blocksDependentTrading: true
        }
      })
    );

    expect(missingReconciliation.approval.status).toBe("REJECTED");
    expect(missingReconciliation.reasonCodes).toContain("missing_reconciliation_state");

    expect(mismatchedReconciliation.approval.status).toBe("REJECTED");
    expect(mismatchedReconciliation.reasonCodes).toContain("reconciliation_mismatch_blocks_trading");
  });

  it("rejects a stale approval basis and a missing evaluation time, but allows a fresh one", () => {
    const missingEvaluatedAt = new OrderApprovalEngine().evaluate(fullyPassingInput({ evaluatedAt: undefined }));
    const stale = new OrderApprovalEngine().evaluate(
      fullyPassingInput({ evaluatedAt: new Date(checkedAt.getTime() + 10 * 60 * 1000) })
    );
    const future = new OrderApprovalEngine().evaluate(
      fullyPassingInput({ evaluatedAt: new Date(checkedAt.getTime() - 1000) })
    );
    const fresh = new OrderApprovalEngine().evaluate(
      fullyPassingInput({ evaluatedAt: new Date(checkedAt.getTime() + 60 * 1000) })
    );

    expect(missingEvaluatedAt.approval.status).toBe("REJECTED");
    expect(missingEvaluatedAt.reasonCodes).toContain("missing_evaluation_time");

    expect(stale.approval.status).toBe("REJECTED");
    expect(stale.reasonCodes).toEqual(expect.arrayContaining(["risk_check_stale", "money_check_stale"]));

    expect(future.approval.status).toBe("REJECTED");
    expect(future.reasonCodes).toEqual(
      expect.arrayContaining(["risk_check_timestamp_in_future", "money_check_timestamp_in_future"])
    );

    expect(fresh.approval.status).toBe("APPROVED");
    expect(fresh.reasonCodes).toEqual([]);
  });

  it("returns deterministically sorted, deduplicated reason codes", () => {
    const output = new OrderApprovalEngine().evaluate({
      approvalId: "approval-1",
      orderIntent: orderIntent(),
      requiredCapability: "US_STOCK_LIMIT_ORDER"
    });

    const sorted = [...output.reasonCodes].sort();
    expect(output.reasonCodes).toEqual(sorted);
    expect(output.reasonCodes).toEqual([...new Set(output.reasonCodes)]);
  });
});

function fullyPassingInput(overrides: Record<string, unknown> = {}) {
  return {
    approvalId: "approval-1",
    orderIntent: orderIntent(),
    riskCheck: passingRiskCheck(),
    moneyCheck: passingMoneyCheck(),
    brokerAccount: liveBrokerAccount(),
    compliance: { allowed: true, reasons: [], limitations: [] },
    capabilityRegistry: supportedCapabilities(),
    requiredCapability: "US_STOCK_LIMIT_ORDER" as const,
    killSwitchGate: passingKillSwitchGate(),
    reconciliation: cleanReconciliation(),
    evaluatedAt: checkedAt,
    ...overrides
  };
}

function passingKillSwitchGate(): KillSwitchTradingGate {
  return {
    allowed: true,
    blocksNewOrders: false,
    reasonCodes: [],
    brokerWriteGate: { active: false, scope: "GLOBAL" },
    safetyType: "KILL_SWITCH_TRADING_GATE_ONLY"
  };
}

function cleanReconciliation(): ReconciliationReport {
  return {
    id: "reconciliation-1",
    status: "CLEAN",
    positionIssues: [],
    cashIssues: [],
    unknownReasons: [],
    blocksDependentTrading: false,
    checkedAt,
    safetyType: "RECONCILIATION_READ_ONLY_REPORT"
  };
}

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
      checkedAt
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
    checkedAt
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
    checkedAt
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
      generatedAt: checkedAt
    }),
    side: "BUY",
    quantity: Quantity.from("1"),
    limitPrice: Price.from("500.00", usd)
  });
}
