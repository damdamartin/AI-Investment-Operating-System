import { describe, expect, it } from "vitest";
import { OperationalAlertingService, type AIHealthCheckRecord, type OperationalEvent } from "../../src/index.js";

describe("OperationalAlertingService", () => {
  it("does not create immediate alerts for normal operation events", () => {
    const service = new OperationalAlertingService();

    expect(service.classify(event("NORMAL_BUY"))).toBeUndefined();
    expect(service.classify(event("NORMAL_SELL"))).toBeUndefined();
    expect(service.classify(event("NORMAL_FILL"))).toBeUndefined();
    expect(service.classify(event("DAILY_PROFIT"))).toBeUndefined();
    expect(service.classify(event("DAILY_LOSS_WITHIN_LIMIT"))).toBeUndefined();
    expect(service.classify(event("ROUTINE_HEALTH_GREEN"))).toBeUndefined();
  });

  it("classifies critical failures for immediate notification", () => {
    const alert = new OperationalAlertingService().classify(event("KILL_SWITCH_ACTIVATED"));

    expect(alert?.category).toBe("KILL_SWITCH");
    expect(alert?.severity).toBe("CRITICAL");
    expect(alert?.immediateNotification).toBe(true);
    expect(alert?.safetyType).toBe("OPERATIONAL_ALERT_EVENT_ONLY");
  });

  it("classifies an unknown kill switch state as a high-severity alert distinct from an active one", () => {
    const alert = new OperationalAlertingService().classify(event("KILL_SWITCH_STATE_UNKNOWN"));

    expect(alert?.category).toBe("KILL_SWITCH");
    expect(alert?.severity).toBe("CRITICAL");
    expect(alert?.immediateNotification).toBe(true);
  });

  it("creates AI Health Check red and blocked alert hooks", () => {
    const service = new OperationalAlertingService();
    const red = service.fromAIHealthCheck(healthCheck("RED"));
    const blocked = service.fromAIHealthCheck(healthCheck("BLOCKED"));

    expect(red?.severity).toBe("ERROR");
    expect(red?.immediateNotification).toBe(true);
    expect(blocked?.severity).toBe("CRITICAL");
    expect(blocked?.immediateNotification).toBe(true);
  });

  it("does not alert on green or yellow AI Health Check by default", () => {
    const service = new OperationalAlertingService();

    expect(service.fromAIHealthCheck(healthCheck("GREEN"))).toBeUndefined();
    expect(service.fromAIHealthCheck(healthCheck("YELLOW"))).toBeUndefined();
  });

  it("redacts sensitive payload fields from alert events", () => {
    const alert = new OperationalAlertingService().classify(
      event("API_AUTH_FAILURE", {
        apiKey: "sk-test-secret",
        accessToken: "token-123",
        accountNumber: "1234567890",
        safeField: "visible"
      })
    );
    const encoded = JSON.stringify(alert);

    expect(encoded).not.toContain("sk-test-secret");
    expect(encoded).not.toContain("token-123");
    expect(encoded).not.toContain("1234567890");
    expect(alert?.payload.safeField).toBe("visible");
  });

  it("does not expose action commands through alerts", () => {
    const alert = new OperationalAlertingService().classify(event("DUPLICATE_ORDER_RISK"));

    expect(alert).not.toHaveProperty("submitOrder");
    expect(alert).not.toHaveProperty("cancelOrder");
    expect(alert).not.toHaveProperty("manualInterventionPrompt");
  });

  describe("live trading authorization boundary", () => {
    it("every alert produced by every builder method carries liveBrokerWriteAllowed:false and impliesLiveTradingAuthorization:false", () => {
      const service = new OperationalAlertingService();
      const at = new Date("2026-01-01T00:00:00Z");

      const alerts = [
        service.classify(event("KILL_SWITCH_ACTIVATED")),
        service.fromAIHealthCheck(healthCheck("BLOCKED")),
        service.fromKillSwitchGate({ id: "gate-1", occurredAt: at, scope: "GLOBAL", allowed: false, reasonCodes: ["kill_switch_active_global"] }),
        service.fromRiskCheck({ id: "risk-1", occurredAt: at, subjectId: "intent-1", result: "BLOCKED", reasonCodes: ["kill_switch_active"] }),
        service.fromOrderApprovalRejection({ id: "approval-1", occurredAt: at, approvalId: "approval-1", approved: false, reasonCodes: ["risk_check_stale"] }),
        service.fromBrokerWriteGuardResult({ id: "guard-1", occurredAt: at, commandType: "SUBMIT_ORDER", allowed: false, reasonCodes: ["missing_order_approval"] }),
        service.fromPaperOrderIntentDecision({ id: "paper-1", occurredAt: at, candidateId: "candidate-1", decision: "REJECTED", reasonCodes: ["risk_check_not_passing"] }),
        service.fromReconciliationWorkflow({ workflowId: "wf-1", reportId: "report-1", occurredAt: at, severity: "CRITICAL", stale: false, reasonCodes: ["broker_state_unknown"] }),
        ...service.fromApiUsageSummary({ id: "usage-1", occurredAt: at, totalCalls: 10, totalFailures: 5, totalRateLimited: 1, totalEstimatedCostUsd: 30 })
      ].filter((item): item is NonNullable<typeof item> => item !== undefined);

      expect(alerts.length).toBeGreaterThan(5);
      for (const alertEvent of alerts) {
        expect(alertEvent.liveBrokerWriteAllowed).toBe(false);
        expect(alertEvent.impliesLiveTradingAuthorization).toBe(false);
        expect(alertEvent.safetyType).toBe("OPERATIONAL_ALERT_EVENT_ONLY");
      }
    });

    it("alert message text never claims trading was authorized, resumed, or approved for live use", () => {
      const service = new OperationalAlertingService();
      const at = new Date("2026-01-01T00:00:00Z");
      const forbiddenPhrases = [
        /trading is (resumed|authorized|now allowed)/i,
        /approved for live/i,
        /live trading (enabled|resumed|authorized)/i,
        /order (was|has been) (successfully )?(executed|filled) live/i
      ];

      const alerts = [
        service.fromRiskCheck({ id: "risk-2", occurredAt: at, subjectId: "intent-2", result: "FAIL", reasonCodes: ["max_order_amount_exceeded"] }),
        service.fromBrokerWriteGuardResult({ id: "guard-2", occurredAt: at, commandType: "SUBMIT_ORDER", allowed: false, reasonCodes: ["order_approval_stale"] }),
        service.fromPaperOrderIntentDecision({ id: "paper-2", occurredAt: at, candidateId: "candidate-2", decision: "DEFERRED", reasonCodes: ["missing_risk_check"] })
      ].filter((item): item is NonNullable<typeof item> => item !== undefined);

      for (const alertEvent of alerts) {
        for (const phrase of forbiddenPhrases) {
          expect(alertEvent.message).not.toMatch(phrase);
          expect(alertEvent.title).not.toMatch(phrase);
        }
        // Structural guarantee, not just message-content convention.
        expect(alertEvent.impliesLiveTradingAuthorization).toBe(false);
      }
    });
  });

  describe("deterministic severity classification", () => {
    it("produces identical severity for the same reason codes regardless of array order", () => {
      const service = new OperationalAlertingService();
      const at = new Date("2026-01-01T00:00:00Z");

      const a = service.fromOrderApprovalRejection({
        id: "det-a",
        occurredAt: at,
        approvalId: "approval-a",
        approved: false,
        reasonCodes: ["risk_check_stale", "money_check_stale"]
      });
      const b = service.fromOrderApprovalRejection({
        id: "det-b",
        occurredAt: at,
        approvalId: "approval-b",
        approved: false,
        reasonCodes: ["money_check_stale", "risk_check_stale"]
      });

      expect(a?.severity).toBe(b?.severity);
      expect(a?.category).toBe(b?.category);
    });

    it("is repeatable: calling the same builder twice with the same input yields the same severity and category", () => {
      const service = new OperationalAlertingService();
      const input = {
        id: "repeat-1",
        occurredAt: new Date("2026-01-01T00:00:00Z"),
        commandType: "SUBMIT_ORDER",
        allowed: false,
        reasonCodes: ["kill_switch_active_global", "missing_broker_account"]
      };

      const first = new OperationalAlertingService().fromBrokerWriteGuardResult(input);
      const second = service.fromBrokerWriteGuardResult(input);

      expect(first?.severity).toBe(second?.severity);
      expect(first?.category).toBe(second?.category);
      expect(first?.severity).toBe("CRITICAL");
    });

    it("escalates to CRITICAL whenever a kill-switch reason code is present, regardless of source", () => {
      const service = new OperationalAlertingService();
      const at = new Date("2026-01-01T00:00:00Z");

      const fromRisk = service.fromRiskCheck({ id: "r1", occurredAt: at, subjectId: "s1", result: "FAIL", reasonCodes: ["kill_switch_active"] });
      const fromApproval = service.fromOrderApprovalRejection({ id: "a1", occurredAt: at, approvalId: "ap1", approved: false, reasonCodes: ["kill_switch_active_global"] });
      const fromGuard = service.fromBrokerWriteGuardResult({ id: "g1", occurredAt: at, commandType: "SUBMIT_ORDER", allowed: false, reasonCodes: ["kill_switch_state_unknown"] });

      expect(fromRisk?.severity).toBe("CRITICAL");
      expect(fromApproval?.severity).toBe("CRITICAL");
      expect(fromApproval?.category).toBe("KILL_SWITCH");
      expect(fromGuard?.severity).toBe("CRITICAL");
    });

    it("classifies staleness reason codes as WARNING (actionable, non-executing) rather than CRITICAL", () => {
      const service = new OperationalAlertingService();
      const at = new Date("2026-01-01T00:00:00Z");

      const staleApproval = service.fromOrderApprovalRejection({
        id: "stale-1",
        occurredAt: at,
        approvalId: "approval-stale",
        approved: false,
        reasonCodes: ["risk_check_stale", "money_check_stale"]
      });
      const staleGuard = service.fromBrokerWriteGuardResult({
        id: "stale-guard-1",
        occurredAt: at,
        commandType: "SUBMIT_ORDER",
        allowed: false,
        reasonCodes: ["order_approval_stale"]
      });
      const futureClockSkew = service.fromOrderApprovalRejection({
        id: "future-1",
        occurredAt: at,
        approvalId: "approval-future",
        approved: false,
        reasonCodes: ["risk_check_timestamp_in_future"]
      });

      expect(staleApproval?.severity).toBe("WARNING");
      expect(staleApproval?.category).toBe("STALE_APPROVAL");
      expect(staleApproval?.immediateNotification).toBe(false);
      expect(staleGuard?.severity).toBe("WARNING");
      expect(futureClockSkew?.severity).toBe("WARNING");
    });

    it("classifies a missing evaluation time as a staleness (actionable) alert, not silent approval", () => {
      const alert = new OperationalAlertingService().fromOrderApprovalRejection({
        id: "missing-time-1",
        occurredAt: new Date("2026-01-01T00:00:00Z"),
        approvalId: "approval-missing-time",
        approved: false,
        reasonCodes: ["missing_evaluation_time"]
      });

      expect(alert).toBeDefined();
      expect(alert?.severity).toBe("WARNING");
      expect(alert?.category).toBe("STALE_APPROVAL");
    });
  });

  describe("risk veto alerts", () => {
    it("stays quiet for PASS and PASS_WITH_WARNING risk results", () => {
      const service = new OperationalAlertingService();
      const at = new Date("2026-01-01T00:00:00Z");

      expect(service.fromRiskCheck({ id: "pass-1", occurredAt: at, subjectId: "s1", result: "PASS", reasonCodes: [] })).toBeUndefined();
      expect(service.fromRiskCheck({ id: "pass-2", occurredAt: at, subjectId: "s2", result: "PASS_WITH_WARNING", reasonCodes: [] })).toBeUndefined();
    });

    it("alerts on FAIL and BLOCKED risk results with FAIL below BLOCKED severity", () => {
      const service = new OperationalAlertingService();
      const at = new Date("2026-01-01T00:00:00Z");

      const fail = service.fromRiskCheck({ id: "fail-1", occurredAt: at, subjectId: "s3", result: "FAIL", reasonCodes: ["max_order_amount_exceeded"] });
      const blocked = service.fromRiskCheck({ id: "blocked-1", occurredAt: at, subjectId: "s4", result: "BLOCKED", reasonCodes: ["max_drawdown_exceeded"] });

      expect(fail?.category).toBe("RISK_VETO");
      expect(fail?.severity).toBe("ERROR");
      expect(blocked?.category).toBe("RISK_VETO");
      expect(blocked?.severity).toBe("CRITICAL");
    });
  });

  describe("reconciliation and kill-switch blockers produce high-severity operator alerts", () => {
    it("maps CRITICAL, UNKNOWN, and HIGH reconciliation severity to a CRITICAL operator alert", () => {
      const service = new OperationalAlertingService();
      const at = new Date("2026-01-01T00:00:00Z");

      for (const severity of ["CRITICAL", "UNKNOWN", "HIGH"] as const) {
        const result = service.fromReconciliationWorkflow({
          workflowId: `wf-${severity}`,
          reportId: `report-${severity}`,
          occurredAt: at,
          severity,
          stale: false,
          reasonCodes: ["broker_state_unknown"]
        });

        expect(result?.severity).toBe("CRITICAL");
        expect(result?.category).toBe("RECONCILIATION_MISMATCH");
        expect(result?.immediateNotification).toBe(true);
      }
    });

    it("does not alert when reconciliation severity is NONE", () => {
      const result = new OperationalAlertingService().fromReconciliationWorkflow({
        workflowId: "wf-none",
        reportId: "report-none",
        occurredAt: new Date("2026-01-01T00:00:00Z"),
        severity: "NONE",
        stale: false,
        reasonCodes: []
      });

      expect(result).toBeUndefined();
    });

    it("scales MEDIUM to ERROR and LOW to WARNING for reconciliation severity", () => {
      const service = new OperationalAlertingService();
      const at = new Date("2026-01-01T00:00:00Z");

      const medium = service.fromReconciliationWorkflow({ workflowId: "wf-medium", reportId: "r-medium", occurredAt: at, severity: "MEDIUM", stale: false, reasonCodes: [] });
      const low = service.fromReconciliationWorkflow({ workflowId: "wf-low", reportId: "r-low", occurredAt: at, severity: "LOW", stale: false, reasonCodes: [] });

      expect(medium?.severity).toBe("ERROR");
      expect(low?.severity).toBe("WARNING");
    });

    it("treats an unknown kill-switch state as high severity, distinct in message from an active one", () => {
      const service = new OperationalAlertingService();
      const at = new Date("2026-01-01T00:00:00Z");

      const unknown = service.fromKillSwitchGate({ id: "gate-unknown", occurredAt: at, scope: "GLOBAL", allowed: false, reasonCodes: ["kill_switch_state_unknown"] });
      const active = service.fromKillSwitchGate({ id: "gate-active", occurredAt: at, scope: "PORTFOLIO", allowed: false, reasonCodes: ["kill_switch_active_portfolio"] });
      const missing = service.fromKillSwitchGate({ id: "gate-missing", occurredAt: at, scope: "GLOBAL", allowed: false, reasonCodes: ["kill_switch_state_missing"] });

      expect(unknown?.severity).toBe("CRITICAL");
      expect(active?.severity).toBe("CRITICAL");
      expect(missing?.severity).toBe("CRITICAL");
      expect(unknown?.title).toContain("unknown");
      expect(active?.title).toContain("active");
      expect(unknown?.title).not.toBe(active?.title);
    });

    it("stays quiet when the kill-switch gate allows trading", () => {
      const result = new OperationalAlertingService().fromKillSwitchGate({
        id: "gate-allowed",
        occurredAt: new Date("2026-01-01T00:00:00Z"),
        scope: "GLOBAL",
        allowed: true,
        reasonCodes: []
      });

      expect(result).toBeUndefined();
    });
  });

  describe("broker-write guard rejection alerts", () => {
    it("alerts when the guard blocks a command and stays quiet when allowed", () => {
      const service = new OperationalAlertingService();
      const at = new Date("2026-01-01T00:00:00Z");

      const blocked = service.fromBrokerWriteGuardResult({ id: "cmd-1", occurredAt: at, commandType: "SUBMIT_ORDER", allowed: false, reasonCodes: ["missing_order_approval"] });
      const allowed = service.fromBrokerWriteGuardResult({ id: "cmd-2", occurredAt: at, commandType: "SUBMIT_ORDER", allowed: true, reasonCodes: [] });

      expect(blocked?.category).toBe("BROKER_WRITE_GUARD_BLOCKED");
      expect(blocked?.message).toContain("no network call");
      expect(allowed).toBeUndefined();
    });
  });

  describe("paper intent rejection/deferment alerts", () => {
    it("stays quiet for ACCEPTED, and alerts for REJECTED and DEFERRED without implying execution", () => {
      const service = new OperationalAlertingService();
      const at = new Date("2026-01-01T00:00:00Z");

      const accepted = service.fromPaperOrderIntentDecision({ id: "p-1", occurredAt: at, candidateId: "c-1", decision: "ACCEPTED", reasonCodes: [] });
      const rejected = service.fromPaperOrderIntentDecision({ id: "p-2", occurredAt: at, candidateId: "c-2", decision: "REJECTED", reasonCodes: ["risk_check_not_passing"] });
      const deferred = service.fromPaperOrderIntentDecision({ id: "p-3", occurredAt: at, candidateId: "c-3", decision: "DEFERRED", reasonCodes: ["missing_risk_check", "missing_money_check"] });

      expect(accepted).toBeUndefined();
      expect(rejected?.category).toBe("PAPER_INTENT_BLOCKED");
      expect(rejected?.severity).toBe("ERROR");
      expect(deferred?.category).toBe("PAPER_INTENT_BLOCKED");
      expect(deferred?.severity).toBe("WARNING");
      expect(deferred?.message).toContain("No paper or live order was submitted");
    });

    it("escalates to CRITICAL when a live-write-capable broker account was attached to a paper candidate", () => {
      const alert = new OperationalAlertingService().fromPaperOrderIntentDecision({
        id: "p-4",
        occurredAt: new Date("2026-01-01T00:00:00Z"),
        candidateId: "c-4",
        decision: "REJECTED",
        reasonCodes: ["live_broker_account_not_allowed_for_paper_trading"]
      });

      expect(alert?.severity).toBe("CRITICAL");
    });
  });

  describe("API usage and cost warnings", () => {
    it("does not alert below thresholds", () => {
      const alerts = new OperationalAlertingService().fromApiUsageSummary({
        id: "usage-quiet",
        occurredAt: new Date("2026-01-01T00:00:00Z"),
        totalCalls: 10,
        totalFailures: 0,
        totalRateLimited: 0,
        totalEstimatedCostUsd: 0.5
      });

      expect(alerts).toEqual([]);
    });

    it("warns at the cost warning threshold and escalates to critical past the critical threshold", () => {
      const service = new OperationalAlertingService();
      const at = new Date("2026-01-01T00:00:00Z");

      const warning = service.fromApiUsageSummary({ id: "usage-warn", occurredAt: at, totalCalls: 5, totalFailures: 0, totalRateLimited: 0, totalEstimatedCostUsd: 6 });
      const critical = service.fromApiUsageSummary({ id: "usage-critical", occurredAt: at, totalCalls: 5, totalFailures: 0, totalRateLimited: 0, totalEstimatedCostUsd: 30 });

      expect(warning.find((item) => item.category === "API_USAGE_WARNING")?.severity).toBe("WARNING");
      expect(critical.find((item) => item.category === "API_USAGE_WARNING")?.severity).toBe("CRITICAL");
    });

    it("warns on elevated failure rate and rate-limit events without exposing raw request data", () => {
      const alerts = new OperationalAlertingService().fromApiUsageSummary({
        id: "usage-mixed",
        occurredAt: new Date("2026-01-01T00:00:00Z"),
        totalCalls: 10,
        totalFailures: 5,
        totalRateLimited: 2,
        totalEstimatedCostUsd: 0
      });

      const failureAlert = alerts.find((item) => item.title.includes("failure rate"));
      const rateLimitAlert = alerts.find((item) => item.title.includes("rate limit"));

      expect(failureAlert?.severity).toBe("ERROR");
      expect(rateLimitAlert?.severity).toBe("WARNING");
      const encoded = JSON.stringify(alerts);
      expect(encoded).not.toMatch(/sk-|token|secret|api[_-]?key/i);
    });

    it("respects custom thresholds", () => {
      const alerts = new OperationalAlertingService().fromApiUsageSummary({
        id: "usage-custom",
        occurredAt: new Date("2026-01-01T00:00:00Z"),
        totalCalls: 1,
        totalFailures: 0,
        totalRateLimited: 0,
        totalEstimatedCostUsd: 1,
        thresholds: { costWarningUsd: 0.5, costCriticalUsd: 2 }
      });

      expect(alerts.find((item) => item.title.includes("cost"))?.severity).toBe("WARNING");
    });
  });
});

function event(type: OperationalEvent["type"], payload: Record<string, unknown> = {}): OperationalEvent {
  return {
    id: `event-${type}`,
    type,
    occurredAt: new Date("2026-01-01T00:00:00Z"),
    source: "test",
    payload
  };
}

function healthCheck(status: AIHealthCheckRecord["status"]): AIHealthCheckRecord {
  return {
    id: `health-${status}`,
    periodStart: new Date("2026-01-01T00:00:00Z"),
    periodEnd: new Date("2026-01-01T23:59:59Z"),
    status,
    summary: `${status} health`,
    findings: [`${status} finding`],
    recommendedActions: [],
    requiresTradingPause: status === "BLOCKED",
    requiresHumanReview: status === "RED" || status === "BLOCKED",
    fallbackStatus: status,
    claudeOutputAccepted: false,
    validationErrors: [],
    inputReferences: ["metrics-1"],
    createdAt: new Date("2026-01-02T00:00:00Z"),
    safetyType: "AI_HEALTH_CHECK_AUDIT_ONLY"
  };
}
