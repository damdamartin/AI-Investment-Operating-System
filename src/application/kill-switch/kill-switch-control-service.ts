import type { AuditRecordProps } from "../audit/index.js";
import { OperationalAlertingService, type AlertEvent, type OperationalEvent } from "../alerting/index.js";
import type { BrokerWriteKillSwitchGate } from "../broker-write-guard/index.js";
import type { RiskLimitScope } from "../../domain/risk/index.js";

export type KillSwitchControlScope = "GLOBAL" | RiskLimitScope;
export type KillSwitchControlStatus = "INACTIVE" | "ACTIVE" | "UNKNOWN";

export interface KillSwitchControlState {
  id: string;
  scope: KillSwitchControlScope;
  targetId?: string | undefined;
  status: KillSwitchControlStatus;
  reason?: string | undefined;
  activatedAt?: Date | undefined;
  activatedBy?: string | undefined;
  deactivatedAt?: Date | undefined;
  deactivatedBy?: string | undefined;
  updatedAt: Date;
  safetyType: "KILL_SWITCH_CONTROL_STATE_ONLY";
}

export interface KillSwitchControlCommand {
  actor: string;
  reason: string;
  occurredAt: Date;
}

export interface KillSwitchControlCommandResult {
  ok: boolean;
  state: KillSwitchControlState;
  reasonCodes: string[];
  auditRecord?: AuditRecordProps | undefined;
  operationalEvent?: OperationalEvent | undefined;
  alertEvent?: AlertEvent | undefined;
  safetyType: "KILL_SWITCH_CONTROL_COMMAND_RESULT_ONLY";
}

export interface KillSwitchTradingGate {
  allowed: boolean;
  blocksNewOrders: boolean;
  reasonCodes: string[];
  brokerWriteGate: BrokerWriteKillSwitchGate;
  safetyType: "KILL_SWITCH_TRADING_GATE_ONLY";
}

export class KillSwitchControlService {
  constructor(private readonly alerting = new OperationalAlertingService()) {}

  createInactiveState(input: {
    id: string;
    scope: KillSwitchControlScope;
    targetId?: string | undefined;
    updatedAt: Date;
  }): KillSwitchControlState {
    return {
      id: input.id,
      scope: input.scope,
      targetId: input.targetId,
      status: "INACTIVE",
      updatedAt: input.updatedAt,
      safetyType: "KILL_SWITCH_CONTROL_STATE_ONLY"
    };
  }

  createUnknownState(input: {
    id: string;
    scope: KillSwitchControlScope;
    targetId?: string | undefined;
    reason: string;
    updatedAt: Date;
  }): KillSwitchControlState {
    return {
      id: input.id,
      scope: input.scope,
      targetId: input.targetId,
      status: "UNKNOWN",
      reason: input.reason,
      updatedAt: input.updatedAt,
      safetyType: "KILL_SWITCH_CONTROL_STATE_ONLY"
    };
  }

  activate(state: KillSwitchControlState, command: KillSwitchControlCommand): KillSwitchControlCommandResult {
    const validationErrors = validateCommand(command);
    if (validationErrors.length > 0) return commandResult(false, state, validationErrors);

    const nextState: KillSwitchControlState = {
      ...state,
      status: "ACTIVE",
      reason: command.reason,
      activatedAt: command.occurredAt,
      activatedBy: command.actor,
      deactivatedAt: undefined,
      deactivatedBy: undefined,
      updatedAt: command.occurredAt
    };
    const operationalEvent = killSwitchActivatedEvent(nextState, command);

    return commandResult(true, nextState, ["kill_switch_activated"], {
      auditRecord: auditRecord(nextState, command, "KILL_SWITCH_ACTIVATED"),
      operationalEvent,
      alertEvent: this.alerting.classify(operationalEvent)
    });
  }

