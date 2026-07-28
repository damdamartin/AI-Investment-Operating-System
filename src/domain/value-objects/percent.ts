import { DomainValidationError } from "../../shared/errors.js";
import { formatDecimal, parseDecimal } from "./decimal.js";

const percentScale = 4;

export class Percent {
  private constructor(public readonly basisPoints: bigint) {}

  static fromPercent(value: string | number | bigint): Percent {
    const parsed = parseDecimal(value, percentScale, "Percent");
    return new Percent(parsed.units);
  }

  static fromRatio(value: string | number): Percent {
    const ratio = Number(value);
    if (!Number.isFinite(ratio)) {
      throw new DomainValidationError("Ratio must be finite.");
    }

    return Percent.fromPercent((ratio * 100).toFixed(percentScale));
  }

  toPercentString(): string {
    return formatDecimal(this.basisPoints, percentScale);
  }
}
