import { describe, expect, it } from "vitest";
import {
  Asset,
  AssetType,
  BrokerAccount,
  BrokerWriteCommandGuard,
  Currency,
  EngineScoreSet,
  KillSwitchControlService,
  Money,
  REQUIRED_MANUAL_APPROVAL_ATTESTATION,
  Market,
  MoneyCheck,
  OrderApprovalEngine,
  OrderIntent,
  PHASE6_NO_LIVE_BROKER_WRITE_ENVIRONMENT_POLICY,
  PaperOrderIntentPipeline,
  Phase6OperatorSafetyDashboardService,
  PortfolioBrokerAccountLink,
  Price,
  Quantity,
  ReconciliationService,
  ReconciliationWorkflowService,
  evaluateSmallCapitalReadiness,
  defaultReconciliationPolicy,
  RiskCheck,
  RiskEngine,
  Signal,
  StrategyVersion,
  TossCapabilityRegistry,
  type BrokerCashSnapshot,
  type InternalPositionSnapshot,
  type ManualLiveApprovalRecord,
  type Phase6OperatorSafetyStatus,
  type ReconciliationReport,
  type SmallCapitalCapitalLimits,
  type SmallCapitalKillSwitchSignal,
  type SmallCapitalOperatorSurfaceSignal,
  type SmallCapitalProposedOrder,
  type SmallCapitalReconciliationSignal,
  type TossPositionSnapshot
} from "../../src/index.js";
import type { ComplianceGateResult } from "../../src/application/compliance/index.js";

const NOW = new Date("2026-07-29T01:00:00Z");
const KRW = Currency.from("KRW");

function krw(amount: string): Money {
  return Money.fromMajor(amount, KRW);
}

function cleanCapitalLimits(): SmallCapitalCapitalLimits {
  return {
    maxOrderValue: krw("300000"),
    maxDailyNotionalExposure: krw("900000"),
    maxTotalCapitalExposure: krw("3000000")
  };
}

function cleanProposedOrder(overrides: Partial<SmallCapitalProposedOrder> = {}): SmallCapitalProposedOrder {
  return {
    market: "KR",
    assetType: "STOCK",
    orderType: "LIMIT",
    orderValue: krw("100000"),
    projectedDailyNotionalAfterOrder: krw("100000"),
    projectedTotalCapitalExposureAfterOrder: krw("100000"),
    withinRegularSessionWindow: true,
    isExtendedHours: false,
    isFractional: false,
    ...overrides
  };
}

function approvedManualApproval(overrides: Partial<ManualLiveApprovalRecord> = {}): ManualLiveApprovalRecord {
  return {
    id: "approval-1",
    scopePortfolioId: "portfolio-1",
    scopeStrategyVersionId: "strategy-version-1",
    approvalStatus: "APPROVED",
    approvedByName: "Jun Kim",
    approvedByRole: "OWNER",
    acknowledgedRisksStatement: REQUIRED_MANUAL_APPROVAL_ATTESTATION,
    approvedAt: new Date("2026-07-01T00:00:00Z"),
    expiresAt: new Date("2026-08-01T00:00:00Z"),
    safetyType: "MANUAL_LIVE_APPROVAL_RECORD_HUMAN_OWNED",
    ...overrides
  };
}

function cleanReconciliation(): SmallCapitalReconciliationSignal {
  return { liveReadinessBlocked: false, stale: false, reasonCodes: [] };
}

function cleanKillSwitch(): SmallCapitalKillSwitchSignal {
  return { allowed: true, blocksNewOrders: false, reasonCodes: [] };
}

function cleanOperatorSurface(): SmallCapitalOperatorSurfaceSignal {
  return {
    dashboardReachable: true,
    systemStatus: "OK",
    openCriticalAlertCount: 0,
    auditTrailRecorded: true
  };
}

function cleanCompliance(): ComplianceGateResult {
  return { allowed: true, reasons: [], limitations: [] };
}

