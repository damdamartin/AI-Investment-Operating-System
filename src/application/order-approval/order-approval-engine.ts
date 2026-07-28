import type { TossCapability } from "../../adapters/contracts/index.js";
import type { BrokerAccount } from "../../domain/broker/index.js";
import { OrderApproval, type OrderIntent } from "../../domain/orders/index.js";
import { MoneyCheck } from "../../domain/portfolio/index.js";
import { RiskCheck } from "../../domain/risk/index.js";
import type { ComplianceGateResult } from "../compliance/index.js";
import type { TossCapabilityRegistry } from "../toss/index.js";

export interface OrderApprovalEngineInput {
  approvalId: string;
  orderIntent: OrderIntent;
  riskCheck?: RiskCheck | undefined;
  moneyCheck?: MoneyCheck | undefined;
  brokerAccount?: BrokerAccount | undefined;
  compliance?: ComplianceGateResult | undefined;
  capabilityRegistry?: TossCapabilityRegistry | undefined;
  requiredCapability: TossCapability;
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

  return [...new Set(reasons)];
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
