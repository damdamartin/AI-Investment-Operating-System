import type { AuditRecordProps } from "../audit/index.js";

export type DashboardActionSensitivity = "READ_ONLY" | "SENSITIVE" | "CRITICAL";

export type DashboardActionType =
  | "VIEW_STATUS"
  | "VIEW_AUDIT_LOG"
  | "VIEW_STRATEGY_REPORT"
  | "ACTIVATE_KILL_SWITCH"
  | "DEACTIVATE_KILL_SWITCH"
  | "CHANGE_RISK_LIMIT"
  | "CHANGE_CAPITAL_ALLOCATION"
  | "PROMOTE_STRATEGY"
  | "RETIRE_PRODUCTION_STRATEGY"
  | "ENABLE_PRODUCTION_MODE"
  | "LINK_BROKER_ACCOUNT"
  | "VALIDATE_BROKER_CREDENTIALS";

export type DashboardPermission =
  | "DASHBOARD_READ"
  | "KILL_SWITCH_CONTROL"
  | "RISK_POLICY_WRITE"
  | "CAPITAL_ALLOCATION_WRITE"
  | "STRATEGY_GOVERNANCE_WRITE"
  | "PRODUCTION_MODE_WRITE"
  | "BROKER_ACCOUNT_WRITE";

export interface DashboardActorAuthState {
  actorId: string;
  authenticated: boolean | "UNKNOWN";
  permissions: DashboardPermission[];
  stepUpConfirmedAt?: Date | undefined;
}

export interface DashboardSensitiveControlInput {
  actionType: DashboardActionType;
  resourceId: string;
  auth: DashboardActorAuthState | undefined;
  reason?: string | undefined;
  confirmedAt?: Date | undefined;
  requestedAt: Date;
}

export interface DashboardSensitiveControlDecision {
  allowed: boolean;
  actionType: DashboardActionType;
  sensitivity: DashboardActionSensitivity;
  reasonCodes: string[];
  requiredPermissions: DashboardPermission[];
  requiresStepUpConfirmation: boolean;
  auditRecord: AuditRecordProps;
  mutatesState: boolean;
  safetyType: "DASHBOARD_SENSITIVE_CONTROL_GATE_DECISION";
}

export class DashboardSensitiveControlGate {
  evaluate(input: DashboardSensitiveControlInput): DashboardSensitiveControlDecision {
    const rule = ruleFor(input.actionType);
    const reasonCodes: string[] = [];

    if (!input.auth) {
      reasonCodes.push(rule.sensitivity === "READ_ONLY" ? "auth_state_missing_for_read" : "auth_state_missing_for_sensitive_action");
    } else if (input.auth.authenticated === "UNKNOWN") {
      reasonCodes.push(rule.sensitivity === "READ_ONLY" ? "auth_state_unknown_for_read" : "auth_state_unknown_for_sensitive_action");
    } else if (!input.auth.authenticated) {
      reasonCodes.push("actor_not_authenticated");
    }

    if (input.auth?.authenticated === true) {
      for (const permission of rule.requiredPermissions) {
        if (!input.auth.permissions.includes(permission)) {
          reasonCodes.push(`missing_permission_${permission.toLowerCase()}`);
        }
      }
    }

    if (rule.requiresStepUpConfirmation) {
      if (!input.confirmedAt && !input.auth?.stepUpConfirmedAt) {
        reasonCodes.push("step_up_confirmation_required");
      }
      if (!input.reason?.trim()) {
        reasonCodes.push("sensitive_action_reason_required");
      }
    }

    const allowed = reasonCodes.length === 0;

    return {
      allowed,
      actionType: input.actionType,
      sensitivity: rule.sensitivity,
      reasonCodes: [...new Set(reasonCodes)].sort(),
      requiredPermissions: rule.requiredPermissions,
      requiresStepUpConfirmation: rule.requiresStepUpConfirmation,
      auditRecord: auditRecord(input, rule, allowed, reasonCodes),
      mutatesState: rule.mutatesState,
      safetyType: "DASHBOARD_SENSITIVE_CONTROL_GATE_DECISION"
    };
  }
}

function ruleFor(actionType: DashboardActionType): {
  sensitivity: DashboardActionSensitivity;
  requiredPermissions: DashboardPermission[];
  requiresStepUpConfirmation: boolean;
  mutatesState: boolean;
} {
  switch (actionType) {
    case "VIEW_STATUS":
    case "VIEW_AUDIT_LOG":
    case "VIEW_STRATEGY_REPORT":
      return {
        sensitivity: "READ_ONLY",
        requiredPermissions: ["DASHBOARD_READ"],
        requiresStepUpConfirmation: false,
        mutatesState: false
      };
    case "ACTIVATE_KILL_SWITCH":
    case "DEACTIVATE_KILL_SWITCH":
      return critical(["KILL_SWITCH_CONTROL"]);
    case "CHANGE_RISK_LIMIT":
      return critical(["RISK_POLICY_WRITE"]);
    case "CHANGE_CAPITAL_ALLOCATION":
      return critical(["CAPITAL_ALLOCATION_WRITE"]);
    case "PROMOTE_STRATEGY":
    case "RETIRE_PRODUCTION_STRATEGY":
      return critical(["STRATEGY_GOVERNANCE_WRITE"]);
    case "ENABLE_PRODUCTION_MODE":
      return critical(["PRODUCTION_MODE_WRITE"]);
    case "LINK_BROKER_ACCOUNT":
    case "VALIDATE_BROKER_CREDENTIALS":
      return critical(["BROKER_ACCOUNT_WRITE"]);
  }
}

function critical(requiredPermissions: DashboardPermission[]) {
  return {
    sensitivity: "CRITICAL" as const,
    requiredPermissions,
    requiresStepUpConfirmation: true,
    mutatesState: true
  };
}

function auditRecord(
  input: DashboardSensitiveControlInput,
  rule: ReturnType<typeof ruleFor>,
  allowed: boolean,
  reasonCodes: string[]
): AuditRecordProps {
  const record: AuditRecordProps = {
    id: `audit-dashboard-${input.actionType.toLowerCase()}-${input.resourceId}-${input.requestedAt.getTime()}`,
    actor: input.auth?.actorId || "unknown-dashboard-actor",
    action: allowed ? "DASHBOARD_CONTROL_ALLOWED" : "DASHBOARD_CONTROL_BLOCKED",
    resourceType: "DASHBOARD_CONTROL",
    resourceId: input.resourceId,
    metadata: {
      actionType: input.actionType,
      sensitivity: rule.sensitivity,
      requiredPermissions: rule.requiredPermissions,
      requiresStepUpConfirmation: rule.requiresStepUpConfirmation,
      mutatesState: rule.mutatesState,
      reasonCodes,
      authenticated: input.auth?.authenticated ?? "MISSING"
    },
    createdAt: input.requestedAt
  };

  if (input.reason !== undefined) record.reason = input.reason;
  return record;
}