function fullyCleanInput() {
  return {
    now: NOW,
    capitalLimits: cleanCapitalLimits(),
    proposedOrder: cleanProposedOrder(),
    manualApproval: approvedManualApproval(),
    reconciliation: cleanReconciliation(),
    killSwitch: cleanKillSwitch(),
    operatorSurface: cleanOperatorSurface(),
    compliance: cleanCompliance()
  };
}

describe("evaluateSmallCapitalReadiness", () => {
  it("is ready only when every gate is clean", () => {
    const report = evaluateSmallCapitalReadiness(fullyCleanInput());

    expect(report.readyForSmallCapitalLive).toBe(true);
    expect(report.blockingReasonCodes).toEqual([]);
    expect(report.liveBrokerWriteAllowed).toBe(false);
    expect(report.safetyType).toBe("SMALL_CAPITAL_READINESS_REPORT_EVALUATION_ONLY");
  });

  it("fails closed on a fully empty input", () => {
    const report = evaluateSmallCapitalReadiness({ now: NOW });

    expect(report.readyForSmallCapitalLive).toBe(false);
    expect(report.liveBrokerWriteAllowed).toBe(false);
    expect(report.blockingReasonCodes).toEqual(
      expect.arrayContaining([
        "missing_capital_limits",
        "missing_manual_live_approval_record",
        "missing_reconciliation_signal",
        "missing_kill_switch_signal",
        "missing_operator_surface_signal",
        "missing_compliance_gate"
      ])
    );
  });

  it("never sets liveBrokerWriteAllowed to true regardless of how clean the input is", () => {
    const report = evaluateSmallCapitalReadiness(fullyCleanInput());
    // Structural check: the literal type already forbids `true`, but this
    // also proves no runtime code path can widen it.
    expect(report.liveBrokerWriteAllowed).toBe(false);
    expect(JSON.stringify(report)).not.toMatch(/"liveBrokerWriteAllowed":true/);
  });

  it("rejects a fully empty evaluation time", () => {
    const report = evaluateSmallCapitalReadiness({ now: new Date(Number.NaN) });
    expect(report.blockingReasonCodes).toContain("missing_or_invalid_evaluation_time");
  });

  describe("capital limits and proposed order", () => {
    it("blocks an order value above the max order value", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        proposedOrder: cleanProposedOrder({ orderValue: krw("400000") })
      });

      expect(report.blockingReasonCodes).toContain("order_value_exceeds_max_order_value");
      expect(report.readyForSmallCapitalLive).toBe(false);
    });

    it("blocks daily notional exposure above the max", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        proposedOrder: cleanProposedOrder({ projectedDailyNotionalAfterOrder: krw("950000") })
      });

      expect(report.blockingReasonCodes).toContain("daily_notional_exposure_exceeds_max");
    });

    it("blocks total capital exposure above the max", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        proposedOrder: cleanProposedOrder({ projectedTotalCapitalExposureAfterOrder: krw("3100000") })
      });

      expect(report.blockingReasonCodes).toContain("total_capital_exposure_exceeds_max");
    });

    it("blocks a disallowed market", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        proposedOrder: cleanProposedOrder({ market: "JP" })
      });

      expect(report.blockingReasonCodes).toContain("market_not_allowed_jp");
    });

    it("blocks a disallowed asset type (e.g. a future crypto/futures/options extension)", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        proposedOrder: cleanProposedOrder({ assetType: "CRYPTO" })
      });

      expect(report.blockingReasonCodes).toContain("asset_type_not_allowed_crypto");
    });

    it("blocks a market order (non-LIMIT order type)", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        proposedOrder: cleanProposedOrder({ orderType: "MARKET" })
      });

      expect(report.blockingReasonCodes).toContain("order_type_not_allowed_market");
    });

    it("blocks an order outside the regular session window", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        proposedOrder: cleanProposedOrder({ withinRegularSessionWindow: false })
      });

      expect(report.blockingReasonCodes).toContain("order_outside_regular_session_window");
    });

    it("blocks extended-hours orders", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        proposedOrder: cleanProposedOrder({ isExtendedHours: true })
      });

      expect(report.blockingReasonCodes).toContain("extended_hours_orders_not_allowed");
    });

    it("blocks fractional orders", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        proposedOrder: cleanProposedOrder({ isFractional: true })
      });

      expect(report.blockingReasonCodes).toContain("fractional_orders_not_allowed");
    });

    it("blocks a currency mismatch between the order and the capital limits instead of throwing", () => {
      const usd = Currency.from("USD");
      expect(() =>
        evaluateSmallCapitalReadiness({
          ...fullyCleanInput(),
          proposedOrder: cleanProposedOrder({ orderValue: Money.fromMajor("100.00", usd) })
        })
      ).not.toThrow();

      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        proposedOrder: cleanProposedOrder({ orderValue: Money.fromMajor("100.00", usd) })
      });
      expect(report.blockingReasonCodes).toContain("order_value_exceeds_max_order_value_currency_mismatch");
      expect(report.readyForSmallCapitalLive).toBe(false);
    });

    it("blocks a zero max order value as an invalid limit", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        capitalLimits: { ...cleanCapitalLimits(), maxOrderValue: krw("0") }
      });

      expect(report.blockingReasonCodes).toContain("invalid_capital_limit_max_order_value");
    });

    it("adds a warning but does not block when no proposed order is supplied", () => {
      const { proposedOrder: _proposedOrder, ...rest } = fullyCleanInput();
      const report = evaluateSmallCapitalReadiness(rest);

      expect(report.readyForSmallCapitalLive).toBe(true);
      expect(report.warnings).toContain("no_proposed_order_evaluated_against_numeric_limits");
    });
  });

  describe("manual live approval record — cannot be inferred or auto-populated", () => {
    it("blocks when the approval record is missing entirely", () => {
      const { manualApproval: _manualApproval, ...rest } = fullyCleanInput();
      const report = evaluateSmallCapitalReadiness(rest);
      expect(report.blockingReasonCodes).toContain("missing_manual_live_approval_record");
    });

    it("blocks a PENDING approval", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        manualApproval: approvedManualApproval({ approvalStatus: "PENDING" })
      });
      expect(report.blockingReasonCodes).toContain("manual_live_approval_status_pending");
    });

    it("blocks a REJECTED approval", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        manualApproval: approvedManualApproval({ approvalStatus: "REJECTED" })
      });
      expect(report.blockingReasonCodes).toContain("manual_live_approval_status_rejected");
    });

    it("blocks a REVOKED approval even if it once was APPROVED-shaped", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        manualApproval: approvedManualApproval({ approvalStatus: "APPROVED", revokedAt: new Date("2026-07-15T00:00:00Z") })
      });
      expect(report.blockingReasonCodes).toContain("manual_live_approval_revoked");
    });

    it("blocks an approval missing the approver's name", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        manualApproval: approvedManualApproval({ approvedByName: "" })
      });
      expect(report.blockingReasonCodes).toContain("manual_live_approval_missing_approver_name");
    });

    it("blocks an approval where the approver role is not OWNER", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        manualApproval: approvedManualApproval({ approvedByRole: "OPERATOR" })
      });
      expect(report.blockingReasonCodes).toContain("manual_live_approval_role_not_owner");
    });

    it("blocks an approval whose attestation text does not match verbatim (proves AI/code cannot fake sign-off)", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        manualApproval: approvedManualApproval({ acknowledgedRisksStatement: "I approve." })
      });
      expect(report.blockingReasonCodes).toContain("manual_live_approval_attestation_mismatch");
    });

    it("blocks an approval missing approvedAt", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        manualApproval: approvedManualApproval({ approvedAt: undefined })
      });
      expect(report.blockingReasonCodes).toContain("manual_live_approval_missing_approved_at");
    });

    it("blocks an approval missing an expiry", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        manualApproval: approvedManualApproval({ expiresAt: undefined })
      });
      expect(report.blockingReasonCodes).toContain("manual_live_approval_missing_expiry");
    });

    it("blocks an expired approval", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        manualApproval: approvedManualApproval({ expiresAt: new Date("2026-07-01T00:00:00Z") })
      });
      expect(report.blockingReasonCodes).toContain("manual_live_approval_expired");
    });
  });

  describe("reconciliation, kill switch, operator surface, compliance", () => {
    it("blocks when reconciliation live-readiness is blocked", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        reconciliation: { liveReadinessBlocked: true, stale: false, reasonCodes: ["reconciliation_not_fully_resolved"] }
      });
      expect(report.blockingReasonCodes).toContain("reconciliation_not_fully_resolved");
    });

    it("blocks when reconciliation is stale", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        reconciliation: { liveReadinessBlocked: false, stale: true, reasonCodes: [] }
      });
      expect(report.blockingReasonCodes).toContain("reconciliation_stale");
    });

    it("blocks when the kill switch gate disallows new orders", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        killSwitch: { allowed: false, blocksNewOrders: true, reasonCodes: ["kill_switch_active_global"] }
      });
      expect(report.blockingReasonCodes).toContain("kill_switch_blocks_new_orders");
    });

    it("blocks when the dashboard is unreachable", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        operatorSurface: { ...cleanOperatorSurface(), dashboardReachable: false }
      });
      expect(report.blockingReasonCodes).toContain("dashboard_unreachable");
    });

    it("blocks when the dashboard system status is not OK", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        operatorSurface: { ...cleanOperatorSurface(), systemStatus: "WARNING" }
      });
      expect(report.blockingReasonCodes).toContain("dashboard_system_status_not_ok_warning");
    });

    it("blocks when there are open critical alerts", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        operatorSurface: { ...cleanOperatorSurface(), openCriticalAlertCount: 2 }
      });
      expect(report.blockingReasonCodes).toContain("open_critical_alerts_present");
    });

    it("blocks when the audit trail was not recorded", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        operatorSurface: { ...cleanOperatorSurface(), auditTrailRecorded: false }
      });
      expect(report.blockingReasonCodes).toContain("audit_trail_not_recorded");
    });

    it("blocks and namespaces reasons when the compliance gate is not allowed", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        compliance: { allowed: false, reasons: ["missing_review_toss_api_terms"], limitations: [] }
      });
      expect(report.blockingReasonCodes).toContain("compliance_missing_review_toss_api_terms");
    });
  });

  it("is a pure function: calling it twice with equivalent input produces the same result", () => {
    const first = evaluateSmallCapitalReadiness(fullyCleanInput());
    const second = evaluateSmallCapitalReadiness(fullyCleanInput());
    expect(first).toEqual(second);
  });

  it("does not mutate its input", () => {
    const input = fullyCleanInput();
    const snapshotBefore = JSON.stringify(input, (_key, value) => (typeof value === "bigint" ? value.toString() : value));
    evaluateSmallCapitalReadiness(input);
    const snapshotAfter = JSON.stringify(input, (_key, value) => (typeof value === "bigint" ? value.toString() : value));
    expect(snapshotAfter).toBe(snapshotBefore);
  });

  describe("Phase 6 signal compatibility", () => {
    it("accepts actual Phase 6 reconciliation, kill-switch, and dashboard status outputs as readiness signals", () => {
      const phase6 = phase6CleanStatus();
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        reconciliation: reconciliationSignalFromPhase6(phase6.reconciliationLiveReadiness),
        killSwitch: killSwitchSignalFromPhase6(phase6.killSwitchGate),
        operatorSurface: operatorSurfaceSignalFromPhase6(phase6)
      });

      expect(report.readyForSmallCapitalLive).toBe(true);
      expect(report.blockingReasonCodes).toEqual([]);
      expect(report.liveBrokerWriteAllowed).toBe(false);
    });

    it("fails closed when actual Phase 6 reconciliation output reports unresolved live-readiness", () => {
      const phase6 = phase6Status({ reconciliationWorkflow: phase6UnresolvedReconciliationWorkflow() });
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        reconciliation: reconciliationSignalFromPhase6(phase6.reconciliationLiveReadiness),
        killSwitch: killSwitchSignalFromPhase6(phase6.killSwitchGate),
        operatorSurface: operatorSurfaceSignalFromPhase6(phase6)
      });

      expect(report.readyForSmallCapitalLive).toBe(false);
      expect(report.blockingReasonCodes).toContain("reconciliation_not_fully_resolved");
      expect(report.blockingReasonCodes).toContain("dashboard_system_status_not_ok_blocked");
    });

    it("fails closed when actual Phase 6 kill-switch output blocks new orders", () => {
      const phase6 = phase6Status({ killSwitchGate: phase6ActiveKillSwitchGate() });
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        reconciliation: reconciliationSignalFromPhase6(phase6.reconciliationLiveReadiness),
        killSwitch: killSwitchSignalFromPhase6(phase6.killSwitchGate),
        operatorSurface: operatorSurfaceSignalFromPhase6(phase6)
      });

      expect(report.readyForSmallCapitalLive).toBe(false);
      expect(report.blockingReasonCodes).toContain("kill_switch_blocks_new_orders");
      expect(report.blockingReasonCodes).toContain("dashboard_system_status_not_ok_blocked");
    });
  });
});

