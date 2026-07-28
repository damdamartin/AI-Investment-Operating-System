import { describe, expect, it } from "vitest";
import { AuditLogService, DomainValidationError, InMemoryAuditLogSink } from "../../src/index.js";

describe("AuditLogService", () => {
  it("records safety-relevant actions", async () => {
    const sink = new InMemoryAuditLogSink();
    const service = new AuditLogService(sink);

    const record = await service.record({
      id: "audit-1",
      actor: "operator",
      action: "KILL_SWITCH_ACTIVATED",
      resourceType: "KILL_SWITCH",
      resourceId: "global",
      reason: "test incident",
      metadata: { safe: "visible" },
      createdAt: new Date("2026-01-01T00:00:00Z")
    });

    expect(record.action).toBe("KILL_SWITCH_ACTIVATED");
    expect(sink.records).toHaveLength(1);
  });

  it("redacts sensitive metadata before storage", async () => {
    const sink = new InMemoryAuditLogSink();
    const service = new AuditLogService(sink);

    const record = await service.record({
      id: "audit-1",
      actor: "operator",
      action: "BROKER_ACCOUNT_REVIEWED",
      resourceType: "BROKER_ACCOUNT",
      resourceId: "broker-account-1",
      metadata: {
        accountRef: "1234567890",
        nested: {
          apiKey: "secret-key"
        }
      },
      createdAt: new Date("2026-01-01T00:00:00Z")
    });

    expect(record.metadata).toEqual({
      accountRef: "****",
      nested: {
        apiKey: "****"
      }
    });
  });

  it("requires actor, action, and resource identity", async () => {
    const sink = new InMemoryAuditLogSink();
    const service = new AuditLogService(sink);

    await expect(
      service.record({
        id: "audit-1",
        actor: "",
        action: "ACTION",
        resourceType: "RESOURCE",
        resourceId: "resource-1",
        createdAt: new Date("2026-01-01T00:00:00Z")
      })
    ).rejects.toThrow(DomainValidationError);
  });
});
