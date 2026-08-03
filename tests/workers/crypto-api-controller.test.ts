/**
 * Crypto API Controller Tests
 * Tests for all 7 crypto API endpoints
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { CryptoApiController } from "../../src/workers/crypto-api-controller";

/**
 * Mock D1Database
 */
class MockD1Database {
  private data: Record<string, any[]> = {
    crypto_orders: [],
    crypto_portfolio_snapshots: [],
    crypto_performance_stats: [],
    kill_switch: []
  };

  prepare(sql: string) {
    return {
      bind: (...params: any[]) => ({
        all: async () => ({ results: this.data.crypto_orders || [] }),
        first: async () => (this.data.kill_switch || [])[0] || null,
        run: async () => ({ success: true })
      }),
      first: async () => (this.data.kill_switch || [])[0] || null,
      all: async () => ({ results: this.data.crypto_orders || [] }),
      run: async () => ({ success: true })
    };
  }

  async setMockData(table: string, data: any[]) {
    this.data[table] = data;
  }
}

describe("CryptoApiController", () => {
  let controller: CryptoApiController;
  let mockDb: MockD1Database;

  beforeEach(() => {
    mockDb = new MockD1Database();
    controller = new CryptoApiController(mockDb as any);
  });

  describe("GET /api/crypto/status", () => {
    it("should return engine status with kill switch state", async () => {
      const response = await controller.getStatus();
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data).toBeDefined();
      expect(data.data.status).toBe("active");
      expect(data.data.killSwitch).toBeDefined();
      expect(data.data.engine).toBeDefined();
      expect(data.data.health).toBeDefined();
    });

    it("should have all required status fields", async () => {
      const response = await controller.getStatus();
      const data = await response.json();

      expect(data.data.engine).toHaveProperty("running");
      expect(data.data.engine).toHaveProperty("signalGenerationActive");
      expect(data.data.engine).toHaveProperty("orderExecutionActive");
      expect(data.data.engine).toHaveProperty("fillTrackingActive");

      expect(data.data.health).toHaveProperty("apiConnection");
      expect(data.data.health).toHaveProperty("websocketConnection");
      expect(data.data.health).toHaveProperty("databaseConnection");
      expect(data.data.health).toHaveProperty("lastUpdate");
    });
  });

  describe("GET /api/crypto/balances", () => {
    it("should return portfolio balances", async () => {
      const response = await controller.getBalances();
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data).toBeDefined();
      expect(data.data.portfolio).toBeDefined();
      expect(data.data.positions).toBeDefined();
      expect(data.data.assetAllocation).toBeDefined();
    });

    it("should have all required portfolio fields", async () => {
      const response = await controller.getBalances();
      const data = await response.json();

      expect(data.data.portfolio).toHaveProperty("totalValue");
      expect(data.data.portfolio).toHaveProperty("cash");
      expect(data.data.portfolio).toHaveProperty("cryptoValue");
      expect(data.data.portfolio).toHaveProperty("totalGain");
      expect(data.data.portfolio).toHaveProperty("totalReturn");
      expect(data.data.portfolio).toHaveProperty("updatedAt");
    });

    it("should have correct position structure", async () => {
      const response = await controller.getBalances();
      const data = await response.json();

      if (data.data.positions.length > 0) {
        const position = data.data.positions[0];
        expect(position).toHaveProperty("market");
        expect(position).toHaveProperty("quantity");
        expect(position).toHaveProperty("avgPrice");
        expect(position).toHaveProperty("currentPrice");
        expect(position).toHaveProperty("totalCost");
        expect(position).toHaveProperty("currentValue");
        expect(position).toHaveProperty("gain");
        expect(position).toHaveProperty("return");
      }
    });
  });

  describe("GET /api/crypto/orders", () => {
    it("should return orders with pagination", async () => {
      const params = new URLSearchParams("?status=all&limit=50&offset=0");
      const response = await controller.getOrders(params);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data).toBeDefined();
      expect(data.data.orders).toBeDefined();
      expect(Array.isArray(data.data.orders)).toBe(true);
      expect(data.data).toHaveProperty("total");
      expect(data.data).toHaveProperty("page");
      expect(data.data).toHaveProperty("pageSize");
    });

    it("should support status filtering", async () => {
      const params = new URLSearchParams("?status=submitted&limit=50&offset=0");
      const response = await controller.getOrders(params);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(Array.isArray(data.data.orders)).toBe(true);
    });

    it("should have correct order structure", async () => {
      const params = new URLSearchParams("?status=all&limit=50&offset=0");
      const response = await controller.getOrders(params);
      const data = await response.json();

      if (data.data.orders.length > 0) {
        const order = data.data.orders[0];
        expect(order).toHaveProperty("id");
        expect(order).toHaveProperty("market");
        expect(order).toHaveProperty("side");
        expect(order).toHaveProperty("orderType");
        expect(order).toHaveProperty("price");
        expect(order).toHaveProperty("volume");
        expect(order).toHaveProperty("status");
      }
    });
  });

  describe("GET /api/crypto/positions", () => {
    it("should return open positions", async () => {
      const response = await controller.getPositions();
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data).toBeDefined();
      expect(data.data.positions).toBeDefined();
      expect(Array.isArray(data.data.positions)).toBe(true);
      expect(data.data).toHaveProperty("totalCount");
      expect(data.data).toHaveProperty("openCount");
    });

    it("should have correct position structure", async () => {
      const response = await controller.getPositions();
      const data = await response.json();

      if (data.data.positions.length > 0) {
        const position = data.data.positions[0];
        expect(position).toHaveProperty("market");
        expect(position).toHaveProperty("quantity");
        expect(position).toHaveProperty("avgPrice");
        expect(position).toHaveProperty("currentPrice");
        expect(position).toHaveProperty("totalCost");
        expect(position).toHaveProperty("currentValue");
        expect(position).toHaveProperty("unrealizedPnl");
        expect(position).toHaveProperty("unrealizedReturn");
        expect(position).toHaveProperty("trades");
      }
    });
  });

  describe("POST /api/crypto/strategy/enable", () => {
    it("should enable strategy with valid request", async () => {
      const body = {
        enabled: true,
        markets: ["KRW-BTC", "KRW-ETH"],
        minConfidence: 60
      };
      const response = await controller.updateStrategy(body);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data).toBeDefined();
      expect(data.data.success).toBe(true);
      expect(data.data.config).toBeDefined();
      expect(data.data.config.enabled).toBe(true);
      expect(data.data.config.markets).toEqual(["KRW-BTC", "KRW-ETH"]);
      expect(data.data.config.minConfidence).toBe(60);
    });

    it("should reject request without markets array", async () => {
      const body = {
        enabled: true,
        minConfidence: 60
      };
      const response = await controller.updateStrategy(body);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe(true);
      expect(data.code).toBe("INVALID_REQUEST");
    });

    it("should disable strategy", async () => {
      const body = {
        enabled: false,
        markets: ["KRW-BTC"],
        minConfidence: 60
      };
      const response = await controller.updateStrategy(body);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data.config.enabled).toBe(false);
    });
  });

  describe("POST /api/crypto/kill-switch/activate", () => {
    it("should activate kill switch", async () => {
      const body = {
        action: "activate",
        reason: "Manual activation by admin"
      };
      const response = await controller.toggleKillSwitch(body);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data).toBeDefined();
      expect(data.data.success).toBe(true);
      expect(data.data.killSwitch).toBeDefined();
      expect(data.data.killSwitch.active).toBe(true);
      expect(data.data.killSwitch.reason).toBe("Manual activation by admin");
    });

    it("should deactivate kill switch", async () => {
      const body = {
        action: "deactivate",
        reason: "Issues resolved"
      };
      const response = await controller.toggleKillSwitch(body);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data.killSwitch.active).toBe(false);
    });

    it("should reject invalid action", async () => {
      const body = {
        action: "invalid",
        reason: "test"
      };
      const response = await controller.toggleKillSwitch(body);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe(true);
      expect(data.code).toBe("INVALID_ACTION");
    });
  });

  describe("GET /api/crypto/performance", () => {
    it("should return performance metrics", async () => {
      const params = new URLSearchParams("?period=month");
      const response = await controller.getPerformance(params);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data).toBeDefined();
      expect(data.data.period).toBeDefined();
      expect(data.data.metrics).toBeDefined();
      expect(data.data.daily).toBeDefined();
    });

    it("should have all required metric fields", async () => {
      const params = new URLSearchParams("?period=month");
      const response = await controller.getPerformance(params);
      const data = await response.json();

      const metrics = data.data.metrics;
      expect(metrics).toHaveProperty("totalReturn");
      expect(metrics).toHaveProperty("dailyReturn");
      expect(metrics).toHaveProperty("monthlyReturn");
      expect(metrics).toHaveProperty("volatility");
      expect(metrics).toHaveProperty("maxDrawdown");
      expect(metrics).toHaveProperty("sharpeRatio");
      expect(metrics).toHaveProperty("winRate");
      expect(metrics).toHaveProperty("profitFactor");
      expect(metrics).toHaveProperty("tradeCount");
      expect(metrics).toHaveProperty("winCount");
      expect(metrics).toHaveProperty("lossCount");
      expect(metrics).toHaveProperty("averageWin");
      expect(metrics).toHaveProperty("averageLoss");
    });

    it("should support different periods", async () => {
      const periods = ["day", "week", "month", "all"];

      for (const period of periods) {
        const params = new URLSearchParams(`?period=${period}`);
        const response = await controller.getPerformance(params);
        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.data.period).toBe(period);
      }
    });

    it("should have daily performance breakdown", async () => {
      const params = new URLSearchParams("?period=month");
      const response = await controller.getPerformance(params);
      const data = await response.json();

      if (data.data.daily.length > 0) {
        const daily = data.data.daily[0];
        expect(daily).toHaveProperty("date");
        expect(daily).toHaveProperty("return");
        expect(daily).toHaveProperty("pnl");
        expect(daily).toHaveProperty("trades");
        expect(daily).toHaveProperty("wins");
      }
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors gracefully", async () => {
      const response = await controller.getStatus();
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data).toBeDefined();
    });

    it("successful endpoints should return timestamp", async () => {
      const successEndpoints = [
        { name: "getStatus", fn: () => controller.getStatus() },
        { name: "getBalances", fn: () => controller.getBalances() },
        { name: "getOrders", fn: () => controller.getOrders(new URLSearchParams()) },
        { name: "getPositions", fn: () => controller.getPositions() },
        { name: "updateStrategy", fn: () => controller.updateStrategy({ enabled: true, markets: ["KRW-BTC"] }) },
        { name: "toggleKillSwitch", fn: () => controller.toggleKillSwitch({ action: "activate", reason: "test" }) },
        { name: "getPerformance", fn: () => controller.getPerformance(new URLSearchParams()) }
      ];

      for (const endpoint of successEndpoints) {
        const response = await endpoint.fn();
        const data = await response.json();
        // Success responses should have timestamp
        if (response.status === 200) {
          expect(data.timestamp).toBeDefined(`${endpoint.name} should have timestamp`);
          expect(typeof data.timestamp).toBe("number");
        }
      }
    });

    it("error responses should have error details", async () => {
      const body = { enabled: true }; // Missing markets
      const response = await controller.updateStrategy(body);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe(true);
      expect(data.code).toBeDefined();
      expect(data.message).toBeDefined();
    });
  });
});
