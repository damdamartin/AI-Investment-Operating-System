import { describe, expect, it } from "vitest";
import {
  BrokerAccount,
  ReadOnlyDashboardService,
  type AIHealthCheckRecord,
  type ReconciliationReport
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
    unknownReasons: [],
    blocksDependentTrading: false,
    checkedAt: new Date("2026-01-01T00:00:00Z"),
    safetyType: "RECONCILIATION_READ_ONLY_REPORT"
  };
}
