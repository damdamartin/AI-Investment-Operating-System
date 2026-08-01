import { describe, it, expect, beforeEach } from "vitest";
import type { D1QueryResultRow } from "../../src/persistence/d1-http-client.js";
import type { PerformanceDatabase } from "../../src/persistence/performance-repository.js";
import { PerformanceRepository } from "../../src/persistence/performance-repository.js";

/**
 * In-memory mock database for testing
 */
class MockPerformanceDatabase implements PerformanceDatabase {
  private data: Map<string, D1QueryResultRow[]> = new Map();

  constructor() {
    this.resetMockData();
  }

  private resetMockData(): void {
    this.data.clear();

    // Initialize mock tables
    this.data.set("trading_performance", [
      {
        id: 1,
        trading_date: "2026-08-01",
        broker: "KIS",
        total_trades: 5,
        winning_trades: 3,
        losing_trades: 2,
        total_pnl: 250000,
        total_pnl_percent: 2.5,
        avg_win: 150000,
        avg_loss: 50000,
        win_rate: 60,
        max_drawdown: -5,
        sharpe_ratio: 1.5,
        profit_factor: 3,
        sl_triggered_count: 2,
        tp_triggered_count: 3,
        created_at: "2026-08-01T00:00:00Z",
        updated_at: "2026-08-01T00:00:00Z",
      },
    ]);

    this.data.set("monthly_performance", [
      {
        id: 1,
        year: 2026,
        month: 8,
        broker: "KIS",
        total_pnl: 2500000,
        roi_percent: 25,
        win_rate: 55,
        max_drawdown: -10,
        sharpe_ratio: 1.8,
        trades_count: 50,
        created_at: "2026-08-01T00:00:00Z",
        updated_at: "2026-08-01T00:00:00Z",
      },
    ]);

    this.data.set("symbol_performance", [
      {
        id: 1,
        symbol: "005930",
        broker: "KIS",
        total_trades: 10,
        winning_trades: 7,
        avg_win: 100000,
        avg_loss: 40000,
        win_rate: 70,
        total_pnl: 600000,
        roi_percent: 15,
        created_at: "2026-08-01T00:00:00Z",
        updated_at: "2026-08-01T00:00:00Z",
      },
    ]);
  }

  async query(
    sql: string,
    params?: ReadonlyArray<string | number | boolean | null>
  ): Promise<{ results: D1QueryResultRow[] }> {
    // Parse SQL to determine operation
    const sqlUpper = sql.toUpperCase();

    if (sqlUpper.includes("SELECT")) {
      return this.handleSelect(sql, params);
    } else if (sqlUpper.includes("INSERT")) {
      return this.handleInsert(sql, params);
    } else if (sqlUpper.includes("UPDATE")) {
      return this.handleUpdate(sql, params);
    }

    return { results: [] };
  }

  private handleSelect(
    sql: string,
    params?: ReadonlyArray<string | number | boolean | null>
  ): { results: D1QueryResultRow[] } {
    const sqlUpper = sql.toUpperCase();

    if (sqlUpper.includes("FROM trading_performance")) {
      const table = this.data.get("trading_performance") || [];

      if (sqlUpper.includes("WHERE trading_date")) {
        const results = table.filter(
          row =>
            (row.trading_date as string | null) === params?.[0] &&
            (row.broker as string | null) === params?.[1]
        );
        return { results };
      }

      if (sqlUpper.includes("WHERE trading_date BETWEEN")) {
        const results = table.filter(
          row =>
            (row.trading_date as string) >= (params?.[0] as string) &&
            (row.trading_date as string) <= (params?.[1] as string) &&
            (row.broker as string) === params?.[2]
        );
        return { results };
      }

      return { results: table };
    }

    if (sqlUpper.includes("FROM monthly_performance")) {
      const table = this.data.get("monthly_performance") || [];

      if (sqlUpper.includes("WHERE year")) {
        const results = table.filter(
          row =>
            row.year === params?.[0] &&
            row.month === params?.[1] &&
            row.broker === params?.[2]
        );
        return { results };
      }

      return { results: table };
    }

    if (sqlUpper.includes("FROM symbol_performance")) {
      const table = this.data.get("symbol_performance") || [];

      if (sqlUpper.includes("WHERE symbol")) {
        const results = table.filter(
          row =>
            row.symbol === params?.[0] &&
            row.broker === params?.[1]
        );
        return { results };
      }

      if (sqlUpper.includes("ORDER BY total_pnl DESC")) {
        const results = table
          .sort((a, b) => Number(b.total_pnl) - Number(a.total_pnl))
          .slice(0, params?.[1] as number);
        return { results };
      }

      if (sqlUpper.includes("ORDER BY total_pnl ASC")) {
        const results = table
          .sort((a, b) => Number(a.total_pnl) - Number(b.total_pnl))
          .slice(0, params?.[1] as number);
        return { results };
      }

      return { results: table };
    }

    if (sqlUpper.includes("FROM position_closed_events")) {
      const table = this.data.get("position_closed_events") || [];

      if (sqlUpper.includes("WHERE exited_at BETWEEN")) {
        const results = table.filter(
          row =>
            (row.exited_at as string) >= (params?.[0] as string) &&
            (row.exited_at as string) <= (params?.[1] as string) &&
            (row.broker as string) === params?.[2]
        );
        return { results };
      }

      if (sqlUpper.includes("WHERE position_id")) {
        const results = table.filter(row => row.position_id === params?.[0]);
        return { results };
      }

      return { results: table };
    }

    if (sqlUpper.includes("FROM trade_signal_metrics")) {
      const table = this.data.get("trade_signal_metrics") || [];

      if (sqlUpper.includes("WHERE signal_id")) {
        const results = table.filter(row => (row.signal_id as string) === (params?.[0] as string));
        return { results };
      }

      return { results: table };
    }

    return { results: [] };
  }

