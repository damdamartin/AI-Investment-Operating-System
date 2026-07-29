import { describe, expect, it } from "vitest";
import {
  Asset,
  AssetType,
  BrokerAccount,
  BrokerWriteCommandGuard,
  Currency,
  defaultReconciliationPolicy,
  EngineScoreSet,
  KillSwitchControlService,
  Market,
  Money,
  MoneyCheck,
  OrderApprovalEngine,
  OrderIntent,
  PaperOrderIntentPipeline,
  Phase6OperatorSafetyDashboardService,
  PHASE6_NO_LIVE_BROKER_WRITE_ENVIRONMENT_POLICY,
  PortfolioBrokerAccountLink,
  Price,
  Quantity,
  ReadOnlyDashboardService,
  ReconciliationService,
  ReconciliationWorkflowService,
  RiskCheck,
  RiskEngine,
  Signal,
  StrategyVersion,
  TossCapabilityRegistry,
  type AIHealthCheckRecord,
  type BrokerCashSnapshot,
  type BrokerWriteCommandGuardResult,
  type InternalPositionSnapshot,
  type KillSwitchTradingGate,
  type OrderApprovalEngineOutput,
  type PaperOrderIntentPipelineResult,
  type Phase6OperatorSafetyStatusInput,
  type ReconciliationReport,
  type ReconciliationWorkflowResult,
  type RiskEngineOutput,
  type TossPositionSnapshot
} from "../../src/index.js";

describe("ReadOnlyDashboardService", () => {
  it("builds an OK read-only dashboard status", () => {
    const status = new ReadOnlyDashboardService().buildStatus(baseInput());

    expect(status.system).toBe("OK");
    expect(status.trading).toBe("ENABLED");
    expect(status.broker).toBe("OK");
    expect(status.dataFreshness).toBe("FRESH");
    expect(status.reconciliation).toBe("CLEAN");
    expect(status.aiHealth).toBe("GREEN");
    expect(status.safetyType).toBe("DASHBOARD_READ_ONLY_STATUS");
  });

  it("masks broker account identifiers and does not expose secrets", () => {
    const status = new ReadOnlyDashboardService().buildStatus(baseInput());
    const encoded = JSON.stringify(status);

    expect(status.portfolio.brokerAccounts[0]?.maskedExternalRef).toBe("ac****90");
    expect(encoded).not.toContain("account-1234567890");
    expect(encoded).not.toContain("secret");
    expect(encoded).not.toContain("token");
  });

  it("blocks trading when reconciliation blocks dependent trading", () => {
    const status = new ReadOnlyDashboardService().buildStatus(
      baseInput({
        reconciliationReport: {
          ...reconciliationReport(),
          status: "UNKNOWN",
          blocksDependentTrading: true,
          unknownReasons: ["broker_positions_unavailable:TOSS_TIMEOUT"]
        }
      })
    );

    expect(status.system).toBe("BLOCKED");
    expect(status.trading).toBe("BLOCKED");
    expect(status.broker).toBe("DEGRADED");
  });

  it("shows red AI health as error without creating dashboard controls", () => {
    const status = new ReadOnlyDashboardService().buildStatus(
      baseInput({
        aiHealthCheck: {
          ...aiHealthCheck(),
          status: "RED",
          requiresHumanReview: true
        }
      })
    );

    expect(status.system).toBe("ERROR");
    expect(status.trading).toBe("PAUSED");
    expect(status).not.toHaveProperty("killSwitchControl");
    expect(status).not.toHaveProperty("submitOrder");
    expect(status).not.toHaveProperty("promoteStrategy");
  });

  it("redacts sensitive keys if a future status input accidentally includes them", () => {
    const status = new ReadOnlyDashboardService().buildStatus({
      ...baseInput(),
      cashSummary: [
        {
          currency: "USD",
          available: 1000,
          reserved: 0,
          unsettled: 0,
          apiKey: "abc123" } as unknown as { currency: "USD"; available: number; reserved: number; unsettled: number }
      ]
    });

    expect(JSON.stringify(status)).not.toContain("abc123");
  });
});

