import { describe, expect, it } from "vitest";
import {
  AuditLogService,
  InMemoryAuditLogSink,
  OrderCancelSimulationService,
  type SimulatedExecutionRecord
} from "../../src/index.js";

describe("OrderCancelSimulationService", () => {
  it("builds a simulated cancel request for accepted or partially filled orders", () => {
    const service = new OrderCancelSimulationService();
    const accepted = service.buildRequest({
      requestId: "cancel-1",
      execution: execution("ACCEPTED"),
      reason: "operator test cancel",
      requestedAt: now()
    });
    const partial = service.buildRequest({
      requestId: "cancel-2",
      execution: execution("PARTIALLY_FILLED"),
      reason: "operator test cancel",
      requestedAt: now()
    });

    expect(accepted.ok).toBe(true);
    expect(accepted.ok && accepted.request.safetyType).toBe("SIMULATED_CANCEL_REQUEST_ONLY");
    expect(partial.ok).toBe(true);
  });

  it("refuses to cancel filled, rejected, or unknown executions", () => {
    const service = new OrderCancelSimulationService();

    expect(refusalReasons(service.buildRequest({
      requestId: "cancel-1",
      execution: execution("FILLED"),
      reason: "too late",
      requestedAt: now()
    }))).toContain("filled_order_cannot_be_cancelled");
    expect(refusalReasons(service.buildRequest({
      requestId: "cancel-2",
      execution: execution("REJECTED"),
      reason: "already rejected",
      requestedAt: now()
    }))).toContain("rejected_order_cannot_be_cancelled");
    expect(refusalReasons(service.buildRequest({
      requestId: "cancel-3",
      execution: execution("UNKNOWN"),
      reason: "uncertain",
      requestedAt: now()
    }))).toContain("unknown_order_state_requires_reconciliation_before_cancel");
  });

  it("simulates accepted, rejected, too-late, and unknown cancel states", () => {
    const service = new OrderCancelSimulationService();
    const request = requestFixture();

    const accepted = service.simulate(request, { status: "ACCEPTED" }, now());
    const rejected = service.simulate(request, { status: "REJECTED", reason: "broker refused cancel" }, now());
    const tooLate = service.simulate(request, { status: "TOO_LATE" }, now());
    const unknown = service.simulate(request, { status: "UNKNOWN", reason: "cancel timeout" }, now());

    expect(accepted.status).toBe("ACCEPTED");
    expect(accepted.reasons).toEqual([]);
    expect(rejected.reasons).toContain("broker refused cancel");
    expect(tooLate.reasons).toContain("simulated_cancel_too_late");
    expect(unknown.blocksDependentActions).toBe(true);
    expect(unknown.reasons).toContain("cancel timeout");
  });

  it("creates auditable cancel events without live cancel commands", async () => {
    const sink = new InMemoryAuditLogSink();
    const auditLog = new AuditLogService(sink);
    const result = new OrderCancelSimulationService().simulate(
      requestFixture(),
      { status: "ACCEPTED" },
      now()
    );

    await auditLog.record(result.audit);

    expect(sink.records[0]?.action).toBe("SIMULATED_CANCEL_ACCEPTED");
    expect(sink.records[0]?.resourceType).toBe("SIMULATED_ORDER_EXECUTION");
    expect(result.safetyType).toBe("SIMULATED_CANCEL_RESULT_ONLY");
    expect(result).not.toHaveProperty("cancelOrder");
    expect(result).not.toHaveProperty("tossRequest");
  });
});

function requestFixture() {
  const result = new OrderCancelSimulationService().buildRequest({
    requestId: "cancel-1",
    execution: execution("ACCEPTED"),
    reason: "operator test cancel",
    requestedAt: now()
  });

  if (!result.ok) throw new Error("Expected cancel request fixture to build.");
  return result.request;
}

function refusalReasons(result: ReturnType<OrderCancelSimulationService["buildRequest"]>): string[] {
  return result.ok ? [] : result.reasons;
}

function execution(status: SimulatedExecutionRecord["status"]): SimulatedExecutionRecord {
  return {
    commandId: "execution-command-1",
    approvalId: "approval-1",
    orderIntentId: "intent-1",
    status,
    fills: status === "PARTIALLY_FILLED"
      ? [{ quantity: 0.5, price: 100, safetyType: "SIMULATED_EXECUTION_FILL_ONLY" }]
      : [],
    rejectionReasons: status === "REJECTED" ? ["simulated rejection"] : [],
    blocksDependentActions: status === "UNKNOWN",
    simulatedBrokerOrderRef: "sim-order-1",
    executedAt: now(),
    safetyType: "SIMULATED_EXECUTION_RECORD_ONLY",
    liveBrokerWriteAllowed: false
  };
}

function now(): Date {
  return new Date("2026-01-01T00:00:00Z");
}
