import { describe, expect, it } from "vitest";
import { TossCapabilityRegistry, type TossCapabilityResult } from "../../src/index.js";

describe("TossCapabilityRegistry", () => {
  it("defaults unknown capabilities to UNVERIFIED", () => {
    const registry = new TossCapabilityRegistry();

    expect(registry.getStatus("US_STOCK_LIMIT_ORDER")).toBe("UNVERIFIED");
    expect(registry.requiresVerifiedSupport("US_STOCK_LIMIT_ORDER")).toBe(false);
  });

  it("allows only supported capabilities", () => {
    const registry = new TossCapabilityRegistry([
      capability("ACCOUNT_BALANCE_QUERY", "SUPPORTED"),
      capability("US_STOCK_LIMIT_ORDER", "PARTIAL"),
      capability("ORDER_CANCEL", "UNVERIFIED")
    ]);

    expect(registry.requiresVerifiedSupport("ACCOUNT_BALANCE_QUERY")).toBe(true);
    expect(registry.requiresVerifiedSupport("US_STOCK_LIMIT_ORDER")).toBe(false);
    expect(registry.blockingReason("ORDER_CANCEL")).toBe("capability_order_cancel_unverified");
  });

  it("builds from adapter results without external API calls", () => {
    const registry = TossCapabilityRegistry.fromAdapterResults([capability("POSITION_QUERY", "SUPPORTED")]);

    expect(registry.getStatus("POSITION_QUERY")).toBe("SUPPORTED");
  });
});

function capability(
  capability: TossCapabilityResult["capability"],
  status: TossCapabilityResult["status"]
): TossCapabilityResult {
  return {
    capability,
    status,
    checkedAt: new Date("2026-01-01T00:00:00Z")
  };
}
