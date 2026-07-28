import { DomainValidationError } from "../../shared/errors.js";

export type CurrencyCode = "KRW" | "USD";

const currencyExponents: Record<CurrencyCode, number> = {
  KRW: 0,
  USD: 2
};

export class Currency {
  private constructor(public readonly code: CurrencyCode) {}

  static from(code: string): Currency {
    if (code !== "KRW" && code !== "USD") {
      throw new DomainValidationError("Unsupported currency.");
    }

    return new Currency(code);
  }

  get exponent(): number {
    return currencyExponents[this.code];
  }

  equals(other: Currency): boolean {
    return this.code === other.code;
  }
}
