import { createHash } from "node:crypto";
import { MarketDataSnapshot } from "../../domain/market-data/index.js";
import { Currency, Price, Quantity, type AssetType, type Market } from "../../domain/value-objects/index.js";

export interface WatchlistAsset {
  assetId: string;
  symbol: string;
  market: Market;
  assetType: AssetType;
}

export interface MarketDataProvider {
  /** Returns the most recent snapshots for one asset, oldest first. */
  fetchRecentSnapshots(asset: WatchlistAsset, now: Date): Promise<MarketDataSnapshot[]>;
}

/**
 * PLACEHOLDER data source. This does NOT call any real market data API - it
 * generates a deterministic pseudo-random walk seeded from the asset symbol
 * and the current hour, purely so the orchestrator's full pipeline (market
 * engine -> strategy scoring -> risk/money checks -> recommendation) can be
 * exercised end-to-end today.
 *
 * Why not real Toss data: `TossReadOnlyHttpClient.getMarketPrices()`
 * (src/adapters/toss/toss-read-only-http-client.ts) deliberately never
 * extracts a real price or symbol from the API response - by design, it
 * only ever returns an item count, per its own P5-016 task requirement.
 *
 * A real `TossMarketDataProvider` implementation exists in
 * `src/adapters/toss/toss-market-data-provider.ts`, which provides actual
 * market data from the Toss Securities API. This implementation can be
 * substituted for the placeholder when ready.
 *
 * Replace this class with a real `MarketDataProvider` implementation (such as
 * `TossMarketDataProvider`, a licensed market data vendor, or any other live
 * feed tied to the user's brokerage identity) before treating recommendations
 * as meaningful.
 */
export class PlaceholderMarketDataProvider implements MarketDataProvider {
  async fetchRecentSnapshots(asset: WatchlistAsset, now: Date): Promise<MarketDataSnapshot[]> {
    const currency = asset.market.code === "US" ? "USD" : "KRW";
    const basePrice = 10_000 + (seed(asset.symbol) % 90_000);
    const points = 5;
    const snapshots: MarketDataSnapshot[] = [];

    for (let i = points - 1; i >= 0; i -= 1) {
      const collectedAt = new Date(now.getTime() - i * 60 * 60 * 1000);
      const drift = pseudoRandom(asset.symbol, i) * 0.02 - 0.01;
      const price = Math.max(1, Math.round(basePrice * (1 + drift * (points - i))));
      const volume = 1_000_000 + Math.round(pseudoRandom(asset.symbol, i + 100) * 5_000_000);

      snapshots.push(
        new MarketDataSnapshot({
          assetId: asset.assetId,
          symbol: asset.symbol,
          market: asset.market,
          assetType: asset.assetType,
          price: Price.from(String(price), currencyFor(currency)),
          volume: Quantity.from(String(volume)),
          lastTradeAt: collectedAt,
          collectedAt,
          source: "UNKNOWN",
          suspectReasons: ["placeholder_synthetic_data_not_real_market_data"]
        })
      );
    }

    return snapshots;
  }
}

function currencyFor(code: "KRW" | "USD") {
  return Currency.from(code);
}

function seed(symbol: string): number {
  const hash = createHash("sha256").update(symbol).digest();
  return hash.readUInt32BE(0);
}

function pseudoRandom(symbol: string, salt: number): number {
  const hash = createHash("sha256").update(`${symbol}:${salt}`).digest();
  return hash.readUInt32BE(0) / 0xffffffff;
}