  private handleInsert(
    sql: string,
    params?: ReadonlyArray<string | number | boolean | null>
  ): { results: D1QueryResultRow[] } {
    if (sql.includes("trading_performance")) {
      const table = this.data.get("trading_performance") || [];
      const newRow = this.createDailyPerformanceRow(params);
      table.push(newRow);
      this.data.set("trading_performance", table);
    }

    if (sql.includes("monthly_performance")) {
      const table = this.data.get("monthly_performance") || [];
      const newRow = this.createMonthlyPerformanceRow(params);
      table.push(newRow);
      this.data.set("monthly_performance", table);
    }

    if (sql.includes("symbol_performance")) {
      const table = this.data.get("symbol_performance") || [];
      const newRow = this.createSymbolPerformanceRow(params);
      table.push(newRow);
      this.data.set("symbol_performance", table);
    }

    if (sql.includes("position_closed_events")) {
      const table = this.data.get("position_closed_events") || [];
      const newRow = {
        id: Math.random(),
        position_id: params?.[0] ?? null,
        symbol: params?.[1] ?? null,
        quantity: params?.[2] ?? null,
        entry_price: params?.[3] ?? null,
        exit_price: params?.[4] ?? null,
        exit_reason: params?.[5] ?? null,
        pnl: params?.[6] ?? null,
        pnl_percent: params?.[7] ?? null,
        broker: params?.[8] ?? null,
        exited_at: params?.[9] ?? null,
        created_at: new Date().toISOString(),
      };
      table.push(newRow);
      this.data.set("position_closed_events", table);
    }

    if (sql.includes("trade_signal_metrics")) {
      const table = this.data.get("trade_signal_metrics") || [];
      const newRow = {
        id: Math.random(),
        signal_id: params?.[0] ?? null,
        symbol: params?.[1] ?? null,
        signal_type: params?.[2] ?? null,
        confidence: params?.[3] ?? null,
        entry_price: params?.[4] ?? null,
        stop_loss: params?.[5] ?? null,
        take_profit: params?.[6] ?? null,
        status: params?.[7] ?? null,
        broker: params?.[8] ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      table.push(newRow);
      this.data.set("trade_signal_metrics", table);
    }

    return { results: [] };
  }

  private handleUpdate(
    sql: string,
    params?: ReadonlyArray<string | number | boolean | null>
  ): { results: D1QueryResultRow[] } {
    // Simple mock update - just return empty results
    return { results: [] };
  }

  private createDailyPerformanceRow(params?: ReadonlyArray<string | number | boolean | null>): D1QueryResultRow {
    const now = new Date().toISOString();
    return {
      id: Math.random(),
      trading_date: params?.[0] as string,
      broker: params?.[1] as string,
      total_trades: params?.[2] as number,
      winning_trades: params?.[3] as number,
      losing_trades: params?.[4] as number,
      total_pnl: params?.[5] as number,
      total_pnl_percent: params?.[6] as number,
      avg_win: params?.[7] as number,
      avg_loss: params?.[8] as number,
      win_rate: params?.[9] as number,
      max_drawdown: params?.[10] as number,
      sharpe_ratio: params?.[11] as number,
      profit_factor: params?.[12] as number,
      sl_triggered_count: params?.[13] as number,
      tp_triggered_count: params?.[14] as number,
      created_at: now,
      updated_at: now,
    };
  }

  private createMonthlyPerformanceRow(params?: ReadonlyArray<string | number | boolean | null>): D1QueryResultRow {
    const now = new Date().toISOString();
    return {
      id: Math.random(),
      year: params?.[0] as number,
      month: params?.[1] as number,
      broker: params?.[2] as string,
      total_pnl: params?.[3] as number,
      roi_percent: params?.[4] as number,
      win_rate: params?.[5] as number,
      max_drawdown: params?.[6] as number,
      sharpe_ratio: params?.[7] as number,
      trades_count: params?.[8] as number,
      created_at: now,
      updated_at: now,
    };
  }

  private createSymbolPerformanceRow(params?: ReadonlyArray<string | number | boolean | null>): D1QueryResultRow {
    const now = new Date().toISOString();
    return {
      id: Math.random(),
      symbol: params?.[0] as string,
      broker: params?.[1] as string,
      total_trades: params?.[2] as number,
      winning_trades: params?.[3] as number,
      avg_win: params?.[4] as number,
      avg_loss: params?.[5] as number,
      win_rate: params?.[6] as number,
      total_pnl: params?.[7] as number,
      roi_percent: params?.[8] as number,
      created_at: now,
      updated_at: now,
    };
  }
}

describe("PerformanceRepository", () => {
  let repository: PerformanceRepository;
  let mockDb: MockPerformanceDatabase;

  beforeEach(() => {
    mockDb = new MockPerformanceDatabase();
    repository = new PerformanceRepository(mockDb);
  });

  describe("getDailyPerformance", () => {
    it("should retrieve daily performance for a date and broker", async () => {
      const result = await repository.getDailyPerformance("2026-08-01", "KIS");
      expect(result).not.toBeNull();
      if (result) {
        expect(result.tradingDate).toBe("2026-08-01");
        expect(result.broker).toBe("KIS");
      }
    });

    it("should return null when no data exists", async () => {
      const result = await repository.getDailyPerformance("2099-01-01", "TOSS");
      expect(result).toBeNull();
    });

    it("should have correct daily performance fields", async () => {
      const result = await repository.getDailyPerformance("2026-08-01", "KIS");
      expect(result).toHaveProperty("winRate");
      expect(result).toHaveProperty("sharpeRatio");
      expect(result).toHaveProperty("profitFactor");
    });
  });

  describe("getDailyPerformanceRange", () => {
    it("should retrieve performance in date range", async () => {
      const results = await repository.getDailyPerformanceRange("2026-08-01", "2026-08-31", "KIS");
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    });

    it("should return empty array for date range with no data", async () => {
      const results = await repository.getDailyPerformanceRange("2099-01-01", "2099-01-31", "TOSS");
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });
  });

  describe("updateDailyPerformance", () => {
    it("should update existing daily performance", async () => {
      const updated = await repository.updateDailyPerformance("2026-08-01", "KIS", {
        winRate: 75,
        totalPnl: 300000,
      });

      expect(updated).not.toBeNull();
    });

    it("should create new daily performance if not exists", async () => {
      const created = await repository.updateDailyPerformance("2026-08-02", "TOSS", {
        totalTrades: 3,
        winningTrades: 2,
        winRate: 66.67,
      });

      expect(created).not.toBeNull();
      expect(created.tradingDate).toBe("2026-08-02");
    });
  });

  describe("getMonthlyPerformance", () => {
    it("should retrieve monthly performance", async () => {
      const result = await repository.getMonthlyPerformance(2026, 8, "KIS");
      expect(result).not.toBeNull();
      expect(result?.year).toBe(2026);
      expect(result?.month).toBe(8);
      expect(result?.broker).toBe("KIS");
    });

    it("should return null for non-existent data", async () => {
      const result = await repository.getMonthlyPerformance(2099, 1, "TOSS");
      expect(result).toBeNull();
    });

    it("should have correct monthly fields", async () => {
      const result = await repository.getMonthlyPerformance(2026, 8, "KIS");
      expect(result).toHaveProperty("roiPercent");
      expect(result).toHaveProperty("tradesCount");
    });
  });

  describe("updateMonthlyPerformance", () => {
    it("should update existing monthly performance", async () => {
      const updated = await repository.updateMonthlyPerformance(2026, 8, "KIS", {
        totalPnl: 3000000,
        roiPercent: 30,
        winRate: 60,
        maxDrawdown: -12,
        sharpeRatio: 2.0,
        tradesCount: 60,
      });

      expect(updated).not.toBeNull();
    });

    it("should create new monthly performance", async () => {
      const created = await repository.updateMonthlyPerformance(2026, 9, "TOSS", {
        totalPnl: 1500000,
        roiPercent: 15,
        winRate: 50,
        maxDrawdown: -8,
        sharpeRatio: 1.2,
        tradesCount: 40,
      });

      expect(created).not.toBeNull();
      expect(created.month).toBe(9);
    });
  });

  describe("getSymbolPerformance", () => {
    it("should retrieve symbol performance", async () => {
      const result = await repository.getSymbolPerformance("005930", "KIS");
      expect(result).not.toBeNull();
      expect(result?.symbol).toBe("005930");
    });

    it("should return null for non-existent symbol", async () => {
      const result = await repository.getSymbolPerformance("999999", "TOSS");
      expect(result).toBeNull();
    });
  });

  describe("updateSymbolPerformance", () => {
    it("should update existing symbol performance", async () => {
      const updated = await repository.updateSymbolPerformance("005930", "KIS", {
        winRate: 75,
        totalPnl: 700000,
      });

      expect(updated).not.toBeNull();
    });

    it("should create new symbol performance", async () => {
      const created = await repository.updateSymbolPerformance("000660", "TOSS", {
        totalTrades: 5,
        winningTrades: 3,
        winRate: 60,
        totalPnl: 200000,
      });

      expect(created).not.toBeNull();
      expect(created.symbol).toBe("000660");
    });
  });

  describe("getTopPerformingSymbols", () => {
    it("should return top performing symbols", async () => {
      const results = await repository.getTopPerformingSymbols(3, "KIS");
      expect(Array.isArray(results)).toBe(true);
    });

    it("should respect limit parameter", async () => {
      const results = await repository.getTopPerformingSymbols(1, "KIS");
      expect(results.length).toBeLessThanOrEqual(1);
    });
  });

  describe("getWorstPerformingSymbols", () => {
    it("should return worst performing symbols", async () => {
      const results = await repository.getWorstPerformingSymbols(3, "KIS");
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe("getTeamComparison", () => {
    it("should compare KIS and TOSS performance", async () => {
      const comparison = await repository.getTeamComparison("2026-08-01");
      expect(comparison).toHaveProperty("kis");
      expect(comparison).toHaveProperty("toss");
    });

    it("should handle missing broker data", async () => {
      const comparison = await repository.getTeamComparison("2099-01-01");
      expect(comparison.kis).toBeNull();
      expect(comparison.toss).toBeNull();
    });
  });

  describe("recordPositionClosed", () => {
    it("should record position close event", async () => {
      const event = await repository.recordPositionClosed({
        positionId: "pos-123",
        symbol: "005930",
        quantity: 10,
        entryPrice: 70000,
        exitPrice: 72000,
        exitReason: "TAKE_PROFIT" as const,
        pnl: 20000,
        pnlPercent: 2.86,
        broker: "KIS" as const,
        exitedAt: "2026-08-01T15:00:00Z",
      });

      expect(event).not.toBeNull();
      expect(event.positionId).toBe("pos-123");
    });
  });

  describe("recordTradeSignal", () => {
    it("should record trade signal", async () => {
      const signal = await repository.recordTradeSignal({
        signalId: "sig-123",
        symbol: "005930",
        signalType: "BUY",
        confidence: 0.85,
        entryPrice: 70000,
        stopLoss: 68000,
        takeProfit: 72000,
        status: "PENDING",
        broker: "KIS",
      });

      expect(signal).not.toBeNull();
      expect(signal.signalId).toBe("sig-123");
      expect(signal.confidence).toBe(0.85);
    });
  });

  describe("updateTradeSignalStatus", () => {
    it("should update trade signal status", async () => {
      // First record a signal
      await repository.recordTradeSignal({
        signalId: "sig-456",
        symbol: "000660",
        signalType: "SELL",
        confidence: 0.75,
        status: "PENDING",
        broker: "TOSS",
        entryPrice: null,
        stopLoss: null,
        takeProfit: null,
      });

      // Then update its status
      const updated = await repository.updateTradeSignalStatus("sig-456", "EXECUTED");
      expect(updated).not.toBeNull();
    });
  });
});
