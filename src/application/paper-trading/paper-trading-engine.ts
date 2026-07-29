import type { BrokerAccount } from "../../domain/broker/index.js";
import { OrderApproval, type OrderIntent, type OrderIntentStatus, type OrderSide } from "../../domain/orders/index.js";
import { MoneyCheck } from "../../domain/portfolio/index.js";
import { RiskCheck } from "../../domain/risk/index.js";

export type PaperOrderStatus =
  | "SUBMITTED"
  | "ACCEPTED"
  | "PARTIALLY_FILLED"
  | "FILLED"
  | "CANCELED"
  | "REJECTED"
  | "UNKNOWN";

export type PaperBrokerEventType = "ACCEPT" | "PARTIAL_FILL" | "FILL" | "REJECT" | "CANCEL" | "UNKNOWN";

export interface PaperOrder {
  id: string;
  approvalId: string;
  orderIntentId: string;
  strategyId: string;
  assetId: string;
  symbol: string;
  side: OrderSide;
  requestedQuantity: number;
  limitPrice: number;
  currency: string;
  status: PaperOrderStatus;
  filledQuantity: number;
  averageFillPrice: number;
  rejectionReasons: string[];
  submittedAt: Date;
  updatedAt: Date;
  safetyType: "PAPER_ORDER_SIMULATED_ONLY";
  liveBrokerWriteAllowed: false;
}

export interface PaperFill {
  id: string;
  paperOrderId: string;
  quantity: number;
  price: number;
  filledAt: Date;
  safetyType: "PAPER_FILL_SIMULATED_ONLY";
}

export interface PaperOrderEvent {
  id: string;
  paperOrderId: string;
  type: PaperBrokerEventType;
  statusAfter: PaperOrderStatus;
  occurredAt: Date;
  reason: string | undefined;
  safetyType: "PAPER_ORDER_EVENT_SIMULATED_ONLY";
}

export interface PaperTradingSubmitInput {
  paperOrderId: string;
  approval: OrderApproval;
  submittedAt: Date;
  brokerAccount?: BrokerAccount | undefined;
}

export interface PaperTradingEventInput {
  order: PaperOrder;
  eventId: string;
  type: PaperBrokerEventType;
  occurredAt: Date;
  fillQuantity?: number | undefined;
  fillPrice?: number | undefined;
  reason?: string | undefined;
}

export interface PaperTradingResult {
  order: PaperOrder;
  fills: PaperFill[];
  events: PaperOrderEvent[];
  blocksDependentTrading: boolean;
  safetyType: "PAPER_TRADING_RESULT_SIMULATED_ONLY";
  liveBrokerWriteAllowed: false;
}

export class PaperTradingEngine {
  submit(input: PaperTradingSubmitInput): PaperTradingResult {
    const reasons = submissionRejectionReasons(input);
    const intent = input.approval.orderIntent;
    const order: PaperOrder = {
      id: input.paperOrderId,
      approvalId: input.approval.id,
      orderIntentId: intent.id,
      strategyId: intent.signal.strategyVersion.strategyId,
      assetId: intent.signal.asset.id,
      symbol: intent.signal.asset.symbol,
      side: intent.side,
      requestedQuantity: Number(intent.quantity.toString()),
      limitPrice: priceToNumber(intent.limitPrice.toString()),
      currency: priceCurrency(intent.limitPrice.toString()),
      status: reasons.length === 0 ? "SUBMITTED" : "REJECTED",
      filledQuantity: 0,
      averageFillPrice: 0,
      rejectionReasons: reasons,
      submittedAt: input.submittedAt,
      updatedAt: input.submittedAt,
      safetyType: "PAPER_ORDER_SIMULATED_ONLY",
      liveBrokerWriteAllowed: false
    };

    return {
      order,
      fills: [],
      events: [
        orderEvent({
          eventId: `${input.paperOrderId}-submit`,
          order,
          type: reasons.length === 0 ? "ACCEPT" : "REJECT",
          occurredAt: input.submittedAt,
          reason: reasons[0]
        })
      ],
      blocksDependentTrading: order.status === "UNKNOWN",
      safetyType: "PAPER_TRADING_RESULT_SIMULATED_ONLY",
      liveBrokerWriteAllowed: false
    };
  }

