import { DomainValidationError } from "../../shared/errors.js";

export type MarketCode = "KR" | "US";

export class Market {
  private constructor(public readonly code: MarketCode) {}

  static from(code: string): Market {
    if (code !== "KR" && code !== "US") {
      throw new DomainValidationError("Unsupported market.");
    }

    return new Market(code);
  }
}
