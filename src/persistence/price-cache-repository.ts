import { randomUUID } from "node:crypto";
import type { D1QueryResultRow } from "./d1-http-client.js";

/**
 * Narrow dependency this repository needs from a D1 client.
 * Kept separate from `D1HttpClient` itself so tests can supply an in-memory fake.
 */
export interface PriceCacheDatabase {
  query(sql: string, params?: ReadonlyArray<string | number | boolean | null>): Promise<{ results: D1QueryResultRow[] }>;
}

export type Broker = "KIS" | "TOSS";

export interface CachedPrice {
  id: string;
  symbol: string;
  broker: Broker;
  priceMajor: string;
  priceCurrency: "KRW" | "USD";
  timestamp: Date;
  ttlSeconds: number;
}

/**
 * Real-time price cache repository for KIS and Toss brokers.
 *
 * Maintains a cache of current stock prices in D1 to:
 * - Reduce API calls to KIS/Toss (rate limit compliance)
 * - Improve stop-loss/take-profit execution speed (no wait for API response)
 * - Provide fast price lookups for position monitoring
 *
 * TTL (time-to-live) in seconds determines when a cached price is considered
 * stale and should be re-fetched from the broker API.
 */
export class PriceCacheRepository {
  constructor(private readonly db: PriceCacheDatabase) {}

  /**
   * Get the current price for a symbol from the specified broker.
   * Returns null if no cached price exists or if the cache is expired.
   *
   * @param symbol - Stock symbol (e.g., "005930" for Samsung, "AAPL" for Apple)
   * @param broker - Broker source ('KIS' or 'TOSS')
   * @returns Cached price or null if not found/expired
   */
  async getCurrentPrice(symbol: string, broker: Broker): Promise<CachedPrice | null> {
    const result = await this.db.query(
      `select id, symbol, broker, price_major, price_currency, timestamp, ttl_seconds
       from price_cache
       where symbol = ? and broker = ?
       order by timestamp desc
       limit 1`,
      [symbol, broker]
    );

    if (result.results.length === 0) {
      return null;
    }

    const row = result.results[0];
    if (!row) {
      return null;
    }

    const cachedPrice = this.#rowToCachedPrice(row);

    // Check if cache is expired
    if (this.#isExpired(cachedPrice)) {
      return null;
    }

    return cachedPrice;
  }

  /**
   * Get current prices for multiple symbols from the specified broker.
   * Returns only non-expired prices.
   *
   * @param symbols - Array of stock symbols
   * @param broker - Broker source ('KIS' or 'TOSS')
   * @returns Array of cached prices for found, non-expired symbols
   */
  async getPricesForSymbols(symbols: string[], broker: Broker): Promise<CachedPrice[]> {
    if (symbols.length === 0) {
      return [];
    }

    const placeholders = symbols.map(() => "?").join(",");
    const result = await this.db.query(
      `select id, symbol, broker, price_major, price_currency, timestamp, ttl_seconds
       from price_cache
       where symbol in (${placeholders}) and broker = ?
       order by symbol, timestamp desc`,
      [...symbols, broker]
    );

    // Group by symbol and take the latest for each
    const pricesBySymbol = new Map<string, CachedPrice>();
    for (const row of result.results) {
      const cachedPrice = this.#rowToCachedPrice(row);
      if (!this.#isExpired(cachedPrice)) {
        // Only store if not already seen (since we ordered by timestamp desc)
        const symbol = cachedPrice.symbol;
        if (!pricesBySymbol.has(symbol)) {
          pricesBySymbol.set(symbol, cachedPrice);
        }
      }
    }

    return Array.from(pricesBySymbol.values());
  }

  /**
   * Update or insert a price into the cache.
   * If a price for (symbol, broker) exists, updates it; otherwise inserts new.
   *
   * @param symbol - Stock symbol
   * @param broker - Broker source ('KIS' or 'TOSS')
   * @param priceMajor - Price value (major unit, e.g., "75000" or "150.25")
   * @param priceCurrency - Currency code ('KRW' or 'USD')
   * @param ttlSeconds - Time-to-live in seconds (default: 60)
   */
  async updatePrice(
    symbol: string,
    broker: Broker,
    priceMajor: string,
    priceCurrency: "KRW" | "USD",
    ttlSeconds: number = 60
  ): Promise<string> {
    // Check if price already exists for this symbol/broker combination
    const existing = await this.db.query(
      `select id from price_cache where symbol = ? and broker = ?`,
      [symbol, broker]
    );

    const now = new Date().toISOString();

    if (existing.results.length > 0) {
      // Update existing price
      const id = existing.results[0]?.id as string;
      await this.db.query(
        `update price_cache
         set price_major = ?, price_currency = ?, timestamp = ?, ttl_seconds = ?, updated_at = ?
         where id = ?`,
        [priceMajor, priceCurrency, now, ttlSeconds, now, id]
      );
      return id;
    }

    // Insert new price
    const id = randomUUID();
    await this.db.query(
      `insert into price_cache (id, symbol, broker, price_major, price_currency, timestamp, ttl_seconds)
       values (?, ?, ?, ?, ?, ?, ?)`,
      [id, symbol, broker, priceMajor, priceCurrency, now, ttlSeconds]
    );
    return id;
  }

