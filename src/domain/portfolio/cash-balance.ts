import { DomainValidationError } from "../../shared/errors.js";
import { requireEntityId, type EntityId } from "../common/index.js";
import { Currency, Money } from "../value-objects/index.js";

export interface CashBalanceProps {
  id: string;
  portfolioId: string;
  currency: Currency;
  available: Money;
  reserved: Money;
  unsettled: Money;
  updatedAt: Date;
}

export class CashBalance {
  readonly id: EntityId;
  readonly portfolioId: EntityId;
  readonly currency: Currency;
  readonly available: Money;
  readonly reserved: Money;
  readonly unsettled: Money;
  readonly updatedAt: Date;

  constructor(props: CashBalanceProps) {
    this.id = requireEntityId(props.id, "Cash balance id");
    this.portfolioId = requireEntityId(props.portfolioId, "Portfolio id");
    this.currency = props.currency;
    this.available = props.available;
    this.reserved = props.reserved;
    this.unsettled = props.unsettled;
    this.updatedAt = props.updatedAt;

    this.assertCurrency(this.available, "available");
    this.assertCurrency(this.reserved, "reserved");
    this.assertCurrency(this.unsettled, "unsettled");

    if (this.available.isNegative() || this.reserved.isNegative() || this.unsettled.isNegative()) {
      throw new DomainValidationError("Cash balance amounts cannot be negative.");
    }

    if (Number.isNaN(this.updatedAt.getTime())) {
      throw new DomainValidationError("Cash balance updatedAt must be valid.");
    }
  }

  reserve(amount: Money, now: Date): CashBalance {
    this.assertCurrency(amount, "reserve amount");

    if (amount.isNegative()) {
      throw new DomainValidationError("Reserve amount cannot be negative.");
    }

    if (this.available.isLessThan(amount)) {
      throw new DomainValidationError("Insufficient available cash to reserve.");
    }

    return new CashBalance({
      id: this.id,
      portfolioId: this.portfolioId,
      currency: this.currency,
      available: this.available.subtract(amount),
      reserved: this.reserved.add(amount),
      unsettled: this.unsettled,
      updatedAt: now
    });
  }

  private assertCurrency(value: Money, label: string): void {
    if (!value.currency.equals(this.currency)) {
      throw new DomainValidationError(`Cash balance ${label} currency mismatch.`);
    }
  }
}
