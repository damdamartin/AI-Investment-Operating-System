import { describe, it, expect, beforeEach, vi } from "vitest";
import { PerformanceAggregator } from "../../../src/application/analytics/performance-aggregator.js";
import { PerformanceRepository } from "../../../src/persistence/performance-repository.js";
import type { Position, Order } from "../../../src/application/analytics/performance-aggregator.js";

/**
 * Mock PerformanceRepository for testing
 */
class MockPerformanceRepository extends PerformanceRepository {
  private dailyPerformanceData: Map<string, any> = new Map();
  private symbolPerformanceData: Map<string, any> = new Map();
  private monthlyPerformanceData: Map<string, any> = new Map();
  private positionClosedEvents: any[] = [];

  constructor() {
    super(null as any);
  }

  async getDailyPerformance(tradingDate: string, broker: "KIS" | "TOSS") {
    const key = `${tradingDate}-${broker}`;
    return this.dailyPerformanceData.get(key) || null;
  }

  async updateDailyPerformance(
    tradingDate: string,
    broker: "KIS" | "TOSS",
    data: any
  ) {
    const key = `${tradingDate}-${broker}`;
    const existing = this.dailyPerformanceData.get(key);

    const updated = {
      id: existing?.id || Math.random(),
      tradingDate,
      broker,
      ...data,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.dailyPerformanceData.set(key, updated);
    return updated;
  }

  async getSymbolPerformance(symbol: string, broker: "KIS" | "TOSS") {
    const key = `${symbol}-${broker}`;
    return this.symbolPerformanceData.get(key) || null;
  }

  async updateSymbolPerformance(symbol: string, broker: "KIS" | "TOSS", data: any) {
    const key = `${symbol}-${broker}`;
    const existing = this.symbolPerformanceData.get(key);

    const updated = {
      id: existing?.id || Math.random(),
      symbol,
      broker,
      ...data,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.symbolPerformanceData.set(key, updated);
    return updated;
  }

  async getMonthlyPerformance(year: number, month: number, broker: "KIS" | "TOSS") {
    const key = `${year}-${month}-${broker}`;
    return this.monthlyPerformanceData.get(key) || null;
  }

  async updateMonthlyPerformance(year: number, month: number, broker: "KIS" | "TOSS", data: any) {
    const key = `${year}-${month}-${broker}`;

    const updated = {
      id: Math.random(),
      year,
      month,
      broker,
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.monthlyPerformanceData.set(key, updated);
    return updated;
  }

  async recordPositionClosed(event: any) {
    this.positionClosedEvents.push(event);
    return { id: Math.random(), ...event };
  }

  async getClosedPositionsInRange(startDate: string, endDate: string, broker: "KIS" | "TOSS") {
    return this.positionClosedEvents.filter(
      e => e.broker === broker && e.exitedAt >= startDate && e.exitedAt <= endDate
    );
  }

  // Getters for testing
  getDailyPerformanceData() {
    return Array.from(this.dailyPerformanceData.values());
  }

  getSymbolPerformanceData() {
    return Array.from(this.symbolPerformanceData.values());
  }

  getMonthlyPerformanceData() {
    return Array.from(this.monthlyPerformanceData.values());
  }

  getPositionClosedEvents() {
    return this.positionClosedEvents;
  }
}

describe("PerformanceAggregator", () => {
  let aggregator: PerformanceAggregator;
  let mockRepository: MockPerformanceRepository;

  const mockPosition: Position = {
    id: "pos-1",
    symbol: "005930",
    quantity: 10,
    entry_price: 50000,
    entry_date: "2026-08-01",
    stop_loss_price: 45000,
    take_profit_price: 55000,
    broker: "KIS",
  };

  const mockOrder: Order = {
    id: "order-1",
    positionId: "pos-1",
    side: "SELL",
    quantity: 10,
    price: 52000,
    executedAt: new Date().toISOString(),
    status: "EXECUTED",
  };

  beforeEach(() => {
    mockRepository = new MockPerformanceRepository();
    aggregator = new PerformanceAggregator(mockRepository, null);
  });

  describe("recordTradeCompletion", () => {
    it("should record a winning trade (take-profit)", async () => {
      const closedPrice = 55000; // Above TP
      await aggregator.recordTradeCompletion(mockPosition, closedPrice, "TP", mockOrder);

      const dailyData = mockRepository.getDailyPerformanceData();
      expect(dailyData).toHaveLength(1);

      const daily = dailyData[0]!;
      expect(daily.tradingDate).toBe(new Date().toISOString().split("T")[0]);
      expect(daily.broker).toBe("KIS");
      expect(daily.totalTrades).toBe(1);
      expect(daily.winningTrades).toBe(1);
      expect(daily.losingTrades).toBe(0);
      expect(daily.totalPnl).toBe(50000); // (55000 - 50000) * 10
      expect(daily.winRate).toBe(100);
      expect(daily.tpTriggeredCount).toBe(1);
    });

    it("should record a losing trade (stop-loss)", async () => {
      const closedPrice = 45000; // Below SL
      await aggregator.recordTradeCompletion(mockPosition, closedPrice, "SL", mockOrder);

      const dailyData = mockRepository.getDailyPerformanceData();
      expect(dailyData).toHaveLength(1);

      const daily = dailyData[0]!;
      expect(daily.totalTrades).toBe(1);
      expect(daily.winningTrades).toBe(0);
      expect(daily.losingTrades).toBe(1);
      expect(daily.totalPnl).toBe(-50000); // (45000 - 50000) * 10
      expect(daily.winRate).toBe(0);
      expect(daily.slTriggeredCount).toBe(1);
    });

    it("should update symbol performance", async () => {
      const closedPrice = 55000;
      await aggregator.recordTradeCompletion(mockPosition, closedPrice, "TP", mockOrder);

      const symbolData = mockRepository.getSymbolPerformanceData();
      expect(symbolData).toHaveLength(1);

      const symbol = symbolData[0]!;
      expect(symbol.symbol).toBe("005930");
      expect(symbol.broker).toBe("KIS");
      expect(symbol.totalTrades).toBe(1);
      expect(symbol.winningTrades).toBe(1);
      expect(symbol.totalPnl).toBe(50000);
      expect(symbol.winRate).toBe(100);
    });

    it("should record position closed event", async () => {
      const closedPrice = 55000;
      await aggregator.recordTradeCompletion(mockPosition, closedPrice, "TP", mockOrder);

      const events = mockRepository.getPositionClosedEvents();
      expect(events).toHaveLength(1);

      const event = events[0]!;
      expect(event.positionId).toBe("pos-1");
      expect(event.symbol).toBe("005930");
      expect(event.exitPrice).toBe(55000);
      expect(event.exitReason).toBe("TAKE_PROFIT");
      expect(event.pnl).toBe(50000);
    });

    it("should aggregate multiple trades (win rate calculation)", async () => {
      // First trade: win
      await aggregator.recordTradeCompletion(mockPosition, 55000, "TP", mockOrder);

      // Second trade: loss
      const lossPosition: Position = { ...mockPosition, id: "pos-2" };
      await aggregator.recordTradeCompletion(lossPosition, 45000, "SL", mockOrder);

      const dailyData = mockRepository.getDailyPerformanceData();
      expect(dailyData).toHaveLength(1); // Same day

      const daily = dailyData[0]!;
      expect(daily.totalTrades).toBe(2);
      expect(daily.winningTrades).toBe(1);
      expect(daily.losingTrades).toBe(1);
      expect(daily.winRate).toBe(50);
      expect(daily.totalPnl).toBe(0); // Breaks even
    });

    it("should handle different brokers separately", async () => {
      // KIS trade
      await aggregator.recordTradeCompletion(mockPosition, 55000, "TP", mockOrder);

      // TOSS trade
      const tossPosition: Position = { ...mockPosition, broker: "TOSS", id: "pos-2" };
      await aggregator.recordTradeCompletion(tossPosition, 45000, "SL", mockOrder);

      const dailyData = mockRepository.getDailyPerformanceData();
      expect(dailyData).toHaveLength(2); // Separate records

      const kis = dailyData.find(d => d.broker === "KIS")!;
      const toss = dailyData.find(d => d.broker === "TOSS")!;

      expect(kis.totalPnl).toBe(50000);
      expect(toss.totalPnl).toBe(-50000);
      expect(kis.winRate).toBe(100);
      expect(toss.winRate).toBe(0);
    });
  });

  describe("aggregateMonthlyPerformance", () => {
    it("should aggregate monthly performance from closed positions", async () => {
      // Record 5 trades: 3 wins, 2 losses
      const trades = [
        { position: mockPosition, price: 55000, trigger: "TP" as const }, // Win: 50k
        { position: { ...mockPosition, id: "pos-2" }, price: 45000, trigger: "SL" as const }, // Loss: -50k
        { position: { ...mockPosition, id: "pos-3" }, price: 56000, trigger: "TP" as const }, // Win: 60k
        { position: { ...mockPosition, id: "pos-4" }, price: 44000, trigger: "SL" as const }, // Loss: -60k
        { position: { ...mockPosition, id: "pos-5" }, price: 54000, trigger: "TP" as const }, // Win: 40k
      ];

      for (const trade of trades) {
        await aggregator.recordTradeCompletion(
          trade.position,
          trade.price,
          trade.trigger === "TP" ? "TP" : "SL",
          mockOrder
        );
      }

      // Aggregate for the current month
      const now = new Date();
      await aggregator.aggregateMonthlyPerformance(now, "KIS");

      const monthlyData = mockRepository.getMonthlyPerformanceData();
      expect(monthlyData).toHaveLength(1);

      const monthly = monthlyData[0]!;
      expect(monthly.tradesCount).toBe(5);
      expect(monthly.totalPnl).toBe(40000); // 50k - 50k + 60k - 60k + 40k
      expect(monthly.winRate).toBeCloseTo(60); // 3/5
    });

    it("should return zero metrics for empty month", async () => {
      const now = new Date();
      await aggregator.aggregateMonthlyPerformance(now, "KIS");

      const monthlyData = mockRepository.getMonthlyPerformanceData();
      expect(monthlyData).toHaveLength(1);

      const monthly = monthlyData[0]!;
      expect(monthly.tradesCount).toBe(0);
      expect(monthly.totalPnl).toBe(0);
      expect(monthly.winRate).toBe(0);
    });

    it("should calculate metrics correctly", async () => {
      // Add multiple trades to test Sharpe ratio and max drawdown
      const positions = [
        { position: mockPosition, price: 55000 }, // Win: 50k
        { position: { ...mockPosition, id: "pos-2" }, price: 48000 }, // Loss: -20k
        { position: { ...mockPosition, id: "pos-3" }, price: 56000 }, // Win: 60k
      ];

      for (const { position, price } of positions) {
        await aggregator.recordTradeCompletion(
          position,
          price,
          price > position.entry_price ? "TP" : "SL",
          mockOrder
        );
      }

      const now = new Date();
      await aggregator.aggregateMonthlyPerformance(now, "KIS");

      const monthlyData = mockRepository.getMonthlyPerformanceData();
      const monthly = monthlyData[0]!;

      expect(monthly.tradesCount).toBe(3);
      expect(monthly.totalPnl).toBe(90000); // 50k - 20k + 60k
      expect(monthly.winRate).toBeCloseTo(66.67, 1); // 2/3
      expect(typeof monthly.sharpeRatio).toBe("number");
      expect(typeof monthly.maxDrawdown).toBe("number");
    });
  });

  describe("edge cases", () => {
    it("should handle break-even trades", async () => {
      await aggregator.recordTradeCompletion(
        mockPosition,
        mockPosition.entry_price, // Exact entry price
        "TP",
        mockOrder
      );

      const dailyData = mockRepository.getDailyPerformanceData();
      const daily = dailyData[0]!;

      expect(daily.totalPnl).toBe(0);
      expect(daily.totalTrades).toBe(1);
      // Break-even trades don't count as wins or losses
      expect(daily.winningTrades).toBe(0);
      expect(daily.losingTrades).toBe(0);
    });

    it("should handle very small profits", async () => {
      const almostBreakEven: Position = {
        ...mockPosition,
        entry_price: 50000,
      };

      await aggregator.recordTradeCompletion(almostBreakEven, 50001, "TP", mockOrder);

      const dailyData = mockRepository.getDailyPerformanceData();
      const daily = dailyData[0]!;

      expect(daily.totalPnl).toBe(10); // (50001 - 50000) * 10
      expect(daily.winningTrades).toBe(1);
    });

    it("should handle very small losses", async () => {
      const almostBreakEven: Position = {
        ...mockPosition,
        entry_price: 50000,
      };

      await aggregator.recordTradeCompletion(almostBreakEven, 49999, "SL", mockOrder);

      const dailyData = mockRepository.getDailyPerformanceData();
      const daily = dailyData[0]!;

      expect(daily.totalPnl).toBe(-10); // (49999 - 50000) * 10
      expect(daily.losingTrades).toBe(1);
    });

    it("should handle large quantities", async () => {
      const largePosition: Position = {
        ...mockPosition,
        quantity: 1000,
      };

      await aggregator.recordTradeCompletion(largePosition, 55000, "TP", mockOrder);

      const dailyData = mockRepository.getDailyPerformanceData();
      const daily = dailyData[0]!;

      expect(daily.totalPnl).toBe(5000000); // (55000 - 50000) * 1000
    });

    it("should handle multiple calls on same day", async () => {
      // First call
      await aggregator.recordTradeCompletion(mockPosition, 55000, "TP", mockOrder);
      let dailyData = mockRepository.getDailyPerformanceData();
      expect(dailyData[0]!.totalTrades).toBe(1);

      // Second call on same day
      const position2: Position = { ...mockPosition, id: "pos-2" };
      await aggregator.recordTradeCompletion(position2, 45000, "SL", mockOrder);
      dailyData = mockRepository.getDailyPerformanceData();
      expect(dailyData[0]!.totalTrades).toBe(2);
    });
  });
});
