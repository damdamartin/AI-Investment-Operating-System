import { describe, expect, it } from "vitest";
import {
  AssetType,
  Currency,
  Market,
  MarketDataSnapshot,
  MarketEngine,
  Price,
  Quantity
} from "../../src/index.js";

const usd = Currency.from("USD");
const policy = {
  maxCollectedAgeMs: 60_000,
  maxLastTradeAgeMs: 120_000
};

describe("MarketEngine", () => {
  it("returns deterministic analysis scores with input references", () => {
    const engine = new MarketEngine();

    const result = engine.evaluate({
      snapshots: [
        snapshot("100", "2026-01-01T00:00:00Z"),
        snapshot("110", "2026-01-01T00:00:30Z")
      ],
      freshnessPolicy: policy,
      now: new Date("2026-01-01T00:01:00Z"),
      scoringVersion: "market-engine-v1"
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.output.scoreSet.scoringVersion).toBe("market-engine-v1");
    expect(result.ok && result.output.scoreSet.scores).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ engine: "MARKET_TREND", score: 100 }),
        expect.objectContaining({ engine: "MARKET_VOLUME", score: 75 }),
        expect.objectContaining({ engine: "MARKET_VOLATILITY" })
      ])
    );
    expect(result.ok && result.output.inputReferences[0]).toContain("market-data:TEST_FIXTURE:asset-aapl");
    expect(result.ok && result.output.safetyType).toBe("MARKET_ENGINE_ANALYSIS_ONLY");
    expect(result.ok && result.output).not.toHaveProperty("direction");
    expect(result.ok && result.output).not.toHaveProperty("order");
  });

  it("refuses stale market data", () => {
    const engine = new MarketEngine();

    const result = engine.evaluate({
      snapshots: [snapshot("100", "2026-01-01T00:00:00Z")],
      freshnessPolicy: policy,
      now: new Date("2026-01-01T00:05:00Z"),
      scoringVersion: "market-engine-v1"
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.refusal.reasons).toContain("stale_collected_at");
    expect(!result.ok && result.refusal.safetyType).toBe("MARKET_ENGINE_REFUSAL_ONLY");
  });

  it("refuses missing market data", () => {
    const engine = new MarketEngine();

    const result = engine.evaluate({
      snapshots: [
        new MarketDataSnapshot({
          assetId: "asset-aapl",
          symbol: "AAPL",
          market: Market.from("US"),
          assetType: AssetType.from("STOCK"),
          volume: Quantity.from("100000"),
          collectedAt: new Date("2026-01-01T00:00:30Z"),
          source: "TEST_FIXTURE"
        })
      ],
      freshnessPolicy: policy,
      now: new Date("2026-01-01T00:01:00Z"),
      scoringVersion: "market-engine-v1"
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.refusal.reasons).toContain("missing_price");
  });

  it("refuses empty snapshot sets", () => {
    const engine = new MarketEngine();

    const result = engine.evaluate({
      snapshots: [],
      freshnessPolicy: policy,
      now: new Date("2026-01-01T00:01:00Z"),
      scoringVersion: "market-engine-v1"
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.refusal.reasons).toContain("missing_market_data_snapshots");
  });
});

function snapshot(price: string, collectedAt: string): MarketDataSnapshot {
  const collected = new Date(collectedAt);
  return new MarketDataSnapshot({
    assetId: "asset-aapl",
    symbol: "AAPL",
    market: Market.from("US"),
    assetType: AssetType.from("STOCK"),
    price: Price.from(price, usd),
    volume: Quantity.from("100000"),
    lastTradeAt: collected,
    collectedAt: collected,
    source: "TEST_FIXTURE"
  });
}
