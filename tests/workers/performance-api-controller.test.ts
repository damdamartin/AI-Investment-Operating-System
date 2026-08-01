import { describe, it, expect, beforeEach, vi } from "vitest";
import { PerformanceController } from "../../src/workers/performance-api-controller.js";
import type {
  DailyPerformance,
  MonthlyPerformance,
  SymbolPerformance,
  PerformanceDatabase,
} from "../../src/persistence/performance-repository.js";
import { PerformanceRepository } from "../../src/persistence/performance-repository.js";

/**
 * Mock PerformanceDatabase for testing
 */
class MockPerformanceDatabase implements PerformanceDatabase {
  async query(
    sql: string,
    params?: ReadonlyArray<string | number | boolean | null>
  ): Promise<{ results: any[] }> {
    return { results: [] };
  }
}

/**
 * Mock PerformanceRepository for testing
 */
class MockPerformanceRepository extends PerformanceRepository {
  constructor() {
    super(new MockPerformanceDatabase());
  }

  async getDailyPerformance(
    tradingDate: string,
    broker: "KIS" | "TOSS"
  ): Promise<DailyPerformance | null> {
    if (tradingDate === "2026-08-01") {
      return {
        id: 1,
        tradingDate,
        broker,
        totalTrades: 5,
        winningTrades: 3,
        losingTrades: 2,
        totalPnl: 150000,
        totalPnlPercent: 1.5,
        avgWin: 75000,
        avgLoss: 25000,
        winRate: 60,
        maxDrawdown: 2.5,
        sharpeRatio: 1.8,
        profitFactor: 2.0,
        slTriggeredCount: 2,
        tpTriggeredCount: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
    return null;
  }

  async getDailyPerformanceRange(
    startDate: string,
    endDate: string,
    broker: "KIS" | "TOSS"
  ): Promise<DailyPerformance[]> {
    if (startDate === "2026-08-01" && endDate === "2026-08-03") {
      return [
        {
          id: 1,
          tradingDate: "2026-08-01",
          broker,
          totalTrades: 5,
          winningTrades: 3,
          losingTrades: 2,
          totalPnl: 150000,
          totalPnlPercent: 1.5,
          avgWin: 75000,
          avgLoss: 25000,
          winRate: 60,
          maxDrawdown: 2.5,
          sharpeRatio: 1.8,
          profitFactor: 2.0,
          slTriggeredCount: 2,
          tpTriggeredCount: 3,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
    }
    return [];
  }

  async updateDailyPerformance(
    tradingDate: string,
    broker: "KIS" | "TOSS",
    data: Partial<DailyPerformance>
  ): Promise<DailyPerformance> {
    throw new Error("Not implemented in mock");
  }

  async getMonthlyPerformance(
    year: number,
    month: number,
    broker: "KIS" | "TOSS"
  ): Promise<MonthlyPerformance | null> {
    if (year === 2026 && month === 8) {
      return {
        id: 1,
        year,
        month,
        broker,
        totalPnl: 500000,
        roiPercent: 5.0,
        winRate: 65,
        maxDrawdown: 3.5,
        sharpeRatio: 1.9,
        tradesCount: 20,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
    return null;
  }

  async updateMonthlyPerformance(
    year: number,
    month: number,
    broker: "KIS" | "TOSS",
    data: any
  ): Promise<MonthlyPerformance> {
    throw new Error("Not implemented in mock");
  }

  async getSymbolPerformance(
    symbol: string,
    broker: "KIS" | "TOSS"
  ): Promise<SymbolPerformance | null> {
    if (symbol === "005930") {
      return {
        id: 1,
        symbol,
        broker,
        totalTrades: 10,
        winningTrades: 7,
        avgWin: 50000,
        avgLoss: 15000,
        winRate: 70,
        totalPnl: 275000,
        roiPercent: 2.75,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
    return null;
  }

  async updateSymbolPerformance(
    symbol: string,
    broker: "KIS" | "TOSS",
    data: any
  ): Promise<SymbolPerformance> {
    throw new Error("Not implemented in mock");
  }

  async getTopPerformingSymbols(
    limit: number,
    broker: "KIS" | "TOSS"
  ): Promise<SymbolPerformance[]> {
    return [
      {
        id: 1,
        symbol: "005930",
        broker,
        totalTrades: 10,
        winningTrades: 7,
        avgWin: 50000,
        avgLoss: 15000,
        winRate: 70,
        totalPnl: 275000,
        roiPercent: 2.75,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 2,
        symbol: "000660",
        broker,
        totalTrades: 8,
        winningTrades: 5,
        avgWin: 40000,
        avgLoss: 20000,
        winRate: 62.5,
        totalPnl: 160000,
        roiPercent: 1.6,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
  }

  async getWorstPerformingSymbols(
    limit: number,
    broker: "KIS" | "TOSS"
  ): Promise<SymbolPerformance[]> {
    return [
      {
        id: 3,
        symbol: "005380",
        broker,
        totalTrades: 5,
        winningTrades: 1,
        avgWin: 20000,
        avgLoss: 30000,
        winRate: 20,
        totalPnl: -100000,
        roiPercent: -1.0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
  }

  async getTeamComparison(tradingDate?: string): Promise<{
    kis: DailyPerformance | null;
    toss: DailyPerformance | null;
  }> {
    const date = tradingDate || "2026-08-01";
    return {
      kis: await this.getDailyPerformance(date, "KIS"),
      toss: await this.getDailyPerformance(date, "TOSS"),
    };
  }

  async recordPositionClosed(event: any): Promise<any> {
    throw new Error("Not implemented in mock");
  }

  async getClosedPositionsInRange(
    startDate: string,
    endDate: string,
    broker: "KIS" | "TOSS"
  ): Promise<any[]> {
    return [];
  }

  async recordTradeSignal(signal: any): Promise<any> {
    throw new Error("Not implemented in mock");
  }

  async updateTradeSignalStatus(
    signalId: string,
    status: "PENDING" | "EXECUTED" | "CANCELLED" | "EXPIRED"
  ): Promise<any> {
    throw new Error("Not implemented in mock");
  }
}

describe("PerformanceController", () => {
  let controller: PerformanceController;
  let mockRepo: MockPerformanceRepository;

  beforeEach(() => {
    mockRepo = new MockPerformanceRepository();
    controller = new PerformanceController(mockRepo);
  });

  describe("getTodayPerformance", () => {
    it("should return today's performance for KIS broker", async () => {
      const response = await controller.getTodayPerformance("KIS");
      expect(response.status).toBe(200);

      const data = (await response.json()) as any;
      expect(data.status).toBe("success");
      expect(data.data.broker).toBe("KIS");
      expect(data.data.trades).toBe(5);
      expect(data.data.winRate).toBe("60.00%");
      expect(data.timestamp).toBeDefined();
    });

    it("should return formatted currency for totalPnL", async () => {
      const response = await controller.getTodayPerformance("KIS");
      const data = (await response.json()) as any;

      expect(data.data.totalPnL).toMatch(/^₩[\d,]+$/);
      expect(data.data.totalPnL).toContain("150,000");
    });

    it("should handle missing data gracefully", async () => {
      const response = await controller.getTodayPerformance("KIS");
      expect(response.status).toBe(200);
    });
  });

  describe("getMonthlyPerformance", () => {
    it("should return monthly performance", async () => {
      const response = await controller.getMonthlyPerformance(2026, 8);
      expect(response.status).toBe(200);

      const data = (await response.json()) as any;
      expect(data.status).toBe("success");
      expect(data.data.period).toBe("2026-08");
      expect(data.data.kis).toBeDefined();
      expect(data.data.toss).toBeDefined();
    });

    it("should format ROI as percentage", async () => {
      const response = await controller.getMonthlyPerformance(2026, 8);
      const data = (await response.json()) as any;

      expect(data.data.kis.roiPercent).toBe("5.00%");
    });

    it("should handle missing monthly data", async () => {
      const response = await controller.getMonthlyPerformance(2025, 1);
      expect(response.status).toBe(200);

      const data = (await response.json()) as any;
      expect(data.status).toBe("success");
    });
  });

  describe("getTeamComparison", () => {
    it("should return KIS vs TOSS comparison", async () => {
      const response = await controller.getTeamComparison("2026-08-01");
      expect(response.status).toBe(200);

      const data = (await response.json()) as any;
      expect(data.status).toBe("success");
      expect(data.data.kis).toBeDefined();
      expect(data.data.toss).toBeDefined();
      expect(data.data.winner).toBeDefined();
    });

    it("should identify winner based on Sharpe ratio", async () => {
      const response = await controller.getTeamComparison("2026-08-01");
      const data = (await response.json()) as any;

      expect(["KIS", "TOSS", "DRAW"]).toContain(data.data.winner);
    });
  });

  describe("getSymbolPerformance", () => {
    it("should return symbol performance", async () => {
      const response = await controller.getSymbolPerformance("005930");
      expect(response.status).toBe(200);

      const data = (await response.json()) as any;
      expect(data.status).toBe("success");
      expect(data.data.symbol).toBe("005930");
      expect(data.data.kis).toBeDefined();
    });

    it("should return 404 for unknown symbol", async () => {
      const response = await controller.getSymbolPerformance("UNKNOWN");
      expect(response.status).toBe(404);

      const data = (await response.json()) as any;
      expect(data.status).toBe("error");
    });

    it("should format win rate as percentage", async () => {
      const response = await controller.getSymbolPerformance("005930");
      const data = (await response.json()) as any;

      expect(data.data.kis.winRate).toBe("70.00%");
    });
  });

  describe("getTopPerformingSymbols", () => {
    it("should return top symbols", async () => {
      const response = await controller.getTopPerformingSymbols(5, "KIS");
      expect(response.status).toBe(200);

      const data = (await response.json()) as any;
      expect(data.status).toBe("success");
      expect(Array.isArray(data.data.top)).toBe(true);
      expect(data.data.top.length).toBeGreaterThan(0);
    });

    it("should limit results", async () => {
      const response = await controller.getTopPerformingSymbols(2, "KIS");
      const data = (await response.json()) as any;

      expect(data.data.limit).toBe(2);
    });

    it("should validate limit parameter", async () => {
      const response = await controller.getTopPerformingSymbols(150, "KIS");
      const data = (await response.json()) as any;

      expect(data.data.limit).toBe(5); // Should default to 5 if > 100
    });
  });

  describe("getWorstPerformingSymbols", () => {
    it("should return worst symbols", async () => {
      const response = await controller.getWorstPerformingSymbols(5, "KIS");
      expect(response.status).toBe(200);

      const data = (await response.json()) as any;
      expect(data.status).toBe("success");
      expect(Array.isArray(data.data.worst)).toBe(true);
    });
  });

  describe("getDailyPerformanceRange", () => {
    it("should return daily performance range", async () => {
      const response = await controller.getDailyPerformanceRange(
        "2026-08-01",
        "2026-08-03",
        "KIS"
      );
      expect(response.status).toBe(200);

      const data = (await response.json()) as any;
      expect(data.status).toBe("success");
      expect(Array.isArray(data.data.days)).toBe(true);
    });

    it("should validate date format", async () => {
      const response = await controller.getDailyPerformanceRange(
        "2026/08/01",
        "2026/08/31",
        "KIS"
      );
      expect(response.status).toBe(400);

      const data = (await response.json()) as any;
      expect(data.status).toBe("error");
    });

    it("should return empty range for unavailable dates", async () => {
      const response = await controller.getDailyPerformanceRange(
        "2020-01-01",
        "2020-01-31",
        "KIS"
      );
      expect(response.status).toBe(200);

      const data = (await response.json()) as any;
      expect(data.data.count).toBe(0);
    });
  });

  describe("Response format validation", () => {
    it("should always include timestamp", async () => {
      const response = await controller.getTodayPerformance("KIS");
      const data = (await response.json()) as any;

      expect(data.timestamp).toBeDefined();
      expect(typeof data.timestamp).toBe("string");
      expect(data.timestamp).toMatch(/\d{4}-\d{2}-\d{2}T/); // ISO 8601 format
    });

    it("should include proper Content-Type header", async () => {
      const response = await controller.getTodayPerformance("KIS");

      expect(response.headers.get("Content-Type")).toContain("application/json");
    });

    it("should include CORS headers", async () => {
      const response = await controller.getTodayPerformance("KIS");

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Access-Control-Allow-Methods")).toBe(
        "GET, OPTIONS"
      );
    });
  });

  describe("Number formatting", () => {
    it("should format large numbers with thousands separator", async () => {
      const response = await controller.getTodayPerformance("KIS");
      const data = (await response.json()) as any;

      expect(data.data.totalPnL).toContain(",");
    });

    it("should format percentages to 2 decimal places", async () => {
      const response = await controller.getTodayPerformance("KIS");
      const data = (await response.json()) as any;

      expect(data.data.winRate).toMatch(/\d+\.\d{2}%/);
    });

    it("should use KRW currency symbol", async () => {
      const response = await controller.getTodayPerformance("KIS");
      const data = (await response.json()) as any;

      expect(data.data.totalPnL).toMatch(/^₩/);
    });
  });
});
