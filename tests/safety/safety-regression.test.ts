import { describe, expect, it } from "vitest";
import {
  Asset,
  AssetType,
  BrokerAccount,
  BrokerOrder,
  BrokerWriteCommandGuard,
  buildAIAnalysisRecord,
  createPhase6SchedulerJobCatalog,
  Currency,
  DashboardSensitiveControlGate,
  DeploymentEnvironmentSkeletonService,
  DomainValidationError,
  EngineScoreSet,
  evaluateBackupRestoreDrill,
  evaluateDeploymentReadiness,
  KillSwitchControlService,
  Market,
  Money,
  MoneyCheck,
  OperationsStatusReadModel,
  OrderApproval,
  OrderApprovalEngine,
  OrderIntent,
  PHASE6_NO_LIVE_BROKER_WRITE_ENVIRONMENT_POLICY,
  PortfolioBrokerAccountLink,
  Price,
  Quantity,
  REQUIRED_DEPLOYMENT_RUNBOOK_IDS,
  REQUIRED_DEPLOYMENT_SECRET_NAMES,
  REQUIRED_MANUAL_APPROVAL_ATTESTATION,
  REQUIRED_ROLLBACK_REHEARSAL_STEPS,
  RestoreSafetyGate,
  RiskCheck,
  RiskEngine,
  Signal,
  StrategyVersion,
  TossCapabilityRegistry,
  evaluateRuntimeLiveLockGate,
  evaluateSmallCapitalEnablementGate,
  evaluateSmallCapitalReadiness,
  validateClaudeAnalysis,
  type BackupRestoreDrillInput,
  type ClaudeAnalysisRequest,
  type DashboardActionType,
  type DashboardActorAuthState,
  type DashboardPermission,
  type DashboardReadOnlyStatus,
  type DeploymentReadinessInput,
  type EvidenceReference,
  type ManualLiveApprovalRecord,
  type OperationsStatusReadModelInput,
  type Phase6OperatorSafetyStatus,
  type ReconciliationReport,
  type RollbackRehearsalStepRecord,
  type RuntimeLiveLockGateApprovalSignal,
  type SmallCapitalCapitalLimits,
  type SmallCapitalKillSwitchSignal,
  type SmallCapitalOperatorSurfaceSignal,
  type SmallCapitalProposedOrder,
  type SmallCapitalReadinessReport,
  type SmallCapitalReconciliationSignal,
  type TossWriteAdapter
} from "../../src/index.js";
import type { ComplianceGateResult } from "../../src/application/compliance/index.js";
import { TOSS_FUTURE_WRITE_CONTRACT_SAFETY_REPORT } from "../../src/adapters/toss-write-contract.js";

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

  describe("Dashboard operator surface stays advisory-only and cannot itself authorize a broker write", () => {
    // Phase 6 round 2 (P6-005/P6-006/P6-007) adds operator-facing surfaces
    // (dashboard, alerts, scheduler) on top of the round 1 safety chain
    // this file already exercises above. Before those branches land, this
    // block closes a gap in the pre-round-2 baseline: the consolidated
    // safety-regression harness never proved that the *existing*
    // read-only dashboard surface (`DashboardSensitiveControlGate`) is
    // structurally incapable of producing, or standing in for, a broker
    // write command — independent of whatever P6-005 adds later. Per-module
    // unit coverage already exists in
    // tests/application/dashboard-sensitive-control-gate.test.ts and
    // tests/application/read-only-dashboard.test.ts; this block instead
    // proves the cross-module property (dashboard decision -> guard) the
    // same way the "AI output stays advisory-only" block above proves it
    // for Claude output.

    const allDashboardPermissions: DashboardPermission[] = [
      "DASHBOARD_READ",
      "KILL_SWITCH_CONTROL",
      "RISK_POLICY_WRITE",
      "CAPITAL_ALLOCATION_WRITE",
      "STRATEGY_GOVERNANCE_WRITE",
      "PRODUCTION_MODE_WRITE",
      "BROKER_ACCOUNT_WRITE"
    ];

    const fullyPrivilegedActor: DashboardActorAuthState = {
      actorId: "operator-1",
      authenticated: true,
      permissions: allDashboardPermissions,
      stepUpConfirmedAt: new Date("2026-01-01T00:00:00Z")
    };

    // Every DashboardActionType known to the current baseline. None of
    // these is an order-submission-shaped action (no SUBMIT_ORDER,
    // CANCEL_ORDER, REPLACE_ORDER, or PLACE_ORDER action exists in the
    // dashboard's own vocabulary).
    const allDashboardActionTypes: DashboardActionType[] = [
      "VIEW_STATUS",
      "VIEW_AUDIT_LOG",
      "VIEW_STRATEGY_REPORT",
      "ACTIVATE_KILL_SWITCH",
      "DEACTIVATE_KILL_SWITCH",
      "CHANGE_RISK_LIMIT",
      "CHANGE_CAPITAL_ALLOCATION",
      "PROMOTE_STRATEGY",
      "RETIRE_PRODUCTION_STRATEGY",
      "ENABLE_PRODUCTION_MODE",
      "LINK_BROKER_ACCOUNT",
      "VALIDATE_BROKER_CREDENTIALS"
    ];

    it("never produces a dashboard control decision shaped like a broker write, for any known dashboard action type, even fully authorized", () => {
      const gate = new DashboardSensitiveControlGate();

      for (const actionType of allDashboardActionTypes) {
        const decision = gate.evaluate({
          actionType,
          resourceId: `resource-${actionType.toLowerCase()}`,
          auth: fullyPrivilegedActor,
          reason: "regression coverage: fully authorized dashboard action",
          confirmedAt: new Date("2026-01-01T00:00:00Z"),
          requestedAt: new Date("2026-01-01T00:00:00Z")
        });

        expect(decision.allowed).toBe(true);
        expect(decision.safetyType).toBe("DASHBOARD_SENSITIVE_CONTROL_GATE_DECISION");

        const encoded = JSON.stringify(decision);
        expect(encoded).not.toMatch(/submitOrder|cancelOrder|replaceOrder|placeOrder|TossSecuritiesAdapter/i);

        for (const value of Object.values(decision)) {
          expect(typeof value).not.toBe("function");
        }
      }
    });

    it("does not let the most privileged allowed dashboard decision (ENABLE_PRODUCTION_MODE) satisfy BrokerWriteCommandGuard on its own", () => {
      const gate = new DashboardSensitiveControlGate();
      const decision = gate.evaluate({
        actionType: "ENABLE_PRODUCTION_MODE",
        resourceId: "production-mode",
        auth: fullyPrivilegedActor,
        reason: "regression coverage: dashboard alone cannot authorize a broker write",
        confirmedAt: new Date("2026-01-01T00:00:00Z"),
        requestedAt: new Date("2026-01-01T00:00:00Z")
      });

      expect(decision.allowed).toBe(true);
      expect(decision.mutatesState).toBe(true);

      // Feeding the dashboard's own "allowed, mutates state" decision as
      // loosely-typed context must not substitute for any of the guard's
      // required deterministic gates (order approval, broker account,
      // portfolio link, compliance, capability, environment, kill switch,
      // reconciliation). A dashboard authorization is not a broker-write
      // authorization.
      const guardResult = new BrokerWriteCommandGuard().evaluate({
        commandType: "SUBMIT_ORDER",
        aiContext: decision
      });

      expect(guardResult.allowed).toBe(false);
      expect(guardResult.reasonCodes).toContain("missing_order_approval");
      expect(guardResult.reasonCodes).toContain("missing_broker_account");
      expect(guardResult.reasonCodes).toContain("missing_compliance_gate");
      expect(guardResult.reasonCodes).toContain("missing_environment_policy");
      expect(guardResult.reasonCodes).toContain("missing_kill_switch_state");
      expect(guardResult.reasonCodes).toContain("missing_reconciliation_state");
      expect(guardResult.reasonCodes).not.toContain("ai_context_contains_forbidden_broker_command");
    });
  });

  describe("TossWriteAdapter placeholder contract stays structurally uncallable (Phase 7 pre-merge baseline)", () => {
    // Phase 7 (P7-002, not yet merged as of this test) is expected to design
    // a future TossSecuritiesAdapter write contract on top of the existing
    // `TossWriteAdapter` placeholder in src/adapters/contracts/toss.ts,
    // whose `submitOrder`/`cancelOrder` parameters are typed `command:
    // never`. Prior reviews (docs/reviews/Codex_Phase6_Simulation_Safety_Review.md,
    // docs/reviews/Codex_Phase6_Round2_Operational_Readiness_Review.md) have
    // repeatedly confirmed by manual grep, each phase, that no concrete
    // implementation of this interface exists anywhere in src/. That is a
    // real property, but until now the consolidated safety-regression
    // harness never asserted it directly the way it already does for AI
    // output and the dashboard operator surface above. This closes that
    // narrow gap on the pre-P7-002 baseline, so Phase 2 of this review has a
    // concrete pre-merge proof to compare against post-merge.
    //
    // No implementation file is modified by this block. It only adds a
    // hand-rolled, throwing stand-in, because the entire point being proven
    // is that no real implementation should exist.
    class ThrowingTossWriteAdapter implements TossWriteAdapter {
      submitOrder(_command: never): Promise<never> {
        throw new Error(
          "TossWriteAdapter.submitOrder must never be called; Phase 7 keeps this contract uncallable by design."
        );
      }
      cancelOrder(_command: never): Promise<never> {
        throw new Error(
          "TossWriteAdapter.cancelOrder must never be called; Phase 7 keeps this contract uncallable by design."
        );
      }
    }

    it("rejects an order-shaped argument to submitOrder/cancelOrder at compile time (command: never)", () => {
      const adapter: TossWriteAdapter = new ThrowingTossWriteAdapter();
      const orderShapedCommand = {
        assetId: "asset-1",
        side: "BUY",
        quantity: "1",
        orderType: "LIMIT"
      };

      // @ts-expect-error - TossWriteAdapter.submitOrder's parameter is typed
      // `never`; no order-shaped value is assignable to it without an
      // explicit `as never` cast. If a future change ever widens this
      // parameter type to something callable, this directive becomes
      // "unused" and `npm run typecheck` fails, catching the regression at
      // the exact boundary Phase 7 must not cross. TypeScript's `@ts-expect-
      // error` only suppresses the type-check report, not the emitted JS -
      // the statement still executes at runtime, so this stand-in must
      // still throw rather than do anything resembling a broker write.
      expect(() => adapter.submitOrder(orderShapedCommand)).toThrow(/must never be called/);

      // @ts-expect-error - same proof for cancelOrder.
      expect(() => adapter.cancelOrder(orderShapedCommand)).toThrow(/must never be called/);
    });

    it("throws rather than silently succeeding if a caller forces a call through an explicit `as never` cast", () => {
      const adapter: TossWriteAdapter = new ThrowingTossWriteAdapter();

      // A sufficiently determined caller could still bypass the type
      // system with `as never`. Even then, the placeholder must refuse to
      // do anything resembling a broker write - it must throw, never
      // resolve, and never return a value that looks like a broker
      // response.
      expect(() => adapter.submitOrder(undefined as never)).toThrow(
        /must never be called/
      );
      expect(() => adapter.cancelOrder(undefined as never)).toThrow(
        /must never be called/
      );
    });
  });

  describe("Pre-existing operational evaluators that Phase 8 will extend cannot themselves satisfy BrokerWriteCommandGuard (Phase 8 pre-merge baseline)", () => {
    // Phase 8 (P8-001/P8-002/P8-003, not yet merged as of this test) is
    // expected to build an operations status read model, a deployment
    // readiness gate, and a backup/restore/rollback drill evaluator on top
    // of evaluators that already exist in this codebase:
    // `DeploymentEnvironmentSkeletonService`
    // (src/application/deployment/deployment-environment-skeleton.ts) and
    // `RestoreSafetyGate` (src/application/backup-restore/restore-safety-gate.ts).
    // Both already produce "everything looks fine" results today under
    // clean input (`validate().ok: true`, `evaluate().tradingResumeAllowed:
    // true`) — the same shape of property the "Dashboard operator surface"
    // block and the "AI output" block above already prove, at this
    // consolidated harness level, cannot substitute for a real
    // BrokerWriteCommandGuard authorization. Until now, neither
    // deployment-skeleton nor restore-safety-gate output had been
    // cross-checked against BrokerWriteCommandGuard here — only per-module
    // unit tests exist
    // (tests/application/deployment-environment-skeleton.test.ts,
    // tests/application/restore-safety-gate.test.ts), and those do not
    // touch BrokerWriteCommandGuard at all. This closes that narrow gap on
    // the pre-P8-002/P8-003 baseline, so Phase 2 of the Phase 8 review has
    // a concrete pre-merge proof to compare the merged deployment-readiness
    // gate and backup-restore drill evaluator outputs against (both are
    // expected to wrap/extend these same two evaluators, per P8-002's and
    // P8-003's task docs).

    it("does not let a clean DeploymentEnvironmentSkeletonService.validate() result satisfy BrokerWriteCommandGuard on its own", () => {
      const service = new DeploymentEnvironmentSkeletonService();
      const validation = service.validate();

      expect(validation.ok).toBe(true);
      expect(validation.safetyType).toBe("DEPLOYMENT_SKELETON_VALIDATION_ONLY");

      const guardResult = new BrokerWriteCommandGuard().evaluate({
        commandType: "SUBMIT_ORDER",
        aiContext: validation
      });

      expect(guardResult.allowed).toBe(false);
      expect(guardResult.reasonCodes).toContain("missing_order_approval");
      expect(guardResult.reasonCodes).toContain("missing_broker_account");
      expect(guardResult.reasonCodes).toContain("missing_compliance_gate");
      expect(guardResult.reasonCodes).toContain("missing_environment_policy");
      expect(guardResult.reasonCodes).toContain("missing_kill_switch_state");
      expect(guardResult.reasonCodes).toContain("missing_reconciliation_state");
      expect(guardResult.reasonCodes).not.toContain("ai_context_contains_forbidden_broker_command");
    });

    it("does not let a clean RestoreSafetyGate.evaluate() result (tradingResumeAllowed: true) satisfy BrokerWriteCommandGuard on its own", () => {
      const gate = new RestoreSafetyGate();
      const result = gate.evaluate({
        restoreId: "restore-1",
        checklist: {
          backupManifestVerified: true,
          schemaVersionVerified: true,
          configVersionsVerified: true,
          auditContinuityVerified: true,
          secretsHandledSeparately: true,
          reconciliationClean: true,
          dataQualityAllowsTrading: true,
          killSwitchAvailable: true,
          operatorApprovalRecorded: true
        },
        checkedAt: new Date("2026-01-01T00:00:00Z")
      });

      expect(result.status).toBe("READY");
      expect(result.tradingResumeAllowed).toBe(true);
      expect(result.safetyType).toBe("RESTORE_SAFETY_GATE_DECISION_ONLY");

      const guardResult = new BrokerWriteCommandGuard().evaluate({
        commandType: "SUBMIT_ORDER",
        aiContext: result
      });

      expect(guardResult.allowed).toBe(false);
      expect(guardResult.reasonCodes).toContain("missing_order_approval");
      expect(guardResult.reasonCodes).toContain("missing_broker_account");
      expect(guardResult.reasonCodes).toContain("missing_compliance_gate");
      expect(guardResult.reasonCodes).toContain("missing_environment_policy");
      expect(guardResult.reasonCodes).toContain("missing_kill_switch_state");
      expect(guardResult.reasonCodes).toContain("missing_reconciliation_state");
      expect(guardResult.reasonCodes).not.toContain("ai_context_contains_forbidden_broker_command");
    });
  });

  describe("P8-001/P8-002/P8-003 outputs cannot themselves satisfy BrokerWriteCommandGuard (Phase 8 post-merge cross-module proof)", () => {
    // Phase 8 (P8-001/P8-002/P8-003) is now merged. Each new module already
    // has its own per-module proof that its output contains no
    // command-shaped key (operations-status-read-model.test.ts's "never
    // exposes a command-shaped key anywhere in the built summary",
    // backup-restore-drill.test.ts's "does not expose any corrective
    // trading, broker order, or live-enable commands"), but until now none
    // of the three new outputs had been fed through the real
    // `BrokerWriteCommandGuard` at this consolidated harness level, the way
    // the Phase 1 block above already does for the two pre-existing
    // evaluators (`DeploymentEnvironmentSkeletonService`,
    // `RestoreSafetyGate`) these three modules build on top of, and the way
    // the "Dashboard operator surface" and "AI output" blocks above do for
    // their own surfaces. This closes that gap, using each module's own
    // cleanest possible ("fully passing") output -- the case most likely to
    // be mistaken for an authorization, if any case were.

    const NOW = new Date("2026-07-29T00:00:00Z");

    it("does not let a clean OperationsStatusReadModel.buildStatus() summary satisfy BrokerWriteCommandGuard on its own", () => {
      const dashboardStatus: DashboardReadOnlyStatus = {
        system: "OK",
        trading: "ENABLED",
        broker: "OK",
        dataFreshness: "FRESH",
        reconciliation: "CLEAN",
        aiHealth: "GREEN",
        openAlertCount: 0,
        portfolio: { portfolioId: "portfolio-1", brokerAccounts: [], cashSummary: [] },
        strategies: { activeStrategyCount: 1, candidateStrategyCount: 0, blockedStrategyCount: 0 },
        risk: {
          dailyLossLimitBreached: false,
          monthlyLossLimitBreached: false,
          maxDrawdownBreached: false,
          openRiskIssueCount: 0
        },
        generatedAt: NOW,
        safetyType: "DASHBOARD_READ_ONLY_STATUS"
      };

      const phase6SafetyStatus: Phase6OperatorSafetyStatus = {
        paperOrderIntent: {
          decision: "ACCEPTED",
          paperOrderStatus: "ACCEPTED",
          reasonCodes: [],
          blocksDependentTrading: false,
          killSwitchBlocksPaperExecution: false,
          nonBrokerPaperOnly: true,
          liveBrokerWriteAllowed: false,
          safetyType: "DASHBOARD_PAPER_ORDER_INTENT_STATUS_VIEW"
        },
        reconciliationLiveReadiness: {
          severity: "NONE",
          tradingSafetyState: "CLEAR",
          blocksDependentTrading: false,
          liveReadinessBlocked: false,
          liveReadinessReasonCodes: [],
          liveBrokerWriteAllowed: false,
          safetyType: "DASHBOARD_RECONCILIATION_LIVE_READINESS_VIEW"
        },
        riskVeto: { result: "PASS", riskLevel: "LOW", vetoActive: false, reasonCodes: [], safetyType: "DASHBOARD_RISK_VETO_STATUS_VIEW" },
        killSwitchGate: { allowed: true, blocksNewOrders: false, reasonCodes: [], safetyType: "DASHBOARD_KILL_SWITCH_GATE_STATUS_VIEW" },
        approvalGuard: {
          approvalStatus: "APPROVED",
          approvalReasonCodes: [],
          brokerWriteGuardAllowed: true,
          brokerWriteGuardReasonCodes: [],
          liveBrokerWriteAllowed: false,
          safetyType: "DASHBOARD_APPROVAL_GUARD_STATUS_VIEW"
        },
        auditCoverage: { auditContextPresent: true, auditTrailRecorded: true, safetyType: "DASHBOARD_AUDIT_COVERAGE_STATUS_VIEW" },
        paperSimulationReady: true,
        liveReadinessBlocked: false,
        liveBrokerWriteAllowed: false,
        generatedAt: NOW,
        safetyType: "DASHBOARD_PHASE6_OPERATOR_SAFETY_STATUS"
      };

      const smallCapitalReadiness: SmallCapitalReadinessReport = {
        // Deliberately the most "authorization-looking" value this evaluator
        // can produce, to prove even that case cannot satisfy the guard.
        readyForSmallCapitalLive: true,
        blockingReasonCodes: [],
        warnings: [],
        liveBrokerWriteAllowed: false,
        generatedAt: NOW,
        safetyType: "SMALL_CAPITAL_READINESS_REPORT_EVALUATION_ONLY"
      };

      const input: OperationsStatusReadModelInput = {
        dashboardStatus,
        phase6SafetyStatus,
        smallCapitalReadiness,
        openAlerts: [],
        schedulerDefinitions: createPhase6SchedulerJobCatalog(),
        schedulerRuns: [],
        generatedAt: NOW
      };

      const summary = new OperationsStatusReadModel().buildStatus(input);

      expect(summary.systemHealth).toBe("OK");
      expect(summary.smallCapitalReadiness.readyForSmallCapitalLive).toBe(true);
      expect(summary.liveBrokerWriteAllowed).toBe(false);

      const guardResult = new BrokerWriteCommandGuard().evaluate({
        commandType: "SUBMIT_ORDER",
        aiContext: summary
      });

      expect(guardResult.allowed).toBe(false);
      expect(guardResult.reasonCodes).toContain("missing_order_approval");
      expect(guardResult.reasonCodes).toContain("missing_broker_account");
      expect(guardResult.reasonCodes).toContain("missing_compliance_gate");
      expect(guardResult.reasonCodes).toContain("missing_environment_policy");
      expect(guardResult.reasonCodes).toContain("missing_kill_switch_state");
      expect(guardResult.reasonCodes).toContain("missing_reconciliation_state");
      expect(guardResult.reasonCodes).not.toContain("ai_context_contains_forbidden_broker_command");
    });

    it("does not let a clean evaluateDeploymentReadiness() report (readyToDeploy: true) satisfy BrokerWriteCommandGuard on its own", () => {
      const input: DeploymentReadinessInput = {
        now: NOW,
        targetEnvironment: "staging",
        liveTradingSignal: { liveTradingEnabled: false, appEnv: "staging" },
        runbookReferences: REQUIRED_DEPLOYMENT_RUNBOOK_IDS.map((runbookId) => ({
          runbookId,
          reference: `docs/runbooks/Incident_Runbooks.md#${runbookId.replace(/_/g, "-")}`,
          exists: true
        })),
        rollbackPlanReference: { reference: "docs/phase8/rollback-drill-runbook.md", exists: true },
        backupRestoreGateReference: { reference: "docs/phase8/backup-restore-drill.md", exists: true },
        observabilityAlertingReference: { reference: "docs/phase8/operations-status-api.md", exists: true },
        secretReferences: REQUIRED_DEPLOYMENT_SECRET_NAMES.map((name) => ({
          name,
          reference: `secret-ref:${name.toLowerCase().replace(/_/g, "-")}-staging`
        }))
      };

      const report = evaluateDeploymentReadiness(input);

      expect(report.readyToDeploy).toBe(true);
      expect(report.blockingReasonCodes).toEqual([]);
      expect(report.liveBrokerWriteAllowed).toBe(false);

      const guardResult = new BrokerWriteCommandGuard().evaluate({
        commandType: "SUBMIT_ORDER",
        aiContext: report
      });

      expect(guardResult.allowed).toBe(false);
      expect(guardResult.reasonCodes).toContain("missing_order_approval");
      expect(guardResult.reasonCodes).toContain("missing_broker_account");
      expect(guardResult.reasonCodes).toContain("missing_compliance_gate");
      expect(guardResult.reasonCodes).toContain("missing_environment_policy");
      expect(guardResult.reasonCodes).toContain("missing_kill_switch_state");
      expect(guardResult.reasonCodes).toContain("missing_reconciliation_state");
      expect(guardResult.reasonCodes).not.toContain("ai_context_contains_forbidden_broker_command");
    });

    it("does not let a clean evaluateBackupRestoreDrill() report (resumeAllowed: true) satisfy BrokerWriteCommandGuard on its own", () => {
      const evidence = (locator: string): EvidenceReference => ({
        description: "regression coverage evidence",
        locator,
        capturedAt: NOW
      });

      const steps: RollbackRehearsalStepRecord[] = REQUIRED_ROLLBACK_REHEARSAL_STEPS.map((stepId) => ({
        stepId,
        rehearsed: true,
        evidence: evidence(`rollback-rehearsal://${stepId}`)
      }));

      const input: BackupRestoreDrillInput = {
        drillId: "regression-drill-1",
        now: NOW,
        requestedResumeMode: "PAPER",
        backupManifest: {
          manifestVerified: true,
          manifestId: "manifest-regression-1",
          backupCompletedAt: NOW,
          encryptionVerified: true,
          storageSeparateFromPrimary: true,
          retentionPolicyDocumented: true,
          evidence: evidence("backup-manifest://manifest-regression-1")
        },
        schemaConfigVersion: {
          schemaVersionVerified: true,
          expectedSchemaVersion: "v1",
          restoredSchemaVersion: "v1",
          configVersionsVerified: true,
          expectedConfigVersionIds: ["risk-v1"],
          activeConfigVersionIds: ["risk-v1"],
          evidence: evidence("config-version-report://regression-drill-1")
        },
        auditContinuity: {
          continuityVerified: true,
          lastAuditRecordIdBeforeRestore: "audit-1",
          firstAuditRecordIdAfterRestore: "audit-2",
          gapDetected: false,
          evidence: evidence("audit-continuity-report://regression-drill-1")
        },
        secretsHandledSeparately: {
          confirmedNotInBackupArtifact: true,
          secretsManagerReference: "secret-manager://toss/api-credentials",
          rotatedOrValidatedSeparately: true,
          evidence: evidence("secret-rotation-ticket://SEC-REGRESSION-1")
        },
        reconciliation: {
          liveReadinessBlocked: false,
          stale: false,
          tradingSafetyState: "CLEAR",
          reconciledAgainstBrokerSnapshot: true,
          reasonCodes: [],
          evidence: evidence("reconciliation-workflow-report://regression-drill-1")
        },
        dataQuality: {
          status: "GREEN",
          blocksTrading: false,
          reasonCodes: [],
          evidence: evidence("data-quality-report://regression-drill-1")
        },
        killSwitch: {
          allowed: true,
          blocksNewOrders: false,
          reasonCodes: [],
          evidence: evidence("kill-switch-state://GLOBAL")
        },
        operatorApproval: {
          approved: true,
          approvedByName: "Regression Operator",
          approvedByRole: "OPERATOR",
          approvedAt: NOW,
          evidence: evidence("approval-record://regression-drill-1")
        },
        rollbackRehearsal: { steps }
      };

      const report = evaluateBackupRestoreDrill(input);

      expect(report.status).toBe("READY");
      expect(report.resumeAllowed).toBe(true);
      expect(report.liveBrokerWriteAllowed).toBe(false);
      expect(report.correctiveTradingAllowed).toBe(false);

      const guardResult = new BrokerWriteCommandGuard().evaluate({
        commandType: "SUBMIT_ORDER",
        aiContext: report
      });

      expect(guardResult.allowed).toBe(false);
      expect(guardResult.reasonCodes).toContain("missing_order_approval");
      expect(guardResult.reasonCodes).toContain("missing_broker_account");
      expect(guardResult.reasonCodes).toContain("missing_compliance_gate");
      expect(guardResult.reasonCodes).toContain("missing_environment_policy");
      expect(guardResult.reasonCodes).toContain("missing_kill_switch_state");
      expect(guardResult.reasonCodes).toContain("missing_reconciliation_state");
      expect(guardResult.reasonCodes).not.toContain("ai_context_contains_forbidden_broker_command");
    });
  });

  describe("Pre-existing small-capital readiness evaluator that Phase 9 will extend cannot itself satisfy BrokerWriteCommandGuard (Phase 9 pre-merge baseline)", () => {
    // Phase 9 (P9-001 live blocker evidence intake, P9-002 Toss write
    // preflight contract guard, P9-003 small-capital enablement gate, none
    // yet merged as of this test) is expected to build on top of
    // `evaluateSmallCapitalReadiness` (src/application/live-readiness/small-capital-readiness.ts,
    // already merged in Phase 7) -- P9-003's own task doc lists
    // `small-capital-readiness.ts` as a direct input, and the future
    // enablement gate's whole purpose is to combine this evaluator's
    // output with Phase 8 operations/deployment/backup readiness and Phase
    // 9 evidence intake into a single go/no-go report. This evaluator can
    // already produce its cleanest possible "everything looks fine" result
    // today (`readyForSmallCapitalLive: true`, zero blocking reason
    // codes) -- the same shape of property the "Dashboard operator
    // surface", "AI output", and "Pre-existing operational evaluators"
    // blocks above already prove, at this consolidated harness level,
    // cannot substitute for a real BrokerWriteCommandGuard authorization.
    // Until now, `evaluateSmallCapitalReadiness`'s output had never been
    // cross-checked against BrokerWriteCommandGuard here -- only
    // per-module unit tests exist (tests/application/small-capital-readiness.test.ts),
    // and those do not touch BrokerWriteCommandGuard at all. This closes
    // that narrow gap on the pre-P9-001/P9-002/P9-003 baseline, mirroring
    // exactly the same pattern the Phase 8 review (P8-004) already
    // established for `DeploymentEnvironmentSkeletonService` and
    // `RestoreSafetyGate` before P8-002/P8-003 merged, so Phase 2 of this
    // Phase 9 review has a concrete pre-merge proof to compare the merged
    // evidence intake, preflight guard, and enablement gate outputs
    // against.

    const NOW = new Date("2026-07-29T01:00:00Z");
    const KRW = Currency.from("KRW");

    function krw(amount: string): Money {
      return Money.fromMajor(amount, KRW);
    }

    function fullyCleanSmallCapitalInput() {
      const capitalLimits: SmallCapitalCapitalLimits = {
        maxOrderValue: krw("300000"),
        maxDailyNotionalExposure: krw("900000"),
        maxTotalCapitalExposure: krw("3000000")
      };
      const proposedOrder: SmallCapitalProposedOrder = {
        market: "KR",
        assetType: "STOCK",
        orderType: "LIMIT",
        orderValue: krw("100000"),
        projectedDailyNotionalAfterOrder: krw("100000"),
        projectedTotalCapitalExposureAfterOrder: krw("100000"),
        withinRegularSessionWindow: true,
        isExtendedHours: false,
        isFractional: false
      };
      const manualApproval: ManualLiveApprovalRecord = {
        id: "approval-1",
        scopePortfolioId: "portfolio-1",
        scopeStrategyVersionId: "strategy-version-1",
        approvalStatus: "APPROVED",
        approvedByName: "Jun Kim",
        approvedByRole: "OWNER",
        acknowledgedRisksStatement: REQUIRED_MANUAL_APPROVAL_ATTESTATION,
        approvedAt: new Date("2026-07-01T00:00:00Z"),
        expiresAt: new Date("2026-08-01T00:00:00Z"),
        safetyType: "MANUAL_LIVE_APPROVAL_RECORD_HUMAN_OWNED"
      };
      const reconciliation: SmallCapitalReconciliationSignal = {
        liveReadinessBlocked: false,
        stale: false,
        reasonCodes: []
      };
      const killSwitch: SmallCapitalKillSwitchSignal = { allowed: true, blocksNewOrders: false, reasonCodes: [] };
      const operatorSurface: SmallCapitalOperatorSurfaceSignal = {
        dashboardReachable: true,
        systemStatus: "OK",
        openCriticalAlertCount: 0,
        auditTrailRecorded: true
      };
      const compliance: ComplianceGateResult = { allowed: true, reasons: [], limitations: [] };

      return {
        now: NOW,
        capitalLimits,
        proposedOrder,
        manualApproval,
        reconciliation,
        killSwitch,
        operatorSurface,
        compliance
      };
    }

    it("does not let a clean evaluateSmallCapitalReadiness() report (readyForSmallCapitalLive: true) satisfy BrokerWriteCommandGuard on its own", () => {
      const report: SmallCapitalReadinessReport = evaluateSmallCapitalReadiness(fullyCleanSmallCapitalInput());

      expect(report.readyForSmallCapitalLive).toBe(true);
      expect(report.blockingReasonCodes).toEqual([]);
      expect(report.liveBrokerWriteAllowed).toBe(false);
      expect(report.safetyType).toBe("SMALL_CAPITAL_READINESS_REPORT_EVALUATION_ONLY");

      const guardResult = new BrokerWriteCommandGuard().evaluate({
        commandType: "SUBMIT_ORDER",
        aiContext: report
      });

      expect(guardResult.allowed).toBe(false);
      expect(guardResult.reasonCodes).toContain("missing_order_approval");
      expect(guardResult.reasonCodes).toContain("missing_broker_account");
      expect(guardResult.reasonCodes).toContain("missing_compliance_gate");
      expect(guardResult.reasonCodes).toContain("missing_environment_policy");
      expect(guardResult.reasonCodes).toContain("missing_kill_switch_state");
      expect(guardResult.reasonCodes).toContain("missing_reconciliation_state");
      expect(guardResult.reasonCodes).not.toContain("ai_context_contains_forbidden_broker_command");
    });
  });

  describe("P10-003 runtime live lock and audit gate: cannot itself satisfy BrokerWriteCommandGuard, and rejects tampered evidence (Phase 10 round 1)", () => {
    // Phase 10 round 1 (P10-001 live operation approval packet, P10-002
    // first-trade operating protocol, P10-003 runtime lock and audit gate,
    // P10-004 integration review) is small-capital LIVE OPERATION READINESS
    // -- still no-write, per docs/phase10/README.md. `evaluateRuntimeLiveLockGate`
    // (src/application/live-readiness/runtime-live-lock-gate.ts) is P10-003's
    // own safety-critical module: a pure gate/report that proves the
    // application remains structurally unable to perform a live broker
    // write, no matter how favorable, or how deliberately tampered, the
    // evidence handed to it is. This block closes the same two gaps every
    // other module in this consolidated harness already closes for its own
    // "cleanest possible" output above: (1) cross-checks this module's own
    // cleanest possible report -- built from a real, non-mocked, maximally
    // permissive BrokerWriteCommandGuard result -- against the real guard
    // again, and (2) proves a deliberately tampered `liveBrokerWriteAllowed:
    // true`-shaped "everything is resolved" approval object is detected as
    // blocking, never trusted as authorization. Point (2) is the load-
    // bearing property P10-003 exists to prove, per
    // docs/tasks/phase10_claude_worktree_tasks/P10-003_runtime_lock_and_audit_gate.md.

    const P10_NOW = new Date("2026-07-29T00:00:00Z");

    it("does not let this gate's own cleanest possible report (built from a real, maximally permissive BrokerWriteCommandGuard result) satisfy BrokerWriteCommandGuard on its own", () => {
      const permissiveGuardResult = new BrokerWriteCommandGuard().evaluate({
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
        killSwitch: { active: false, scope: "GLOBAL" },
        reconciliation: cleanReconciliationReport(),
        now: new Date("2026-01-01T00:00:00Z")
      });
      // Sanity: this really is the most favorable BrokerWriteCommandGuard
      // result the real, non-mocked guard can ever produce for this command.
      expect(permissiveGuardResult.allowed).toBe(true);
      expect(permissiveGuardResult.reasonCodes).toEqual([]);

      const enablementReport = evaluateSmallCapitalEnablementGate({ now: P10_NOW });
      expect(enablementReport.liveBrokerWriteAllowed).toBe(false);

      const lockGateReport = evaluateRuntimeLiveLockGate({
        now: P10_NOW,
        brokerWriteGuardResult: permissiveGuardResult,
        tossFutureWriteContractSafetyReport: TOSS_FUTURE_WRITE_CONTRACT_SAFETY_REPORT,
        smallCapitalEnablementReport: enablementReport
      });

      // The property under test: even fed the single most favorable,
      // genuinely-computed guard result, this gate's own output never flips.
      expect(lockGateReport.runtimeWriteLockEngaged).toBe(true);
      expect(lockGateReport.liveBrokerWriteAllowed).toBe(false);
      expect(lockGateReport.safetyType).toBe("RUNTIME_LIVE_LOCK_GATE_REPORT_EVIDENCE_ONLY");

      const guardResult = new BrokerWriteCommandGuard().evaluate({
        commandType: "SUBMIT_ORDER",
        aiContext: lockGateReport
      });

      expect(guardResult.allowed).toBe(false);
      expect(guardResult.reasonCodes).toContain("missing_order_approval");
      expect(guardResult.reasonCodes).toContain("missing_broker_account");
      expect(guardResult.reasonCodes).toContain("missing_compliance_gate");
      expect(guardResult.reasonCodes).toContain("missing_environment_policy");
      expect(guardResult.reasonCodes).toContain("missing_kill_switch_state");
      expect(guardResult.reasonCodes).toContain("missing_reconciliation_state");
      expect(guardResult.reasonCodes).not.toContain("ai_context_contains_forbidden_broker_command");
    });

    it("detects a deliberately tampered liveBrokerWriteAllowed: true approval object ('everything is resolved') as blocking, never as authorization, and BrokerWriteCommandGuard still independently denies", () => {
      const tamperedApprovalSignal: RuntimeLiveLockGateApprovalSignal = {
        claimedLiveBrokerWriteAllowed: true,
        claimedFullyResolved: true
      };

      const lockGateReport = evaluateRuntimeLiveLockGate({
        now: P10_NOW,
        brokerWriteGuardResult: new BrokerWriteCommandGuard().evaluate({
          commandType: "SUBMIT_ORDER",
          environment: PHASE6_NO_LIVE_BROKER_WRITE_ENVIRONMENT_POLICY
        }),
        tossFutureWriteContractSafetyReport: TOSS_FUTURE_WRITE_CONTRACT_SAFETY_REPORT,
        runtimeApprovalSignals: [tamperedApprovalSignal]
      });

      expect(lockGateReport.blockingAnomalyReasonCodes).toContain(
        "approval_signal_0_claims_live_broker_write_allowed_not_false"
      );
      // Tampering is detected and reported -- never trusted as
      // authorization, and never changes the hardcoded output below.
      expect(lockGateReport.runtimeWriteLockEngaged).toBe(true);
      expect(lockGateReport.liveBrokerWriteAllowed).toBe(false);
      expect(JSON.stringify(lockGateReport)).not.toMatch(/"liveBrokerWriteAllowed":true/);

      const guardResult = new BrokerWriteCommandGuard().evaluate({
        commandType: "SUBMIT_ORDER",
        aiContext: lockGateReport
      });

      expect(guardResult.allowed).toBe(false);
      expect(guardResult.reasonCodes).toContain("missing_order_approval");
      expect(guardResult.reasonCodes).toContain("missing_broker_account");
      expect(guardResult.reasonCodes).toContain("missing_compliance_gate");
      expect(guardResult.reasonCodes).toContain("missing_environment_policy");
      expect(guardResult.reasonCodes).toContain("missing_kill_switch_state");
      expect(guardResult.reasonCodes).toContain("missing_reconciliation_state");
      expect(guardResult.reasonCodes).not.toContain("ai_context_contains_forbidden_broker_command");
    });
  });
});
