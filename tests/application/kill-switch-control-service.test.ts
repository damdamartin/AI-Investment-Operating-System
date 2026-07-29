import { describe, expect, it } from "vitest";
import {
  BrokerWriteCommandGuard,
  KillSwitchControlService,
  type KillSwitchControlState
} from "../../src/index.js";

describe("KillSwitchControlService", () => {
  it("activates a kill switch with audit and alert hooks", () => {
    const service = new KillSwitchControlService();
    const initial = service.createInactiveState({
      id: "kill-switch-1",
      scope: "GLOBAL",
      updatedAt: now()
    });

    const result = service.activate(initial, {
      actor: "operator-1",
      reason: "manual emergency stop",
      occurredAt: now()
    });

    expect(result.ok).toBe(true);
    expect(result.state.status).toBe("ACTIVE");
    expect(result.state.activatedBy).toBe("operator-1");
    expect(result.auditRecord?.action).toBe("KILL_SWITCH_ACTIVATED");
    expect(result.alertEvent?.category).toBe("KILL_SWITCH");
    expect(result.alertEvent?.immediateNotification).toBe(true);
    expect(result).not.toHaveProperty("submitOrder");
  });

  it("requires explicit actor and reason for deactivation", () => {
    const service = new KillSwitchControlService();
    const active = activeState();

    const rejected = service.deactivate(active, {
      actor: "",
      reason: "",
      occurredAt: now()
    });
    const accepted = service.deactivate(active, {
      actor: "operator-1",
      reason: "incident resolved after reconciliation",
      occurredAt: new Date("2026-01-01T00:05:00Z")
    });

    expect(rejected.ok).toBe(false);
    expect(rejected.reasonCodes).toEqual(["kill_switch_actor_required", "kill_switch_reason_required"]);
    expect(accepted.ok).toBe(true);
    expect(accepted.state.status).toBe("INACTIVE");
    expect(accepted.auditRecord?.action).toBe("KILL_SWITCH_DEACTIVATED");
    expect(accepted.state.deactivatedBy).toBe("operator-1");
  });

  it("blocks new orders when the kill switch is active", () => {
    const gate = new KillSwitchControlService().evaluateTradingGate(activeState({ scope: "PORTFOLIO" }));

    expect(gate.allowed).toBe(false);
    expect(gate.blocksNewOrders).toBe(true);
    expect(gate.reasonCodes).toContain("kill_switch_active_portfolio");
    expect(gate.brokerWriteGate).toMatchObject({
      active: true,
      scope: "PORTFOLIO",
      reason: "manual stop"
    });
  });

  it("fails closed when kill switch state is missing or unknown", () => {
    const service = new KillSwitchControlService();
    const missing = service.evaluateTradingGate(undefined);
    const unknown = service.evaluateTradingGate(
      service.createUnknownState({
        id: "kill-switch-unknown",
        scope: "GLOBAL",
        reason: "state store unavailable",
        updatedAt: now()
      })
    );

    expect(missing.allowed).toBe(false);
    expect(missing.reasonCodes).toContain("kill_switch_state_missing");
    expect(unknown.allowed).toBe(false);
    expect(unknown.reasonCodes).toContain("kill_switch_state_unknown");
  });

  it("feeds active kill switch state into the broker write guard", () => {
    const gate = new KillSwitchControlService().evaluateTradingGate(activeState({ scope: "ASSET" }));
    const decision = new BrokerWriteCommandGuard().evaluate({
      commandType: "SUBMIT_ORDER",
      killSwitch: gate.brokerWriteGate
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reasonCodes).toContain("kill_switch_active_asset");
  });

  it("rejects a stale deactivate command that arrives after a more recent activation", () => {
    const service = new KillSwitchControlService();
    const inactive = service.createInactiveState({
      id: "kill-switch-1",
      scope: "GLOBAL",
      updatedAt: new Date("2026-01-01T00:00:00Z")
    });

    // A newer activation lands first...
    const activated = service.activate(inactive, {
      actor: "operator-1",
      reason: "manual emergency stop",
      occurredAt: new Date("2026-01-01T00:10:00Z")
    });
    expect(activated.ok).toBe(true);

    // ...then a stale/replayed deactivation claiming an earlier time arrives.
    // It must not be allowed to silently turn the switch back off.
    const staleDeactivation = service.deactivate(activated.state, {
      actor: "operator-2",
      reason: "late duplicate message",
      occurredAt: new Date("2026-01-01T00:05:00Z")
    });

    expect(staleDeactivation.ok).toBe(false);
    expect(staleDeactivation.reasonCodes).toContain("kill_switch_command_out_of_order");
    expect(staleDeactivation.state.status).toBe("ACTIVE");
  });

  it("aggregates multiple scoped kill-switch states and fails closed to the most restrictive one", () => {
    const service = new KillSwitchControlService();

    const allInactive = service.evaluateAggregateTradingGate([
      activeState({ scope: "GLOBAL", status: "INACTIVE" }),
      activeState({ scope: "PORTFOLIO", status: "INACTIVE" })
    ]);
    expect(allInactive.allowed).toBe(true);

    const oneActive = service.evaluateAggregateTradingGate([
      activeState({ scope: "GLOBAL", status: "INACTIVE" }),
      activeState({ scope: "STRATEGY", status: "ACTIVE", reason: "strategy breach" })
    ]);
    expect(oneActive.allowed).toBe(false);
    expect(oneActive.reasonCodes).toContain("kill_switch_active_strategy");

    const oneUnknown = service.evaluateAggregateTradingGate([
      activeState({ scope: "GLOBAL", status: "INACTIVE" }),
      service.createUnknownState({
        id: "kill-switch-unknown",
        scope: "MARKET",
        reason: "state store unavailable",
        updatedAt: now()
      })
    ]);
    expect(oneUnknown.allowed).toBe(false);
    expect(oneUnknown.reasonCodes).toContain("kill_switch_state_unknown");

    const empty = service.evaluateAggregateTradingGate([]);
    expect(empty.allowed).toBe(false);
    expect(empty.reasonCodes).toContain("kill_switch_state_missing");
  });
});

function activeState(overrides: Partial<KillSwitchControlState> = {}): KillSwitchControlState {
  return {
    id: "kill-switch-1",
    scope: "GLOBAL",
    status: "ACTIVE",
    reason: "manual stop",
    activatedAt: now(),
    activatedBy: "operator-1",
    updatedAt: now(),
    safetyType: "KILL_SWITCH_CONTROL_STATE_ONLY",
    ...overrides
  };
}

function now(): Date {
  return new Date("2026-01-01T00:00:00Z");
}
