import { describe, expect, it } from "vitest";
import { AccessControlService, type AccessControlActor } from "../../src/index.js";

describe("AccessControlService", () => {
  it("separates read-only viewer permissions from sensitive controls", () => {
    const service = new AccessControlService();
    const viewer = actor(["VIEWER"]);
    const readDecision = service.authorize({
      actor: viewer,
      requiredPermissions: ["DASHBOARD_READ"]
    });
    const sensitiveDecision = service.authorize({
      actor: viewer,
      requiredPermissions: ["KILL_SWITCH_CONTROL"]
    });

    expect(readDecision.allowed).toBe(true);
    expect(sensitiveDecision.allowed).toBe(false);
    expect(sensitiveDecision.reasonCodes).toContain("missing_permission_kill_switch_control");
  });

  it("grants owner access to sensitive production controls only when production access is present", () => {
    const service = new AccessControlService();
    const ownerWithoutProduction = actor(["OWNER"], { productionAccess: false });
    const ownerWithProduction = actor(["OWNER"], { productionAccess: true });

    expect(service.authorize({
      actor: ownerWithoutProduction,
      requiredPermissions: ["PRODUCTION_MODE_WRITE"],
      productionSurface: true
    }).allowed).toBe(false);
    expect(service.authorize({
      actor: ownerWithProduction,
      requiredPermissions: ["PRODUCTION_MODE_WRITE"],
      productionSurface: true
    }).allowed).toBe(true);
  });

  it("fails closed for missing or unknown actors", () => {
    const service = new AccessControlService();
    const missing = service.authorize({
      actor: undefined,
      requiredPermissions: ["DASHBOARD_READ"]
    });
    const unknown = service.authorize({
      actor: actor(["OPERATOR"], { authenticated: "UNKNOWN" }),
      requiredPermissions: ["KILL_SWITCH_CONTROL"]
    });

    expect(missing.allowed).toBe(false);
    expect(missing.reasonCodes).toContain("actor_missing");
    expect(unknown.allowed).toBe(false);
    expect(unknown.reasonCodes).toContain("actor_auth_state_unknown");
  });

  it("masks account identifiers before display", () => {
    const service = new AccessControlService();

    expect(service.maskAccountIdentifier("account-1234567890")).toBe("ac****90");
    expect(service.maskAccountIdentifier(undefined)).toBe("****");
  });

  it("does not expose credential or action commands in authorization decisions", () => {
    const decision = new AccessControlService().authorize({
      actor: actor(["OPERATOR"]),
      requiredPermissions: ["KILL_SWITCH_CONTROL"]
    });

    expect(JSON.stringify(decision)).not.toContain("secret");
    expect(decision).not.toHaveProperty("submitOrder");
    expect(decision).not.toHaveProperty("rotateSecret");
  });
});

function actor(
  roles: AccessControlActor["roles"],
  overrides: Partial<AccessControlActor> = {}
): AccessControlActor {
  return {
    id: "actor-1",
    roles,
    authenticated: true,
    productionAccess: false,
    safetyType: "ACCESS_CONTROL_ACTOR_ONLY",
    ...overrides
  };
}
