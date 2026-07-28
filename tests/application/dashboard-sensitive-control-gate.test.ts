import { describe, expect, it } from "vitest";
import { DashboardSensitiveControlGate, type DashboardActorAuthState } from "../../src/index.js";

describe("DashboardSensitiveControlGate", () => {
  it("allows authenticated read-only actions without mutation or step-up confirmation", () => {
    const decision = new DashboardSensitiveControlGate().evaluate({
      actionType: "VIEW_STATUS",
      resourceId: "dashboard-status",
      auth: actor(["DASHBOARD_READ"]),
      requestedAt: now()
    });

    expect(decision.allowed).toBe(true);
    expect(decision.sensitivity).toBe("READ_ONLY");
    expect(decision.mutatesState).toBe(false);
    expect(decision.requiresStepUpConfirmation).toBe(false);
    expect(decision.auditRecord.action).toBe("DASHBOARD_CONTROL_ALLOWED");
  });

  it("requires elevated permission, reason, and confirmation for sensitive controls", () => {
    const decision = new DashboardSensitiveControlGate().evaluate({
      actionType: "DEACTIVATE_KILL_SWITCH",
      resourceId: "kill-switch-1",
      auth: actor(["DASHBOARD_READ"]),
      requestedAt: now()
    });

    expect(decision.allowed).toBe(false);
    expect(decision.sensitivity).toBe("CRITICAL");
    expect(decision.mutatesState).toBe(true);
    expect(decision.reasonCodes).toContain("missing_permission_kill_switch_control");
    expect(decision.reasonCodes).toContain("step_up_confirmation_required");
    expect(decision.reasonCodes).toContain("sensitive_action_reason_required");
  });

  it("allows a critical action after permission and confirmation requirements pass", () => {
    const decision = new DashboardSensitiveControlGate().evaluate({
      actionType: "ACTIVATE_KILL_SWITCH",
      resourceId: "kill-switch-1",
      auth: actor(["KILL_SWITCH_CONTROL"]),
      reason: "emergency stop after broker state uncertainty",
      confirmedAt: now(),
      requestedAt: now()
    });

    expect(decision.allowed).toBe(true);
    expect(decision.auditRecord.action).toBe("DASHBOARD_CONTROL_ALLOWED");
    expect(decision.requiredPermissions).toEqual(["KILL_SWITCH_CONTROL"]);
  });

  it("fails closed for sensitive actions when auth state is unknown", () => {
    const decision = new DashboardSensitiveControlGate().evaluate({
      actionType: "PROMOTE_STRATEGY",
      resourceId: "strategy-version-1",
      auth: {
        actorId: "operator-1",
        authenticated: "UNKNOWN",
        permissions: ["STRATEGY_GOVERNANCE_WRITE"],
        stepUpConfirmedAt: now()
      },
      reason: "validated candidate strategy",
      requestedAt: now()
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reasonCodes).toContain("auth_state_unknown_for_sensitive_action");
    expect(decision.auditRecord.action).toBe("DASHBOARD_CONTROL_BLOCKED");
  });

  it("keeps read-only dashboard output separate from sensitive controls", () => {
    const decision = new DashboardSensitiveControlGate().evaluate({
      actionType: "ENABLE_PRODUCTION_MODE",
      resourceId: "production-mode",
      auth: actor(["PRODUCTION_MODE_WRITE"]),
      reason: "readiness gates approved",
      confirmedAt: now(),
      requestedAt: now()
    });

    expect(decision).not.toHaveProperty("enableProductionMode");
    expect(decision).not.toHaveProperty("submitOrder");
    expect(decision.safetyType).toBe("DASHBOARD_SENSITIVE_CONTROL_GATE_DECISION");
  });
});

function actor(permissions: DashboardActorAuthState["permissions"]): DashboardActorAuthState {
  return {
    actorId: "operator-1",
    authenticated: true,
    permissions
  };
}

function now(): Date {
  return new Date("2026-01-01T00:00:00Z");
}