function reconciliationSignalFromPhase6(
  view: Phase6OperatorSafetyStatus["reconciliationLiveReadiness"]
): SmallCapitalReconciliationSignal {
  return {
    liveReadinessBlocked: view.liveReadinessBlocked,
    stale: view.liveReadinessReasonCodes.includes("reconciliation_stale"),
    reasonCodes: [...view.liveReadinessReasonCodes]
  };
}

function killSwitchSignalFromPhase6(view: Phase6OperatorSafetyStatus["killSwitchGate"]): SmallCapitalKillSwitchSignal {
  return {
    allowed: view.allowed,
    blocksNewOrders: view.blocksNewOrders,
    reasonCodes: [...view.reasonCodes]
  };
}

function operatorSurfaceSignalFromPhase6(status: Phase6OperatorSafetyStatus): SmallCapitalOperatorSurfaceSignal {
  return {
    dashboardReachable: true,
    systemStatus: status.liveReadinessBlocked ? "BLOCKED" : "OK",
    openCriticalAlertCount: 0,
    auditTrailRecorded: status.auditCoverage.auditTrailRecorded
  };
}

function phase6CleanStatus(): Phase6OperatorSafetyStatus {
  return phase6Status();
}

function phase6Status(overrides: Partial<Parameters<Phase6OperatorSafetyDashboardService["buildSafetyStatus"]>[0]> = {}): Phase6OperatorSafetyStatus {
  const reconciliationReport = phase6CleanReconciliationReport();
  const reconciliationWorkflow = overrides.reconciliationWorkflow ?? phase6WorkflowFromReport(reconciliationReport, "workflow-phase6-clean-1");
  const killSwitchGate = overrides.killSwitchGate ?? phase6InactiveKillSwitchGate();
  const orderApproval = overrides.orderApproval ?? phase6ApprovedOrderApproval(reconciliationReport, killSwitchGate);

  return new Phase6OperatorSafetyDashboardService().buildSafetyStatus({
    paperOrderIntent: phase6AcceptedPaperOrderIntent(),
    reconciliationWorkflow,
    riskEngineOutput: phase6PassingRiskEngineOutput(),
    killSwitchGate,
    orderApproval,
    brokerWriteGuard: new BrokerWriteCommandGuard().evaluate({
      commandType: "SUBMIT_ORDER",
      approval: orderApproval.approval,
      brokerAccount: phase6LiveBrokerAccount(),
      portfolioLink: phase6PortfolioLink(),
      compliance: cleanCompliance(),
      capabilityRegistry: phase6SupportedCapabilities(),
      requiredCapability: "US_STOCK_LIMIT_ORDER",
      environment: PHASE6_NO_LIVE_BROKER_WRITE_ENVIRONMENT_POLICY,
      killSwitch: killSwitchGate.brokerWriteGate,
      reconciliation: reconciliationReport,
      now: NOW
    }),
    auditTrailRecorded: true,
    generatedAt: NOW,
    ...overrides
  });
}