  applyEvent(input: PaperTradingEventInput): PaperTradingResult {
    const order = cloneOrder(input.order);
    const fills: PaperFill[] = [];

    if (isTerminal(order.status)) {
      return result(order, fills, [
        orderEvent({
          eventId: input.eventId,
          order,
          type: input.type,
          occurredAt: input.occurredAt,
          reason: "paper_order_already_terminal"
        })
      ]);
    }

    if (input.type === "ACCEPT") {
      order.status = "ACCEPTED";
    }

    if (input.type === "PARTIAL_FILL" || input.type === "FILL") {
      const remainingQuantity = Math.max(0, order.requestedQuantity - order.filledQuantity);
      const requestedFillQuantity = input.type === "FILL"
        ? (input.fillQuantity ?? remainingQuantity)
        : (input.fillQuantity ?? 0);
      const fillQuantity = Math.min(remainingQuantity, Math.max(0, requestedFillQuantity));
      const fillPrice = input.fillPrice ?? order.limitPrice;

      if (fillQuantity > 0 && fillPrice > 0) {
        order.averageFillPrice = weightedAverage(
          order.filledQuantity,
          order.averageFillPrice,
          fillQuantity,
          fillPrice
        );
        order.filledQuantity = roundQuantity(order.filledQuantity + fillQuantity);
        fills.push({
          id: `${input.eventId}-fill`,
          paperOrderId: order.id,
          quantity: fillQuantity,
          price: roundCurrency(fillPrice),
          filledAt: input.occurredAt,
          safetyType: "PAPER_FILL_SIMULATED_ONLY"
        });
      }

      order.status = order.filledQuantity >= order.requestedQuantity ? "FILLED" : "PARTIALLY_FILLED";
    }

    if (input.type === "REJECT") {
      order.status = "REJECTED";
      order.rejectionReasons = [...order.rejectionReasons, input.reason ?? "paper_broker_rejected"];
    }

    if (input.type === "CANCEL") {
      order.status = "CANCELED";
    }

    if (input.type === "UNKNOWN") {
      order.status = "UNKNOWN";
      order.rejectionReasons = [...order.rejectionReasons, input.reason ?? "paper_broker_state_unknown"];
    }

    order.updatedAt = input.occurredAt;

    return result(order, fills, [
      orderEvent({
        eventId: input.eventId,
        order,
        type: input.type,
        occurredAt: input.occurredAt,
        reason: input.reason
      })
    ]);
  }
}

/**
 * Decision reached by {@link PaperOrderIntentPipeline} for a candidate strategy
 * decision / order intent.
 *
 * - `ACCEPTED`: risk and money checks passed and no live-capable broker account
 *   was attached. A paper-only order was submitted into the simulated lifecycle.
 * - `REJECTED`: an actual evaluated gate (risk check, money check, or a
 *   live-write-capable broker account) actively vetoed the candidate. This is a
 *   hard stop and must never be silently retried.
 * - `DEFERRED`: every present reason code reflects a missing input (risk check
 *   and/or money check were never supplied), not an active veto. The candidate
 *   simply cannot be decided yet; it is not a permanent rejection.
 */
export type PaperOrderIntentDecision = "ACCEPTED" | "REJECTED" | "DEFERRED";

export interface PaperOrderIntentPipelineInput {
  candidateId: string;
  approvalId: string;
  paperOrderId: string;
  orderIntent: OrderIntent;
  riskCheck?: RiskCheck | undefined;
  moneyCheck?: MoneyCheck | undefined;
  brokerAccount?: BrokerAccount | undefined;
  evaluatedAt: Date;
}

/**
 * Sanitized decision lineage for audit reconstruction. Deliberately contains no
 * secrets, no raw broker payloads, and no unmasked account identifiers.
 */
export interface PaperOrderIntentAuditContext {
  candidateId: string;
  orderIntentId: string;
  approvalId: string;
  strategyId: string;
  strategyVersionId: string;
  assetId: string;
  symbol: string;
  side: OrderSide;
  signalDirection: string;
  decision: PaperOrderIntentDecision;
  reasonCodes: string[];
  riskCheckResult: string | undefined;
  moneyCheckResult: string | undefined;
  brokerAccountMaskedRef: string | undefined;
  evaluatedAt: Date;
  liveBrokerWriteAllowed: false;
  safetyType: "PAPER_ORDER_INTENT_AUDIT_CONTEXT_ONLY";
}

