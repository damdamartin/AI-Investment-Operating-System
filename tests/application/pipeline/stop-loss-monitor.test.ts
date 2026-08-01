/**
 * Tests for StopLossMonitor
 *
 * Verifies:
 * - Position monitoring and SL trigger detection
 * - Price cache integration
 * - Order execution and logging
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { StopLossMonitor } from "../../../src/application/pipeline/stop-loss-monitor.js";
import type { PriceCacheRepository, Broker } from "../../../src/persistence/price-cache-repository.js";

describe("StopLossMonitor", () => {
  let monitor: StopLossMonitor;
  let mockDB: any;
  let mockPriceCache: any;

  beforeEach(() => {
    // Mock D1Database
    mockDB = {
      prepare: vi.fn((sql: string) => ({
        all: vi.fn(),
        bind: vi.fn(function (...params) {
          return {
            all: vi.fn(),
            run: vi.fn()
          };
        }),
        run: vi.fn()
      }))
    };

    // Mock PriceCacheRepository
    mockPriceCache = {
      getCurrentPrice: vi.fn()
    };

    monitor = new StopLossMonitor(mockDB, mockPriceCache as any);
  });

  describe("evaluatePositions", () => {
    it("should return empty array when no open positions exist", async () => {
      // Setup
      const preparedStmt = { all: vi.fn().mockResolvedValue({ results: [] }) };
      mockDB.prepare.mockReturnValue(preparedStmt);

      // Execute
      const results = await monitor.evaluatePositions();

      // Assert
      expect(results).toEqual([]);
      expect(preparedStmt.all).toHaveBeenCalled();
    });

    it("should detect stop-loss trigger when price falls below SL", async () => {
      // Setup
      const position = {
        id: "pos-1",
        symbol: "005930",
        quantity: 10,
        entry_price: 70000,
        entry_date: new Date().toISOString(),
        stop_loss_price: 66500, // 5% below entry
        take_profit_price: 77000,
        status: "OPEN",
        broker: "KIS",
        team: "KIS",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const cachedPrice = {
        id: "price-1",
        symbol: "005930",
        broker: "KIS",
        priceMajor: "66000", // Below SL
        priceCurrency: "KRW",
        timestamp: new Date(),
        ttlSeconds: 60
      };

      // Mock DB query
      const preparedStmt = { all: vi.fn().mockResolvedValue({ results: [position] }) };
      mockDB.prepare.mockReturnValue(preparedStmt);

      // Mock price cache
      mockPriceCache.getCurrentPrice.mockResolvedValue(cachedPrice);

      // Execute
      const results = await monitor.evaluatePositions();

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        triggered: true,
        positionId: "pos-1",
        symbol: "005930",
        currentPrice: 66000
      });
    });

    it("should not trigger when price is above SL", async () => {
      // Setup
      const position = {
        id: "pos-1",
        symbol: "005930",
        quantity: 10,
        entry_price: 70000,
        entry_date: new Date().toISOString(),
        stop_loss_price: 66500,
        take_profit_price: 77000,
        status: "OPEN",
        broker: "KIS",
        team: "KIS",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const cachedPrice = {
        id: "price-1",
        symbol: "005930",
        broker: "KIS",
        priceMajor: "68000", // Above SL
        priceCurrency: "KRW",
        timestamp: new Date(),
        ttlSeconds: 60
      };

      // Mock DB query
      const preparedStmt = { all: vi.fn().mockResolvedValue({ results: [position] }) };
      mockDB.prepare.mockReturnValue(preparedStmt);

      // Mock price cache
      mockPriceCache.getCurrentPrice.mockResolvedValue(cachedPrice);

      // Execute
      const results = await monitor.evaluatePositions();

      // Assert
      expect(results).toHaveLength(0);
    });

    it("should skip positions without cached price", async () => {
      // Setup
      const position = {
        id: "pos-1",
        symbol: "005930",
        quantity: 10,
        entry_price: 70000,
        entry_date: new Date().toISOString(),
        stop_loss_price: 66500,
        take_profit_price: 77000,
        status: "OPEN",
        broker: "KIS",
        team: "KIS",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Mock DB query
      const preparedStmt = { all: vi.fn().mockResolvedValue({ results: [position] }) };
      mockDB.prepare.mockReturnValue(preparedStmt);

      // Mock price cache - return null (price not cached)
      mockPriceCache.getCurrentPrice.mockResolvedValue(null);

      // Execute
      const results = await monitor.evaluatePositions();

      // Assert
      expect(results).toHaveLength(0);
    });
  });

  describe("P&L Calculation", () => {
    it("should calculate negative P&L when stop-loss is triggered", async () => {
      // Setup
      const position = {
        id: "pos-1",
        symbol: "005930",
        quantity: 10,
        entry_price: 70000,
        entry_date: new Date().toISOString(),
        stop_loss_price: 66500,
        take_profit_price: 77000,
        status: "OPEN",
        broker: "KIS",
        team: "KIS",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const cachedPrice = {
        id: "price-1",
        symbol: "005930",
        broker: "KIS",
        priceMajor: "66000", // Exit at this price
        priceCurrency: "KRW",
        timestamp: new Date(),
        ttlSeconds: 60
      };

      // Expected P&L: (66000 - 70000) * 10 = -40000
      const expectedPnL = (66000 - 70000) * 10; // -40000
      const expectedPnLPercent = ((66000 - 70000) / 70000) * 100; // ~-5.71%

      // Mock DB query
      const preparedStmt = { all: vi.fn().mockResolvedValue({ results: [position] }) };
      mockDB.prepare.mockReturnValue(preparedStmt);

      // Mock price cache
      mockPriceCache.getCurrentPrice.mockResolvedValue(cachedPrice);

      // Execute
      const results = await monitor.evaluatePositions();

      // Assert
      expect(results[0].pnl).toBe(expectedPnL);
      expect(Math.abs(results[0].pnlPercent! - expectedPnLPercent) < 0.01).toBe(true);
    });
  });

  describe("Broker Separation", () => {
    it("should handle multiple positions from different brokers", async () => {
      // Setup
      const positions = [
        {
          id: "kis-pos-1",
          symbol: "005930",
          quantity: 10,
          entry_price: 70000,
          entry_date: new Date().toISOString(),
          stop_loss_price: 66500,
          take_profit_price: 77000,
          status: "OPEN",
          broker: "KIS",
          team: "KIS",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: "toss-pos-1",
          symbol: "005930",
          quantity: 5,
          entry_price: 71000,
          entry_date: new Date().toISOString(),
          stop_loss_price: 67450,
          take_profit_price: 78100,
          status: "OPEN",
          broker: "TOSS",
          team: "Toss",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];

      const kisCachedPrice = {
        id: "price-kis",
        symbol: "005930",
        broker: "KIS",
        priceMajor: "66000",
        priceCurrency: "KRW",
        timestamp: new Date(),
        ttlSeconds: 60
      };

      const tossCachedPrice = {
        id: "price-toss",
        symbol: "005930",
        broker: "TOSS",
        priceMajor: "67000",
        priceCurrency: "KRW",
        timestamp: new Date(),
        ttlSeconds: 60
      };

      // Mock DB query
      const preparedStmt = { all: vi.fn().mockResolvedValue({ results: positions }) };
      mockDB.prepare.mockReturnValue(preparedStmt);

      // Mock price cache - return different prices for different brokers
      mockPriceCache.getCurrentPrice.mockImplementation((symbol: string, broker: Broker) => {
        if (broker === "KIS") return Promise.resolve(kisCachedPrice);
        if (broker === "TOSS") return Promise.resolve(tossCachedPrice);
        return Promise.resolve(null);
      });

      // Execute
      const results = await monitor.evaluatePositions();

      // Assert - should trigger for KIS (66000 < 66500) but not for TOSS (67000 > 67450)
      expect(results).toHaveLength(1);
      expect(results[0].positionId).toBe("kis-pos-1");
    });
  });
});
