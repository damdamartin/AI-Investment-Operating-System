import { describe, expect, it, vi } from "vitest";
import {
  defaultOutboxWorkerPolicy,
  OutboxWorkerService,
  type OutboxEventRecord,
  type OutboxProcessingResult
} from "../../src/index.js";

describe("OutboxWorkerService", () => {
  it("locks and processes the next pending event successfully", async () => {
    const service = new OutboxWorkerService();
    const process = vi.fn(async (): Promise<OutboxProcessingResult> => ({ ok: true }));
    const result = await service.run({
      events: [event("outbox-1")],
      workerId: "worker-1",
      now: now(),
      policy: defaultOutboxWorkerPolicy,
      process
    });

    expect(process).toHaveBeenCalledTimes(1);
    expect(result.events[0]?.status).toBe("PROCESSED");
    expect(result.events[0]?.processedAt?.toISOString()).toBe(now().toISOString());
    expect(result.processedEventIds).toEqual(["outbox-1"]);
    expect(result.safetyType).toBe("OUTBOX_WORKER_STATE_TRANSITION_ONLY");
  });

  it("does not process an event locked by another active worker", async () => {
    const process = vi.fn(async (): Promise<OutboxProcessingResult> => ({ ok: true }));
    const result = await new OutboxWorkerService().run({
      events: [
        event("outbox-1", {
          status: "PROCESSING",
          lockedBy: "worker-other",
          lockedAt: new Date("2026-01-01T00:00:00Z")
        })
      ],
      workerId: "worker-1",
      now: new Date("2026-01-01T00:01:00Z"),
      policy: defaultOutboxWorkerPolicy,
      process
    });

    expect(process).not.toHaveBeenCalled();
    expect(result.events[0]?.status).toBe("PROCESSING");
    expect(result.skippedEventIds).toEqual(["outbox-1"]);
  });

  it("retries failed events according to policy", async () => {
    const result = await new OutboxWorkerService().run({
      events: [event("outbox-1")],
      workerId: "worker-1",
      now: now(),
      policy: defaultOutboxWorkerPolicy,
      process: async () => ({
        ok: false,
        error: {
          code: "NAVER_RATE_LIMIT",
          message: "rate limited"
        }
      })
    });

    expect(result.events[0]?.status).toBe("FAILED");
    expect(result.events[0]?.attemptCount).toBe(1);
    expect(result.events[0]?.nextAttemptAt?.toISOString()).toBe("2026-01-01T00:01:00.000Z");
    expect(result.events[0]?.lastError).toBe("NAVER_RATE_LIMIT:rate limited");
  });

  it("moves events to dead-letter after retry exhaustion", async () => {
    const result = await new OutboxWorkerService().run({
      events: [
        event("outbox-1", {
          status: "FAILED",
          attemptCount: 2,
          nextAttemptAt: new Date("2026-01-01T00:00:00Z")
        })
      ],
      workerId: "worker-1",
      now: now(),
      policy: defaultOutboxWorkerPolicy,
      process: async () => ({
        ok: false,
        error: {
          code: "PROVIDER_DOWN",
          message: "still down"
        }
      })
    });

    expect(result.events[0]?.status).toBe("DEAD_LETTER");
    expect(result.deadLetterEventIds).toEqual(["outbox-1"]);
    expect(result.events[0]?.processedAt?.toISOString()).toBe(now().toISOString());
  });

  it("dead-letters unknown broker state instead of blindly retrying", async () => {
    const result = await new OutboxWorkerService().run({
      events: [event("outbox-1", { eventType: "BROKER_ORDER_SUBMIT" })],
      workerId: "worker-1",
      now: now(),
      policy: defaultOutboxWorkerPolicy,
      process: async () => ({
        ok: false,
        error: {
          code: "UNKNOWN_BROKER_STATE",
          message: "submission timeout after possible broker accept",
          unknownBrokerState: true
        }
      })
    });

    expect(result.events[0]?.status).toBe("DEAD_LETTER");
    expect(result.events[0]?.lastError).toContain("UNKNOWN_BROKER_STATE");
    expect(result.events[0]?.nextAttemptAt).toBeUndefined();
  });

  it("uses idempotency keys without exposing command execution helpers", async () => {
    const result = await new OutboxWorkerService().run({
      events: [event("outbox-1", { idempotencyKey: "order-approval-1-submit" })],
      workerId: "worker-1",
      now: now(),
      policy: defaultOutboxWorkerPolicy,
      process: async () => ({ ok: true })
    });

    expect(result.events[0]?.idempotencyKey).toBe("order-approval-1-submit");
    expect(result).not.toHaveProperty("submitOrder");
    expect(result).not.toHaveProperty("retryBlindly");
  });
});

function event(id: string, overrides: Partial<OutboxEventRecord> = {}): OutboxEventRecord {
  return {
    id,
    eventType: "SIMULATED_EVENT",
    aggregateType: "ORDER",
    aggregateId: "aggregate-1",
    payload: {},
    idempotencyKey: `${id}-key`,
    status: "PENDING",
    attemptCount: 0,
    nextAttemptAt: undefined,
    lockedBy: undefined,
    lockedAt: undefined,
    lastError: undefined,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    processedAt: undefined,
    ...overrides
  };
}

function now(): Date {
  return new Date("2026-01-01T00:00:00Z");
}
