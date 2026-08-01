import { randomUUID } from "node:crypto";
import type { D1QueryResultRow } from "./d1-http-client.js";

/**
 * Database interface for performance analytics.
 * Separated from the HTTP client to allow test mocks.
 */
export interface PerformanceDatabase {
  query(sql: string, params?: ReadonlyArray<string | number | boolean | null>): Promise<{ results: D1QueryResultRow[] }>;
}

/**
 * Daily trading performance metrics
 */
export interface DailyPerformance {
  id: number;
  tradingDate: string;
  broker: "KIS" | "TOSS";
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalPnl: number;
  totalPnlPercent: number;
  avgWin: number;
  avgLoss: number;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number;
  profitFactor: number;
  slTriggeredCount: number;
  tpTriggeredCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Monthly performance summary
 */
export interface MonthlyPerformance {
  id: number;
  year: number;
  month: number;
  broker: "KIS" | "TOSS";
  totalPnl: number;
  roiPercent: number;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number;
  tradesCount: number;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Symbol-level performance metrics
 */
export interface SymbolPerformance {
  id: number;
  symbol: string;
  broker: "KIS" | "TOSS";
  totalTrades: number;
  winningTrades: number;
  avgWin: number;
  avgLoss: number;
  winRate: number;
  totalPnl: number;
  roiPercent: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Position close/exit event
 */
export interface PositionClosedEvent {
  id: number;
  positionId: string;
  symbol: string;
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  exitReason: "STOP_LOSS" | "TAKE_PROFIT" | "MANUAL" | "EXPIRED";
  pnl: number;
  pnlPercent: number;
  broker: "KIS" | "TOSS";
  exitedAt: string;
  createdAt: string;
}

/**
 * Trade signal metrics
 */
export interface TradeSignalMetrics {
  id: number;
  signalId: string;
  symbol: string;
  signalType: "BUY" | "SELL";
  confidence: number;
  entryPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  status: "PENDING" | "EXECUTED" | "CANCELLED" | "EXPIRED";
  broker: "KIS" | "TOSS";
  createdAt: string;
  updatedAt: string;
}

/**
 * Performance Repository for managing analytics and metrics.
 * Handles CRUD operations for performance data, monthly summaries, and symbol metrics.
 */
export class PerformanceRepository {
  constructor(private readonly db: PerformanceDatabase) {}

  /**
   * Get daily performance for a specific date and broker
   */
  async getDailyPerformance(tradingDate: string, broker: "KIS" | "TOSS"): Promise<DailyPerformance | null> {
    const result = await this.db.query(
      `SELECT * FROM trading_performance WHERE trading_date = ? AND broker = ?`,
      [tradingDate, broker]
    );

    if (result.results.length === 0) {
      return null;
    }

    return this.mapRowToDailyPerformance(result.results[0]!);
  }

  /**
   * Get all daily performance for a date range
   */
  async getDailyPerformanceRange(
    startDate: string,
    endDate: string,
    broker: "KIS" | "TOSS"
  ): Promise<DailyPerformance[]> {
    const result = await this.db.query(
      `SELECT * FROM trading_performance
       WHERE trading_date BETWEEN ? AND ? AND broker = ?
       ORDER BY trading_date ASC`,
      [startDate, endDate, broker]
    );

    return result.results.map(row => this.mapRowToDailyPerformance(row));
  }

