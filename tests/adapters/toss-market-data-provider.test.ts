import { describe, it, expect, beforeEach } from "vitest";
import { TossMarketDataProvider } from "../../src/adapters/toss/toss-market-data-provider.js";
import type { WatchlistAsset, MarketDataProvider } from "../../src/application/pipeline/market-data-provider.js";
import { Market, AssetType } from "../../src/domain/value-objects/index.js";
import type { TossMarketDataFetchResponse, TossMarketDataRequestInit } from "../../src/adapters/toss/toss-market-data-provider.js";

/**
 * Mock fetch implementation for testing. Logs all requests and allows
 * configurable responses per URL.
 */
class MockFetch {
  private responses: Map<string, TossMarketDataFetchResponse> = new Map();
  private requests: Array<{ url: string; init: TossMarketDataRequestInit }> = [];

  setResponse(urlPattern: string, response: TossMarketDataFetchResponse): void {
    this.responses.set(urlPattern, response);
  }

  async call(url: string, init: TossMarketDataRequestInit): Promise<TossMarketDataFetchResponse> {
    this.requests.push({ url, init });

    // Try exact match first
    if (this.responses.has(url)) {
      return this.responses.get(url)!;
    }

    // Try pattern matching (substring)
    for (const [pattern, response] of this.responses) {
      if (url.includes(pattern)) {
        return response;
      }
    }

    // Default error response
    return {
      ok: false,
      status: 404,
      json: async () => ({ error: "Not mocked" })
    };
  }

  getRequests() {
    return this.requests;
  }

  clear() {
    this.requests = [];
  }
}