function baseInput(overrides: Partial<Parameters<ReadOnlyDashboardService["buildStatus"]>[0]> = {}) {
  return {
    portfolioId: "portfolio-1",
    brokerAccounts: [
      new BrokerAccount({
        id: "broker-account-1",
        broker: "TOSS_SECURITIES",
        externalAccountRef: "account-1234567890",
        accountLabel: "Main",
        permissionStatus: "READ_ONLY",
        readOnlyEnabled: true,
        liveTradingEnabled: false
      })
    ],
    cashSummary: [
      {
        currency: "USD" as const,
        available: 1000,
        reserved: 0,
        unsettled: 0
      }
    ],
    aiHealthCheck: aiHealthCheck(),
    reconciliationReport: reconciliationReport(),
    strategies: {
      activeStrategyCount: 1,
      candidateStrategyCount: 2,
      blockedStrategyCount: 0
    },
    risk: {
      dailyLossLimitBreached: false,
      monthlyLossLimitBreached: false,
      maxDrawdownBreached: false,
      openRiskIssueCount: 0
    },
    openAlertCount: 0,
    staleData: false,
    brokerUnavailable: false,
    generatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides
  };
}

function aiHealthCheck(): AIHealthCheckRecord {
  return {
    id: "health-check-1",
    periodStart: new Date("2026-01-01T00:00:00Z"),
    periodEnd: new Date("2026-01-01T23:59:59Z"),
    status: "GREEN",
    summary: "Healthy",
    findings: [],
    recommendedActions: [],
    requiresTradingPause: false,
    requiresHumanReview: false,
    fallbackStatus: "GREEN",
    claudeOutputAccepted: true,
    validationErrors: [],
    inputReferences: ["metrics-1"],
    createdAt: new Date("2026-01-02T00:00:00Z"),
    safetyType: "AI_HEALTH_CHECK_AUDIT_ONLY"
  };
}

function reconciliationReport(): ReconciliationReport {
  return {
    id: "reconciliation-1",
    status: "CLEAN",
    positionIssues: [],
    cashIssues: [],
    issueCounts: { informational: 0, blocking: 0, requiresHumanReview: 0 },
    unknownReasons: [],
    blocksDependentTrading: false,
    checkedAt: new Date("2026-01-01T00:00:00Z"),
    liveBrokerWriteAllowed: false,
    safetyType: "RECONCILIATION_READ_ONLY_REPORT"
  };
}

