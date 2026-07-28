import { DomainValidationError } from "../../shared/errors.js";
import { Currency } from "./currency.js";
import { formatDecimal, parseDecimal } from "./decimal.js";

export class Money {
  private constructor(
    public readonly minorUnits: bigint,
    public readonly currency: Currency
  ) {}

  static fromMajor(amount: string | number | bigint, currency: Currency): Money {
    const parsed = parseDecimal(amount, currency.exponent, "Money amount");
    return new Money(parsed.units, currency);
  }

  static zero(currency: Currency): Money {
    return new Money(0n, currency);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.minorUnits + other.minorUnits, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.minorUnits - other.minorUnits, this.currency);
  }

  compare(other: Money): number {
    this.assertSameCurrency(other);
    if (this.minorUnits < other.minorUnits) return -1;
    if (this.minorUnits > other.minorUnits) return 1;
    return 0;
  }

  isLessThan(other: Money): boolean {
    return this.compare(other) < 0;
  }

  isGreaterThan(other: Money): boolean {
    return this.compare(other) > 0;
  }

  isNegative(): boolean {
    return this.minorUnits < 0n;
  }

  toMajorString(): string {
    return formatDecimal(this.minorUnits, this.currency.exponent);
  }

  private assertSameCurrency(other: Money): void {
    if (!this.currency.equals(other.currency)) {
      throw new DomainValidationError("Cannot combine money with different currencies.");
    }
  }
}
