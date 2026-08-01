import type { WatchlistAsset } from "../../application/pipeline/market-data-provider.js";
import { Price, Currency } from "../../domain/value-objects/index.js";
import type { PriceCacheRepository } from "../../persistence/price-cache-repository.js";
import type { TossMarketDataProvider } from "./toss-market-data-provider.js";

/**
 * Toss price fetcher with caching support.
 *
 * This adapter wraps TossMarketDataProvider and PriceCacheRepository to:
 * 1. Check the cache first (reuse prices < 10 seconds old)
 * 2. If cache miss, fetch from Toss API
 * 3. Store result in D1 cache
 * 4. Return the price
 *
 * This reduces API calls and improves stop-loss/take-profit execution speed.
 */
export class TossPriceFetcher {
  constructor(
    private readonly provider: TossMarketDataProvider,
    private readonly cache: PriceCacheRepository
  ) {}

  /**
   * Get current price for a symbol, using cache when available.
   *
   * Strategy:
   * 1. Check cache for price within 10 seconds (fast path)
   * 2. If cache miss, fetch from Toss API
   * 3. Store in cache with 60-second TTL
   * 4. Return price
   *
   * @param asset - Asset to fetch price for
   * @param now - Current timestamp
   * @returns Price object or null if fetch fails
   */
  async getPrice(asset: WatchlistAsset, now: Date): Promise<Price | null> {
    const CACHE_CHECK_TTL = 10; // Use cache if within 10 seconds
    const CACHE_STORE_TTL = 60; // Store prices with 60-second TTL

    try {
      // Step 1: Check cache for recent price
      const cachedPrice = await this.cache.getCurrentPrice(asset.symbol, "TOSS");
      if (cachedPrice) {
        const ageSeconds = (now.getTime() - cachedPrice.timestamp.getTime()) / 1000;
        if (ageSeconds < CACHE_CHECK_TTL) {
          // Cache is fresh, use it
          const price = Price.from(cachedPrice.priceMajor, Currency.from(cachedPrice.priceCurrency));
          return price;
        }
      }

      // Step 2: Cache miss or expired, fetch from Toss API
      const snapshots = await this.provider.fetchRecentSnapshots(asset, now);
      if (!snapshots || snapshots.length === 0) {
        return null;
      }

      const snapshot = snapshots[0];
      if (!snapshot || !snapshot.price) {
        return null;
      }

      // Check if snapshot contains suspect data
      if (snapshot.suspectReasons && snapshot.suspectReasons.length > 0) {
        console.warn(
          `[TossPriceFetcher] Snapshot for ${asset.symbol} is suspect: ${snapshot.suspectReasons.join(", ")}`
        );
      }

      // Step 3: Store in cache
      const priceStr = snapshot.price.toString();
      const priceParts = priceStr.split(" ");
      const priceMajor = priceParts[0] ?? "0";
      const currency = priceParts[1] ?? snapshot.price.currency.code;

      await this.cache.updatePrice(
        asset.symbol,
        "TOSS",
        priceMajor,
        currency as "KRW" | "USD",
        CACHE_STORE_TTL
      );

      // Step 4: Return price
      return snapshot.price;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[TossPriceFetcher] Error fetching price for ${asset.symbol}: ${message}`);
      return null;
    }
  }

  /**
   * Get prices for multiple symbols in batch.
   * Uses cache for symbols with recent prices, fetches others from API.
   *
   * @param assets - Assets to fetch prices for
   * @param now - Current timestamp
   * @returns Map of symbol to price (only successful fetches)
   */
  async getPrices(assets: WatchlistAsset[], now: Date): Promise<Map<string, Price>> {
    const CACHE_CHECK_TTL = 10; // Use cache if within 10 seconds
    const CACHE_STORE_TTL = 60; // Store prices with 60-second TTL
    const prices = new Map<string, Price>();

    try {
      // Step 1: Check cache for all symbols
      const cachedPrices = await this.cache.getPricesForSymbols(
        assets.map((a) => a.symbol),
        "TOSS"
      );

      const cachedBySymbol = new Map(
        cachedPrices.map((p) => [
          p.symbol,
          {
            price: Price.from(p.priceMajor, Currency.from(p.priceCurrency)),
            timestamp: p.timestamp
          }
        ])
      );

      // Add fresh cached prices to result
      const symbolsToFetch: WatchlistAsset[] = [];
      for (const asset of assets) {
        const cached = cachedBySymbol.get(asset.symbol);
        if (cached) {
          const ageSeconds = (now.getTime() - cached.timestamp.getTime()) / 1000;
          if (ageSeconds < CACHE_CHECK_TTL) {
            // Cache is fresh
            prices.set(asset.symbol, cached.price);
          } else {
            // Cache expired, need to fetch
            symbolsToFetch.push(asset);
          }
        } else {
          // Not in cache, need to fetch
          symbolsToFetch.push(asset);
        }
      }

      // Step 2: Fetch missing prices from API (one by one, as provider doesn't support batch)
      const pricesToCache: Array<{
        symbol: string;
        broker: "KIS" | "TOSS";
        priceMajor: string;
        priceCurrency: "KRW" | "USD";
        ttlSeconds?: number;
      }> = [];

      for (const asset of symbolsToFetch) {
        try {
          const snapshots = await this.provider.fetchRecentSnapshots(asset, now);
          if (!snapshots || snapshots.length === 0) {
            continue;
          }

          const snapshot = snapshots[0];
          if (!snapshot || !snapshot.price) {
            continue;
          }

          if (snapshot.suspectReasons && snapshot.suspectReasons.length > 0) {
            console.warn(
              `[TossPriceFetcher] Snapshot for ${asset.symbol} is suspect: ${snapshot.suspectReasons.join(", ")}`
            );
          }

          prices.set(asset.symbol, snapshot.price);
          const priceStr = snapshot.price.toString();
          const priceParts = priceStr.split(" ");
          const priceMajor = priceParts[0] ?? "0";
          const currency = priceParts[1] ?? snapshot.price.currency.code;

          pricesToCache.push({
            symbol: asset.symbol,
            broker: "TOSS",
            priceMajor,
            priceCurrency: currency as "KRW" | "USD",
            ttlSeconds: CACHE_STORE_TTL
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`[TossPriceFetcher] Error fetching price for ${asset.symbol}: ${message}`);
        }
      }

      // Step 3: Store fetched prices in cache
      if (pricesToCache.length > 0) {
        await this.cache.updatePricesBatch(pricesToCache);
      }

      return prices;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[TossPriceFetcher] Error in getPrices: ${message}`);
      return prices;
    }
  }

  /**
   * Clear the entire Toss price cache (useful for testing/reset).
   */
  async clearCache(): Promise<void> {
    await this.cache.clearBrokerCache("TOSS");
  }
}
