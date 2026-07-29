import { describe, expect, it, vi } from "vitest";
import {
  defaultReconciliationPolicy,
  ReconciliationService,
  type AdapterResult,
  type BrokerCashSnapshot,
  type InternalPositionSnapshot,
  type TossAccountSnapshot,
  type TossPositionSnapshot,
  type TossReadOnlyAdapter
} from "../../src/index.js";

describe("ReconciliationService", () => {
  it("classifies matching internal and broker snapshots as clean, read-only review only", () => {
    const report = new ReconciliationService().reconcileSnapshots({
      id: "reconciliation-1",
      internalPositions: [internalPosition()],
      brokerPositions: [brokerPosition()],
      internalCash: [internalCash()],
      brokerCash: [brokerCash()],
      checkedAt: new Date("2026-01-01T00:00:00Z"),
      policy: defaultReconciliationPolicy
    });

    expect(report.status).toBe("CLEAN");
    expect(report.blocksDependentTrading).toBe(false);
    expect(report.positionIssues).toHaveLength(0);
    expect(report.cashIssues).toHaveLength(0);
    expect(report.issueCounts).toEqual({ informational: 0, blocking: 0, requiresHumanReview: 0 });
    expect(report.safetyType).toBe("RECONCILIATION_READ_ONLY_REPORT");
    expect(report.liveBrokerWriteAllowed).toBe(false);
    expect(report).not.toHaveProperty("submitOrder");
    expect(report).not.toHaveProperty("correctionCommand");
    expect(report).not.toHaveProperty("brokerWritePayload");
  });

  it("detects position and cash mismatches with deterministic reason codes and BLOCKING classification", () => {
    const report = new ReconciliationService().reconcileSnapshots({
      id: "reconciliation-1",
      internalPositions: [internalPosition({ quantity: 2, averagePrice: 100 })],
      brokerPositions: [brokerPosition({ quantity: "1", averagePrice: "110" })],
      internalCash: [internalCash({ available: 1000 })],
      brokerCash: [brokerCash({ available: 900 })],
      checkedAt: new Date("2026-01-01T00:00:00Z"),
      policy: defaultReconciliationPolicy
    });

    expect(report.status).toBe("MISMATCH");
    expect(report.blocksDependentTrading).toBe(true);
    expect(report.positionIssues[0]?.type).toBe("POSITION_MISMATCH");
    expect(report.positionIssues[0]?.classification).toBe("BLOCKING");
    expect(report.positionIssues[0]?.reason).toBe("position_quantity_and_price_mismatch");
    expect(report.cashIssues[0]?.type).toBe("CASH_MISMATCH");
    expect(report.cashIssues[0]?.classification).toBe("BLOCKING");
    expect(report.cashIssues[0]?.reason).toBe("cash_available_mismatch");
    expect(report.issueCounts).toEqual({ informational: 0, blocking: 2, requiresHumanReview: 0 });
  });

  it("distinguishes quantity-only and price-only mismatches with distinct reason codes", () => {
    const quantityOnly = new ReconciliationService().reconcileSnapshots({
      id: "reconciliation-quantity",
      internalPositions: [internalPosition({ quantity: 5, averagePrice: 100 })],
      brokerPositions: [brokerPosition({ quantity: "1", averagePrice: "100" })],
      internalCash: [],
      brokerCash: [],
      checkedAt: new Date("2026-01-01T00:00:00Z"),
      policy: defaultReconciliationPolicy
    });
    expect(quantityOnly.positionIssues[0]?.reason).toBe("position_quantity_mismatch");

    const priceOnly = new ReconciliationService().reconcileSnapshots({
      id: "reconciliation-price",
      internalPositions: [internalPosition({ quantity: 1, averagePrice: 500 })],
      brokerPositions: [brokerPosition({ quantity: "1", averagePrice: "100" })],
      internalCash: [],
      brokerCash: [],
      checkedAt: new Date("2026-01-01T00:00:00Z"),
      policy: defaultReconciliationPolicy
    });
    expect(priceOnly.positionIssues[0]?.reason).toBe("position_price_mismatch");
  });

  it("records within-tolerance variance as informational only and keeps status clean", () => {
    const report = new ReconciliationService().reconcileSnapshots({
      id: "reconciliation-informational",
      internalPositions: [internalPosition({ quantity: 1.0000001, averagePrice: 100.001 })],
      brokerPositions: [brokerPosition({ quantity: "1", averagePrice: "100" })],
      internalCash: [],
      brokerCash: [],
      checkedAt: new Date("2026-01-01T00:00:00Z"),
      policy: defaultReconciliationPolicy
    });

    expect(report.status).toBe("CLEAN");
    expect(report.blocksDependentTrading).toBe(false);
    expect(report.positionIssues[0]?.type).toBe("POSITION_MINOR_VARIANCE");
    expect(report.positionIssues[0]?.classification).toBe("INFORMATIONAL");
    expect(report.issueCounts).toEqual({ informational: 1, blocking: 0, requiresHumanReview: 0 });
  });

  it("detects missing internal and missing broker records as requiring human review", () => {
    const report = new ReconciliationService().reconcileSnapshots({
      id: "reconciliation-1",
      internalPositions: [internalPosition({ brokerSymbol: "SYN-A" })],
      brokerPositions: [brokerPosition({ brokerSymbol: "SYN-B" })],
      internalCash: [internalCash({ currency: "USD" })],
      brokerCash: [brokerCash({ currency: "KRW" })],
      checkedAt: new Date("2026-01-01T00:00:00Z"),
      policy: defaultReconciliationPolicy
    });

    expect(report.positionIssues.map((item) => item.type)).toEqual(
      expect.arrayContaining(["POSITION_MISSING_INTERNAL", "POSITION_MISSING_BROKER"])
    );
    expect(report.positionIssues.every((item) => item.classification === "REQUIRES_HUMAN_REVIEW")).toBe(true);
    expect(report.cashIssues.map((item) => item.type)).toEqual(
      expect.arrayContaining(["CASH_MISSING_INTERNAL", "CASH_MISSING_BROKER"])
    );
    expect(report.cashIssues.every((item) => item.classification === "REQUIRES_HUMAN_REVIEW")).toBe(true);
    expect(report.issueCounts?.requiresHumanReview).toBe(4);
    expect(report.status).toBe("MISMATCH");
    expect(report.blocksDependentTrading).toBe(true);
  });

  it("marks unavailable broker read state as unknown and blocking", async () => {
    const adapter: TossReadOnlyAdapter = {
      getCapabilities: vi.fn(),
      getAccountSnapshot: vi.fn(async () => failure<TossAccountSnapshot>("TOSS_AUTH_FAILED")),
      getPositions: vi.fn()
    };

    const report = await new ReconciliationService().reconcileFromReadOnlyAdapter({
      id: "reconciliation-1",
      adapter,
      internalPositions: [internalPosition()],
      internalCash: [internalCash()],
      checkedAt: new Date("2026-01-01T00:00:00Z"),
      policy: defaultReconciliationPolicy
    });

    expect(report.status).toBe("UNKNOWN");
    expect(report.blocksDependentTrading).toBe(true);
    expect(report.unknownReasons).toContain("account_snapshot_unavailable:TOSS_AUTH_FAILED");
    expect(adapter.getPositions).not.toHaveBeenCalled();
  });

  it("uses read-only adapter methods for broker state comparison", async () => {
    const adapter: TossReadOnlyAdapter = {
      getCapabilities: vi.fn(),
      getAccountSnapshot: vi.fn(async () => success(accountSnapshot())),
      getPositions: vi.fn(async () => success([brokerPosition()]))
    };

    const report = await new ReconciliationService().reconcileFromReadOnlyAdapter({
      id: "reconciliation-1",
      adapter,
      internalPositions: [internalPosition()],
      internalCash: [],
      brokerCash: [],
      checkedAt: new Date("2026-01-01T00:00:00Z"),
      policy: defaultReconciliationPolicy
    });

    expect(report.status).toBe("CLEAN");
    expect(adapter.getAccountSnapshot).toHaveBeenCalledTimes(1);
    expect(adapter.getPositions).toHaveBeenCalledTimes(1);
    expect(adapter).not.toHaveProperty("submitOrder");
  });

  it("never stores raw symbols, raw quantities, raw prices, or raw account identifiers in reported issues", () => {
    const report = new ReconciliationService().reconcileSnapshots({
      id: "reconciliation-sanitized",
      internalPositions: [internalPosition({ brokerSymbol: "SYNTHETIC-LONGSYMBOL", quantity: 42, averagePrice: 12345.67 })],
      brokerPositions: [brokerPosition({ brokerSymbol: "OTHER-LONGSYMBOL", quantity: "99", averagePrice: "1.23" })],
      internalCash: [internalCash({ available: 500000 })],
      brokerCash: [brokerCash({ available: 1, brokerAccountId: "synthetic-broker-account-ref" })],
      checkedAt: new Date("2026-01-01T00:00:00Z"),
      policy: defaultReconciliationPolicy
    });

    const serialized = JSON.stringify(report);

    // Raw symbols must never appear unmasked.
    expect(serialized).not.toContain("SYNTHETIC-LONGSYMBOL");
    expect(serialized).not.toContain("OTHER-LONGSYMBOL");
    // Raw quantities and prices must never appear as literal values.
    expect(serialized).not.toContain("42");
    expect(serialized).not.toContain("12345.67");
    expect(serialized).not.toContain("99");
    expect(serialized).not.toContain("500000");
    // Raw account identifiers must never appear.
    expect(serialized).not.toContain("synthetic-broker-account-ref");

    for (const issue of [...report.positionIssues, ...report.cashIssues]) {
      expect(issue).not.toHaveProperty("internalValue");
      expect(issue).not.toHaveProperty("brokerValue");
      expect(issue).not.toHaveProperty("quantity");
      expect(issue).not.toHaveProperty("averagePrice");
    }
  });
});

