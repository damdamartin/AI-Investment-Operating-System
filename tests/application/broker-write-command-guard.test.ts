import { describe, expect, it } from "vitest";
import {
  Asset,
  AssetType,
  BrokerAccount,
  BrokerWriteCommandGuard,
  Currency,
  EngineScoreSet,
  Market,
  Money,
  MoneyCheck,
  OrderApproval,
  OrderIntent,
  PortfolioBrokerAccountLink,
  Price,
  Quantity,
  RiskCheck,
  Signal,
  StrategyVersion,
  TossCapabilityRegistry,
  type BrokerWriteCommandGuardInput,
  type ReconciliationReport
} from "../../src/index.js";

describe("BrokerWriteCommandGuard", () => {
  it("blocks by default when required gates are unknown", () => {
    const result = new BrokerWriteCommandGuard().evaluate({ commandType: "SUBMIT_ORDER" });

    expect(result.allowed).toBe(false);
    expect(result.reasonCodes).toEqual(
      expect.arrayContaining([
        "missing_order_approval",
        "missing_broker_account",
        "missing_compliance_gate",
        "missing_required_broker_capability",
        "missing_environment_policy",
        "missing_kill_switch_state",
        "missing_reconciliation_state"
      ])
    );
  });

  it("allows broker writes only when every live-trading gate passes", () => {
    const result = new BrokerWriteCommandGuard().evaluate(passingInput());

    expect(result.allowed).toBe(true);
    expect(result.reasonCodes).toEqual([]);
    expect(result.safetyType).toBe("BROKER_WRITE_COMMAND_GUARD_DECISION");
    expect(result).not.toHaveProperty("submitOrder");
  });

  it("blocks compliance, account, capability, kill switch, environment, and reconciliation failures", () => {
    const result = new BrokerWriteCommandGuard().evaluate({
      ...passingInput(),
      brokerAccount: new BrokerAccount({
        id: "broker-account-1",
        broker: "TOSS_SECURITIES",
        externalAccountRef: "account-1",
        accountLabel: "Main",
        permissionStatus: "READ_ONLY",
        readOnlyEnabled: true,
        liveTradingEnabled: false
      }),
      compliance: { allowed: false, reasons: ["review_toss_api_terms_unverified"], limitations: [] },
      capabilityRegistry: new TossCapabilityRegistry([]),
      environment: {
        environment: "local",
        liveBrokerWritesEnabled: false,
        allowedEnvironments: ["production"]
      },
      killSwitch: { active: true, scope: "GLOBAL", reason: "manual stop" },
      reconciliation: {
        ...cleanReconciliation(),
        status: "UNKNOWN",
        blocksDependentTrading: true
      }
    });

    expect(result.allowed).toBe(false);
    expect(result.reasonCodes).toEqual(
      expect.arrayContaining([
        "broker_account_live_trading_not_allowed",
        "compliance_review_toss_api_terms_unverified",
        "capability_us_stock_limit_order_unverified",
        "environment_live_broker_writes_disabled",
        "environment_local_not_allowed_for_broker_writes",
        "kill_switch_active_global",
        "reconciliation_unknown_blocks_trading"
      ])
    );
  });

  it("blocks unresolved open questions from live broker writes", () => {
    const result = new BrokerWriteCommandGuard().evaluate({
      ...passingInput(),
      openQuestionBlocks: ["OQ-001", "OQ-003"]
    });

    expect(result.allowed).toBe(false);
    expect(result.reasonCodes).toEqual(
      expect.arrayContaining([
        "open_question_oq-001_blocks_broker_writes",
        "open_question_oq-003_blocks_broker_writes"
      ])
    );
  });

  it("blocks inactive portfolio links or disallowed assets", () => {
    const result = new BrokerWriteCommandGuard().evaluate({
      ...passingInput(),
      portfolioLink: new PortfolioBrokerAccountLink({
        id: "link-1",
        portfolioId: "portfolio-1",
        brokerAccountId: "broker-account-1",
        allowedMarkets: [Market.from("KR")],
        allowedAssetTypes: [AssetType.from("ETF")],
        status: "ACTIVE"
      })
    });

    expect(result.allowed).toBe(false);
    expect(result.reasonCodes).toContain("portfolio_broker_account_link_does_not_allow_asset");
  });

  it("rejects Claude-shaped broker commands even when other gates pass", () => {
    const result = new BrokerWriteCommandGuard().evaluate({
      ...passingInput(),
      aiContext: {
        confidence: 1,
        brokerCommand: {
          submitOrder: true
        }
      }
    });

    expect(result.allowed).toBe(false);
    expect(result.reasonCodes).toContain("ai_context_contains_forbidden_broker_command");
  });
});