  /**
   * Update prices in batch for multiple symbols (atomic operation).
   * Useful for bulk price updates from broker APIs.
   *
   * @param prices - Array of price updates {symbol, broker, priceMajor, priceCurrency, ttlSeconds}
   */
  async updatePricesBatch(
    prices: Array<{
      symbol: string;
      broker: Broker;
      priceMajor: string;
      priceCurrency: "KRW" | "USD";
      ttlSeconds?: number;
    }>
  ): Promise<void> {
    const now = new Date().toISOString();

    for (const price of prices) {
      const ttl = price.ttlSeconds ?? 60;

      // Check if price already exists for this symbol/broker combination
      const existing = await this.db.query(
        `select id from price_cache where symbol = ? and broker = ?`,
        [price.symbol, price.broker]
      );

      if (existing.results.length > 0) {
        // Update existing price
        const id = existing.results[0]?.id as string;
        await this.db.query(
          `update price_cache
           set price_major = ?, price_currency = ?, timestamp = ?, ttl_seconds = ?, updated_at = ?
           where id = ?`,
          [price.priceMajor, price.priceCurrency, now, ttl, now, id]
        );
      } else {
        // Insert new price
        const id = randomUUID();
        await this.db.query(
          `insert into price_cache (id, symbol, broker, price_major, price_currency, timestamp, ttl_seconds)
           values (?, ?, ?, ?, ?, ?, ?)`,
          [id, price.symbol, price.broker, price.priceMajor, price.priceCurrency, now, ttl]
        );
      }
    }
  }

  /**
   * Delete expired prices from the cache.
   * Called periodically to prevent the cache table from growing indefinitely.
   *
   * @returns Number of rows deleted
   */
  async cleanExpiredPrices(): Promise<number> {
    const now = new Date();

    // Delete prices where (now - timestamp) > ttl_seconds
    const result = await this.db.query(
      `delete from price_cache
       where datetime(timestamp) < datetime('now', '-' || ttl_seconds || ' seconds')`,
      []
    );

    return result.results.length;
  }

  /**
   * Get all prices in cache for a specific broker.
   * Useful for monitoring/debugging.
   *
   * @param broker - Broker source ('KIS' or 'TOSS')
   * @returns All prices for the broker (expired and non-expired)
   */
  async getAllPricesForBroker(broker: Broker): Promise<CachedPrice[]> {
    const result = await this.db.query(
      `select id, symbol, broker, price_major, price_currency, timestamp, ttl_seconds
       from price_cache
       where broker = ?
       order by symbol, timestamp desc`,
      [broker]
    );

    return result.results.map((row) => this.#rowToCachedPrice(row));
  }

  /**
   * Clear all prices for a specific broker (useful for reset/testing).
   *
   * @param broker - Broker source ('KIS' or 'TOSS')
   * @returns Number of rows deleted
   */
  async clearBrokerCache(broker: Broker): Promise<number> {
    const result = await this.db.query(`delete from price_cache where broker = ?`, [broker]);
    return result.results.length;
  }

  /**
   * Convert D1 row to CachedPrice domain object
   */
  #rowToCachedPrice(row: D1QueryResultRow): CachedPrice {
    const timestamp = typeof row.timestamp === "string" ? new Date(row.timestamp) : new Date();
    const ttlSeconds = typeof row.ttl_seconds === "number" ? row.ttl_seconds : 60;

    return {
      id: String(row.id),
      symbol: String(row.symbol),
      broker: String(row.broker) as Broker,
      priceMajor: String(row.price_major),
      priceCurrency: (String(row.price_currency) as "KRW" | "USD"),
      timestamp,
      ttlSeconds
    };
  }

  /**
   * Check if a cached price has expired based on its TTL.
   * Adds a small buffer (5 seconds) before expiration for safety.
   */
  #isExpired(cachedPrice: CachedPrice): boolean {
    const bufferMs = 5 * 1000; // 5-second buffer
    const ageMs = Date.now() - cachedPrice.timestamp.getTime();
    const ttlMs = cachedPrice.ttlSeconds * 1000;

    return ageMs > ttlMs - bufferMs;
  }
}
