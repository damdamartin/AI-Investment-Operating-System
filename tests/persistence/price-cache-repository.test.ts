import { describe, it, expect, beforeEach } from "vitest";
import type { PriceCacheDatabase } from "../../src/persistence/price-cache-repository.js";
import { PriceCacheRepository } from "../../src/persistence/price-cache-repository.js";
import type { D1QueryResultRow } from "../../src/persistence/d1-http-client.js";

/**
 * In-memory fake D1 database for testing
 */
class FakePriceCacheDatabase implements PriceCacheDatabase {
  private prices: Map<string, D1QueryResultRow[]> = new Map();

  async query(sql: string, params: ReadonlyArray<string | number | boolean | null> = []): Promise<{ results: D1QueryResultRow[] }> {
    // Parse SQL and handle different operations
    if (sql.includes("select") && sql.includes("where symbol = ?")) {
      // getCurrentPrice query
      const symbol = params[0] as string;
      const broker = params[1] as string;
      const key = `${symbol}:${broker}`;
      const results = this.prices.get(key) ?? [];
      return { results };
    }

    if (sql.includes("select") && sql.includes("where symbol in")) {
      // getPricesForSymbols query
      // Extract symbol count from params (n symbols + 1 broker)
      const brokerParam = params[params.length - 1] as string;
      const symbolParams = params.slice(0, -1) as string[];

      const results: D1QueryResultRow[] = [];
      for (const symbol of symbolParams) {
        const key = `${symbol}:${brokerParam}`;
        const prices = this.prices.get(key) ?? [];
        results.push(...prices);
      }
      return { results };
    }

    if (sql.includes("select") && sql.includes("where broker = ?")) {
      // getAllPricesForBroker query
      const broker = params[0] as string;
      const results: D1QueryResultRow[] = [];
      for (const [key, prices] of this.prices) {
        if (key.endsWith(`:${broker}`)) {
          results.push(...prices);
        }
      }
      return { results };
    }

    if (sql.includes("insert into price_cache")) {
      // Insert new price
      const id = params[0] as string;
      const symbol = params[1] as string;
      const broker = params[2] as string;
      const priceMajor = params[3] as string;
      const priceCurrency = params[4] as string;
      const timestamp = params[5] as string;
      const ttlSeconds = params[6] as number;

      const key = `${symbol}:${broker}`;
      const row: D1QueryResultRow = {
        id,
        symbol,
        broker,
        price_major: priceMajor,
        price_currency: priceCurrency,
        timestamp,
        ttl_seconds: ttlSeconds
      };

      if (!this.prices.has(key)) {
        this.prices.set(key, []);
      }
      this.prices.get(key)!.unshift(row); // Add to front for "order by timestamp desc"
      return { results: [] };
    }

    if (sql.includes("update price_cache")) {
      // Update existing price
      const priceMajor = params[0] as string;
      const priceCurrency = params[1] as string;
      const timestamp = params[2] as string;
      const ttlSeconds = params[3] as number;
      const id = params[5] as string;

      // Find and update
      for (const [key, rows] of this.prices) {
        const idx = rows.findIndex((r) => r.id === id);
        if (idx >= 0) {
          rows[idx] = {
            ...rows[idx],
            price_major: priceMajor,
            price_currency: priceCurrency,
            timestamp,
            ttl_seconds: ttlSeconds
          };
        }
      }
      return { results: [] };
    }

    if (sql.includes("delete from price_cache")) {
      // Delete
      if (sql.includes("where broker = ?")) {
        const broker = params[0] as string;
        let deleted = 0;
        for (const [key, _] of this.prices) {
          if (key.endsWith(`:${broker}`)) {
            deleted += this.prices.get(key)?.length ?? 0;
            this.prices.delete(key);
          }
        }
        return { results: [{ deleted }] };
      }
    }

    return { results: [] };
  }

  // Helper method to add test data
  addPrice(symbol: string, broker: string, priceMajor: string, priceCurrency: string, timestamp: string, ttlSeconds: number = 60) {
    const id = `${symbol}:${broker}:${Date.now()}`;
    const key = `${symbol}:${broker}`;
    const row: D1QueryResultRow = {
      id,
      symbol,
      broker,
      price_major: priceMajor,
      price_currency: priceCurrency,
      timestamp,
      ttl_seconds: ttlSeconds
    };
    if (!this.prices.has(key)) {
      this.prices.set(key, []);
    }
    this.prices.get(key)!.unshift(row);
  }
}

