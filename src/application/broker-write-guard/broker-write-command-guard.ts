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
