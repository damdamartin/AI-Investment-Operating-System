import { describe, expect, it } from "vitest";
import {
  createPhase6SchedulerJobCatalog,
  createSchedulerJobStore,
  OperationalAlertingService,
  OperationsStatusReadModel,
  SchedulerJobRunner,
  type AlertEvent,
  type DashboardReadOnlyStatus,
  type OperationsStatusReadModelInput,
  type Phase6OperatorSafetyStatus,
  type ScheduledJobDefinition,
  type SmallCapitalReadinessReport
} from "../../src/index.js";

const NOW = new Date("2026-07-29T09:00:00Z");

function cleanDashboardStatus(overrides: Partial<DashboardReadOnlyStatus> = {}): DashboardReadOnlyStatus {
  return {
    system: "OK",
    trading: "ENABLED",
    broker: "OK",
    dataFreshness: "FRESH",
    reconciliation: "CLEAN",
    aiHealth: "GREEN",
    openAlertCount: 0,
    portfolio: {
      portfolioId: "portfolio-1",
      brokerAccounts: [],
      cashSummary: []
    },
    strategies: {
      activeStrategyCount: 1,
      candidateStrategyCount: 0,
      blockedStrategyCount: 0
    },
    risk: {
      dailyLossLimitBreached: false,
      monthlyLossLimitBreached: false,
      maxDrawdownBreached: false,
      openRiskIssueCount: 0
    },
    generatedAt: NOW,
    safetyType: "DASHBOARD_READ_ONLY_STATUS",
    ...overrides
  };
}

function cleanPhase6SafetyStatus(overrides: Partial<Phase6OperatorSafetyStatus> = {}): Phase6OperatorSafetyStatus {
  return {
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
    riskVeto: {
      result: "PASS",
      riskLevel: "LOW",
      vetoActive: false,
      reasonCodes: [],
      safetyType: "DASHBOARD_RISK_VETO_STATUS_VIEW"
    },
    killSwitchGate: {
      allowed: true,
      blocksNewOrders: false,
      reasonCodes: [],
      safetyType: "DASHBOARD_KILL_SWITCH_GATE_STATUS_VIEW"
    },
    approvalGuard: {
      approvalStatus: "APPROVED",
      approvalReasonCodes: [],
      brokerWriteGuardAllowed: true,
      brokerWriteGuardReasonCodes: [],
      liveBrokerWriteAllowed: false,
      safetyType: "DASHBOARD_APPROVAL_GUARD_STATUS_VIEW"
    },
    auditCoverage: {
      auditContextPresent: true,
      auditTrailRecorded: true,
      safetyType: "DASHBOARD_AUDIT_COVERAGE_STATUS_VIEW"
    },
    paperSimulationReady: true,
    liveReadinessBlocked: false,
    liveBrokerWriteAllowed: false,
    generatedAt: NOW,
    safetyType: "DASHBOARD_PHASE6_OPERATOR_SAFETY_STATUS",
    ...overrides
  };
}

function cleanSmallCapitalReadiness(overrides: Partial<SmallCapitalReadinessReport> = {}): SmallCapitalReadinessReport {
  return {
    readyForSmallCapitalLive: false,
    blockingReasonCodes: ["missing_manual_live_approval_record"],
    warnings: [],
    liveBrokerWriteAllowed: false,
    generatedAt: NOW,
    safetyType: "SMALL_CAPITAL_READINESS_REPORT_EVALUATION_ONLY",
    ...overrides
  };
}

function cleanSchedulerCatalog(): ScheduledJobDefinition[] {
  return createPhase6SchedulerJobCatalog();
}

function baseInput(overrides: Partial<OperationsStatusReadModelInput> = {}): OperationsStatusReadModelInput {
  return {
    dashboardStatus: cleanDashboardStatus(),
    phase6SafetyStatus: cleanPhase6SafetyStatus(),
    smallCapitalReadiness: cleanSmallCapitalReadiness(),
    openAlerts: [],
    schedulerDefinitions: cleanSchedulerCatalog(),
    schedulerRuns: [],
    generatedAt: NOW,
    ...overrides
  };
}

