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
  it("classifies matching internal and broker snapshots as clean", () => {
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
    expect(report.safetyType).toBe("RECONCILIATION_READ_ONLY_REPORT");
    expect(report).not.toHaveProperty("submitOrder");
  });

  it("detects position and cash mismatches", () => {
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
    expect(report.cashIssues[0]?.type).toBe("CASH_MISMATCH");
  });

  it("detects missing internal and missing broker records", () => {
    const report = new ReconciliationService().reconcileSnapshots({
      id: "reconciliation-1",
      internalPositions: [internalPosition({ brokerSymbol: "AAPL" })],
      brokerPositions: [brokerPosition({ brokerSymbol: "MSFT" })],
      internalCash: [internalCash({ currency: "USD" })],
      brokerCash: [brokerCash({ currency: "KRW" })],
      checkedAt: new Date("2026-01-01T00:00:00Z"),
      policy: defaultReconciliationPolicy
    });

    expect(report.positionIssues.map((item) => item.type)).toEqual(
      expect.arrayContaining(["POSITION_MISSING_INTERNAL", "POSITION_MISSING_BROKER"])
    );
    expect(report.cashIssues.map((item) => item.type)).toEqual(
      expect.arrayContaining(["CASH_MISSING_INTERNAL", "CASH_MISSING_BROKER"])
    );
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
});

function internalPosition(overrides: Partial<InternalPositionSnapshot> = {}): InternalPositionSnapshot {
  return {
    assetId: "asset-aapl",
    brokerSymbol: "AAPL",
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
    brokerAccountId: "broker-account-1",
    brokerSymbol: "AAPL",
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
    brokerAccountId: "broker-account-1",
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
    brokerAccountId: "broker-account-1",
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