function phase6OrderIntent(): OrderIntent {
  return new OrderIntent({
    id: "intent-phase6-1",
    signal: new Signal({
      id: "signal-phase6-1",
      strategyVersion: new StrategyVersion({
        id: "version-phase6-1",
        strategyId: "strategy-phase6-1",
        version: "1.0.0",
        definitionHash: "hash-phase6-1"
      }),
      asset: new Asset({
        id: "asset-phase6-aapl",
        symbol: "AAPL",
        name: "Apple",
        market: Market.from("US"),
        assetType: AssetType.from("STOCK"),
        tradingStatus: "TRADABLE"
      }),
      direction: "BUY",
      scoreSet: new EngineScoreSet([{ engine: "STRATEGY_COMPOSITE", score: 80, confidence: 0.85 }], "score-phase6-v1"),
      generatedAt: NOW
    }),
    side: "BUY",
    quantity: Quantity.from("1"),
    limitPrice: Price.from("100.00", Currency.from("USD")),
    status: "CREATED"
  });
}

function phase6PassingRiskCheck(): RiskCheck {
  return new RiskCheck({
    id: "risk-check-phase6-1",
    subjectType: "ORDER_INTENT",
    subjectId: "intent-phase6-1",
    result: "PASS",
    riskLevel: "LOW",
    checkedAt: NOW
  });
}

