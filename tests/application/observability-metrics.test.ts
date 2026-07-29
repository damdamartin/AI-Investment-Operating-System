import { describe, expect, it } from "vitest";
import {
  baselineMetricDefinitions,
  metricNameForAlertCategory,
  ObservabilityMetricsService,
  OperationalAlertingService,
  paperIntentMetricNameFor
} from "../../src/index.js";

describe("ObservabilityMetricsService", () => {
  it("defines baseline metrics for critical system states", () => {
    const names = baselineMetricDefinitions.map((metric) => metric.name);

    expect(names).toEqual(
      expect.arrayContaining([
        "scheduler.job_failed",
        "api.call_latency_ms",
        "api.call_failure",
        "trading.risk_rejection",
        "trading.kill_switch_active",
        "trading.reconciliation_block",
        "order.unknown_state",
        "validation.data_quality_block"
      ])
    );
  });

  it("defines Phase 6 round 2 baseline metrics for stale approvals, guard blocks, paper intents, and API cost warnings", () => {
    const names = baselineMetricDefinitions.map((metric) => metric.name);

    expect(names).toEqual(
      expect.arrayContaining([
        "trading.stale_approval",
        "trading.broker_write_guard_blocked",
        "order.paper_intent_rejected",
        "order.paper_intent_deferred",
        "api.cost_warning"
      ])
    );
  });

  it("emits typed metric events for dashboard and alerting consumption", () => {
    const event = new ObservabilityMetricsService().emit({
      name: "api.call_latency_ms",
      value: 123.4567894,
      labels: { provider: "TOSS_SECURITIES" },
      payload: { operation: "getPositions" },
      emittedAt: now()
    });

    expect(event.category).toBe("API");
    expect(event.kind).toBe("HISTOGRAM");
    expect(event.value).toBe(123.456789);
    expect(event.safetyType).toBe("OBSERVABILITY_METRIC_EVENT_SAFE_ONLY");
  });

  it("redacts sensitive labels and payload fields", () => {
    const event = new ObservabilityMetricsService().emit({
      name: "api.call_failure",
      value: 1,
      labels: {
        provider: "CLAUDE",
        apiKey: "sk-test-secret"
      },
      payload: {
        accessToken: "token-123",
        accountNumber: "1234567890",
        safe: "visible"
      },
      emittedAt: now()
    });
    const encoded = JSON.stringify(event);

    expect(encoded).not.toContain("sk-test-secret");
    expect(encoded).not.toContain("token-123");
    expect(encoded).not.toContain("1234567890");
    expect(event.payload.safe).toBe("visible");
  });

  it("summarizes metric events by category for dashboard snapshots", () => {
    const service = new ObservabilityMetricsService();
    const snapshot = service.dashboardSnapshot([
      service.emit({ name: "scheduler.job_succeeded", value: 1, emittedAt: now() }),
      service.emit({ name: "api.call_failure", value: 1, emittedAt: now() }),
      service.emit({ name: "trading.risk_rejection", value: 1, emittedAt: now() })
    ]);

    expect(snapshot.SCHEDULER).toBe(1);
    expect(snapshot.API).toBe(1);
    expect(snapshot.TRADING_SAFETY).toBe(1);
  });

  it("does not expose action commands through metrics", () => {
    const event = new ObservabilityMetricsService().emit({
      name: "order.unknown_state",
      value: 1,
      emittedAt: now()
    });

    expect(event).not.toHaveProperty("submitOrder");
    expect(event).not.toHaveProperty("cancelOrder");
    expect(event).not.toHaveProperty("resolveBrokerState");
  });

  describe("metricNameForAlertCategory", () => {
    it("deterministically maps alert categories to their baseline metric", () => {
      expect(metricNameForAlertCategory("RECONCILIATION_MISMATCH")).toBe("trading.reconciliation_block");
      expect(metricNameForAlertCategory("KILL_SWITCH")).toBe("trading.kill_switch_active");
      expect(metricNameForAlertCategory("RISK_VETO")).toBe("trading.risk_rejection");
      expect(metricNameForAlertCategory("STALE_APPROVAL")).toBe("trading.stale_approval");
      expect(metricNameForAlertCategory("BROKER_WRITE_GUARD_BLOCKED")).toBe("trading.broker_write_guard_blocked");
      expect(metricNameForAlertCategory("API_USAGE_WARNING")).toBe("api.cost_warning");
    });

    it("returns undefined for categories with no mapped baseline metric rather than guessing", () => {
      expect(metricNameForAlertCategory("NORMAL_TRADING")).toBeUndefined();
    });

    it("every mapped metric name corresponds to an actual baseline definition", () => {
      const definedNames = new Set(baselineMetricDefinitions.map((metric) => metric.name));
      const categories: Array<Parameters<typeof metricNameForAlertCategory>[0]> = [
        "API_FAILURE",
        "API_USAGE_WARNING",
        "RECONCILIATION_MISMATCH",
        "KILL_SWITCH",
        "RISK_VETO",
        "STALE_APPROVAL",
        "BROKER_WRITE_GUARD_BLOCKED",
        "UNKNOWN_BROKER_STATE",
        "ORDER_FAILURE",
        "CLAUDE_SCHEMA_FAILURE",
        "STALE_DATA"
      ];

      for (const category of categories) {
        const name = metricNameForAlertCategory(category);
        expect(name).toBeDefined();
        expect(definedNames.has(name!)).toBe(true);
      }
    });
  });

  describe("paperIntentMetricNameFor", () => {
    it("distinguishes rejected from deferred paper intents", () => {
      expect(paperIntentMetricNameFor("REJECTED")).toBe("order.paper_intent_rejected");
      expect(paperIntentMetricNameFor("DEFERRED")).toBe("order.paper_intent_deferred");
    });
  });

  describe("emitFromAlert", () => {
    it("emits the mapped baseline metric for an alert produced by the alerting service", () => {
      const alerting = new OperationalAlertingService();
      const metrics = new ObservabilityMetricsService();
      const alert = alerting.fromReconciliationWorkflow({
        workflowId: "wf-1",
        reportId: "report-1",
        occurredAt: now(),
        severity: "CRITICAL",
        stale: false,
        reasonCodes: ["broker_state_unknown"]
      });

      const metric = metrics.emitFromAlert(alert!);

      expect(metric?.name).toBe("trading.reconciliation_block");
      expect(metric?.category).toBe("TRADING_SAFETY");
      expect(metric?.labels.severity).toBe("CRITICAL");
      expect(metric?.labels.category).toBe("RECONCILIATION_MISMATCH");
    });

    it("returns undefined for an alert category with no mapped metric rather than fabricating one", () => {
      const alerting = new OperationalAlertingService();
      const metrics = new ObservabilityMetricsService();
      const alert = alerting.classify({
        id: "duplicate-1",
        type: "DUPLICATE_ORDER_RISK",
        occurredAt: now(),
        source: "test"
      });

      expect(metrics.emitFromAlert(alert!)).toBeUndefined();
    });

    it("never leaks raw alert payload contents into the emitted metric", () => {
      const alerting = new OperationalAlertingService();
      const metrics = new ObservabilityMetricsService();
      const alert = alerting.fromRiskCheck({
        id: "risk-secret-test",
        occurredAt: now(),
        subjectId: "intent-1",
        result: "BLOCKED",
        reasonCodes: ["max_drawdown_exceeded"]
      });

      const metric = metrics.emitFromAlert(alert!);
      const encoded = JSON.stringify(metric);

      expect(encoded).not.toContain("intent-1");
      expect(metric?.payload).toEqual({ alertId: alert!.id });
    });
  });

  describe("summarizeAlertSeverity", () => {
    it("counts alerts deterministically by severity", () => {
      const alerting = new OperationalAlertingService();
      const metrics = new ObservabilityMetricsService();
      const alerts = [
        alerting.fromReconciliationWorkflow({ workflowId: "wf-a", reportId: "r-a", occurredAt: now(), severity: "CRITICAL", stale: false, reasonCodes: [] }),
        alerting.fromReconciliationWorkflow({ workflowId: "wf-b", reportId: "r-b", occurredAt: now(), severity: "LOW", stale: false, reasonCodes: [] }),
        alerting.fromOrderApprovalRejection({ id: "ap-1", occurredAt: now(), approvalId: "ap-1", approved: false, reasonCodes: ["risk_check_stale"] })
      ].filter((item): item is NonNullable<typeof item> => item !== undefined);

      const summary = metrics.summarizeAlertSeverity(alerts);

      expect(summary.CRITICAL).toBe(1);
      expect(summary.WARNING).toBe(2);
      expect(summary.ERROR).toBe(0);
      expect(summary.INFO).toBe(0);
    });

    it("returns a full zeroed record for an empty alert list", () => {
      const summary = new ObservabilityMetricsService().summarizeAlertSeverity([]);

      expect(summary).toEqual({ INFO: 0, WARNING: 0, ERROR: 0, CRITICAL: 0 });
    });
  });
});

function now(): Date {
  return new Date("2026-01-01T00:00:00Z");
}
