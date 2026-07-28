import { DomainValidationError } from "../../shared/errors.js";
import { requireEntityId, type EntityId } from "../common/index.js";
import { Price, Quantity } from "../value-objects/index.js";
import type { BrokerAccount } from "../broker/index.js";
import type { Signal } from "../strategy/index.js";

export type OrderSide = "BUY" | "SELL";
export type OrderIntentStatus = "CREATED" | "RISK_CHECKED" | "MONEY_CHECKED" | "APPROVED" | "REJECTED";
export type OrderApprovalStatus = "APPROVED" | "REJECTED";
export type BrokerOrderStatus = "SUBMITTED" | "ACCEPTED" | "PARTIALLY_FILLED" | "FILLED" | "CANCELED" | "REJECTED" | "UNKNOWN";

export interface OrderIntentProps {
  id: string;
  signal: Signal;
  side: OrderSide;
  quantity: Quantity;
  limitPrice: Price;
  status?: OrderIntentStatus;
}

export class OrderIntent {
  readonly id: EntityId;
  readonly signal: Signal;
  readonly side: OrderSide;
  readonly quantity: Quantity;
  readonly limitPrice: Price;
  readonly status: OrderIntentStatus;

  constructor(props: OrderIntentProps) {
    this.id = requireEntityId(props.id, "Order intent id");
    this.signal = props.signal;
    this.side = props.side;
    this.quantity = props.quantity;
    this.limitPrice = props.limitPrice;
    this.status = props.status ?? "CREATED";

    if (this.quantity.isZero()) {
      throw new DomainValidationError("Order quantity must be greater than zero.");
    }
  }

  transitionTo(next: OrderIntentStatus): OrderIntent {
    if (!allowedOrderIntentTransitions[this.status].includes(next)) {
      throw new DomainValidationError(`Invalid order intent transition: ${this.status} -> ${next}.`);
    }

    return new OrderIntent({
      id: this.id,
      signal: this.signal,
      side: this.side,
      quantity: this.quantity,
      limitPrice: this.limitPrice,
      status: next
    });
  }
}

const allowedOrderIntentTransitions: Record<OrderIntentStatus, OrderIntentStatus[]> = {
  CREATED: ["RISK_CHECKED", "REJECTED"],
  RISK_CHECKED: ["MONEY_CHECKED", "REJECTED"],
  MONEY_CHECKED: ["APPROVED", "REJECTED"],
  APPROVED: [],
  REJECTED: []
};

export interface OrderApprovalProps {
  id: string;
  orderIntent: OrderIntent;
  status: OrderApprovalStatus;
  reasons: string[];
}

export class OrderApproval {
  readonly id: EntityId;
  readonly orderIntent: OrderIntent;
  readonly status: OrderApprovalStatus;
  readonly reasons: string[];

  constructor(props: OrderApprovalProps) {
    this.id = requireEntityId(props.id, "Order approval id");
    this.orderIntent = props.orderIntent;
    this.status = props.status;
    this.reasons = [...props.reasons];

    if (this.status === "REJECTED" && this.reasons.length === 0) {
      throw new DomainValidationError("Rejected approval requires reasons.");
    }

    if (this.status === "APPROVED" && this.orderIntent.status !== "APPROVED") {
      throw new DomainValidationError("OrderIntent must be approved before creating an approved OrderApproval.");
    }
  }

  isApproved(): boolean {
    return this.status === "APPROVED";
  }
}

export interface BrokerOrderProps {
  id: string;
  approval: OrderApproval;
  brokerAccount: BrokerAccount;
  status?: BrokerOrderStatus;
  brokerOrderRef?: string;
}

export class BrokerOrder {
  readonly id: EntityId;
  readonly approval: OrderApproval;
  readonly brokerAccount: BrokerAccount;
  readonly status: BrokerOrderStatus;
  readonly brokerOrderRef: string | undefined;

  constructor(props: BrokerOrderProps) {
    if (!props.approval.isApproved()) {
      throw new DomainValidationError("BrokerOrder requires an approved OrderApproval.");
    }

    this.id = requireEntityId(props.id, "Broker order id");
    this.approval = props.approval;
    this.brokerAccount = props.brokerAccount;
    this.status = props.status ?? "SUBMITTED";
    this.brokerOrderRef = props.brokerOrderRef;
  }

  blocksDependentTrading(): boolean {
    return this.status === "UNKNOWN";
  }
}

export interface FillProps {
  id: string;
  brokerOrder: BrokerOrder;
  quantity: Quantity;
  price: Price;
  filledAt: Date;
}

export class Fill {
  readonly id: EntityId;
  readonly brokerOrder: BrokerOrder;
  readonly quantity: Quantity;
  readonly price: Price;
  readonly filledAt: Date;

  constructor(props: FillProps) {
    this.id = requireEntityId(props.id, "Fill id");
    this.brokerOrder = props.brokerOrder;
    this.quantity = props.quantity;
    this.price = props.price;
    this.filledAt = props.filledAt;

    if (this.quantity.isZero()) {
      throw new DomainValidationError("Fill quantity must be greater than zero.");
    }

    if (Number.isNaN(this.filledAt.getTime())) {
      throw new DomainValidationError("Fill time must be valid.");
    }
  }
}