describe("Phase6OperatorSafetyDashboardService", () => {
  it("builds an all-clear status: paper-simulation ready, live-readiness unblocked, live broker writes always false", () => {
    const status = new Phase6OperatorSafetyDashboardService().buildSafetyStatus(safetyInput());

    expect(status.paperSimulationReady).toBe(true);
    expect(status.liveReadinessBlocked).toBe(false);
    expect(status.liveBrokerWriteAllowed).toBe(false);
    expect(status.safetyType).toBe("DASHBOARD_PHASE6_OPERATOR_SAFETY_STATUS");
    expect(status.generatedAt).toEqual(now());
  });

  it("shows paper/simulation readiness independently of a blocked live-readiness signal", () => {
    const status = new Phase6OperatorSafetyDashboardService().buildSafetyStatus(
      safetyInput({ reconciliationWorkflow: lowSeverityReconciliationWorkflowResult() })
    );

    expect(status.reconciliationLiveReadiness.liveReadinessBlocked).toBe(true);
    expect(status.liveReadinessBlocked).toBe(true);
    // The exact point of this field split: paper trading can stay ready even
    // while the live-readiness chain has an open block, because Phase 6
    // never authorizes live trading regardless of either signal.
    expect(status.paperSimulationReady).toBe(true);
    expect(status.liveBrokerWriteAllowed).toBe(false);
  });

  it("blocks live readiness when reconciliation is unresolved, even at LOW severity", () => {
    const status = new Phase6OperatorSafetyDashboardService().buildSafetyStatus(
      safetyInput({ reconciliationWorkflow: lowSeverityReconciliationWorkflowResult() })
    );

    expect(status.reconciliationLiveReadiness.severity).toBe("LOW");
    expect(status.reconciliationLiveReadiness.liveReadinessReasonCodes).toContain("reconciliation_not_fully_resolved");
    expect(status.liveReadinessBlocked).toBe(true);
  });

  it("blocks paper execution status when the kill switch is active", () => {
    const status = new Phase6OperatorSafetyDashboardService().buildSafetyStatus(
      safetyInput({ killSwitchGate: activeKillSwitchGate() })
    );

    expect(status.killSwitchGate.allowed).toBe(false);
    expect(status.paperOrderIntent.killSwitchBlocksPaperExecution).toBe(true);
    expect(status.paperSimulationReady).toBe(false);
    expect(status.liveReadinessBlocked).toBe(true);
  });

  it("blocks live readiness when the risk engine actively vetoes", () => {
    const status = new Phase6OperatorSafetyDashboardService().buildSafetyStatus(
      safetyInput({ riskEngineOutput: blockedRiskEngineOutput() })
    );

    expect(status.riskVeto.result).toBe("BLOCKED");
    expect(status.riskVeto.vetoActive).toBe(true);
    expect(status.liveReadinessBlocked).toBe(true);
    // A risk veto is scoped to live-readiness in this dashboard; it is not
    // consulted by PaperOrderIntentPipeline itself and is not part of
    // paperSimulationReady.
  });

  it("keeps paperSimulationReady false when the paper order intent pipeline rejects the candidate", () => {
    const status = new Phase6OperatorSafetyDashboardService().buildSafetyStatus(
      safetyInput({ paperOrderIntent: rejectedPaperOrderIntentResult() })
    );

    expect(status.paperOrderIntent.decision).toBe("REJECTED");
    expect(status.paperSimulationReady).toBe(false);
  });

  it("keeps liveBrokerWriteAllowed:false on every sub-view where it is relevant", () => {
    const status = new Phase6OperatorSafetyDashboardService().buildSafetyStatus(safetyInput());

    expect(status.liveBrokerWriteAllowed).toBe(false);
    expect(status.paperOrderIntent.liveBrokerWriteAllowed).toBe(false);
    expect(status.reconciliationLiveReadiness.liveBrokerWriteAllowed).toBe(false);
    expect(status.approvalGuard.liveBrokerWriteAllowed).toBe(false);
  });

  it("never includes raw secrets, raw broker payloads, or unmasked account identifiers", () => {
    const rejectedByLiveAccount = new PaperOrderIntentPipeline().evaluate({
      candidateId: "candidate-1",
      approvalId: "approval-1",
      paperOrderId: "paper-order-1",
      orderIntent: candidateOrderIntent(),
      brokerAccount: new BrokerAccount({
        id: "broker-account-1",
        broker: "TOSS_SECURITIES",
        externalAccountRef: "account-1234567890",
        accountLabel: "Main",
        permissionStatus: "LIVE_TRADING_ALLOWED",
        readOnlyEnabled: true,
        liveTradingEnabled: true
      }),
      evaluatedAt: now()
    });

    const status = new Phase6OperatorSafetyDashboardService().buildSafetyStatus(
      safetyInput({ paperOrderIntent: rejectedByLiveAccount })
    );

    const serialized = JSON.stringify(status);
    expect(serialized).not.toContain("account-1234567890");
    expect(serialized).not.toMatch(/secret/i);
    expect(serialized).not.toMatch(/apiKey|api_key/i);
    expect(serialized).not.toMatch(/accessToken|access_token/i);
    expect(serialized).not.toMatch(/clientSecret|client_secret/i);
    expect(status.paperOrderIntent.reasonCodes).toContain("live_broker_account_not_allowed_for_paper_trading");
  });

  it("exposes no method that could place, cancel, or modify a broker order", () => {
    const methodNames = Object.getOwnPropertyNames(Phase6OperatorSafetyDashboardService.prototype);
    const forbidden = ["submitOrder", "cancelOrder", "replaceOrder", "placeOrder", "activateKillSwitch", "deactivateKillSwitch", "approveOrder", "enableLiveTrading"];

    expect(methodNames).toEqual(["constructor", "buildSafetyStatus"]);
    for (const name of forbidden) {
      expect(methodNames).not.toContain(name);
    }
  });
});

function now(): Date {
  return new Date("2026-01-01T00:00:00Z");
}

function safetyInput(overrides: Partial<Phase6OperatorSafetyStatusInput> = {}): Phase6OperatorSafetyStatusInput {
  return {
    paperOrderIntent: acceptedPaperOrderIntentResult(),
    reconciliationWorkflow: cleanReconciliationWorkflowResult(),
    riskEngineOutput: passingRiskEngineOutput(),
    killSwitchGate: inactiveKillSwitchGate(),
    orderApproval: approvedOrderApprovalOutput(),
    brokerWriteGuard: brokerWriteGuardResult(),
    auditTrailRecorded: true,
    generatedAt: now(),
    ...overrides
  };
}

function candidateOrderIntent(): OrderIntent {
  return new OrderIntent({
    id: "intent-1",
    signal: dashboardSignal(),
    side: "BUY",
    quantity: Quantity.from("1"),
    limitPrice: Price.from("100.00", Currency.from("USD")),
    status: "CREATED"
  });
}

function dashboardSignal(): Signal {
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
    generatedAt: now()
  });
}

