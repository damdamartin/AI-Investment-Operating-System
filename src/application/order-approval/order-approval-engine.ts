import type { TossCapability } from "../../adapters/contracts/index.js";
import type { BrokerAccount } from "../../domain/broker/index.js";
import { OrderApproval, type OrderIntent } from "../../domain/orders/index.js";
import { MoneyCheck } from "../../domain/portfolio/index.js";
import { RiskCheck } from "../../domain/risk/index.js";
import type { ComplianceGateResult } from "../compliance/index.js";
import type { KillSwitchTradingGate } from "../kill-switch/index.js";
import type { ReconciliationReport } from "../reconciliation/index.js";
import type { TossCapabilityRegistry } from "../toss/index.js";

/**
 * Default maximum age for a RiskCheck or MoneyCheck used to build an
 * approval. Per docs/11_AI_RULES.md Rule 22 (fail closed), an approval must
 * not be built on checks that are no longer a fresh view of risk or money
 * state. Callers may override with `maxCheckAgeMs`.
 */
export const DEFAULT_MAX_CHECK_AGE_MS = 5 * 60 * 1000;

export interface OrderApprovalEngineInput {
  approvalId: string;
  orderIntent: OrderIntent;
  riskCheck?: RiskCheck | undefined;
  moneyCheck?: MoneyCheck | undefined;
  brokerAccount?: BrokerAccount | undefined;
  compliance?: ComplianceGateResult | undefined;
  capabilityRegistry?: TossCapabilityRegistry | undefined;
  requiredCapability: TossCapability;
  /**
   * Current kill-switch trading gate from KillSwitchControlService. Required
   * for approval: per docs/07_Trading_System.md section 15, "current kill
   * switch state" is one of the Order Approval Engine's inputs, and per
   * Rule 23 no approval may bypass an active or unknown kill switch.
   */
  killSwitchGate?: KillSwitchTradingGate | undefined;
  /**
   * Latest reconciliation status. Required for approval: per
   * docs/07_Trading_System.md section 15, "approval requires clean
   * reconciliation state".
   */
  reconciliation?: ReconciliationReport | undefined;
  /** The time this approval decision is being evaluated ("now"). */
  evaluatedAt?: Date | undefined;
  /** Overrides DEFAULT_MAX_CHECK_AGE_MS for staleness checks. */
  maxCheckAgeMs?: number | undefined;
}

export interface OrderApprovalEngineOutput {
  approval: OrderApproval;
  reasonCodes: string[];
  safetyType: "ORDER_APPROVAL_RECORD_ONLY";
}

export class OrderApprovalEngine {
  evaluate(input: OrderApprovalEngineInput): OrderApprovalEngineOutput {
    const reasonCodes = rejectionReasons(input);
    const orderIntent = reasonCodes.length === 0
      ? advanceIntentToApproved(input.orderIntent)
      : rejectIntent(input.orderIntent);
    const riskCheck = input.riskCheck ?? syntheticRejectedRiskCheck(input.orderIntent, "missing_risk_check");
    const moneyCheck = input.moneyCheck ?? syntheticRejectedMoneyCheck(input.orderIntent, "missing_money_check");
    const approval = new OrderApproval({
      id: input.approvalId,
      orderIntent,
      riskCheck,
      moneyCheck,
      status: reasonCodes.length === 0 ? "APPROVED" : "REJECTED",
      reasons: reasonCodes
    });

    return {
      approval,
      reasonCodes,
      safetyType: "ORDER_APPROVAL_RECORD_ONLY"
    };
  }
}

