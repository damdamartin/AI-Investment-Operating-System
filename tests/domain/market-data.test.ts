import { describe, expect, it } from "vitest";
import { AssetType, Currency, Market, MarketDataSnapshot, Price, Quantity } from "../../src/index.js";

const baseSnapshot = {
  assetId: "asset-aapl",
  symbol: "AAPL",
  market: Market.from("US"),
  assetType: AssetType.from("STOCK"),
  price: Price.from("190.12", Currency.from("USD")),
  volume: Quantity.from("1000000"),
  lastTradeAt: new Date("2026-01-01T00:00:20Z"),
  collectedAt: new Date("2026-01-01T00:00:30Z"),
  source: "TOSS_SECURITIES" as const
};

const policy = {
  maxCollectedAgeMs: 60_000,
  maxLastTradeAgeMs: 120_000
};

describe("MarketDataSnapshot", () => {
  it("marks complete recent data as fresh", () => {
    const snapshot = new MarketDataSnapshot(baseSnapshot);

    const assessment = snapshot.assessFreshness(policy, new Date("2026-01-01T00:01:00Z"));

    expect(assessment.status).toBe("FRESH");
    expect(assessment.blocksTradingDecision).toBe(false);
    expect(assessment.reasons).toEqual([]);
  });

  it("marks old collected data as stale and blocking", () => {
    const snapshot = new MarketDataSnapshot({
      ...baseSnapshot,
      collectedAt: new Date("2026-01-01T00:00:00Z")
    });

    const assessment = snapshot.assessFreshness(policy, new Date("2026-01-01T00:02:00Z"));

    expect(assessment.status).toBe("STALE");
    expect(assessment.reasons).toContain("stale_collected_at");
    expect(assessment.blocksTradingDecision).toBe(true);
  });

  it("marks missing price or volume as missing and blocking", () => {
    const snapshot = new MarketDataSnapshot({
      ...baseSnapshot,
      price: undefined
    });

    const assessment = snapshot.assessFreshness(policy, new Date("2026-01-01T00:01:00Z"));

    expect(assessment.status).toBe("MISSING");
    expect(assessment.reasons).toContain("missing_price");
    expect(assessment.blocksTradingDecision).toBe(true);
  });

  it("marks zero price and unknown source as suspect", () => {
    const snapshot = new MarketDataSnapshot({
      ...baseSnapshot,
      price: Price.from("0", Currency.from("USD")),
      source: "UNKNOWN"
    });

    const assessment = snapshot.assessFreshness(policy, new Date("2026-01-01T00:01:00Z"));

    expect(assessment.status).toBe("SUSPECT");
    expect(assessment.reasons).toEqual(expect.arrayContaining(["zero_price", "unknown_source"]));
    expect(assessment.blocksTradingDecision).toBe(true);
  });

  it("preserves source traceability in persistence-ready records", () => {
    const snapshot = new MarketDataSnapshot({
      ...baseSnapshot,
      sourceRequestId: "request-1",
      suspectReasons: ["wide_spread"]
    });

    expect(snapshot.toRecord()).toMatchObject({
      assetId: "asset-aapl",
      symbol: "AAPL",
      market: "US",
      assetType: "STOCK",
      source: "TOSS_SECURITIES",
      sourceRequestId: "request-1",
      suspectReasons: ["wide_spread"]
    });
  });
});