function passingRiskCheck(): RiskCheck {
  return new RiskCheck({
    id: "risk-check-1",
    subjectType: "ORDER_INTENT",
    subjectId: "intent-1",
    result: "PASS",
    riskLevel: "LOW",
    checkedAt: now()
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
    checkedAt: now()
  });
}

function acceptedPaperOrderIntentResult(): PaperOrderIntentPipelineResult {
  return new PaperOrderIntentPipeline().evaluate({
    candidateId: "candidate-1",
    approvalId: "approval-1",
    paperOrderId: "paper-order-1",
    orderIntent: candidateOrderIntent(),
    riskCheck: passingRiskCheck(),
    moneyCheck: passingMoneyCheck(),
    evaluatedAt: now()
  });
}

function rejectedPaperOrderIntentResult(): PaperOrderIntentPipelineResult {
  return new PaperOrderIntentPipeline().evaluate({
    candidateId: "candidate-1",
    approvalId: "approval-1",
    paperOrderId: "paper-order-1",
    orderIntent: candidateOrderIntent(),
    riskCheck: new RiskCheck({
      id: "risk-check-1",
      subjectType: "ORDER_INTENT",
      subjectId: "intent-1",
      result: "FAIL",
      riskLevel: "HIGH",
      failedLimitIds: ["max_daily_loss"],
      checkedAt: now()
    }),
    moneyCheck: passingMoneyCheck(),
    evaluatedAt: now()
  });
}

function internalPosition(overrides: Partial<InternalPositionSnapshot> = {}): InternalPositionSnapshot {
  return {
    assetId: "asset-synthetic-1",
    brokerSymbol: "SYNT",
    market: "US",
    assetType: "STOCK",
    quantity: 1,
    averagePrice: 100,
    currency: "USD",
    updatedAt: now(),
    ...overrides
  };
}

function brokerPosition(overrides: Partial<TossPositionSnapshot> = {}): TossPositionSnapshot {
  return {
    brokerAccountId: "synthetic-broker-account-1",
    brokerSymbol: "SYNT",
    market: "US",
    assetType: "STOCK",
    quantity: "1",
    averagePrice: "100",
    currency: "USD",
    collectedAt: now(),
    ...overrides
  };
}

function internalCash(overrides: Partial<BrokerCashSnapshot> = {}): BrokerCashSnapshot {
  return {
    brokerAccountId: "internal-ledger",
    currency: "USD",
    available: 1000,
    reserved: 0,
    unsettled: 0,
    updatedAt: now(),
    collectedAt: now(),
    ...overrides
  };
}

function brokerCash(overrides: Partial<BrokerCashSnapshot> = {}): BrokerCashSnapshot {
  return {
    brokerAccountId: "synthetic-broker-account-1",
    currency: "USD",
    available: 1000,
    reserved: 0,
    unsettled: 0,
    updatedAt: now(),
    collectedAt: now(),
    ...overrides
  };
}

function cleanReconciliationWorkflowResult(): ReconciliationWorkflowResult {
  const report = new ReconciliationService().reconcileSnapshots({
    id: "reconciliation-workflow-clean-1",
    internalPositions: [internalPosition()],
    brokerPositions: [brokerPosition()],
    internalCash: [internalCash()],
    brokerCash: [brokerCash()],
    checkedAt: now(),
    policy: defaultReconciliationPolicy
  });

  return new ReconciliationWorkflowService().evaluate({
    workflowId: "workflow-clean-1",
    report,
    evaluatedAt: now()
  });
}

function lowSeverityReconciliationWorkflowResult(): ReconciliationWorkflowResult {
  const report = new ReconciliationService().reconcileSnapshots({
    id: "reconciliation-workflow-low-1",
    internalPositions: [internalPosition({ quantity: 5, averagePrice: 100 })],
    brokerPositions: [brokerPosition({ quantity: "1", averagePrice: "100" })],
    internalCash: [],
    brokerCash: [],
    checkedAt: now(),
    policy: defaultReconciliationPolicy
  });

  return new ReconciliationWorkflowService().evaluate({
    workflowId: "workflow-low-1",
    report,
    evaluatedAt: now()
  });
}