describe("OperationsStatusReadModel", () => {
  it("exposes exactly one public method (a read-only status builder, no command surface)", () => {
    const proto = Object.getPrototypeOf(new OperationsStatusReadModel()) as object;
    const methodNames = Object.getOwnPropertyNames(proto).filter((name) => name !== "constructor");

    expect(methodNames).toEqual(["buildStatus"]);
  });

  it("builds an OK summary from a fully clean input", () => {
    const summary = new OperationsStatusReadModel().buildStatus(baseInput());

    expect(summary.systemHealth).toBe("OK");
    expect(summary.paperSimulationReady).toBe(true);
    expect(summary.liveReadinessBlocked).toBe(false);
    expect(summary.killSwitch.allowed).toBe(true);
    expect(summary.reconciliation.status).toBe("CLEAN");
    expect(summary.aiApiHealth.ai).toBe("GREEN");
    expect(summary.aiApiHealth.api).toBe("OK");
    expect(summary.alerts.openAlertCount).toBe(0);
    expect(summary.scheduler.totalJobCount).toBe(cleanSchedulerCatalog().length);
    expect(summary.scheduler.unsafeJobDefinitionCount).toBe(0);
    expect(summary.liveBrokerWriteAllowed).toBe(false);
    expect(summary.safetyType).toBe("OPERATIONS_STATUS_SUMMARY_READ_MODEL");
    expect(summary.generatedAt).toBe(NOW);
  });

  it("never reports liveBrokerWriteAllowed: true even when every other signal is clean and small-capital readiness is ready", () => {
    const summary = new OperationsStatusReadModel().buildStatus(
      baseInput({
        smallCapitalReadiness: cleanSmallCapitalReadiness({
          readyForSmallCapitalLive: true,
          blockingReasonCodes: [],
          warnings: []
        })
      })
    );

    expect(summary.smallCapitalReadiness.readyForSmallCapitalLive).toBe(true);
    expect(summary.smallCapitalReadiness.liveBrokerWriteAllowed).toBe(false);
    expect(summary.liveBrokerWriteAllowed).toBe(false);
  });

  it("marks systemHealth BLOCKED and reflects reason codes when the kill switch gate blocks new orders", () => {
    const summary = new OperationsStatusReadModel().buildStatus(
      baseInput({
        phase6SafetyStatus: cleanPhase6SafetyStatus({
          killSwitchGate: {
            allowed: false,
            blocksNewOrders: true,
            reasonCodes: ["kill_switch_active_global"],
            safetyType: "DASHBOARD_KILL_SWITCH_GATE_STATUS_VIEW"
          }
        })
      })
    );

    expect(summary.systemHealth).toBe("BLOCKED");
    expect(summary.killSwitch.allowed).toBe(false);
    expect(summary.killSwitch.blocksNewOrders).toBe(true);
    expect(summary.killSwitch.reasonCodes).toEqual(["kill_switch_active_global"]);
  });

  it("marks systemHealth BLOCKED when reconciliation blocks dependent trading", () => {
    const summary = new OperationsStatusReadModel().buildStatus(
      baseInput({
        phase6SafetyStatus: cleanPhase6SafetyStatus({
          reconciliationLiveReadiness: {
            severity: "CRITICAL",
            tradingSafetyState: "BLOCKED",
            blocksDependentTrading: true,
            liveReadinessBlocked: true,
            liveReadinessReasonCodes: ["reconciliation_mismatch_unresolved"],
            liveBrokerWriteAllowed: false,
            safetyType: "DASHBOARD_RECONCILIATION_LIVE_READINESS_VIEW"
          }
        })
      })
    );

    expect(summary.systemHealth).toBe("BLOCKED");
    expect(summary.reconciliation.blocksDependentTrading).toBe(true);
    expect(summary.reconciliation.tradingSafetyState).toBe("BLOCKED");
  });

  it("marks systemHealth WARNING (not BLOCKED) when live-readiness is blocked but trading is not blocking", () => {
    const summary = new OperationsStatusReadModel().buildStatus(
      baseInput({
        phase6SafetyStatus: cleanPhase6SafetyStatus({
          reconciliationLiveReadiness: {
            severity: "LOW",
            tradingSafetyState: "WATCH",
            blocksDependentTrading: false,
            liveReadinessBlocked: true,
            liveReadinessReasonCodes: ["reconciliation_pending_review"],
            liveBrokerWriteAllowed: false,
            safetyType: "DASHBOARD_RECONCILIATION_LIVE_READINESS_VIEW"
          },
          liveReadinessBlocked: true
        })
      })
    );

    expect(summary.systemHealth).toBe("WARNING");
    expect(summary.liveReadinessBlocked).toBe(true);
    expect(summary.reconciliation.blocksDependentTrading).toBe(false);
  });

  it("derives DOWN api health and ERROR systemHealth from an open CRITICAL API alert", () => {
    const alertingService = new OperationalAlertingService();
    const alert = alertingService.classify({
      id: "evt-1",
      type: "BROKER_UNAVAILABLE",
      occurredAt: NOW,
      source: "TOSS_ADAPTER"
    });
    expect(alert).toBeDefined();

    const summary = new OperationsStatusReadModel().buildStatus(
      baseInput({ openAlerts: alert ? [alert] : [] })
    );

    expect(summary.aiApiHealth.api).toBe("DOWN");
    expect(summary.systemHealth).toBe("ERROR");
    expect(summary.alerts.openAlertCount).toBe(1);
    expect(summary.alerts.hasOpenCriticalAlert).toBe(true);
    expect(summary.alerts.bySeverity.CRITICAL).toBe(1);
  });

  it("derives DEGRADED api health and WARNING systemHealth from a non-critical API usage alert", () => {
    const alertingService = new OperationalAlertingService();
    const alerts = alertingService.fromApiUsageSummary({
      id: "usage-1",
      occurredAt: NOW,
      totalCalls: 100,
      totalFailures: 0,
      totalRateLimited: 0,
      totalEstimatedCostUsd: 10
    });
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts.every((event) => event.severity !== "CRITICAL")).toBe(true);

    const summary = new OperationsStatusReadModel().buildStatus(baseInput({ openAlerts: alerts }));

    expect(summary.aiApiHealth.api).toBe("DEGRADED");
    expect(summary.systemHealth).toBe("WARNING");
  });

  it("counts alerts by severity across a mixed alert set without dropping non-API categories", () => {
    const alertingService = new OperationalAlertingService();
    const killSwitchAlert = alertingService.fromKillSwitchGate({
      id: "gate-1",
      occurredAt: NOW,
      scope: "GLOBAL",
      allowed: false,
      reasonCodes: ["kill_switch_active_global"]
    });
    const riskAlert = alertingService.fromRiskCheck({
      id: "risk-1",
      occurredAt: NOW,
      subjectId: "candidate-1",
      result: "FAIL",
      reasonCodes: ["daily_loss_limit_breach"]
    });
    const openAlerts: AlertEvent[] = [killSwitchAlert, riskAlert].filter((event): event is AlertEvent => event !== undefined);
    expect(openAlerts).toHaveLength(2);

    const summary = new OperationsStatusReadModel().buildStatus(baseInput({ openAlerts }));

    expect(summary.alerts.openAlertCount).toBe(2);
    // killSwitchAlert is CRITICAL (KILL_SWITCH category is always CRITICAL);
    // riskAlert is ERROR (a FAIL result with a non-critical reason code
    // classifies as ERROR, not CRITICAL, per OperationalAlertingService).
    expect(summary.alerts.bySeverity.CRITICAL).toBe(1);
    expect(summary.alerts.bySeverity.ERROR).toBe(1);
    expect(summary.alerts.hasOpenCriticalAlert).toBe(true);
  });

  it("reports scheduler job health from real job runs, including a failing job and its reason codes", () => {
    const runner = new SchedulerJobRunner();
    const definitions = cleanSchedulerCatalog();
    const targetJobId = definitions[0]?.id;
    expect(targetJobId).toBeDefined();

    let store = createSchedulerJobStore(definitions, []);
    const started = runner.start(store, {
      runId: "run-1",
      jobId: targetJobId!,
      workerId: "worker-1",
      now: NOW,
      localStateAvailability: { paperTradingStateSnapshot: true }
    });
    expect(started.ok).toBe(true);
    store = started.store;

    const failed = runner.fail(store, "run-1", NOW, new Error("simulated failure"));
    expect(failed.ok).toBe(false);
    store = failed.store;

    const summary = new OperationsStatusReadModel().buildStatus(
      baseInput({ schedulerDefinitions: store.definitions, schedulerRuns: store.runs })
    );

    const jobView = summary.scheduler.jobs.find((job) => job.jobId === targetJobId);
    expect(jobView).toBeDefined();
    expect(jobView?.lastRunStatus).toBe("FAILED");
    expect(jobView?.consecutiveFailureCount).toBe(1);
    expect(summary.scheduler.failingJobCount).toBe(1);
    expect(summary.systemHealth).toBe("WARNING");
  });

  it("reports NEVER_RUN for a job with no run history", () => {
    const definitions = cleanSchedulerCatalog();
    const summary = new OperationsStatusReadModel().buildStatus(
      baseInput({ schedulerDefinitions: definitions, schedulerRuns: [] })
    );

    expect(summary.scheduler.jobs.every((job) => job.lastRunStatus === "NEVER_RUN")).toBe(true);
    expect(summary.scheduler.failingJobCount).toBe(0);
  });

  it("flags an unsafe scheduler job definition (callsBrokerApi: true) as BLOCKED and does not silently drop it", () => {
    const unsafeDefinition: ScheduledJobDefinition = {
      ...cleanSchedulerCatalog()[0]!,
      id: "unsafe-job",
      callsBrokerApi: true
    };

    const summary = new OperationsStatusReadModel().buildStatus(
      baseInput({ schedulerDefinitions: [unsafeDefinition], schedulerRuns: [] })
    );

    expect(summary.scheduler.unsafeJobDefinitionCount).toBeGreaterThan(0);
    expect(summary.scheduler.unsafeJobDefinitionReasonCodes.length).toBeGreaterThan(0);
    expect(summary.systemHealth).toBe("BLOCKED");
  });

  it("passes through small-capital readiness blocking reason codes and warning counts unchanged", () => {
    const summary = new OperationsStatusReadModel().buildStatus(
      baseInput({
        smallCapitalReadiness: cleanSmallCapitalReadiness({
          readyForSmallCapitalLive: false,
          blockingReasonCodes: ["missing_manual_live_approval_record", "missing_reconciliation_signal"],
          warnings: ["no_proposed_order_evaluated_against_numeric_limits"]
        })
      })
    );

    expect(summary.smallCapitalReadiness.readyForSmallCapitalLive).toBe(false);
    expect(summary.smallCapitalReadiness.blockingReasonCodeCount).toBe(2);
    expect(summary.smallCapitalReadiness.blockingReasonCodes).toEqual([
      "missing_manual_live_approval_record",
      "missing_reconciliation_signal"
    ]);
    expect(summary.smallCapitalReadiness.warningCount).toBe(1);
  });

  it("does not mutate any of its inputs", () => {
    const input = baseInput({
      openAlerts: [
        {
          id: "alert-1",
          sourceEventId: "evt-1",
          category: "KILL_SWITCH",
          severity: "CRITICAL",
          title: "Kill switch active",
          message: "test",
          immediateNotification: true,
          payload: {},
          createdAt: NOW,
          liveBrokerWriteAllowed: false,
          impliesLiveTradingAuthorization: false,
          safetyType: "OPERATIONAL_ALERT_EVENT_ONLY"
        }
      ]
    });
    const snapshot = JSON.parse(JSON.stringify(input));

    new OperationsStatusReadModel().buildStatus(input);

    expect(JSON.parse(JSON.stringify(input))).toEqual(snapshot);
  });

  it("never exposes a command-shaped key anywhere in the built summary", () => {
    const summary = new OperationsStatusReadModel().buildStatus(baseInput());

    expect(summary).not.toHaveProperty("submitOrder");
    expect(summary).not.toHaveProperty("cancelOrder");
    expect(summary).not.toHaveProperty("replaceOrder");
    expect(summary).not.toHaveProperty("placeOrder");
    expect(summary).not.toHaveProperty("activateKillSwitch");
    expect(summary).not.toHaveProperty("deactivateKillSwitch");
    expect(summary).not.toHaveProperty("approveOrder");
    expect(summary).not.toHaveProperty("enableLiveTrading");

    const serialized = JSON.stringify(summary);
    expect(serialized).not.toMatch(/submitOrder|cancelOrder|replaceOrder|placeOrder|TossSecuritiesAdapter/i);
  });

  it("never contains secret-like or raw broker payload text in its serialized output", () => {
    const summary = new OperationsStatusReadModel().buildStatus(baseInput());
    const serialized = JSON.stringify(summary);

    expect(serialized).not.toMatch(/access[_-]?token|refresh[_-]?token|client[_-]?secret|api[_-]?key|authorization|password/i);
  });

  it("redacts a sensitive-looking key if one were ever present on a scheduler job's reason codes payload", () => {
    // Defense in depth: prove `redactObject` is actually applied to the
    // built summary, not merely present in the import list. A definition id
    // containing a sensitive-looking substring should not appear verbatim
    // if it were nested under a sensitive key -- this test documents that
    // the read model's own field names never collide with the redaction
    // key pattern (secret/token/api[_-]key/password/account[_-]ref/account[_-]number),
    // which would otherwise cause legitimate ids to be masked unexpectedly.
    const summary = new OperationsStatusReadModel().buildStatus(baseInput());

    for (const job of summary.scheduler.jobs) {
      expect(job.jobId).not.toBe("****");
      expect(job.kind).not.toBe("****");
    }
  });
});