describe("TossMarketDataProvider", () => {
  let mockFetch: MockFetch;
  let provider: TossMarketDataProvider;
  let testAsset: WatchlistAsset;

  beforeEach(() => {
    mockFetch = new MockFetch();
    provider = new TossMarketDataProvider({
      baseUrl: "http://localhost:8080",
      clientId: "test-client-id",
      clientSecret: "test-client-secret",
      fetch: mockFetch.call.bind(mockFetch),
      now: () => new Date("2026-07-30T12:00:00Z")
    });

    testAsset = {
      assetId: "asset-005930",
      symbol: "005930",
      market: Market.from("KR"),
      assetType: AssetType.from("STOCK")
    };
  });

  describe("fetchRecentSnapshots with success", () => {
    beforeEach(() => {
      // Mock successful token response
      mockFetch.setResponse("oauth2/token", {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "mock-token-12345",
          token_type: "Bearer",
          expires_in: 3600
        })
      });

      // Mock successful prices response
      mockFetch.setResponse("prices", {
        ok: true,
        status: 200,
        json: async () => [
          {
            symbol: "005930",
            lastPrice: "70500",
            currency: "KRW",
            timestamp: "2026-07-30T11:59:00Z"
          }
        ]
      });
    });

    it("should return MarketDataSnapshot with current price data", async () => {
      const snapshots = await provider.fetchRecentSnapshots(testAsset, new Date("2026-07-30T12:00:00Z"));

      expect(snapshots).toHaveLength(1);
      const snapshot = snapshots[0];

      expect(snapshot!.assetId).toBe("asset-005930");
      expect(snapshot!.symbol).toBe("005930");
      expect(snapshot!.market.code).toBe("KR");
      expect(snapshot!.price?.toString()).toBe("70500.000000 KRW");
      expect(snapshot!.source).toBe("TOSS_SECURITIES");
      expect(snapshot!.suspectReasons).toHaveLength(0);
    });

    it("should extract currency from response", async () => {
      mockFetch.setResponse("prices", {
        ok: true,
        status: 200,
        json: async () => [
          {
            symbol: "AAPL",
            lastPrice: "225.50",
            currency: "USD",
            timestamp: "2026-07-30T11:59:00Z"
          }
        ]
      });

      const usdAsset: WatchlistAsset = {
        assetId: "asset-aapl",
        symbol: "AAPL",
        market: Market.from("US"),
        assetType: AssetType.from("STOCK")
      };

      const snapshots = await provider.fetchRecentSnapshots(usdAsset, new Date("2026-07-30T12:00:00Z"));

      expect(snapshots).toHaveLength(1);
      expect(snapshots[0]!.price?.toString()).toBe("225.500000 USD");
    });

    it("should parse timestamp from response", async () => {
      const snapshots = await provider.fetchRecentSnapshots(testAsset, new Date("2026-07-30T12:00:00Z"));

      expect(snapshots[0]!.lastTradeAt).toEqual(new Date("2026-07-30T11:59:00Z"));
    });

    it("should send authorization header with access token", async () => {
      await provider.fetchRecentSnapshots(testAsset, new Date("2026-07-30T12:00:00Z"));

      const priceRequests = mockFetch.getRequests().filter((r) => r.url.includes("prices"));
      expect(priceRequests).toHaveLength(1);
      expect(priceRequests[0]!.init.headers.authorization).toBe("Bearer mock-token-12345");
    });

    it("should cache and reuse access token", async () => {
      await provider.fetchRecentSnapshots(testAsset, new Date("2026-07-30T12:00:00Z"));
      mockFetch.clear();

      await provider.fetchRecentSnapshots(testAsset, new Date("2026-07-30T13:00:00Z"));

      const tokenRequests = mockFetch.getRequests().filter((r) => r.url.includes("oauth2/token"));
      expect(tokenRequests).toHaveLength(0); // Token should be cached
    });
  });

  describe("fetchRecentSnapshots with authentication failure", () => {
    beforeEach(() => {
      mockFetch.setResponse("oauth2/token", {
        ok: false,
        status: 401,
        json: async () => ({ error: "invalid_client" })
      });
    });

    it("should return suspect snapshot on auth failure", async () => {
      const snapshots = await provider.fetchRecentSnapshots(testAsset, new Date("2026-07-30T12:00:00Z"));

      expect(snapshots).toHaveLength(1);
      expect(snapshots[0]!.price).toBeUndefined();
      expect(snapshots[0]!.suspectReasons).toContain("toss_market_data_error: Toss authentication failed with status 401");
    });
  });

  describe("fetchRecentSnapshots with network failure", () => {
    beforeEach(() => {
      // Mock successful token response
      mockFetch.setResponse("oauth2/token", {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "mock-token",
          token_type: "Bearer",
          expires_in: 3600
        })
      });

      // Mock fetch that throws
      provider = new TossMarketDataProvider({
        baseUrl: "http://localhost:8080",
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        fetch: async () => {
          throw new Error("Network timeout");
        },
        now: () => new Date("2026-07-30T12:00:00Z")
      });
    });

    it("should return suspect snapshot on network error", async () => {
      const snapshots = await provider.fetchRecentSnapshots(testAsset, new Date("2026-07-30T12:00:00Z"));

      expect(snapshots).toHaveLength(1);
      expect(snapshots[0]!.price).toBeUndefined();
      expect(snapshots[0]!.suspectReasons[0]).toMatch(/toss_market_data_error/);
    });
  });

  describe("fetchRecentSnapshots with malformed response", () => {
    beforeEach(() => {
      // Mock successful token response
      mockFetch.setResponse("oauth2/token", {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "mock-token",
          token_type: "Bearer",
          expires_in: 3600
        })
      });

      // Mock prices response with missing data
      mockFetch.setResponse("prices", {
        ok: true,
        status: 200,
        json: async () => [
          {
            // Missing symbol, price, or timestamp
            currency: "KRW"
          }
        ]
      });
    });

    it("should return suspect snapshot when response data is incomplete", async () => {
      const snapshots = await provider.fetchRecentSnapshots(testAsset, new Date("2026-07-30T12:00:00Z"));

      expect(snapshots).toHaveLength(1);
      expect(snapshots[0]!.price).toBeUndefined();
      expect(snapshots[0]!.suspectReasons).toContain("toss_market_data_error: failed_to_fetch_price_data");
    });
  });

  describe("fetchRecentSnapshots with empty response", () => {
    beforeEach(() => {
      // Mock successful token response
      mockFetch.setResponse("oauth2/token", {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "mock-token",
          token_type: "Bearer",
          expires_in: 3600
        })
      });

      // Mock empty prices response
      mockFetch.setResponse("prices", {
        ok: true,
        status: 200,
        json: async () => []
      });
    });

    it("should return suspect snapshot when response is empty", async () => {
      const snapshots = await provider.fetchRecentSnapshots(testAsset, new Date("2026-07-30T12:00:00Z"));

      expect(snapshots).toHaveLength(1);
      expect(snapshots[0]!.price).toBeUndefined();
      expect(snapshots[0]!.suspectReasons[0]).toMatch(/toss_market_data_error/);
    });
  });

  describe("multiple symbols handling", () => {
    beforeEach(() => {
      mockFetch.setResponse("oauth2/token", {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "mock-token",
          token_type: "Bearer"
        })
      });

      mockFetch.setResponse("prices", {
        ok: true,
        status: 200,
        json: async () => [
          {
            symbol: "005930",
            lastPrice: "70500",
            currency: "KRW",
            timestamp: "2026-07-30T11:59:00Z"
          },
          {
            symbol: "000660",
            lastPrice: "120000",
            currency: "KRW",
            timestamp: "2026-07-30T11:59:00Z"
          }
        ]
      });
    });

    it("should handle batch requests (though provider only processes one asset at a time)", async () => {
      const snapshots = await provider.fetchRecentSnapshots(testAsset, new Date("2026-07-30T12:00:00Z"));

      // Provider returns only first match for the requested asset
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0]!.symbol).toBe("005930");
    });
  });

  describe("currency defaulting", () => {
    beforeEach(() => {
      mockFetch.setResponse("oauth2/token", {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "mock-token",
          token_type: "Bearer"
        })
      });

      mockFetch.setResponse("prices", {
        ok: true,
        status: 200,
        json: async () => [
          {
            symbol: "005930",
            lastPrice: "70500",
            // currency not provided - should default to KRW
            timestamp: "2026-07-30T11:59:00Z"
          }
        ]
      });
    });

    it("should default to KRW when currency is not in response", async () => {
      const snapshots = await provider.fetchRecentSnapshots(testAsset, new Date("2026-07-30T12:00:00Z"));

      expect(snapshots[0]!.price?.toString()).toBe("70500.000000 KRW");
    });
  });

  describe("interface compliance", () => {
    it("should implement MarketDataProvider interface", () => {
      const _provider: MarketDataProvider = provider;
      expect(_provider).toBeDefined();
      expect(typeof _provider.fetchRecentSnapshots).toBe("function");
    });
  });
});