export interface PaperOrderIntentPipelineResult {
  decision: PaperOrderIntentDecision;
  reasonCodes: string[];
  paperTrading: PaperTradingResult;
  auditContext: PaperOrderIntentAuditContext;
  liveBrokerWriteAllowed: false;
  nonBrokerPaperOnly: true;
  notLiveExecutable: true;
  safetyType: "PAPER_ORDER_INTENT_PIPELINE_RESULT_ONLY";
}

/**
 * Connects a candidate strategy decision / order intent to the paper-trading
 * lifecycle without ever touching a real broker.
 *
 * This pipeline intentionally does NOT reuse the live-oriented
 * `OrderApprovalEngine` (broker capability checks, verified BrokerAccount
 * writes, compliance gates) because those gates are specific to the real
 * broker-write approval path. Paper trading must remain reachable without any
 * broker capability being verified, and must actively reject any attempt to
 * attach a live-write-capable broker account. Reusing the live approval gate
 * here would either force paper trading to depend on live broker readiness or
 * create a path where a "paper approval" could be mistaken for a live one.
 * Keeping this pipeline self-contained keeps that impossible by construction:
 * there is no code path in this file that can produce a
 * `BrokerWriteCommandGuardInput`, a `SUBMIT_ORDER`/`CANCEL_ORDER`/
 * `REPLACE_ORDER` command, or any object with `liveBrokerWriteAllowed` set to
 * anything other than `false`.
 */
export class PaperOrderIntentPipeline {
  constructor(private readonly paperTradingEngine: PaperTradingEngine = new PaperTradingEngine()) {}

  evaluate(input: PaperOrderIntentPipelineInput): PaperOrderIntentPipelineResult {
    const reasonCodes = paperGateReasonCodes(input);
    const decision = classifyPaperOrderIntentDecision(reasonCodes);

    const orderIntent = decision === "ACCEPTED"
      ? advanceIntentToApprovedStatus(input.orderIntent)
      : advanceIntentToRejectedStatus(input.orderIntent);

    const riskCheck = input.riskCheck ?? deferredRiskCheck(input.orderIntent.id, input.evaluatedAt);
    const moneyCheck = input.moneyCheck ?? deferredMoneyCheck(input.orderIntent.id, input.evaluatedAt);

    const approval = new OrderApproval({
      id: input.approvalId,
      orderIntent,
      riskCheck,
      moneyCheck,
      status: decision === "ACCEPTED" ? "APPROVED" : "REJECTED",
      reasons: reasonCodes
    });

    const paperTrading = this.paperTradingEngine.submit({
      paperOrderId: input.paperOrderId,
      approval,
      submittedAt: input.evaluatedAt,
      brokerAccount: input.brokerAccount
    });

    const signal = input.orderIntent.signal;
    const auditContext: PaperOrderIntentAuditContext = {
      candidateId: input.candidateId,
      orderIntentId: input.orderIntent.id,
      approvalId: input.approvalId,
      strategyId: signal.strategyVersion.strategyId,
      strategyVersionId: signal.strategyVersion.id,
      assetId: signal.asset.id,
      symbol: signal.asset.symbol,
      side: input.orderIntent.side,
      signalDirection: signal.direction,
      decision,
      reasonCodes,
      riskCheckResult: input.riskCheck?.result,
      moneyCheckResult: input.moneyCheck?.result,
      brokerAccountMaskedRef: input.brokerAccount?.maskedExternalRef(),
      evaluatedAt: input.evaluatedAt,
      liveBrokerWriteAllowed: false,
      safetyType: "PAPER_ORDER_INTENT_AUDIT_CONTEXT_ONLY"
    };

    return {
      decision,
      reasonCodes,
      paperTrading,
      auditContext,
      liveBrokerWriteAllowed: false,
      nonBrokerPaperOnly: true,
      notLiveExecutable: true,
      safetyType: "PAPER_ORDER_INTENT_PIPELINE_RESULT_ONLY"
    };
  }
}

const PAPER_GATE_MISSING_REASON_CODES = new Set(["missing_risk_check", "missing_money_check"]);

