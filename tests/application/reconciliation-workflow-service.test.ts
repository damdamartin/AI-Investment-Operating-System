import { describe, expect, it } from "vitest";
import {
  defaultReconciliationPolicy,
  ReconciliationService,
  ReconciliationWorkflowService,
  type BrokerCashSnapshot,
  type InternalPositionSnapshot,
  type ReconciliationReport,
  type TossPositionSnapshot
} from "../../src/index.js";

describe("ReconciliationWorkflowService", () => {
  it("keeps matching reconciliation reports clear, auditable, and live-readiness unblocked", () => {
    const report = reconciliationReport();
    const result = new ReconciliationWorkflowService().evaluate({
      workflowId: "workflow-1",
      report,
      evaluatedAt: now()
    });

    expect(result.severity).toBe("NONE");
    expect(result.tradingSafetyState).toBe("CLEAR");
    expect(result.blocksDependentTrading).toBe(false);
    expect(result.alertEvent).toBeUndefined();
    expect(result.auditRecord.resourceId).toBe(report.id);
    expect(result.correctiveTradingAllowed).toBe(false);
    expect(result.liveReadinessBlocked).toBe(false);
    expect(result.liveReadinessReasonCodes).toEqual([]);
    // liveBrokerWriteAllowed is a permanent Phase 6 boundary, not derived from reconciliation cleanliness.
    expect(result.liveBrokerWriteAllowed).toBe(false);
    expect(result).not.toHaveProperty("submitOrder");
    expect(result).not.toHaveProperty("correctionCommand");
    expect(result).not.toHaveProperty("brokerWritePayload");
  });

  it("classifies severe mismatches and emits an alert hook", () => {
    const report = reconciliationReport({
      internalPositions: [internalPosition({ quantity: 2 })],
      brokerPositions: [brokerPosition({ quantity: "1" })],
      internalCash: [internalCash({ available: 1000 })],
      brokerCash: [brokerCash({ available: 900 })]
    });

    const result = new ReconciliationWorkflowService().evaluate({
      workflowId: "workflow-1",
      report,
      evaluatedAt: now()
    });

    expect(result.severity).toBe("HIGH");
    expect(result.tradingSafetyState).toBe("BLOCKED");
    expect(result.requiresHumanReview).toBe(true);
    expect(result.operationalEvent?.type).toBe("RECONCILIATION_MISMATCH");
    expect(result.alertEvent?.category).toBe("RECONCILIATION_MISMATCH");
    expect(result.alertEvent?.immediateNotification).toBe(true);
    expect(result.liveReadinessBlocked).toBe(true);
    expect(result.liveReadinessReasonCodes).toContain("reconciliation_not_fully_resolved");
  });

  it("blocks unknown broker state without creating corrective trading", () => {
    const report = reconciliationReport({
      unknownReasons: ["broker_positions_unavailable:TOSS_TIMEOUT"]
    });

    const result = new ReconciliationWorkflowService().evaluate({
      workflowId: "workflow-unknown",
      report,
      evaluatedAt: now()
    });

    expect(result.severity).toBe("UNKNOWN");
    expect(result.blocksDependentTrading).toBe(true);
    expect(result.reasonCodes).toContain("reconciliation_unknown");
    expect(result.reasonCodes).toContain("broker_positions_unavailable:TOSS_TIMEOUT");
    expect(result.correctiveTradingAllowed).toBe(false);
    expect(result.auditRecord.metadata?.correctiveTradingAllowed).toBe(false);
    expect(result.liveReadinessBlocked).toBe(true);
    expect(result.liveBrokerWriteAllowed).toBe(false);
  });

  it("treats stale reconciliation reports as blocking", () => {
    const report = reconciliationReport({
      checkedAt: new Date("2026-01-01T00:00:00Z")
    });

    const result = new ReconciliationWorkflowService().evaluate({
      workflowId: "workflow-stale",
      report,
      evaluatedAt: new Date("2026-01-01T00:10:01Z")
    });

    expect(result.stale).toBe(true);
    expect(result.severity).toBe("HIGH");
    expect(result.blocksDependentTrading).toBe(true);
    expect(result.reasonCodes).toContain("reconciliation_report_stale");
    expect(result.operationalEvent?.type).toBe("STALE_MARKET_DATA");
    expect(result.liveReadinessBlocked).toBe(true);
  });

  it("classifies missing broker or internal records as critical and requiring human review", () => {
    const report = reconciliationReport({
      internalPositions: [internalPosition({ brokerSymbol: "SYN-A" })],
      brokerPositions: [brokerPosition({ brokerSymbol: "SYN-B" })]
    });

    const result = new ReconciliationWorkflowService().evaluate({
      workflowId: "workflow-critical",
      report,
      evaluatedAt: now()
    });

    expect(result.severity).toBe("CRITICAL");
    expect(result.tradingSafetyState).toBe("BLOCKED");
    expect(result.reasonCodes).toContain("critical_reconciliation_issue_detected");
    expect(result.alertEvent?.severity).toBe("ERROR");
    expect(result.issueCounts.requiresHumanReview).toBeGreaterThan(0);
    expect(result.liveReadinessBlocked).toBe(true);
  });

  it("does not let purely informational within-tolerance variance block dependent trading or raise severity", () => {
    const report = reconciliationReport({
      internalPositions: [internalPosition({ quantity: 1.0000001, averagePrice: 100.001 })],
      brokerPositions: [brokerPosition({ quantity: "1", averagePrice: "100" })]
    });

    const result = new ReconciliationWorkflowService().evaluate({
      workflowId: "workflow-informational",
      report,
      evaluatedAt: now()
    });

    expect(report.status).toBe("CLEAN");
    expect(result.severity).toBe("NONE");
    expect(result.tradingSafetyState).toBe("CLEAR");
    expect(result.blocksDependentTrading).toBe(false);
    expect(result.issueCounts.informational).toBe(1);
    // A hard block on live-readiness is a stricter bar than dependent-trading;
    // informational-only variance still does not block it (it is fully resolved).
    expect(result.liveReadinessBlocked).toBe(false);
  });

  it("hard-blocks the live-readiness signal for any unresolved reconciliation, even LOW severity, while allowing watched dependent trading", () => {
    const report = reconciliationReport({
      internalPositions: [internalPosition({ quantity: 5, averagePrice: 100 })],
      brokerPositions: [brokerPosition({ quantity: "1", averagePrice: "100" })],
      internalCash: [],
      brokerCash: []
    });

    const result = new ReconciliationWorkflowService().evaluate({
      workflowId: "workflow-low",
      report,
      evaluatedAt: now()
    });

    expect(result.severity).toBe("LOW");
    expect(result.tradingSafetyState).toBe("WATCH");
    expect(result.blocksDependentTrading).toBe(false);
    // Even though dependent trading is only "watched", live-readiness is hard-blocked.
    expect(result.liveReadinessBlocked).toBe(true);
    expect(result.liveReadinessReasonCodes).toContain("reconciliation_not_fully_resolved");
    expect(result.liveBrokerWriteAllowed).toBe(false);
  });

  it("hard-blocks the live-readiness signal for MEDIUM-severity cash mismatches while only watching dependent trading", () => {
    const report = reconciliationReport({
      internalCash: [internalCash({ available: 1000 })],
      brokerCash: [brokerCash({ available: 998 })]
    });

    const result = new ReconciliationWorkflowService().evaluate({
      workflowId: "workflow-medium",
      report,
      evaluatedAt: now()
    });

    expect(result.severity).toBe("MEDIUM");
    expect(result.tradingSafetyState).toBe("WATCH");
    expect(result.blocksDependentTrading).toBe(false);
    expect(result.liveReadinessBlocked).toBe(true);
    expect(result.liveBrokerWriteAllowed).toBe(false);
  });

  it("never produces a correction command or broker-write payload regardless of severity", () => {
    const reports = [
      reconciliationReport(),
      reconciliationReport({ unknownReasons: ["broker_positions_unavailable:TOSS_TIMEOUT"] }),
      reconciliationReport({
        internalPositions: [internalPosition({ brokerSymbol: "SYN-A" })],
        brokerPositions: [brokerPosition({ brokerSymbol: "SYN-B" })]
      })
    ];

    for (const report of reports) {
      const result = new ReconciliationWorkflowService().evaluate({
        workflowId: "workflow-safety-scan",
        report,
        evaluatedAt: now()
      });

      const serialized = JSON.stringify(result);
      expect(serialized).not.toMatch(/submitOrder|cancelOrder|correctionCommand|brokerWritePayload|placeOrder/i);
      expect(result.correctiveTradingAllowed).toBe(false);
      expect(result.liveBrokerWriteAllowed).toBe(false);
    }
  });
});

function reconciliationReport(
  overrides: {
    internalPositions?: InternalPositionSnapshot[];
    brokerPositions?: TossPositionSnapshot[];
    internalCash?: BrokerCashSnapshot[];
    brokerCash?: BrokerCashSnapshot[];
    checkedAt?: Date;
    unknownReasons?: string[];
  } = {}
): ReconciliationReport {
  return new ReconciliationService().reconcileSnapshots({
    id: "reconciliation-1",
    internalPositions: overrides.internalPositions ?? [internalPosition()],
    brokerPositions: overrides.brokerPositions ?? [brokerPosition()],
    internalCash: overrides.internalCash ?? [internalCash()],
    brokerCash: overrides.brokerCash ?? [brokerCash()],
    checkedAt: overrides.checkedAt ?? now(),
    policy: defaultReconciliationPolicy,
    unknownReasons: overrides.unknownReasons
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

function now(): Date {
  return new Date("2026-01-01T00:00:00Z");
}
