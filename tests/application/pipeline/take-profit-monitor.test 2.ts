/**
 * Tests for TakeProfitMonitor
 *
 * Verifies:
 * - Position monitoring and TP trigger detection
 * - Full and partial close scenarios
 * - Price cache integration
 * - Order execution and logging
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { TakeProfitMonitor } from "../../../src/application/pipeline/take-profit-monitor.js";
import type { Broker } from "../../../src/persistence/price-cache-repository.js";

describe("TakeProfitMonitor", () => {
  let monitor: TakeProfitMonitor;
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

    monitor = new TakeProfitMonitor(mockDB, mockPriceCache as any, 1.0); // Full close by default
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

    it("should detect take-profit trigger when price reaches TP", async () => {
      // Setup
      const position = {
        id: "pos-1",
        symbol: "005930",
        quantity: 10,
        entry_price: 70000,
        entry_date: new Date().toISOString(),
        stop_loss_price: 66500,
        take_profit_price: 77000, // 10% above entry
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
        priceMajor: "77000", // At TP level
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
        currentPrice: 77000
      });
    });

    it("should not trigger when price is below TP", async () => {
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
        priceMajor: "75000", // Below TP
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

    it("should detect take-profit trigger when price exceeds TP", async () => {
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
        priceMajor: "78000", // Above TP
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
      expect(results[0]!.triggered).toBe(true);
    });
  });

  describe("P&L Calculation", () => {
    it("should calculate positive P&L when take-profit is triggered", async () => {
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
        priceMajor: "77000", // Exit at TP
        priceCurrency: "KRW",
        timestamp: new Date(),
        ttlSeconds: 60
      };

      // Expected P&L: (77000 - 70000) * 10 = 70000
      const expectedPnL = (77000 - 70000) * 10; // 70000
      const expectedPnLPercent = ((77000 - 70000) / 70000) * 100; // 10%

      // Mock DB query
      const preparedStmt = { all: vi.fn().mockResolvedValue({ results: [position] }) };
      mockDB.prepare.mockReturnValue(preparedStmt);

      // Mock price cache
      mockPriceCache.getCurrentPrice.mockResolvedValue(cachedPrice);

      // Execute
      const results = await monitor.evaluatePositions();

      // Assert
      expect(results[0]!.pnl!).toBe(expectedPnL);
      expect(Math.abs(results[0]!.pnlPercent! - expectedPnLPercent) < 0.01).toBe(true);
    });
  });

  describe("Partial Close", () => {
    it("should support partial close at 50%", async () => {
      // Setup with 50% partial close ratio
      const partialMonitor = new TakeProfitMonitor(mockDB, mockPriceCache as any, 0.5);

      const position = {
        id: "pos-1",
        symbol: "005930",
        quantity: 100,
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
        priceMajor: "77000",
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

      // Assert - should close 50 shares (50% of 100)
      expect(results).toHaveLength(1);
      expect(results[0]!.closeQuantity!).toBe(50);
      expect(results[0]!.partialClose!).toBe(true);
    });

    it("should support full close when ratio is 1.0", async () => {
      // Setup with full close ratio (1.0)
      const fullMonitor = new TakeProfitMonitor(mockDB, mockPriceCache as any, 1.0);

      const position = {
        id: "pos-1",
        symbol: "005930",
        quantity: 100,
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
        priceMajor: "77000",
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

      // Assert - should close all 100 shares
      expect(results).toHaveLength(1);
      expect(results[0]!.closeQuantity!).toBe(100);
      expect(results[0]!.partialClose!).toBe(false);
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
        priceMajor: "77000",
        priceCurrency: "KRW",
        timestamp: new Date(),
        ttlSeconds: 60
      };

      const tossCachedPrice = {
        id: "price-toss",
        symbol: "005930",
        broker: "TOSS",
        priceMajor: "78000",
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

      // Assert - should trigger for both (KIS at 77000 >= 77000, TOSS at 78000 >= 78100 is false, so only KIS)
      expect(results).toHaveLength(1);
      expect(results[0]!.positionId!).toBe("kis-pos-1");
    });
  });
});
