import { describe, expect, it } from "vitest";
import { AIHealthCheckService, defaultAIHealthPolicy, validateClaudeHealthCheck } from "../../src/index.js";

const validClaudeOutput = {
  schema_version: "ai_health_check.v1",
  analysis_type: "AI_HEALTH_CHECK",
  period_start: "2026-01-01T00:00:00Z",
  period_end: "2026-01-01T23:59:59Z",
  status: "YELLOW",
  summary: "Strategy performance is soft but infrastructure is stable.",
  strategy_findings: ["win rate declined"],
  execution_findings: [],
  risk_findings: ["drawdown remains below red threshold"],
  api_findings: [],
  data_quality_findings: [],
  cost_findings: [],
  recommended_actions: ["review strategy performance"],
  requires_trading_pause: false,
  requires_human_review: true
};

describe("AI Health Check schema validation", () => {
  it("accepts valid Claude health output", () => {
    const validation = validateClaudeHealthCheck(validClaudeOutput);

    expect(validation.ok).toBe(true);
    expect(validation.output?.status).toBe("YELLOW");
  });

  it("rejects invalid Claude health output and forbidden command keys", () => {
    const validation = validateClaudeHealthCheck({
      ...validClaudeOutput,
      status: "BUY_NOW",
      recommended_actions: "not-array",
      submitOrder: true
    });

    expect(validation.ok).toBe(false);
    expect(validation.errors).toEqual(
      expect.arrayContaining([
        "status_has_unsupported_value",
        "recommendedActions_must_be_string_array",
        "forbidden_command_key_submitOrder"
      ])
    );
  });
});

describe("AIHealthCheckService", () => {
  it("creates an audit-only health record from valid Claude output", () => {
    const record = new AIHealthCheckService().run({
      id: "health-check-1",
      metrics: greenMetrics(),
      policy: defaultAIHealthPolicy,
      inputReferences: ["metrics-1", "claude-health-1"],
      createdAt: new Date("2026-01-02T00:00:00Z"),
      claudeOutput: validClaudeOutput
    });

    expect(record.status).toBe("YELLOW");
    expect(record.claudeOutputAccepted).toBe(true);
    expect(record.requiresHumanReview).toBe(true);
    expect(record.findings).toContain("win rate declined");
    expect(record.safetyType).toBe("AI_HEALTH_CHECK_AUDIT_ONLY");
    expect(record).not.toHaveProperty("order");
    expect(record).not.toHaveProperty("trade");
  });

  it("falls back to deterministic status calculation when Claude output is invalid", () => {
    const record = new AIHealthCheckService().run({
      id: "health-check-1",
      metrics: {
        ...greenMetrics(),
        apiErrorRate: 0.03
      },
      policy: defaultAIHealthPolicy,
      inputReferences: ["metrics-1"],
      createdAt: new Date("2026-01-02T00:00:00Z"),
      claudeOutput: {
        ...validClaudeOutput,
        status: "UNKNOWN_STATUS"
      }
    });

    expect(record.status).toBe("YELLOW");
    expect(record.fallbackStatus).toBe("YELLOW");
    expect(record.claudeOutputAccepted).toBe(false);
    expect(record.validationErrors).toContain("status_has_unsupported_value");
    expect(record.recommendedActions).toEqual([]);
  });

  it("marks unresolved broker state as blocked and pause-required", () => {
    const record = new AIHealthCheckService().run({
      id: "health-check-1",
      metrics: {
        ...greenMetrics(),
        unresolvedBrokerStateCount: 1
      },
      policy: defaultAIHealthPolicy,
      inputReferences: ["metrics-1"],
      createdAt: new Date("2026-01-02T00:00:00Z")
    });

    expect(record.status).toBe("BLOCKED");
    expect(record.requiresTradingPause).toBe(true);
    expect(record.requiresHumanReview).toBe(true);
    expect(record.findings).toContain("unresolved_broker_state_detected");
  });

  it("does not allow Claude to downgrade deterministic red status", () => {
    const record = new AIHealthCheckService().run({
      id: "health-check-1",
      metrics: {
        ...greenMetrics(),
        orderFailureRate: 0.08
      },
      policy: defaultAIHealthPolicy,
      inputReferences: ["metrics-1", "claude-health-1"],
      createdAt: new Date("2026-01-02T00:00:00Z"),
      claudeOutput: {
        ...validClaudeOutput,
        status: "GREEN",
        summary: "Looks fine.",
        requires_human_review: false
      }
    });

    expect(record.fallbackStatus).toBe("RED");
    expect(record.status).toBe("RED");
    expect(record.requiresHumanReview).toBe(true);
  });
});

function greenMetrics() {
  return {
    periodStart: new Date("2026-01-01T00:00:00Z"),
    periodEnd: new Date("2026-01-01T23:59:59Z"),
    strategyWinRateDelta: 0,
    strategyMaxDrawdownRatio: 0.03,
    orderFailureRate: 0,
    apiErrorRate: 0,
    staleDataCount: 0,
    claudeSchemaFailureRate: 0,
    aiCostBudgetUsedRatio: 0.2,
    unresolvedBrokerStateCount: 0,
    reconciliationMismatchCount: 0
  };
}
