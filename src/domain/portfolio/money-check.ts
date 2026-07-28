import { DomainValidationError } from "../../shared/errors.js";
import { requireEntityId, type EntityId } from "../common/index.js";
import { Money, Quantity } from "../value-objects/index.js";

export type MoneyCheckResult = "PASS" | "PASS_WITH_ADJUSTMENT" | "FAIL" | "BLOCKED";

export interface MoneyCheckProps {
  id: string;
  orderIntentId: string;
  result: MoneyCheckResult;
  approvedQuantity?: Quantity;
  approvedAmount?: Money;
  cashAfterOrder?: Money;
  warnings?: string[];
  reasons?: string[];
  checkedAt: Date;
}

export class MoneyCheck {
  readonly id: EntityId;
  readonly orderIntentId: EntityId;
  readonly result: MoneyCheckResult;
  readonly approvedQuantity: Quantity | undefined;
  readonly approvedAmount: Money | undefined;
  readonly cashAfterOrder: Money | undefined;
  readonly warnings: string[];
  readonly reasons: string[];
  readonly checkedAt: Date;

  constructor(props: MoneyCheckProps) {
    this.id = requireEntityId(props.id, "Money check id");
    this.orderIntentId = requireEntityId(props.orderIntentId, "Order intent id");
    this.result = props.result;
    this.approvedQuantity = props.approvedQuantity;
    this.approvedAmount = props.approvedAmount;
    this.cashAfterOrder = props.cashAfterOrder;
    this.warnings = [...(props.warnings ?? [])];
    this.reasons = [...(props.reasons ?? [])];
    this.checkedAt = props.checkedAt;

    if (Number.isNaN(this.checkedAt.getTime())) {
      throw new DomainValidationError("Money check checkedAt must be valid.");
    }

    if ((this.result === "FAIL" || this.result === "BLOCKED") && this.reasons.length === 0) {
      throw new DomainValidationError("Failed or blocked money checks require reasons.");
    }

    if (this.allowsApproval() && (!this.approvedQuantity || !this.approvedAmount || !this.cashAfterOrder)) {
      throw new DomainValidationError("Passing money checks require approved quantity, amount, and cash after order.");
    }
  }

  allowsApproval(): boolean {
    return this.result === "PASS" || this.result === "PASS_WITH_ADJUSTMENT";
  }
}
