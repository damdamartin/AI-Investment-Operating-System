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
