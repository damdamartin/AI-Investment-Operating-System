import { DomainValidationError } from "../../shared/errors.js";
import { Currency } from "./currency.js";
import { formatDecimal, parseDecimal } from "./decimal.js";

const priceScale = 6;

export class Price {
  private constructor(
    public readonly units: bigint,
    public readonly currency: Currency
  ) {}

  static from(value: string | number | bigint, currency: Currency): Price {
    const parsed = parseDecimal(value, priceScale, "Price");
    if (parsed.units < 0n) {
      throw new DomainValidationError("Price cannot be negative.");
    }

    return new Price(parsed.units, currency);
  }

  toString(): string {
    return `${formatDecimal(this.units, priceScale)} ${this.currency.code}`;
  }
}