describe("PriceCacheRepository", () => {
  let db: FakePriceCacheDatabase;
  let repo: PriceCacheRepository;

  beforeEach(() => {
    db = new FakePriceCacheDatabase();
    repo = new PriceCacheRepository(db);
  });

  describe("updatePrice", () => {
    it("should insert a new price", async () => {
      const id = await repo.updatePrice("005930", "KIS", "75000", "KRW", 60);
      expect(id).toBeTruthy();

      const cached = await repo.getCurrentPrice("005930", "KIS");
      expect(cached).toBeTruthy();
      expect(cached?.priceMajor).toBe("75000");
      expect(cached?.priceCurrency).toBe("KRW");
    });

    it("should update an existing price", async () => {
      await repo.updatePrice("005930", "KIS", "75000", "KRW", 60);
      await repo.updatePrice("005930", "KIS", "76000", "KRW", 60);

      const cached = await repo.getCurrentPrice("005930", "KIS");
      expect(cached?.priceMajor).toBe("76000");
    });

    it("should handle different brokers separately", async () => {
      await repo.updatePrice("005930", "KIS", "75000", "KRW", 60);
      await repo.updatePrice("005930", "TOSS", "75100", "KRW", 60);

      const kisCached = await repo.getCurrentPrice("005930", "KIS");
      const tossCached = await repo.getCurrentPrice("005930", "TOSS");

      expect(kisCached?.priceMajor).toBe("75000");
      expect(tossCached?.priceMajor).toBe("75100");
    });

    it("should handle different currencies", async () => {
      await repo.updatePrice("AAPL", "KIS", "150.25", "USD", 60);

      const cached = await repo.getCurrentPrice("AAPL", "KIS");
      expect(cached?.priceCurrency).toBe("USD");
      expect(cached?.priceMajor).toBe("150.25");
    });
  });

  describe("getCurrentPrice", () => {
    it("should return null if price not found", async () => {
      const cached = await repo.getCurrentPrice("NOTFOUND", "KIS");
      expect(cached).toBeNull();
    });

    it("should return null if price is expired", async () => {
      const now = new Date();
      const expiredTimestamp = new Date(now.getTime() - 70 * 1000).toISOString(); // 70 seconds ago

      db.addPrice("005930", "KIS", "75000", "KRW", expiredTimestamp, 60);

      const cached = await repo.getCurrentPrice("005930", "KIS");
      expect(cached).toBeNull();
    });

    it("should return price if not expired", async () => {
      const now = new Date();
      const recentTimestamp = new Date(now.getTime() - 5 * 1000).toISOString(); // 5 seconds ago

      db.addPrice("005930", "KIS", "75000", "KRW", recentTimestamp, 60);

      const cached = await repo.getCurrentPrice("005930", "KIS");
      expect(cached).toBeTruthy();
      expect(cached?.priceMajor).toBe("75000");
    });
  });

  describe("getPricesForSymbols", () => {
    it("should return empty array if no prices found", async () => {
      const prices = await repo.getPricesForSymbols(["005930", "000660"], "KIS");
      expect(prices).toHaveLength(0);
    });

    it("should return only non-expired prices", async () => {
      const now = new Date();
      const recentTimestamp = new Date(now.getTime() - 5 * 1000).toISOString();
      const expiredTimestamp = new Date(now.getTime() - 70 * 1000).toISOString();

      db.addPrice("005930", "KIS", "75000", "KRW", recentTimestamp, 60);
      db.addPrice("000660", "KIS", "120000", "KRW", expiredTimestamp, 60);

      const prices = await repo.getPricesForSymbols(["005930", "000660"], "KIS");
      expect(prices).toHaveLength(1);
      expect(prices[0]?.symbol).toBe("005930");
    });

    it("should handle empty symbol array", async () => {
      const prices = await repo.getPricesForSymbols([], "KIS");
      expect(prices).toHaveLength(0);
    });
  });

  describe("updatePricesBatch", () => {
    it("should insert multiple prices", async () => {
      await repo.updatePricesBatch([
        { symbol: "005930", broker: "KIS", priceMajor: "75000", priceCurrency: "KRW" },
        { symbol: "000660", broker: "KIS", priceMajor: "120000", priceCurrency: "KRW" }
      ]);

      const price1 = await repo.getCurrentPrice("005930", "KIS");
      const price2 = await repo.getCurrentPrice("000660", "KIS");

      expect(price1?.priceMajor).toBe("75000");
      expect(price2?.priceMajor).toBe("120000");
    });
  });

  describe("getAllPricesForBroker", () => {
    it("should return all prices for a broker", async () => {
      const now = new Date();
      const timestamp = now.toISOString();

      db.addPrice("005930", "KIS", "75000", "KRW", timestamp);
      db.addPrice("000660", "KIS", "120000", "KRW", timestamp);
      db.addPrice("005930", "TOSS", "75100", "KRW", timestamp);

      const kisPrices = await repo.getAllPricesForBroker("KIS");
      expect(kisPrices).toHaveLength(2);
    });

    it("should return empty array if broker has no prices", async () => {
      const prices = await repo.getAllPricesForBroker("KIS");
      expect(prices).toHaveLength(0);
    });
  });

  describe("clearBrokerCache", () => {
    it("should delete all prices for a broker", async () => {
      const now = new Date();
      const timestamp = now.toISOString();

      db.addPrice("005930", "KIS", "75000", "KRW", timestamp);
      db.addPrice("000660", "KIS", "120000", "KRW", timestamp);
      db.addPrice("005930", "TOSS", "75100", "KRW", timestamp);

      await repo.clearBrokerCache("KIS");

      const kisPrices = await repo.getAllPricesForBroker("KIS");
      const tossPrices = await repo.getAllPricesForBroker("TOSS");

      expect(kisPrices).toHaveLength(0);
      expect(tossPrices).toHaveLength(1);
    });
  });
});
