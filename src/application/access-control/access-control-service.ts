import { redactSecret } from "../../config/index.js";
import type { DashboardPermission } from "../dashboard/index.js";

export type AccessControlRole = "OWNER" | "OPERATOR" | "AUDITOR" | "VIEWER" | "SYSTEM";
export type AccessControlPermission =
  | DashboardPermission
  | "AUDIT_READ"
  | "RUNBOOK_READ"
  | "OBSERVABILITY_READ"
  | "SECRET_ROTATION_REQUEST";

export interface AccessControlActor {
  id: string;
  roles: AccessControlRole[];
  authenticated: boolean | "UNKNOWN";
  productionAccess: boolean;
  safetyType: "ACCESS_CONTROL_ACTOR_ONLY";
}

export interface AccessControlDecision {
  allowed: boolean;
  actorId: string;
  requiredPermissions: AccessControlPermission[];
  grantedPermissions: AccessControlPermission[];
  reasonCodes: string[];
  safetyType: "ACCESS_CONTROL_DECISION_ONLY";
}

const permissionsByRole: Record<AccessControlRole, AccessControlPermission[]> = {
  OWNER: [
    "DASHBOARD_READ",
    "KILL_SWITCH_CONTROL",
    "RISK_POLICY_WRITE",
    "CAPITAL_ALLOCATION_WRITE",
    "STRATEGY_GOVERNANCE_WRITE",
    "PRODUCTION_MODE_WRITE",
    "BROKER_ACCOUNT_WRITE",
    "AUDIT_READ",
    "RUNBOOK_READ",
    "OBSERVABILITY_READ",
    "SECRET_ROTATION_REQUEST"
  ],
  OPERATOR: [
    "DASHBOARD_READ",
    "KILL_SWITCH_CONTROL",
    "STRATEGY_GOVERNANCE_WRITE",
    "AUDIT_READ",
    "RUNBOOK_READ",
    "OBSERVABILITY_READ"
  ],
  AUDITOR: ["DASHBOARD_READ", "AUDIT_READ", "RUNBOOK_READ", "OBSERVABILITY_READ"],
  VIEWER: ["DASHBOARD_READ", "RUNBOOK_READ", "OBSERVABILITY_READ"],
  SYSTEM: ["OBSERVABILITY_READ"]
};

export class AccessControlService {
  permissionsFor(actor: AccessControlActor | undefined): AccessControlPermission[] {
    if (!actor || actor.authenticated !== true) return [];

    return [...new Set(actor.roles.flatMap((role) => permissionsByRole[role]))].sort();
  }

  authorize(input: {
    actor: AccessControlActor | undefined;
    requiredPermissions: AccessControlPermission[];
    productionSurface?: boolean | undefined;
  }): AccessControlDecision {
    const actor = input.actor;
    const reasonCodes: string[] = [];
    const grantedPermissions = this.permissionsFor(actor);

    if (!actor) {
      reasonCodes.push("actor_missing");
    } else if (actor.authenticated === "UNKNOWN") {
      reasonCodes.push("actor_auth_state_unknown");
    } else if (!actor.authenticated) {
      reasonCodes.push("actor_not_authenticated");
    }

    if (input.productionSurface && !actor?.productionAccess) {
      reasonCodes.push("production_surface_access_not_granted");
    }

    for (const permission of input.requiredPermissions) {
      if (!grantedPermissions.includes(permission)) {
        reasonCodes.push(`missing_permission_${permission.toLowerCase()}`);
      }
    }

    return {
      allowed: reasonCodes.length === 0,
      actorId: actor?.id ?? "unknown-actor",
      requiredPermissions: input.requiredPermissions,
      grantedPermissions,
      reasonCodes: [...new Set(reasonCodes)].sort(),
      safetyType: "ACCESS_CONTROL_DECISION_ONLY"
    };
  }

  maskAccountIdentifier(identifier: string | undefined): string {
    return redactSecret(identifier) ?? "****";
  }
}
