import { describe, expect, it } from "vitest";
import {
  Asset,
  AssetType,
  BrokerAccount,
  BrokerOrder,
  BrokerWriteCommandGuard,
  buildAIAnalysisRecord,
  Currency,
  DomainValidationError,
  EngineScoreSet,
  KillSwitchControlService,
  Market,
  Money,
  MoneyCheck,
  OrderApproval,
  OrderApprovalEngine,
  OrderIntent,
  PortfolioBrokerAccountLink,
  Price,
  Quantity,
  RiskCheck,
  RiskEngine,
  Signal,
  StrategyVersion,
  TossCapabilityRegistry,
  validateClaudeAnalysis,
  type ClaudeAnalysisRequest,
  type ReconciliationReport
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

function livePassingBrokerAccount(): BrokerAccount {
  return new BrokerAccount({
    id: "broker-account-1",
    broker: "TOSS_SECURITIES",
    externalAccountRef: "account-1",
    accountLabel: "Main",
    permissionStatus: "LIVE_TRADING_ALLOWED",
    readOnlyEnabled: true,
    liveTradingEnabled: true,
    status: "ACTIVE"
  });
}

function activePortfolioLink(): PortfolioBrokerAccountLink {
  return new PortfolioBrokerAccountLink({
    id: "link-1",
    portfolioId: "portfolio-1",
    brokerAccountId: "broker-account-1",
    allowedMarkets: [Market.from("US")],
    allowedAssetTypes: [AssetType.from("STOCK")],
    status: "ACTIVE"
  });
}

function supportedCapabilityRegistry(): TossCapabilityRegistry {
  return new TossCapabilityRegistry([
    {
      capability: "US_STOCK_LIMIT_ORDER",
      status: "SUPPORTED",
      checkedAt: new Date("2026-01-01T00:00:00Z")
    }
  ]);
}

function cleanReconciliationReport(): ReconciliationReport {
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

  it("lets a RiskEngine veto cascade through OrderApprovalEngine into a blocked BrokerWriteCommandGuard decision", () => {
    const usd = Currency.from("USD");
    const intent = new OrderIntent({
      id: "intent-1",
      signal: signal(),
      side: "BUY",
      quantity: Quantity.from("1"),
      limitPrice: Price.from("100.00", usd)
    });

    const riskOutput = new RiskEngine().evaluate({
      riskCheckId: "risk-check-1",
      orderIntent: intent,
      orderAmount: Money.fromMajor("5000.00", usd),
      limits: {
        maxOrderAmount: Money.fromMajor("1000.00", usd),
        maxPositionExposureRatio: 0.3,
        maxStrategyExposureRatio: 0.45,
        maxMarketExposureRatio: 0.75,
        maxDrawdownRatio: 0.2
      },
      portfolio: {
        totalEquity: Money.fromMajor("10000.00", usd),
        currentAssetExposure: Money.fromMajor("1000.00", usd),
        currentStrategyExposure: Money.fromMajor("2000.00", usd),
        currentMarketExposure: Money.fromMajor("5000.00", usd),
        currentDrawdownRatio: 0.05
      },
      checkedAt: new Date("2026-01-01T00:00:00Z")
    });

    expect(riskOutput.riskCheck.result).toBe("FAIL");
    expect(riskOutput.riskCheck.allowsApproval()).toBe(false);

    const approvalOutput = new OrderApprovalEngine().evaluate({
      approvalId: "approval-1",
      orderIntent: intent,
      riskCheck: riskOutput.riskCheck,
      moneyCheck: passingMoneyCheck(),
      brokerAccount: livePassingBrokerAccount(),
      compliance: { allowed: true, reasons: [], limitations: [] },
      capabilityRegistry: supportedCapabilityRegistry(),
      requiredCapability: "US_STOCK_LIMIT_ORDER"
    });

    expect(approvalOutput.approval.status).toBe("REJECTED");
    expect(approvalOutput.reasonCodes).toContain("risk_check_not_passing");

    const guardResult = new BrokerWriteCommandGuard().evaluate({
      commandType: "SUBMIT_ORDER",
      approval: approvalOutput.approval,
      brokerAccount: livePassingBrokerAccount(),
      portfolioLink: activePortfolioLink(),
      compliance: { allowed: true, reasons: [], limitations: [] },
      capabilityRegistry: supportedCapabilityRegistry(),
      requiredCapability: "US_STOCK_LIMIT_ORDER",
      environment: {
        environment: "production",
        liveBrokerWritesEnabled: true,
        allowedEnvironments: ["production"]
      },
      killSwitch: { active: false, scope: "GLOBAL" },
      reconciliation: cleanReconciliationReport()
    });

    expect(guardResult.allowed).toBe(false);
    expect(guardResult.reasonCodes).toContain("order_approval_not_approved");
  });

  it("blocks the BrokerWriteCommandGuard when the kill switch is active even though every other gate passes", () => {
    const killSwitchService = new KillSwitchControlService();
    const inactiveState = killSwitchService.createInactiveState({
      id: "kill-switch-1",
      scope: "GLOBAL",
      updatedAt: new Date("2026-01-01T00:00:00Z")
    });
    const activation = killSwitchService.activate(inactiveState, {
      actor: "operator-1",
      reason: "manual emergency stop",
      occurredAt: new Date("2026-01-01T00:00:00Z")
    });

    expect(activation.ok).toBe(true);

    const tradingGate = killSwitchService.evaluateTradingGate(activation.state);
    expect(tradingGate.allowed).toBe(false);
    expect(tradingGate.reasonCodes).toContain("kill_switch_active_global");

    const guardResult = new BrokerWriteCommandGuard().evaluate({
      commandType: "SUBMIT_ORDER",
      approval: new OrderApproval({
        id: "approval-1",
        orderIntent: approvedIntent(),
        riskCheck: passingRiskCheck(),
        moneyCheck: passingMoneyCheck(),
        status: "APPROVED",
        reasons: []
      }),
      brokerAccount: livePassingBrokerAccount(),
      portfolioLink: activePortfolioLink(),
      compliance: { allowed: true, reasons: [], limitations: [] },
      capabilityRegistry: supportedCapabilityRegistry(),
      requiredCapability: "US_STOCK_LIMIT_ORDER",
      environment: {
        environment: "production",
        liveBrokerWritesEnabled: true,
        allowedEnvironments: ["production"]
      },
      // Kill switch state is fed from the real KillSwitchControlService trading
      // gate, not a hand-authored stub, so this proves the two modules agree.
      killSwitch: tradingGate.brokerWriteGate,
      reconciliation: cleanReconciliationReport()
    });

    expect(guardResult.allowed).toBe(false);
    expect(guardResult.reasonCodes).toContain("kill_switch_active_global");
  });

  describe("P6-003 chain hardening (kill-switch gate and staleness on approval/guard)", () => {
    // These four tests were explicitly requested by Engineer 3 in
    // docs/phase6/risk-kill-switch-approval-guard.md, "For Engineer 4
    // (P6-004 Phase 2 Integration)", after P6-003 closed the gap flagged in
    // Engineer 4's Phase 1 report: OrderApprovalEngine previously did not
    // check kill-switch state or check/approval freshness at all.

    it("OrderApprovalEngine rejects when the kill-switch gate is omitted or blocked", () => {
      const usd = Currency.from("USD");
      const intent = new OrderIntent({
        id: "intent-1",
        signal: signal(),
        side: "BUY",
        quantity: Quantity.from("1"),
        limitPrice: Price.from("100.00", usd)
      });
      const evaluatedAt = new Date("2026-01-01T00:00:00Z");

      const missingGate = new OrderApprovalEngine().evaluate({
        approvalId: "approval-1",
        orderIntent: intent,
        riskCheck: passingRiskCheck(),
        moneyCheck: passingMoneyCheck(),
        brokerAccount: livePassingBrokerAccount(),
        compliance: { allowed: true, reasons: [], limitations: [] },
        capabilityRegistry: supportedCapabilityRegistry(),
        requiredCapability: "US_STOCK_LIMIT_ORDER",
        reconciliation: cleanReconciliationReport(),
        evaluatedAt
        // killSwitchGate intentionally omitted
      });

      expect(missingGate.approval.status).toBe("REJECTED");
      expect(missingGate.reasonCodes).toContain("missing_kill_switch_gate");

      const killSwitchService = new KillSwitchControlService();
      const activation = killSwitchService.activate(
        killSwitchService.createInactiveState({ id: "kill-switch-1", scope: "GLOBAL", updatedAt: evaluatedAt }),
        { actor: "operator-1", reason: "manual emergency stop", occurredAt: evaluatedAt }
      );
      const blockedGate = killSwitchService.evaluateTradingGate(activation.state);

      const blockedByGate = new OrderApprovalEngine().evaluate({
        approvalId: "approval-2",
        orderIntent: intent,
        riskCheck: passingRiskCheck(),
        moneyCheck: passingMoneyCheck(),
        brokerAccount: livePassingBrokerAccount(),
        compliance: { allowed: true, reasons: [], limitations: [] },
        capabilityRegistry: supportedCapabilityRegistry(),
        requiredCapability: "US_STOCK_LIMIT_ORDER",
        reconciliation: cleanReconciliationReport(),
        evaluatedAt,
        killSwitchGate: blockedGate
      });

      expect(blockedByGate.approval.status).toBe("REJECTED");
      expect(blockedByGate.reasonCodes).toContain("kill_switch_active_global");
    });

    it("OrderApprovalEngine rejects a stale RiskCheck/MoneyCheck pair", () => {
      const usd = Currency.from("USD");
      const intent = new OrderIntent({
        id: "intent-1",
        signal: signal(),
        side: "BUY",
        quantity: Quantity.from("1"),
        limitPrice: Price.from("100.00", usd)
      });

      const checkedAt = new Date("2026-01-01T00:00:00Z");
      const staleRiskCheck = new RiskCheck({
        id: "risk-check-1",
        subjectType: "ORDER_INTENT",
        subjectId: "intent-1",
        result: "PASS",
        riskLevel: "LOW",
        checkedAt
      });
      const staleMoneyCheck = new MoneyCheck({
        id: "money-check-1",
        orderIntentId: "intent-1",
        result: "PASS",
        approvedQuantity: Quantity.from("1"),
        approvedAmount: Money.fromMajor("100.00", usd),
        cashAfterOrder: Money.fromMajor("900.00", usd),
        checkedAt
      });

      const killSwitchGate = new KillSwitchControlService().evaluateTradingGate(
        new KillSwitchControlService().createInactiveState({
          id: "kill-switch-1",
          scope: "GLOBAL",
          updatedAt: checkedAt
        })
      );

      // Evaluated 20 minutes after the checks were made, well past the
      // engine's 5-minute default staleness window.
      const evaluatedAt = new Date("2026-01-01T00:20:00Z");

      const output = new OrderApprovalEngine().evaluate({
        approvalId: "approval-1",
        orderIntent: intent,
        riskCheck: staleRiskCheck,
        moneyCheck: staleMoneyCheck,
        brokerAccount: livePassingBrokerAccount(),
        compliance: { allowed: true, reasons: [], limitations: [] },
        capabilityRegistry: supportedCapabilityRegistry(),
        requiredCapability: "US_STOCK_LIMIT_ORDER",
        reconciliation: cleanReconciliationReport(),
        killSwitchGate,
        evaluatedAt
      });

      expect(output.approval.status).toBe("REJECTED");
      expect(output.reasonCodes).toContain("risk_check_stale");
      expect(output.reasonCodes).toContain("money_check_stale");
    });

    it("BrokerWriteCommandGuard rejects a broker write command built on a stale OrderApproval", () => {
      const approval = new OrderApproval({
        id: "approval-1",
        orderIntent: approvedIntent(),
        riskCheck: passingRiskCheck(),
        moneyCheck: passingMoneyCheck(),
        status: "APPROVED",
        reasons: []
      });

      // passingRiskCheck() / passingMoneyCheck() are both checked at
      // 2026-01-01T00:00:00Z; evaluating 20 minutes later exceeds the
      // guard's 5-minute default approval-staleness window.
      const guardResult = new BrokerWriteCommandGuard().evaluate({
        commandType: "SUBMIT_ORDER",
        approval,
        brokerAccount: livePassingBrokerAccount(),
        portfolioLink: activePortfolioLink(),
        compliance: { allowed: true, reasons: [], limitations: [] },
        capabilityRegistry: supportedCapabilityRegistry(),
        requiredCapability: "US_STOCK_LIMIT_ORDER",
        environment: {
          environment: "production",
          liveBrokerWritesEnabled: true,
          allowedEnvironments: ["production"]
        },
        killSwitch: { active: false, scope: "GLOBAL" },
        reconciliation: cleanReconciliationReport(),
        now: new Date("2026-01-01T00:20:00Z")
      });

      expect(guardResult.allowed).toBe(false);
      expect(guardResult.reasonCodes).toContain("order_approval_stale");
    });

    it("KillSwitchControlService.deactivate rejects an out-of-order command that predates a more recent activation", () => {
      const service = new KillSwitchControlService();
      const inactive = service.createInactiveState({
        id: "kill-switch-1",
        scope: "GLOBAL",
        updatedAt: new Date("2026-01-01T00:00:00Z")
      });

      const activation = service.activate(inactive, {
        actor: "operator-1",
        reason: "manual emergency stop",
        occurredAt: new Date("2026-01-01T00:10:00Z")
      });
      expect(activation.ok).toBe(true);
      expect(activation.state.status).toBe("ACTIVE");

      // A deactivate command claiming to have occurred *before* the
      // activation (a stale or replayed command) must never be allowed to
      // silently turn a more-recently-activated kill switch back off.
      const staleDeactivation = service.deactivate(activation.state, {
        actor: "operator-2",
        reason: "stale replayed deactivation",
        occurredAt: new Date("2026-01-01T00:05:00Z")
      });

      expect(staleDeactivation.ok).toBe(false);
      expect(staleDeactivation.reasonCodes).toContain("kill_switch_command_out_of_order");
      expect(staleDeactivation.state.status).toBe("ACTIVE");
    });
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

  it("blocks live writes for a suspended account even with full permission granted", () => {
    const account = new BrokerAccount({
      id: "broker-account-1",
      broker: "TOSS_SECURITIES",
      externalAccountRef: "account-1",
      accountLabel: "Main",
      liveTradingEnabled: true,
      permissionStatus: "LIVE_TRADING_ALLOWED",
      status: "SUSPENDED"
    });

    expect(account.canWriteLive()).toBe(false);
  });

  it("blocks live writes when liveTradingEnabled is false even with an active, permitted account", () => {
    const account = new BrokerAccount({
      id: "broker-account-1",
      broker: "TOSS_SECURITIES",
      externalAccountRef: "account-1",
      accountLabel: "Main",
      liveTradingEnabled: false,
      permissionStatus: "LIVE_TRADING_ALLOWED",
      status: "ACTIVE"
    });

    expect(account.canWriteLive()).toBe(false);
  });

  it("only allows live writes when status, liveTradingEnabled, and permissionStatus all agree", () => {
    const account = new BrokerAccount({
      id: "broker-account-1",
      broker: "TOSS_SECURITIES",
      externalAccountRef: "account-1",
      accountLabel: "Main",
      liveTradingEnabled: true,
      permissionStatus: "LIVE_TRADING_ALLOWED",
      status: "ACTIVE"
    });

    expect(account.canWriteLive()).toBe(true);
  });

  describe("AI output stays advisory-only and cannot approve or trigger a broker write", () => {
    const aiRequest: ClaudeAnalysisRequest = {
      promptTemplateId: "news-event-template",
      promptTemplateVersion: "1.0.0",
      inputReferences: ["news-event:apple|2026-01-01"],
      variables: {}
    };

    const cleanRawAnalysis = {
      analysisId: "analysis-1",
      sentiment: "positive",
      eventType: "earnings",
      impactScore: 90,
      confidence: 0.95,
      timeHorizon: "short",
      evidence: ["strong guidance beat"],
      risks: [],
      contradictions: [],
      requiresReview: false,
      schemaVersion: "ai-analysis-v1",
      model: "claude-test"
    };

    it("rejects a broker write command whose AI context carries a nested executable broker command", () => {
      const guard = new BrokerWriteCommandGuard();

      const result = guard.evaluate({
        commandType: "SUBMIT_ORDER",
        approval: new OrderApproval({
          id: "approval-1",
          orderIntent: approvedIntent(),
          riskCheck: passingRiskCheck(),
          moneyCheck: passingMoneyCheck(),
          status: "APPROVED",
          reasons: []
        }),
        aiContext: {
          ...cleanRawAnalysis,
          followUp: { recommendedNextStep: { submitOrder: { assetId: "asset-1", side: "BUY" } } }
        }
      });

      expect(result.allowed).toBe(false);
      expect(result.reasonCodes).toContain("ai_context_contains_forbidden_broker_command");
    });

    it("never lets a high-confidence, review-clean AI analysis alone satisfy a broker write command", () => {
      const validation = validateClaudeAnalysis(cleanRawAnalysis);
      expect(validation.ok).toBe(true);

      const record = buildAIAnalysisRecord({
        request: aiRequest,
        validation,
        now: new Date("2026-01-01T00:00:00Z")
      });

      expect(record.safetyType).toBe("AI_ANALYSIS_ADVISORY_ONLY");

      const guard = new BrokerWriteCommandGuard();
      const result = guard.evaluate({
        commandType: "SUBMIT_ORDER",
        // Even a clean, non-forbidden AI analysis is supplied as context, but
        // none of the deterministic gates (broker account, portfolio link,
        // compliance, capability, environment, kill switch, reconciliation)
        // are present. AI confidence must never substitute for them.
        aiContext: record.normalizedOutput
      });

      expect(result.allowed).toBe(false);
      expect(result.reasonCodes).not.toContain("ai_context_contains_forbidden_broker_command");
      expect(result.reasonCodes).toContain("missing_broker_account");
      expect(result.reasonCodes).toContain("missing_compliance_gate");
      expect(result.reasonCodes).toContain("missing_environment_policy");
      expect(result.reasonCodes).toContain("missing_kill_switch_state");
      expect(result.reasonCodes).toContain("missing_reconciliation_state");
    });

    it("keeps invalid Claude output out of any broker write decision entirely", () => {
      const validation = validateClaudeAnalysis({
        ...cleanRawAnalysis,
        cancelOrder: { orderId: "order-1" }
      });

      expect(validation.ok).toBe(false);
      expect(() =>
        buildAIAnalysisRecord({
          request: aiRequest,
          validation,
          now: new Date("2026-01-01T00:00:00Z")
        })
      ).toThrow(DomainValidationError);
    });
  });
});
