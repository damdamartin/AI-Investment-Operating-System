import type { TossCapability } from "../../adapters/contracts/index.js";
import type { BrokerAccount, PortfolioBrokerAccountLink } from "../../domain/broker/index.js";
import type { OrderApproval } from "../../domain/orders/index.js";
import type { ComplianceGateResult } from "../compliance/index.js";
import type { ReconciliationReport } from "../reconciliation/index.js";
import type { TossCapabilityRegistry } from "../toss/index.js";

export type BrokerWriteEnvironment = "local" | "development" | "staging" | "production";
export type BrokerWriteCommandType = "SUBMIT_ORDER" | "CANCEL_ORDER" | "REPLACE_ORDER";

export interface BrokerWriteEnvironmentPolicy {
  environment: BrokerWriteEnvironment;
  liveBrokerWritesEnabled: boolean;
  allowedEnvironments: BrokerWriteEnvironment[];
}

/**
 * Safe default environment policy for Phase 6. Phase 6 is paper-trading and
 * simulation only (see docs/reviews/Codex_Phase5_Final_Closure_Review.md,
 * "Phase 6 Entry Conditions", and docs/tasks/phase6_claude_worktree_tasks/
 * README.md, "Phase 6 Boundary"). Wiring code should import and reuse this
 * constant instead of hand-building an environment policy object, so a
 * typo or copy-paste mistake can never accidentally enable live broker
 * writes during this phase. `allowedEnvironments` is intentionally empty:
 * no environment is allowed to perform a live broker write in Phase 6.
 */
export const PHASE6_NO_LIVE_BROKER_WRITE_ENVIRONMENT_POLICY: BrokerWriteEnvironmentPolicy = Object.freeze({
  environment: "development",
  liveBrokerWritesEnabled: false,
  allowedEnvironments: []
});

/** Default maximum age of the OrderApproval's underlying checks before a broker write command is refused as stale. */
export const DEFAULT_MAX_APPROVAL_AGE_MS = 5 * 60 * 1000;

export interface BrokerWriteKillSwitchGate {
  active: boolean;
  scope: "GLOBAL" | "MARKET" | "PORTFOLIO" | "STRATEGY" | "ASSET";
  reason?: string | undefined;
}

export interface BrokerWriteCommandGuardInput {
  commandType: BrokerWriteCommandType;
  approval?: OrderApproval | undefined;
  brokerAccount?: BrokerAccount | undefined;
  portfolioLink?: PortfolioBrokerAccountLink | undefined;
  compliance?: ComplianceGateResult | undefined;
  capabilityRegistry?: TossCapabilityRegistry | undefined;
  requiredCapability?: TossCapability | undefined;
  environment?: BrokerWriteEnvironmentPolicy | undefined;
  killSwitch?: BrokerWriteKillSwitchGate | undefined;
  reconciliation?: ReconciliationReport | undefined;
  openQuestionBlocks?: string[] | undefined;
  aiContext?: unknown;
  /** The time this broker write command is being evaluated ("now"). Required to detect a stale approval. */
  now?: Date | undefined;
  /** Overrides DEFAULT_MAX_APPROVAL_AGE_MS for approval-staleness checks. */
  maxApprovalAgeMs?: number | undefined;
}

export interface BrokerWriteCommandGuardResult {
  allowed: boolean;
  commandType: BrokerWriteCommandType;
  reasonCodes: string[];
  safetyType: "BROKER_WRITE_COMMAND_GUARD_DECISION";
}

export class BrokerWriteCommandGuard {
  evaluate(input: BrokerWriteCommandGuardInput): BrokerWriteCommandGuardResult {
    const reasonCodes = rejectionReasons(input);

    return {
      allowed: reasonCodes.length === 0,
      commandType: input.commandType,
      reasonCodes,
      safetyType: "BROKER_WRITE_COMMAND_GUARD_DECISION"
    };
  }
}