function passingRiskEngineOutput(): RiskEngineOutput {
  const usd = Currency.from("USD");
  return new RiskEngine().evaluate({
    riskCheckId: "risk-check-dashboard-1",
    orderIntent: candidateOrderIntent(),
    orderAmount: Money.fromMajor("100.00", usd),
    limits: {
      maxOrderAmount: Money.fromMajor("1000.00", usd),
      maxPositionExposureRatio: 0.3,
      maxStrategyExposureRatio: 0.45,
      maxMarketExposureRatio: 0.75,
      maxDrawdownRatio: 0.2
    },
    portfolio: {
      totalEquity: Money.fromMajor("10000.00", usd),
      currentAssetExposure: Money.fromMajor("100.00", usd),
      currentStrategyExposure: Money.fromMajor("100.00", usd),
      currentMarketExposure: Money.fromMajor("100.00", usd),
      currentDrawdownRatio: 0.01
    },
    checkedAt: now()
  });
}

function blockedRiskEngineOutput(): RiskEngineOutput {
  const usd = Currency.from("USD");
  return new RiskEngine().evaluate({
    riskCheckId: "risk-check-dashboard-blocked-1",
    orderIntent: candidateOrderIntent(),
    orderAmount: Money.fromMajor("100.00", usd),
    limits: {
      maxOrderAmount: Money.fromMajor("1000.00", usd),
      maxPositionExposureRatio: 0.3,
      maxStrategyExposureRatio: 0.45,
      maxMarketExposureRatio: 0.75,
      maxDrawdownRatio: 0.2
    },
    portfolio: {
      totalEquity: Money.fromMajor("10000.00", usd),
      currentAssetExposure: Money.fromMajor("100.00", usd),
      currentStrategyExposure: Money.fromMajor("100.00", usd),
      currentMarketExposure: Money.fromMajor("100.00", usd),
      currentDrawdownRatio: 0.5
    },
    checkedAt: now()
  });
}

function inactiveKillSwitchGate(): KillSwitchTradingGate {
  const service = new KillSwitchControlService();
  const state = service.createInactiveState({ id: "kill-switch-1", scope: "GLOBAL", updatedAt: now() });
  return service.evaluateTradingGate(state);
}

function activeKillSwitchGate(): KillSwitchTradingGate {
  const service = new KillSwitchControlService();
  const inactive = service.createInactiveState({ id: "kill-switch-1", scope: "GLOBAL", updatedAt: now() });
  const activation = service.activate(inactive, {
    actor: "operator-1",
    reason: "manual emergency stop",
    occurredAt: now()
  });
  return service.evaluateTradingGate(activation.state);
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
      checkedAt: now()
    }
  ]);
}

function approvedOrderApprovalOutput(): OrderApprovalEngineOutput {
  return new OrderApprovalEngine().evaluate({
    approvalId: "approval-dashboard-1",
    orderIntent: candidateOrderIntent(),
    riskCheck: passingRiskCheck(),
    moneyCheck: passingMoneyCheck(),
    brokerAccount: livePassingBrokerAccount(),
    compliance: { allowed: true, reasons: [], limitations: [] },
    capabilityRegistry: supportedCapabilityRegistry(),
    requiredCapability: "US_STOCK_LIMIT_ORDER",
    killSwitchGate: inactiveKillSwitchGate(),
    reconciliation: reconciliationReport(),
    evaluatedAt: now()
  });
}

function brokerWriteGuardResult(): BrokerWriteCommandGuardResult {
  const approval = new OrderApprovalEngine().evaluate({
    approvalId: "approval-dashboard-1",
    orderIntent: candidateOrderIntent(),
    riskCheck: passingRiskCheck(),
    moneyCheck: passingMoneyCheck(),
    brokerAccount: livePassingBrokerAccount(),
    compliance: { allowed: true, reasons: [], limitations: [] },
    capabilityRegistry: supportedCapabilityRegistry(),
    requiredCapability: "US_STOCK_LIMIT_ORDER",
    killSwitchGate: inactiveKillSwitchGate(),
    reconciliation: reconciliationReport(),
    evaluatedAt: now()
  }).approval;

  return new BrokerWriteCommandGuard().evaluate({
    commandType: "SUBMIT_ORDER",
    approval,
    brokerAccount: livePassingBrokerAccount(),
    portfolioLink: activePortfolioLink(),
    compliance: { allowed: true, reasons: [], limitations: [] },
    capabilityRegistry: supportedCapabilityRegistry(),
    requiredCapability: "US_STOCK_LIMIT_ORDER",
    // Phase 6 wiring always uses this frozen, safe-default policy so a typo
    // can never accidentally enable a live broker write during this phase.
    environment: PHASE6_NO_LIVE_BROKER_WRITE_ENVIRONMENT_POLICY,
    killSwitch: { active: false, scope: "GLOBAL" },
    reconciliation: reconciliationReport(),
    now: now()
  });
}