function rejectionReasons(input: OrderApprovalEngineInput): string[] {
  const reasons: string[] = [];

  if (!input.riskCheck) {
    reasons.push("missing_risk_check");
  } else if (!input.riskCheck.allowsApproval()) {
    reasons.push("risk_check_not_passing");
  }

  if (!input.moneyCheck) {
    reasons.push("missing_money_check");
  } else if (!input.moneyCheck.allowsApproval()) {
    reasons.push("money_check_not_passing");
  }

  if (!input.brokerAccount) {
    reasons.push("missing_broker_account");
  } else if (!input.brokerAccount.canWriteLive()) {
    reasons.push("broker_account_live_trading_not_allowed");
  }

  if (!input.compliance) {
    reasons.push("missing_compliance_gate");
  } else if (!input.compliance.allowed) {
    reasons.push(...input.compliance.reasons.map((reason) => `compliance_${reason}`));
  }

  if (!input.capabilityRegistry) {
    reasons.push("missing_broker_capability_registry");
  } else {
    const reason = input.capabilityRegistry.blockingReason(input.requiredCapability);
    if (reason) reasons.push(reason);
  }

  if (!input.killSwitchGate) {
    reasons.push("missing_kill_switch_gate");
  } else if (!input.killSwitchGate.allowed) {
    // Reuse the kill-switch control service's own reason codes verbatim so
    // approval rejections stay traceable to the same audit vocabulary used
    // by the risk engine and the broker write guard.
    reasons.push(...input.killSwitchGate.reasonCodes);
  }

  if (!input.reconciliation) {
    reasons.push("missing_reconciliation_state");
  } else if (input.reconciliation.blocksDependentTrading) {
    reasons.push(`reconciliation_${input.reconciliation.status.toLowerCase()}_blocks_trading`);
  }

  reasons.push(...stalenessReasons(input));

  return [...new Set(reasons)].sort();
}

function stalenessReasons(input: OrderApprovalEngineInput): string[] {
  const evaluatedAt = input.evaluatedAt;
  if (!evaluatedAt || Number.isNaN(evaluatedAt.getTime())) {
    return ["missing_evaluation_time"];
  }

  const maxAgeMs = input.maxCheckAgeMs ?? DEFAULT_MAX_CHECK_AGE_MS;
  const reasons: string[] = [];

  if (input.riskCheck) {
    const ageMs = evaluatedAt.getTime() - input.riskCheck.checkedAt.getTime();
    if (ageMs < 0) reasons.push("risk_check_timestamp_in_future");
    else if (ageMs > maxAgeMs) reasons.push("risk_check_stale");
  }

  if (input.moneyCheck) {
    const ageMs = evaluatedAt.getTime() - input.moneyCheck.checkedAt.getTime();
    if (ageMs < 0) reasons.push("money_check_timestamp_in_future");
    else if (ageMs > maxAgeMs) reasons.push("money_check_stale");
  }

  return reasons;
}

function advanceIntentToApproved(intent: OrderIntent): OrderIntent {
  const riskChecked = intent.status === "CREATED" ? intent.transitionTo("RISK_CHECKED") : intent;
  const moneyChecked = riskChecked.status === "RISK_CHECKED" ? riskChecked.transitionTo("MONEY_CHECKED") : riskChecked;
  return moneyChecked.status === "MONEY_CHECKED" ? moneyChecked.transitionTo("APPROVED") : moneyChecked;
}

function rejectIntent(intent: OrderIntent): OrderIntent {
  if (intent.status === "REJECTED") return intent;
  if (intent.status === "APPROVED") return intent;
  return intent.transitionTo("REJECTED");
}

function syntheticRejectedRiskCheck(intent: OrderIntent, reason: string): RiskCheck {
  return new RiskCheck({
    id: `risk-check-${intent.id}`,
    subjectType: "ORDER_INTENT",
    subjectId: intent.id,
    result: "BLOCKED",
    riskLevel: "CRITICAL",
    failedLimitIds: [reason],
    checkedAt: new Date(0)
  });
}

function syntheticRejectedMoneyCheck(intent: OrderIntent, reason: string): MoneyCheck {
  return new MoneyCheck({
    id: `money-check-${intent.id}`,
    orderIntentId: intent.id,
    result: "BLOCKED",
    reasons: [reason],
    checkedAt: new Date(0)
  });
}
