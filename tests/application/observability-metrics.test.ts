import { describe, expect, it } from "vitest";
import { baselineMetricDefinitions, ObservabilityMetricsService } from "../../src/index.js";

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
});

function now(): Date {
  return new Date("2026-01-01T00:00:00Z");
}
