import type { BrokerAccount } from "../../domain/broker/index.js";
import type { OrderApproval, OrderSide } from "../../domain/orders/index.js";

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
      safetyType: "PAPER_ORDER_SIMULATED_ONLY"
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
      safetyType: "PAPER_TRADING_RESULT_SIMULATED_ONLY"
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
    safetyType: "PAPER_TRADING_RESULT_SIMULATED_ONLY"
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