function phase6PassingMoneyCheck(): MoneyCheck {
  return new MoneyCheck({
    id: "money-check-phase6-1",
    orderIntentId: "intent-phase6-1",
    result: "PASS",
    approvedQuantity: Quantity.from("1"),
    approvedAmount: Money.fromMajor("100.00", Currency.from("USD")),
    cashAfterOrder: Money.fromMajor("900.00", Currency.from("USD")),
    checkedAt: NOW
  });
}

function phase6AcceptedPaperOrderIntent() {
  return new PaperOrderIntentPipeline().evaluate({
    candidateId: "candidate-phase6-1",
    approvalId: "approval-phase6-1",
    paperOrderId: "paper-order-phase6-1",
    orderIntent: phase6OrderIntent(),
    riskCheck: phase6PassingRiskCheck(),
    moneyCheck: phase6PassingMoneyCheck(),
    evaluatedAt: NOW
  });
}

function phase6CleanReconciliationReport(): ReconciliationReport {
  return new ReconciliationService().reconcileSnapshots({
    id: "reconciliation-phase6-clean-1",
    internalPositions: [phase6InternalPosition()],
    brokerPositions: [phase6BrokerPosition()],
    internalCash: [phase6InternalCash()],
    brokerCash: [phase6BrokerCash()],
    checkedAt: NOW,
    policy: defaultReconciliationPolicy
  });
}