  /**
   * Create or update daily performance
   */
  async updateDailyPerformance(tradingDate: string, broker: "KIS" | "TOSS", data: Partial<DailyPerformance>): Promise<DailyPerformance> {
    const existing = await this.getDailyPerformance(tradingDate, broker);

    if (existing) {
      // Update existing
      const updates: string[] = [];
      const params: (string | number | null)[] = [];

      Object.entries(data).forEach(([key, value]) => {
        if (key !== 'id' && key !== 'tradingDate' && key !== 'broker') {
          const snakeCaseKey = this.camelToSnakeCase(key);
          updates.push(`${snakeCaseKey} = ?`);
          params.push(value as string | number | null);
        }
      });

      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(tradingDate);
      params.push(broker);

      const sql = `UPDATE trading_performance SET ${updates.join(', ')}
                   WHERE trading_date = ? AND broker = ?`;

      await this.db.query(sql, params);

      const updated = await this.getDailyPerformance(tradingDate, broker);
      if (!updated) {
        throw new Error(`Failed to retrieve updated daily performance for ${tradingDate}/${broker}`);
      }
      return updated;
    } else {
      // Create new
      const sql = `INSERT INTO trading_performance (
        trading_date, broker, total_trades, winning_trades, losing_trades,
        total_pnl, total_pnl_percent, avg_win, avg_loss, win_rate,
        max_drawdown, sharpe_ratio, profit_factor, sl_triggered_count, tp_triggered_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      const params: (string | number)[] = [
        tradingDate,
        broker,
        data.totalTrades ?? 0,
        data.winningTrades ?? 0,
        data.losingTrades ?? 0,
        data.totalPnl ?? 0,
        data.totalPnlPercent ?? 0,
        data.avgWin ?? 0,
        data.avgLoss ?? 0,
        data.winRate ?? 0,
        data.maxDrawdown ?? 0,
        data.sharpeRatio ?? 0,
        data.profitFactor ?? 0,
        data.slTriggeredCount ?? 0,
        data.tpTriggeredCount ?? 0,
      ];

      await this.db.query(sql, params);

      const created = await this.getDailyPerformance(tradingDate, broker);
      if (!created) {
        throw new Error(`Failed to create daily performance for ${tradingDate}/${broker}`);
      }
      return created;
    }
  }

  /**
   * Get monthly performance summary
   */
  async getMonthlyPerformance(year: number, month: number, broker: "KIS" | "TOSS"): Promise<MonthlyPerformance | null> {
    const result = await this.db.query(
      `SELECT * FROM monthly_performance WHERE year = ? AND month = ? AND broker = ?`,
      [year, month, broker]
    );

    if (result.results.length === 0) {
      return null;
    }

    return this.mapRowToMonthlyPerformance(result.results[0]!);
  }

  /**
   * Create or update monthly performance
   */
  async updateMonthlyPerformance(
    year: number,
    month: number,
    broker: "KIS" | "TOSS",
    data: Omit<MonthlyPerformance, 'id' | 'year' | 'month' | 'broker' | 'createdAt' | 'updatedAt'>
  ): Promise<MonthlyPerformance> {
    const existing = await this.getMonthlyPerformance(year, month, broker);

    if (existing) {
      // Update
      const sql = `UPDATE monthly_performance
                   SET total_pnl = ?, roi_percent = ?, win_rate = ?,
                       max_drawdown = ?, sharpe_ratio = ?, trades_count = ?,
                       updated_at = CURRENT_TIMESTAMP
                   WHERE year = ? AND month = ? AND broker = ?`;

      await this.db.query(sql, [
        data.totalPnl,
        data.roiPercent,
        data.winRate,
        data.maxDrawdown,
        data.sharpeRatio,
        data.tradesCount,
        year,
        month,
        broker,
      ]);
    } else {
      // Create
      const sql = `INSERT INTO monthly_performance
                   (year, month, broker, total_pnl, roi_percent, win_rate, max_drawdown, sharpe_ratio, trades_count)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      await this.db.query(sql, [
        year,
        month,
        broker,
        data.totalPnl,
        data.roiPercent,
        data.winRate,
        data.maxDrawdown,
        data.sharpeRatio,
        data.tradesCount,
      ]);
    }

    const result = await this.getMonthlyPerformance(year, month, broker);
    if (!result) {
      throw new Error(`Failed to retrieve monthly performance for ${year}/${month}/${broker}`);
    }
    return result;
  }

  /**
   * Get symbol-level performance
   */
  async getSymbolPerformance(symbol: string, broker: "KIS" | "TOSS"): Promise<SymbolPerformance | null> {
    const result = await this.db.query(
      `SELECT * FROM symbol_performance WHERE symbol = ? AND broker = ?`,
      [symbol, broker]
    );

    if (result.results.length === 0) {
      return null;
    }

    return this.mapRowToSymbolPerformance(result.results[0]!);
  }

