import { describe, expect, it } from "vitest";
import {
  AssetType,
  Currency,
  DomainValidationError,
  Market,
  Money,
  Percent,
  Price,
  Quantity,
  TimeRange
} from "../../src/index.js";

describe("core value objects", () => {
  it("prevents combining money across currencies", () => {
    const krw = Currency.from("KRW");
    const usd = Currency.from("USD");

    expect(() => Money.fromMajor("1000", krw).add(Money.fromMajor("1.00", usd))).toThrow(
      DomainValidationError
    );
  });

  it("uses currency-specific precision for money", () => {
    const krw = Currency.from("KRW");
    const usd = Currency.from("USD");

    expect(Money.fromMajor("1000", krw).toMajorString()).toBe("1000");
    expect(Money.fromMajor("12.34", usd).toMajorString()).toBe("12.34");
    expect(() => Money.fromMajor("12.345", usd)).toThrow(DomainValidationError);
  });

  it("rejects negative quantity and price", () => {
    const usd = Currency.from("USD");

    expect(() => Quantity.from("-1")).toThrow(DomainValidationError);
    expect(() => Price.from("-1", usd)).toThrow(DomainValidationError);
  });

  it("formats zero quantity explicitly", () => {
    expect(Quantity.from("0").toString()).toBe("0");
  });

  it("validates market and asset type allowlists", () => {
    expect(Market.from("KR").code).toBe("KR");
    expect(AssetType.from("ETF").code).toBe("ETF");
    expect(() => Market.from("JP")).toThrow(DomainValidationError);
    expect(() => AssetType.from("CRYPTO")).toThrow(DomainValidationError);
  });

  it("validates time range order", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const end = new Date("2026-01-02T00:00:00Z");

    expect(TimeRange.from(start, end).contains(start)).toBe(true);
    expect(() => TimeRange.from(end, start)).toThrow(DomainValidationError);
  });

  it("formats percent values", () => {
    expect(Percent.fromRatio("0.125").toPercentString()).toBe("12.5000");
  });
});