function phase6WorkflowFromReport(report: ReconciliationReport, workflowId: string) {
  return new ReconciliationWorkflowService().evaluate({
    workflowId,
    report,
    evaluatedAt: NOW
  });
}

function phase6UnresolvedReconciliationWorkflow() {
  const report = new ReconciliationService().reconcileSnapshots({
    id: "reconciliation-phase6-unresolved-1",
    internalPositions: [phase6InternalPosition({ quantity: 2 })],
    brokerPositions: [phase6BrokerPosition({ quantity: "1" })],
    internalCash: [],
    brokerCash: [],
    checkedAt: NOW,
    policy: defaultReconciliationPolicy
  });

  return new ReconciliationWorkflowService().evaluate({
    workflowId: "workflow-phase6-unresolved-1",
    report,
    evaluatedAt: NOW
  });
}

function phase6InternalPosition(overrides: Partial<InternalPositionSnapshot> = {}): InternalPositionSnapshot {
  return {
    assetId: "asset-phase6-aapl",
    brokerSymbol: "AAPL",
    market: "US",
    assetType: "STOCK",
    quantity: 1,
    averagePrice: 100,
    currency: "USD",
    updatedAt: NOW,
    ...overrides
  };
}

function phase6BrokerPosition(overrides: Partial<TossPositionSnapshot> = {}): TossPositionSnapshot {
  return {
    brokerAccountId: "broker-phase6-1",
    brokerSymbol: "AAPL",
    market: "US",
    assetType: "STOCK",
    quantity: "1",
    averagePrice: "100",
    currency: "USD",
    collectedAt: NOW,
    ...overrides
  };
}