  /**
   * Update symbol performance
   */
  async updateSymbolPerformance(
    symbol: string,
    broker: "KIS" | "TOSS",
    data: Partial<Omit<SymbolPerformance, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<SymbolPerformance> {
    const existing = await this.getSymbolPerformance(symbol, broker);

    if (existing) {
      const updates: string[] = [];
      const params: (string | number | null)[] = [];

      Object.entries(data).forEach(([key, value]) => {
        if (key !== 'symbol' && key !== 'broker') {
          const snakeCaseKey = this.camelToSnakeCase(key);
          updates.push(`${snakeCaseKey} = ?`);
          params.push(value as string | number | null);
        }
      });

      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(symbol);
      params.push(broker);

      const sql = `UPDATE symbol_performance SET ${updates.join(', ')}
                   WHERE symbol = ? AND broker = ?`;

      await this.db.query(sql, params);
    } else {
      const sql = `INSERT INTO symbol_performance
                   (symbol, broker, total_trades, winning_trades, avg_win, avg_loss, win_rate, total_pnl, roi_percent)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      await this.db.query(sql, [
        symbol,
        broker,
        data.totalTrades ?? 0,
        data.winningTrades ?? 0,
        data.avgWin ?? 0,
        data.avgLoss ?? 0,
        data.winRate ?? 0,
        data.totalPnl ?? 0,
        data.roiPercent ?? 0,
      ]);
    }

    const result = await this.getSymbolPerformance(symbol, broker);
    if (!result) {
      throw new Error(`Failed to retrieve symbol performance for ${symbol}/${broker}`);
    }
    return result;
  }

  /**
   * Get top performing symbols
   */
  async getTopPerformingSymbols(limit: number, broker: "KIS" | "TOSS"): Promise<SymbolPerformance[]> {
    const result = await this.db.query(
      `SELECT * FROM symbol_performance
       WHERE broker = ?
       ORDER BY total_pnl DESC
       LIMIT ?`,
      [broker, limit]
    );

    return result.results.map(row => this.mapRowToSymbolPerformance(row));
  }

  /**
   * Get worst performing symbols
   */
  async getWorstPerformingSymbols(limit: number, broker: "KIS" | "TOSS"): Promise<SymbolPerformance[]> {
    const result = await this.db.query(
      `SELECT * FROM symbol_performance
       WHERE broker = ?
       ORDER BY total_pnl ASC
       LIMIT ?`,
      [broker, limit]
    );

    return result.results.map(row => this.mapRowToSymbolPerformance(row));
  }

  /**
   * Get team comparison (KIS vs TOSS)
   */
  async getTeamComparison(tradingDate?: string): Promise<{
    kis: DailyPerformance | null;
    toss: DailyPerformance | null;
  }> {
    const dateToUse = tradingDate ?? (new Date().toISOString().split('T')[0] as string);

    const kis = await this.getDailyPerformance(dateToUse, "KIS");
    const toss = await this.getDailyPerformance(dateToUse, "TOSS");

    return { kis, toss };
  }

  /**
   * Record position close event
   */
  async recordPositionClosed(event: Omit<PositionClosedEvent, 'id' | 'createdAt'>): Promise<PositionClosedEvent> {
    const sql = `INSERT INTO position_closed_events
                 (position_id, symbol, quantity, entry_price, exit_price, exit_reason, pnl, pnl_percent, broker, exited_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    await this.db.query(sql, [
      event.positionId,
      event.symbol,
      event.quantity,
      event.entryPrice,
      event.exitPrice,
      event.exitReason,
      event.pnl,
      event.pnlPercent,
      event.broker,
      event.exitedAt,
    ]);

    const result = await this.db.query(
      `SELECT * FROM position_closed_events WHERE position_id = ? ORDER BY id DESC LIMIT 1`,
      [event.positionId]
    );

    if (result.results.length === 0) {
      throw new Error(`Failed to record position closed event for ${event.positionId}`);
    }

    return this.mapRowToPositionClosedEvent(result.results[0]!);
  }

  /**
   * Get position close events for a date range
   */
  async getClosedPositionsInRange(
    startDate: string,
    endDate: string,
    broker: "KIS" | "TOSS"
  ): Promise<PositionClosedEvent[]> {
    const result = await this.db.query(
      `SELECT * FROM position_closed_events
       WHERE exited_at BETWEEN ? AND ? AND broker = ?
       ORDER BY exited_at DESC`,
      [startDate, endDate, broker]
    );

    return result.results.map(row => {
      if (!row) throw new Error("Unexpected null row in query result");
      return this.mapRowToPositionClosedEvent(row);
    });
  }

  /**
   * Record trade signal
   */
  async recordTradeSignal(signal: Omit<TradeSignalMetrics, 'id' | 'createdAt' | 'updatedAt'>): Promise<TradeSignalMetrics> {
    const sql = `INSERT INTO trade_signal_metrics
                 (signal_id, symbol, signal_type, confidence, entry_price, stop_loss, take_profit, status, broker)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    await this.db.query(sql, [
      signal.signalId,
      signal.symbol,
      signal.signalType,
      signal.confidence,
      signal.entryPrice ?? null,
      signal.stopLoss ?? null,
      signal.takeProfit ?? null,
      signal.status,
      signal.broker,
    ]);

    const result = await this.db.query(
      `SELECT * FROM trade_signal_metrics WHERE signal_id = ?`,
      [signal.signalId]
    );

    return this.mapRowToTradeSignalMetrics(result.results[0]!);
  }

  /**
   * Update trade signal status
   */
  async updateTradeSignalStatus(
    signalId: string,
    status: "PENDING" | "EXECUTED" | "CANCELLED" | "EXPIRED"
  ): Promise<TradeSignalMetrics | null> {
    await this.db.query(
      `UPDATE trade_signal_metrics SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE signal_id = ?`,
      [status, signalId]
    );

    const result = await this.db.query(
      `SELECT * FROM trade_signal_metrics WHERE signal_id = ?`,
      [signalId]
    );

    if (result.results.length === 0) {
      return null;
    }

    return this.mapRowToTradeSignalMetrics(result.results[0]!);
  }

  // ============ Private helpers ============

  private mapRowToDailyPerformance(row: D1QueryResultRow): DailyPerformance {
    return {
      id: row.id as number,
      tradingDate: row.trading_date as string,
      broker: row.broker as "KIS" | "TOSS",
      totalTrades: row.total_trades as number,
      winningTrades: row.winning_trades as number,
      losingTrades: row.losing_trades as number,
      totalPnl: row.total_pnl as number,
      totalPnlPercent: row.total_pnl_percent as number,
      avgWin: row.avg_win as number,
      avgLoss: row.avg_loss as number,
      winRate: row.win_rate as number,
      maxDrawdown: row.max_drawdown as number,
      sharpeRatio: row.sharpe_ratio as number,
      profitFactor: row.profit_factor as number,
      slTriggeredCount: row.sl_triggered_count as number,
      tpTriggeredCount: row.tp_triggered_count as number,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  private mapRowToMonthlyPerformance(row: D1QueryResultRow): MonthlyPerformance {
    return {
      id: row.id as number,
      year: row.year as number,
      month: row.month as number,
      broker: row.broker as "KIS" | "TOSS",
      totalPnl: row.total_pnl as number,
      roiPercent: row.roi_percent as number,
      winRate: row.win_rate as number,
      maxDrawdown: row.max_drawdown as number,
      sharpeRatio: row.sharpe_ratio as number,
      tradesCount: row.trades_count as number,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  private mapRowToSymbolPerformance(row: D1QueryResultRow): SymbolPerformance {
    return {
      id: row.id as number,
      symbol: row.symbol as string,
      broker: row.broker as "KIS" | "TOSS",
      totalTrades: row.total_trades as number,
      winningTrades: row.winning_trades as number,
      avgWin: row.avg_win as number,
      avgLoss: row.avg_loss as number,
      winRate: row.win_rate as number,
      totalPnl: row.total_pnl as number,
      roiPercent: row.roi_percent as number,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  private mapRowToPositionClosedEvent(row: D1QueryResultRow): PositionClosedEvent {
    return {
      id: row.id as number,
      positionId: row.position_id as string,
      symbol: row.symbol as string,
      quantity: row.quantity as number,
      entryPrice: row.entry_price as number,
      exitPrice: row.exit_price as number,
      exitReason: row.exit_reason as "STOP_LOSS" | "TAKE_PROFIT" | "MANUAL" | "EXPIRED",
      pnl: row.pnl as number,
      pnlPercent: row.pnl_percent as number,
      broker: row.broker as "KIS" | "TOSS",
      exitedAt: row.exited_at as string,
      createdAt: row.created_at as string,
    };
  }

  private mapRowToTradeSignalMetrics(row: D1QueryResultRow): TradeSignalMetrics {
    return {
      id: row.id as number,
      signalId: row.signal_id as string,
      symbol: row.symbol as string,
      signalType: row.signal_type as "BUY" | "SELL",
      confidence: row.confidence as number,
      entryPrice: (row.entry_price as number | null) ?? null,
      stopLoss: (row.stop_loss as number | null) ?? null,
      takeProfit: (row.take_profit as number | null) ?? null,
      status: row.status as "PENDING" | "EXECUTED" | "CANCELLED" | "EXPIRED",
      broker: row.broker as "KIS" | "TOSS",
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  private camelToSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}
