import { DomainValidationError } from "../../shared/errors.js";
import { formatDecimal, parseDecimal } from "./decimal.js";

const quantityScale = 8;

export class Quantity {
  private constructor(public readonly units: bigint) {}

  static from(value: string | number | bigint): Quantity {
    const parsed = parseDecimal(value, quantityScale, "Quantity");
    if (parsed.units < 0n) {
      throw new DomainValidationError("Quantity cannot be negative.");
    }

    return new Quantity(parsed.units);
  }

  isZero(): boolean {
    return this.units === 0n;
  }

  toString(): string {
    if (this.units === 0n) return "0";
    return formatDecimal(this.units, quantityScale).replace(/\.?0+$/, "");
  }
}