function paperGateReasonCodes(input: PaperOrderIntentPipelineInput): string[] {
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

  if (input.brokerAccount?.canWriteLive()) {
    reasons.push("live_broker_account_not_allowed_for_paper_trading");
  }

  return reasons;
}

function classifyPaperOrderIntentDecision(reasonCodes: string[]): PaperOrderIntentDecision {
  if (reasonCodes.length === 0) return "ACCEPTED";
  const onlyMissingGates = reasonCodes.every((code) => PAPER_GATE_MISSING_REASON_CODES.has(code));
  return onlyMissingGates ? "DEFERRED" : "REJECTED";
}

function advanceIntentToApprovedStatus(intent: OrderIntent): OrderIntent {
  let current = intent;
  if (current.status === "CREATED") current = current.transitionTo("RISK_CHECKED");
  if (current.status === "RISK_CHECKED") current = current.transitionTo("MONEY_CHECKED");
  if (current.status === "MONEY_CHECKED") current = current.transitionTo("APPROVED");
  return current;
}

function advanceIntentToRejectedStatus(intent: OrderIntent): OrderIntent {
  const terminal: OrderIntentStatus[] = ["APPROVED", "REJECTED"];
  if (terminal.includes(intent.status)) return intent;
  return intent.transitionTo("REJECTED");
}

function deferredRiskCheck(orderIntentId: string, checkedAt: Date): RiskCheck {
  return new RiskCheck({
    id: `paper-risk-check-deferred-${orderIntentId}`,
    subjectType: "ORDER_INTENT",
    subjectId: orderIntentId,
    result: "BLOCKED",
    riskLevel: "CRITICAL",
    failedLimitIds: ["paper_risk_check_not_yet_available"],
    checkedAt
  });
}

function deferredMoneyCheck(orderIntentId: string, checkedAt: Date): MoneyCheck {
  return new MoneyCheck({
    id: `paper-money-check-deferred-${orderIntentId}`,
    orderIntentId,
    result: "BLOCKED",
    reasons: ["paper_money_check_not_yet_available"],
    checkedAt
  });
}

function submissionRejectionReasons(input: PaperTradingSubmitInput): string[] {
  const reasons: string[] = [];

  if (!input.approval.isApproved()) reasons.push("approval_not_approved");
  if (input.brokerAccount?.canWriteLive()) reasons.push("live_broker_account_not_allowed_for_paper_trading");

  return reasons;
}

function result(order: PaperOrder, fills: PaperFill[], events: PaperOrderEvent[]): PaperTradingResult {
  return {
    order,
    fills,
    events,
    blocksDependentTrading: order.status === "UNKNOWN",
    safetyType: "PAPER_TRADING_RESULT_SIMULATED_ONLY",
    liveBrokerWriteAllowed: false
  };
}

function orderEvent(input: {
  eventId: string;
  order: PaperOrder;
  type: PaperBrokerEventType;
  occurredAt: Date;
  reason: string | undefined;
}): PaperOrderEvent {
  return {
    id: input.eventId,
    paperOrderId: input.order.id,
    type: input.type,
    statusAfter: input.order.status,
    occurredAt: input.occurredAt,
    reason: input.reason,
    safetyType: "PAPER_ORDER_EVENT_SIMULATED_ONLY"
  };
}

function isTerminal(status: PaperOrderStatus): boolean {
  return status === "FILLED" || status === "CANCELED" || status === "REJECTED";
}

function cloneOrder(order: PaperOrder): PaperOrder {
  return {
    ...order,
    rejectionReasons: [...order.rejectionReasons]
  };
}

function weightedAverage(
  previousQuantity: number,
  previousAveragePrice: number,
  fillQuantity: number,
  fillPrice: number
): number {
  const totalQuantity = previousQuantity + fillQuantity;
  if (totalQuantity === 0) return 0;
  return roundCurrency(((previousQuantity * previousAveragePrice) + (fillQuantity * fillPrice)) / totalQuantity);
}

function priceToNumber(value: string): number {
  return Number(value.split(" ")[0]);
}

function priceCurrency(value: string): string {
  return value.split(" ")[1] ?? "UNKNOWN";
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundQuantity(value: number): number {
  return Math.round(value * 100_000_000) / 100_000_000;
}