function internalPosition(overrides: Partial<InternalPositionSnapshot> = {}): InternalPositionSnapshot {
  return {
    assetId: "asset-synthetic-1",
    brokerSymbol: "SYNT",
    market: "US",
    assetType: "STOCK",
    quantity: 1,
    averagePrice: 100,
    currency: "USD",
    updatedAt: new Date("2026-01-01T00:00:00Z"),
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
    collectedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides
  };
}

function internalCash(overrides: Partial<BrokerCashSnapshot> = {}) {
  return {
    currency: "USD" as const,
    available: 1000,
    reserved: 0,
    unsettled: 0,
    updatedAt: new Date("2026-01-01T00:00:00Z"),
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
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    collectedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides
  };
}

function accountSnapshot(): TossAccountSnapshot {
  return {
    brokerAccountId: "synthetic-broker-account-1",
    permissionStatus: "READ_ONLY",
    readOnlyEnabled: true,
    liveTradingEnabled: false,
    checkedAt: new Date("2026-01-01T00:00:00Z")
  };
}

function success<T>(data: T): AdapterResult<T> {
  return {
    ok: true,
    data,
    metadata: {
      provider: "TOSS_SECURITIES",
      collectedAt: new Date("2026-01-01T00:00:00Z")
    }
  };
}

function failure<T>(code: string): AdapterResult<T> {
  return {
    ok: false,
    error: {
      provider: "TOSS_SECURITIES",
      code,
      message: code,
      retryable: false
    }
  };
}
