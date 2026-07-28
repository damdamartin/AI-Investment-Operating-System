import { describe, expect, it } from "vitest";
import { ConfigVersioningService, createConfigVersionStore } from "../../src/index.js";

describe("ConfigVersioningService", () => {
  it("creates immutable draft config versions with audit metadata", () => {
    const service = new ConfigVersioningService();
    const result = service.createDraft(createConfigVersionStore(), {
      id: "risk-config-v1",
      category: "RISK",
      version: "1.0.0",
      payload: { maxOrderAmount: 1000, maxDrawdownRatio: 0.1 },
      actor: "operator-1",
      reason: "initial risk configuration",
      occurredAt: now()
    });

    expect(result.ok).toBe(true);
    expect(result.record?.status).toBe("DRAFT");
    expect(result.record?.payloadHash).toMatch(/^config-hash-/);
    expect(result.auditRecord?.action).toBe("CONFIG_VERSION_CREATED");
    expect(() => {
      (result.record!.payload as Record<string, unknown>).maxOrderAmount = 2000;
    }).toThrow(TypeError);
  });

  it("requires explicit approval before activation", () => {
    const service = new ConfigVersioningService();
    const draft = service.createDraft(createConfigVersionStore(), draftInput("risk-config-v1"));
    const activation = service.activate(draft.store, "risk-config-v1", command("activate without approval"));

    expect(activation.ok).toBe(false);
    expect(activation.reasonCodes).toContain("only_approved_config_can_be_activated");
  });

  it("activates approved versions and retires the previous active version in the same category", () => {
    const service = new ConfigVersioningService();
    const firstDraft = service.createDraft(createConfigVersionStore(), draftInput("risk-config-v1", "1.0.0"));
    const firstApproved = service.approve(firstDraft.store, "risk-config-v1", command("approve v1"));
    const firstActive = service.activate(firstApproved.store, "risk-config-v1", command("activate v1"));
    const secondDraft = service.createDraft(firstActive.store, {
      ...draftInput("risk-config-v2", "1.1.0"),
      previousVersionId: "risk-config-v1"
    });
    const secondApproved = service.approve(secondDraft.store, "risk-config-v2", command("approve v2"));
    const secondActive = service.activate(secondApproved.store, "risk-config-v2", command("activate v2"));

    expect(secondActive.ok).toBe(true);
    expect(service.activeVersion(secondActive.store, "RISK")?.id).toBe("risk-config-v2");
    expect(secondActive.store.records.find((record) => record.id === "risk-config-v1")?.status).toBe("RETIRED");
    expect(secondActive.auditRecord?.action).toBe("CONFIG_VERSION_ACTIVATED");
  });

  it("does not mutate approved historical versions in place", () => {
    const service = new ConfigVersioningService();
    const draft = service.createDraft(createConfigVersionStore(), draftInput("risk-config-v1", "1.0.0"));
    const approved = service.approve(draft.store, "risk-config-v1", command("approve v1"));
    const before = approved.store.records.find((record) => record.id === "risk-config-v1")!;
    const duplicate = service.createDraft(approved.store, draftInput("risk-config-v1", "1.0.1"));
    const after = approved.store.records.find((record) => record.id === "risk-config-v1")!;

    expect(duplicate.ok).toBe(false);
    expect(duplicate.reasonCodes).toContain("config_id_already_exists");
    expect(after).toEqual(before);
  });

  it("requires actor and reason so production config changes are not silent", () => {
    const result = new ConfigVersioningService().createDraft(createConfigVersionStore(), {
      id: "runtime-config-v1",
      category: "RUNTIME",
      version: "1.0.0",
      payload: { liveTradingEnabled: false },
      actor: "",
      reason: "",
      occurredAt: now()
    });

    expect(result.ok).toBe(false);
    expect(result.reasonCodes).toEqual(["config_actor_required", "config_change_reason_required"]);
  });
});

function draftInput(id: string, version = "1.0.0") {
  return {
    id,
    category: "RISK" as const,
    version,
    payload: { maxOrderAmount: 1000, maxDrawdownRatio: 0.1 },
    actor: "operator-1",
    reason: "risk config update",
    occurredAt: now()
  };
}

function command(reason: string) {
  return {
    actor: "operator-1",
    reason,
    occurredAt: now()
  };
}

function now(): Date {
  return new Date("2026-01-01T00:00:00Z");
}
