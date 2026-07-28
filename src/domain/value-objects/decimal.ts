import { DomainValidationError } from "../../shared/errors.js";

export interface ParsedDecimal {
  units: bigint;
  scale: number;
}

export function parseDecimal(input: string | number | bigint, scale: number, fieldName: string): ParsedDecimal {
  if (typeof input === "bigint") {
    return { units: input * 10n ** BigInt(scale), scale };
  }

  const raw = String(input).trim();
  if (!/^-?\d+(\.\d+)?$/.test(raw)) {
    throw new DomainValidationError(`${fieldName} must be a decimal number.`);
  }

  const negative = raw.startsWith("-");
  const normalized = negative ? raw.slice(1) : raw;
  const [whole = "0", fraction = ""] = normalized.split(".");

  if (fraction.length > scale) {
    throw new DomainValidationError(`${fieldName} has too many decimal places.`);
  }

  const paddedFraction = fraction.padEnd(scale, "0");
  const units = BigInt(`${whole}${paddedFraction || ""}`);

  return {
    units: negative ? -units : units,
    scale
  };
}

export function formatDecimal(units: bigint, scale: number): string {
  const negative = units < 0n;
  const absolute = negative ? -units : units;
  const divisor = 10n ** BigInt(scale);
  const whole = absolute / divisor;
  const fraction = absolute % divisor;

  if (scale === 0) {
    return `${negative ? "-" : ""}${whole.toString()}`;
  }

  return `${negative ? "-" : ""}${whole.toString()}.${fraction.toString().padStart(scale, "0")}`;
}