  deactivate(state: KillSwitchControlState, command: KillSwitchControlCommand): KillSwitchControlCommandResult {
    const validationErrors = validateCommand(command);
    if (validationErrors.length > 0) return commandResult(false, state, validationErrors);

    if (state.status === "INACTIVE") {
      return commandResult(false, state, ["kill_switch_already_inactive"]);
    }

    const nextState: KillSwitchControlState = {
      ...state,
      status: "INACTIVE",
      reason: command.reason,
      deactivatedAt: command.occurredAt,
      deactivatedBy: command.actor,
      updatedAt: command.occurredAt
    };

    return commandResult(true, nextState, ["kill_switch_deactivated"], {
      auditRecord: auditRecord(nextState, command, "KILL_SWITCH_DEACTIVATED")
    });
  }

  evaluateTradingGate(state: KillSwitchControlState | undefined): KillSwitchTradingGate {
    if (!state) {
      return tradingGate(false, ["kill_switch_state_missing"], {
        active: true,
        scope: "GLOBAL",
        reason: "kill_switch_state_missing"
      });
    }

    if (state.status === "UNKNOWN") {
      return tradingGate(false, ["kill_switch_state_unknown"], {
        active: true,
        scope: brokerWriteScope(state.scope),
        reason: state.reason ?? "kill_switch_state_unknown"
      });
    }

    if (state.status === "ACTIVE") {
      return tradingGate(false, [`kill_switch_active_${state.scope.toLowerCase()}`], {
        active: true,
        scope: brokerWriteScope(state.scope),
        reason: state.reason
      });
    }

    return tradingGate(true, [], {
      active: false,
      scope: brokerWriteScope(state.scope),
      reason: state.reason
    });
  }
}

function validateCommand(command: KillSwitchControlCommand): string[] {
  const errors: string[] = [];
  if (!command.actor.trim()) errors.push("kill_switch_actor_required");
  if (!command.reason.trim()) errors.push("kill_switch_reason_required");
  if (Number.isNaN(command.occurredAt.getTime())) errors.push("kill_switch_occurred_at_invalid");
  return errors;
}

function commandResult(
  ok: boolean,
  state: KillSwitchControlState,
  reasonCodes: string[],
  hooks: {
    auditRecord?: AuditRecordProps | undefined;
    operationalEvent?: OperationalEvent | undefined;
    alertEvent?: AlertEvent | undefined;
  } = {}
): KillSwitchControlCommandResult {
  return {
    ok,
    state,
    reasonCodes,
    ...hooks,
    safetyType: "KILL_SWITCH_CONTROL_COMMAND_RESULT_ONLY"
  };
}

function tradingGate(
  allowed: boolean,
  reasonCodes: string[],
  brokerWriteGate: BrokerWriteKillSwitchGate
): KillSwitchTradingGate {
  return {
    allowed,
    blocksNewOrders: !allowed,
    reasonCodes,
    brokerWriteGate,
    safetyType: "KILL_SWITCH_TRADING_GATE_ONLY"
  };
}

function auditRecord(
  state: KillSwitchControlState,
  command: KillSwitchControlCommand,
  action: "KILL_SWITCH_ACTIVATED" | "KILL_SWITCH_DEACTIVATED"
): AuditRecordProps {
  return {
    id: `audit-${state.id}-${action.toLowerCase()}-${command.occurredAt.getTime()}`,
    actor: command.actor,
    action,
    resourceType: "KILL_SWITCH",
    resourceId: state.id,
    reason: command.reason,
    metadata: {
      scope: state.scope,
      targetId: state.targetId,
      status: state.status
    },
    createdAt: command.occurredAt
  };
}

function killSwitchActivatedEvent(
  state: KillSwitchControlState,
  command: KillSwitchControlCommand
): OperationalEvent {
  return {
    id: `kill-switch-${state.id}-${command.occurredAt.getTime()}`,
    type: "KILL_SWITCH_ACTIVATED",
    occurredAt: command.occurredAt,
    source: "KILL_SWITCH_CONTROL",
    payload: {
      killSwitchId: state.id,
      scope: state.scope,
      targetId: state.targetId,
      actor: command.actor,
      reason: command.reason
    }
  };
}

function brokerWriteScope(scope: KillSwitchControlScope): BrokerWriteKillSwitchGate["scope"] {
  if (scope === "GLOBAL" || scope === "MARKET" || scope === "PORTFOLIO" || scope === "STRATEGY" || scope === "ASSET") {
    return scope;
  }

  return "GLOBAL";
}