function phase6InternalCash(overrides: Partial<BrokerCashSnapshot> = {}): BrokerCashSnapshot {
  return {
    brokerAccountId: "internal-ledger",
    currency: "USD",
    available: 1000,
    reserved: 0,
    unsettled: 0,
    updatedAt: NOW,
    collectedAt: NOW,
    ...overrides
  };
}

function phase6BrokerCash(overrides: Partial<BrokerCashSnapshot> = {}): BrokerCashSnapshot {
  return {
    brokerAccountId: "broker-phase6-1",
    currency: "USD",
    available: 1000,
    reserved: 0,
    unsettled: 0,
    updatedAt: NOW,
    collectedAt: NOW,
    ...overrides
  };
}

function phase6InactiveKillSwitchGate() {
  const service = new KillSwitchControlService();
  return service.evaluateTradingGate(service.createInactiveState({ id: "kill-switch-phase6-1", scope: "GLOBAL", updatedAt: NOW }));
}

function phase6ActiveKillSwitchGate() {
  const service = new KillSwitchControlService();
  const inactive = service.createInactiveState({ id: "kill-switch-phase6-1", scope: "GLOBAL", updatedAt: NOW });
  return service.evaluateTradingGate(
    service.activate(inactive, { actor: "operator-1", reason: "manual stop", occurredAt: NOW }).state
  );
}

function phase6PassingRiskEngineOutput() {
  const usd = Currency.from("USD");
  return new RiskEngine().evaluate({
    riskCheckId: "risk-engine-phase6-1",
    orderIntent: phase6OrderIntent(),
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
    checkedAt: NOW
  });
}

function phase6ApprovedOrderApproval(reconciliation: ReconciliationReport, killSwitchGate: ReturnType<typeof phase6InactiveKillSwitchGate>) {
  return new OrderApprovalEngine().evaluate({
    approvalId: "approval-phase6-1",
    orderIntent: phase6OrderIntent(),
    riskCheck: phase6PassingRiskCheck(),
    moneyCheck: phase6PassingMoneyCheck(),
    brokerAccount: phase6LiveBrokerAccount(),
    compliance: cleanCompliance(),
    capabilityRegistry: phase6SupportedCapabilities(),
    requiredCapability: "US_STOCK_LIMIT_ORDER",
    killSwitchGate,
    reconciliation,
    evaluatedAt: NOW
  });
}

function phase6LiveBrokerAccount(): BrokerAccount {
  return new BrokerAccount({
    id: "broker-phase6-1",
    broker: "TOSS_SECURITIES",
    externalAccountRef: "account-phase6-1",
    accountLabel: "Main",
    permissionStatus: "LIVE_TRADING_ALLOWED",
    readOnlyEnabled: true,
    liveTradingEnabled: true,
    status: "ACTIVE"
  });
}

function phase6PortfolioLink(): PortfolioBrokerAccountLink {
  return new PortfolioBrokerAccountLink({
    id: "portfolio-link-phase6-1",
    portfolioId: "portfolio-phase6-1",
    brokerAccountId: "broker-phase6-1",
    allowedMarkets: [Market.from("US")],
    allowedAssetTypes: [AssetType.from("STOCK")],
    status: "ACTIVE"
  });
}

function phase6SupportedCapabilities(): TossCapabilityRegistry {
  return new TossCapabilityRegistry([{ capability: "US_STOCK_LIMIT_ORDER", status: "SUPPORTED", checkedAt: NOW }]);
}
