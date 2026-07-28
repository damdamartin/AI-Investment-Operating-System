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
  it("keeps matching reconciliation reports clear and auditable", () => {
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
    expect(result).not.toHaveProperty("submitOrder");
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
  });

  it("classifies missing broker or internal records as critical", () => {
    const report = reconciliationReport({
      internalPositions: [internalPosition({ brokerSymbol: "AAPL" })],
      brokerPositions: [brokerPosition({ brokerSymbol: "MSFT" })]
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
    assetId: "asset-aapl",
    brokerSymbol: "AAPL",
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
    brokerAccountId: "broker-account-1",
    brokerSymbol: "AAPL",
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
    brokerAccountId: "broker-account-1",
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