function rejectionReasons(input: BrokerWriteCommandGuardInput): string[] {
  const reasons: string[] = [];

  if (!input.approval) {
    reasons.push("missing_order_approval");
  } else if (!input.approval.isApproved()) {
    reasons.push("order_approval_not_approved");
  } else {
    reasons.push(...approvalStalenessReasons(input.approval, input.now, input.maxApprovalAgeMs));
  }

  if (!input.brokerAccount) {
    reasons.push("missing_broker_account");
  } else if (!input.brokerAccount.canWriteLive()) {
    reasons.push("broker_account_live_trading_not_allowed");
  }

  if (!input.portfolioLink) {
    reasons.push("missing_portfolio_broker_account_link");
  } else if (input.approval) {
    const asset = input.approval.orderIntent.signal.asset;
    if (!input.portfolioLink.allows(asset.market, asset.assetType)) {
      reasons.push("portfolio_broker_account_link_does_not_allow_asset");
    }
  } else if (input.portfolioLink.status !== "ACTIVE") {
    reasons.push("portfolio_broker_account_link_not_active");
  }

  if (!input.compliance) {
    reasons.push("missing_compliance_gate");
  } else if (!input.compliance.allowed) {
    reasons.push(...input.compliance.reasons.map((reason) => `compliance_${reason}`));
  }

  if (!input.requiredCapability) {
    reasons.push("missing_required_broker_capability");
  } else if (!input.capabilityRegistry) {
    reasons.push("missing_broker_capability_registry");
  } else {
    const reason = input.capabilityRegistry.blockingReason(input.requiredCapability);
    if (reason) reasons.push(reason);
  }

  if (!input.environment) {
    reasons.push("missing_environment_policy");
  } else {
    if (!input.environment.liveBrokerWritesEnabled) reasons.push("environment_live_broker_writes_disabled");
    if (!input.environment.allowedEnvironments.includes(input.environment.environment)) {
      reasons.push(`environment_${input.environment.environment}_not_allowed_for_broker_writes`);
    }
  }

  if (!input.killSwitch) {
    reasons.push("missing_kill_switch_state");
  } else if (input.killSwitch.active) {
    reasons.push(`kill_switch_active_${input.killSwitch.scope.toLowerCase()}`);
  }

  if (!input.reconciliation) {
    reasons.push("missing_reconciliation_state");
  } else if (input.reconciliation.blocksDependentTrading) {
    reasons.push(`reconciliation_${input.reconciliation.status.toLowerCase()}_blocks_trading`);
  }

  for (const block of input.openQuestionBlocks ?? []) {
    reasons.push(`open_question_${block.toLowerCase()}_blocks_broker_writes`);
  }

  if (containsForbiddenAICommand(input.aiContext)) {
    reasons.push("ai_context_contains_forbidden_broker_command");
  }

  return [...new Set(reasons)].sort();
}

/**
 * An approved OrderApproval is only as trustworthy as the RiskCheck and
 * MoneyCheck it was built from. If too much time has passed since those
 * checks were made, market, account, or kill-switch conditions may have
 * changed underneath the approval. This guard therefore requires `now` and
 * refuses to authorize a stale approval, and fails closed when `now` is not
 * supplied at all (the caller must prove freshness, not assume it).
 */
function approvalStalenessReasons(
  approval: OrderApproval,
  now: Date | undefined,
  maxApprovalAgeMs: number | undefined
): string[] {
  if (!now || Number.isNaN(now.getTime())) {
    return ["missing_evaluation_time"];
  }

  const approvalBasisTime = Math.max(
    approval.riskCheck.checkedAt.getTime(),
    approval.moneyCheck.checkedAt.getTime()
  );
  const ageMs = now.getTime() - approvalBasisTime;
  const maxAgeMs = maxApprovalAgeMs ?? DEFAULT_MAX_APPROVAL_AGE_MS;

  if (ageMs < 0) return ["order_approval_timestamp_in_future"];
  if (ageMs > maxAgeMs) return ["order_approval_stale"];
  return [];
}

function containsForbiddenAICommand(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.some(containsForbiddenAICommand);
  if (typeof value !== "object") return false;

  const forbidden = new Set([
    "order",
    "orders",
    "brokerCommand",
    "broker_command",
    "submitOrder",
    "cancelOrder",
    "replaceOrder",
    "tossRequest"
  ]);

  return Object.entries(value as Record<string, unknown>).some(([key, nested]) => (
    forbidden.has(key) || containsForbiddenAICommand(nested)
  ));
}