function passingInput(): BrokerWriteCommandGuardInput {
  return {
    commandType: "SUBMIT_ORDER",
    approval: approvedOrderApproval(),
    brokerAccount: new BrokerAccount({
      id: "broker-account-1",
      broker: "TOSS_SECURITIES",
      externalAccountRef: "account-1",
      accountLabel: "Main",
      permissionStatus: "LIVE_TRADING_ALLOWED",
      readOnlyEnabled: true,
      liveTradingEnabled: true
    }),
    portfolioLink: new PortfolioBrokerAccountLink({
      id: "link-1",
      portfolioId: "portfolio-1",
      brokerAccountId: "broker-account-1",
      allowedMarkets: [Market.from("US")],
      allowedAssetTypes: [AssetType.from("STOCK")],
      status: "ACTIVE"
    }),
    compliance: { allowed: true, reasons: [], limitations: [] },
    capabilityRegistry: new TossCapabilityRegistry([
      {
        capability: "US_STOCK_LIMIT_ORDER",
        status: "SUPPORTED",
        checkedAt: new Date("2026-01-01T00:00:00Z")
      }
    ]),
    requiredCapability: "US_STOCK_LIMIT_ORDER",
    environment: {
      environment: "production",
      liveBrokerWritesEnabled: true,
      allowedEnvironments: ["production"]
    },
    killSwitch: { active: false, scope: "GLOBAL" },
    reconciliation: cleanReconciliation()
  };
}

function approvedOrderApproval(): OrderApproval {
  return new OrderApproval({
    id: "approval-1",
    orderIntent: approvedOrderIntent(),
    riskCheck: new RiskCheck({
      id: "risk-check-1",
      subjectType: "ORDER_INTENT",
      subjectId: "intent-1",
      result: "PASS",
      riskLevel: "LOW",
      checkedAt: new Date("2026-01-01T00:00:00Z")
    }),
    moneyCheck: new MoneyCheck({
      id: "money-check-1",
      orderIntentId: "intent-1",
      result: "PASS",
      approvedQuantity: Quantity.from("1"),
      approvedAmount: Money.fromMajor("100.00", Currency.from("USD")),
      cashAfterOrder: Money.fromMajor("900.00", Currency.from("USD")),
      checkedAt: new Date("2026-01-01T00:00:00Z")
    }),
    status: "APPROVED",
    reasons: []
  });
}

function approvedOrderIntent(): OrderIntent {
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
      scoreSet: new EngineScoreSet([{ engine: "STRATEGY_COMPOSITE", score: 80, confidence: 0.8 }], "score-v1"),
      generatedAt: new Date("2026-01-01T00:00:00Z")
    }),
    side: "BUY",
    quantity: Quantity.from("1"),
    limitPrice: Price.from("100.00", Currency.from("USD")),
    status: "MONEY_CHECKED"
  }).transitionTo("APPROVED");
}

function cleanReconciliation(): ReconciliationReport {
  return {
    id: "reconciliation-1",
    status: "CLEAN",
    positionIssues: [],
    cashIssues: [],
    unknownReasons: [],
    blocksDependentTrading: false,
    checkedAt: new Date("2026-01-01T00:00:00Z"),
    safetyType: "RECONCILIATION_READ_ONLY_REPORT"
  };
}
