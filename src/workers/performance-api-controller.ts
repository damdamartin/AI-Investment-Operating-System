/**
 * Performance API Controller
 * Provides REST endpoints for trading performance analytics
 */

import type { PerformanceRepository } from "../persistence/performance-repository.js";

interface ApiResponse<T> {
  status: "success" | "error";
  data?: T;
  error?: string;
  timestamp: string;
}

/**
 * PerformanceController
 * Handles all performance-related API endpoints
 */
export class PerformanceController {
  constructor(private readonly repo: PerformanceRepository) {}

  /**
   * Get today's performance for a specific broker
   * GET /api/performance/today?broker=KIS
   */
  async getTodayPerformance(broker: "KIS" | "TOSS"): Promise<Response> {
    try {
      const today = new Date().toISOString().split("T")[0] as string;
      const perf = await this.repo.getDailyPerformance(today, broker);

      if (!perf) {
        return this.jsonResponse(
          {
            status: "success",
            data: {
              date: today,
              broker: broker,
              trades: 0,
              winRate: "0.00%",
              totalPnL: "₩0",
              totalPnLPercent: "0.00%",
              avgWin: "₩0",
              avgLoss: "₩0",
              maxDrawdown: "0.00%",
              sharpeRatio: "0.00",
              message: "No trading data available for today",
            },
          },
          200
        );
      }

      return this.jsonResponse(
        {
          status: "success",
          data: {
            date: today,
            broker: broker,
            trades: perf.totalTrades,
            winRate: `${perf.winRate.toFixed(2)}%`,
            totalPnL: `₩${perf.totalPnl.toLocaleString()}`,
            totalPnLPercent: `${perf.totalPnlPercent.toFixed(2)}%`,
            avgWin: `₩${perf.avgWin.toLocaleString()}`,
            avgLoss: `₩${perf.avgLoss.toLocaleString()}`,
            maxDrawdown: `${perf.maxDrawdown.toFixed(2)}%`,
            sharpeRatio: perf.sharpeRatio.toFixed(2),
          },
        },
        200
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return this.jsonResponse(
        {
          status: "error",
          error: `Failed to fetch today's performance: ${errorMsg}`,
        },
        500
      );
    }
  }

  /**
   * Get monthly performance for both brokers
   * GET /api/performance/monthly?year=2026&month=8
   */
  async getMonthlyPerformance(year: number, month: number): Promise<Response> {
    try {
      const kisPerf = await this.repo.getMonthlyPerformance(year, month, "KIS");
      const tossPerf = await this.repo.getMonthlyPerformance(
        year,
        month,
        "TOSS"
      );

      return this.jsonResponse(
        {
          status: "success",
          data: {
            period: `${year}-${String(month).padStart(2, "0")}`,
            kis: kisPerf
              ? {
                  totalPnL: `₩${kisPerf.totalPnl.toLocaleString()}`,
                  roiPercent: `${kisPerf.roiPercent.toFixed(2)}%`,
                  winRate: `${kisPerf.winRate.toFixed(2)}%`,
                  tradesCount: kisPerf.tradesCount,
                  maxDrawdown: `${kisPerf.maxDrawdown.toFixed(2)}%`,
                  sharpeRatio: kisPerf.sharpeRatio.toFixed(2),
                }
              : null,
            toss: tossPerf
              ? {
                  totalPnL: `₩${tossPerf.totalPnl.toLocaleString()}`,
                  roiPercent: `${tossPerf.roiPercent.toFixed(2)}%`,
                  winRate: `${tossPerf.winRate.toFixed(2)}%`,
                  tradesCount: tossPerf.tradesCount,
                  maxDrawdown: `${tossPerf.maxDrawdown.toFixed(2)}%`,
                  sharpeRatio: tossPerf.sharpeRatio.toFixed(2),
                }
              : null,
          },
        },
        200
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return this.jsonResponse(
        {
          status: "error",
          error: `Failed to fetch monthly performance: ${errorMsg}`,
        },
        500
      );
    }
  }

  /**
   * Get team comparison (KIS vs TOSS)
   * GET /api/performance/comparison
   */
  async getTeamComparison(tradingDate?: string): Promise<Response> {
    try {
      const comparison = await this.repo.getTeamComparison(tradingDate);
      const date = tradingDate ?? new Date().toISOString().split("T")[0];

      const kisStats = comparison.kis
        ? {
            totalPnL: `₩${comparison.kis.totalPnl.toLocaleString()}`,
            winRate: `${comparison.kis.winRate.toFixed(2)}%`,
            sharpeRatio: comparison.kis.sharpeRatio,
            totalTrades: comparison.kis.totalTrades,
            maxDrawdown: `${comparison.kis.maxDrawdown.toFixed(2)}%`,
          }
        : null;

      const tossStats = comparison.toss
        ? {
            totalPnL: `₩${comparison.toss.totalPnl.toLocaleString()}`,
            winRate: `${comparison.toss.winRate.toFixed(2)}%`,
            sharpeRatio: comparison.toss.sharpeRatio,
            totalTrades: comparison.toss.totalTrades,
            maxDrawdown: `${comparison.toss.maxDrawdown.toFixed(2)}%`,
          }
        : null;

      let winner: "KIS" | "TOSS" | "DRAW" = "DRAW";
      let winnerScore = "0.00";

      if (kisStats && tossStats) {
        if (comparison.kis!.sharpeRatio > comparison.toss!.sharpeRatio) {
          winner = "KIS";
          winnerScore = comparison.kis!.sharpeRatio.toFixed(2);
        } else if (comparison.toss!.sharpeRatio > comparison.kis!.sharpeRatio) {
          winner = "TOSS";
          winnerScore = comparison.toss!.sharpeRatio.toFixed(2);
        }
      }

      return this.jsonResponse(
        {
          status: "success",
          data: {
            date,
            kis: kisStats,
            toss: tossStats,
            winner,
            winnerScore,
          },
        },
        200
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return this.jsonResponse(
        {
          status: "error",
          error: `Failed to fetch team comparison: ${errorMsg}`,
        },
        500
      );
    }
  }

  /**
   * Get symbol-level performance (both brokers combined)
   * GET /api/performance/symbol/:symbol
   */
  async getSymbolPerformance(symbol: string): Promise<Response> {
    try {
      const kisStats = await this.repo.getSymbolPerformance(symbol, "KIS");
      const tossStats = await this.repo.getSymbolPerformance(symbol, "TOSS");

      if (!kisStats && !tossStats) {
        return this.jsonResponse(
          {
            status: "error",
            error: `No performance data found for symbol: ${symbol}`,
          },
          404
        );
      }

      const totalTrades =
        (kisStats?.totalTrades ?? 0) + (tossStats?.totalTrades ?? 0);

      return this.jsonResponse(
        {
          status: "success",
          data: {
            symbol: symbol,
            kis: kisStats
              ? {
                  totalTrades: kisStats.totalTrades,
                  winRate: `${kisStats.winRate.toFixed(2)}%`,
                  avgWin: `₩${kisStats.avgWin.toLocaleString()}`,
                  avgLoss: `₩${kisStats.avgLoss.toLocaleString()}`,
                  totalPnL: `₩${kisStats.totalPnl.toLocaleString()}`,
                  roiPercent: `${kisStats.roiPercent.toFixed(2)}%`,
                }
              : null,
            toss: tossStats
              ? {
                  totalTrades: tossStats.totalTrades,
                  winRate: `${tossStats.winRate.toFixed(2)}%`,
                  avgWin: `₩${tossStats.avgWin.toLocaleString()}`,
                  avgLoss: `₩${tossStats.avgLoss.toLocaleString()}`,
                  totalPnL: `₩${tossStats.totalPnl.toLocaleString()}`,
                  roiPercent: `${tossStats.roiPercent.toFixed(2)}%`,
                }
              : null,
            totalTrades,
          },
        },
        200
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return this.jsonResponse(
        {
          status: "error",
          error: `Failed to fetch symbol performance: ${errorMsg}`,
        },
        500
      );
    }
  }

  /**
   * Get top performing symbols
   * GET /api/performance/top-symbols?limit=10&broker=KIS
   */
  async getTopPerformingSymbols(
    limit: number = 5,
    broker: "KIS" | "TOSS" = "KIS"
  ): Promise<Response> {
    try {
      if (limit < 1 || limit > 100) {
        limit = 5;
      }

      const topSymbols = await this.repo.getTopPerformingSymbols(limit, broker);

      return this.jsonResponse(
        {
          status: "success",
          data: {
            broker,
            limit,
            count: topSymbols.length,
            top: topSymbols.map((s) => ({
              symbol: s.symbol,
              totalPnL: `₩${s.totalPnl.toLocaleString()}`,
              winRate: `${s.winRate.toFixed(2)}%`,
              trades: s.totalTrades,
              roiPercent: `${s.roiPercent.toFixed(2)}%`,
            })),
          },
        },
        200
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return this.jsonResponse(
        {
          status: "error",
          error: `Failed to fetch top symbols: ${errorMsg}`,
        },
        500
      );
    }
  }

  /**
   * Get worst performing symbols
   * GET /api/performance/worst-symbols?limit=5&broker=TOSS
   */
  async getWorstPerformingSymbols(
    limit: number = 5,
    broker: "KIS" | "TOSS" = "KIS"
  ): Promise<Response> {
    try {
      if (limit < 1 || limit > 100) {
        limit = 5;
      }

      const worstSymbols = await this.repo.getWorstPerformingSymbols(
        limit,
        broker
      );

      return this.jsonResponse(
        {
          status: "success",
          data: {
            broker,
            limit,
            count: worstSymbols.length,
            worst: worstSymbols.map((s) => ({
              symbol: s.symbol,
              totalPnL: `₩${s.totalPnl.toLocaleString()}`,
              winRate: `${s.winRate.toFixed(2)}%`,
              trades: s.totalTrades,
              roiPercent: `${s.roiPercent.toFixed(2)}%`,
            })),
          },
        },
        200
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return this.jsonResponse(
        {
          status: "error",
          error: `Failed to fetch worst symbols: ${errorMsg}`,
        },
        500
      );
    }
  }

  /**
   * Get daily performance range (for charts)
   * GET /api/performance/range?start=2026-08-01&end=2026-08-31&broker=KIS
   */
  async getDailyPerformanceRange(
    startDate: string,
    endDate: string,
    broker: "KIS" | "TOSS"
  ): Promise<Response> {
    try {
      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        return this.jsonResponse(
          {
            status: "error",
            error: "Invalid date format. Use YYYY-MM-DD",
          },
          400
        );
      }

      const performance = await this.repo.getDailyPerformanceRange(
        startDate,
        endDate,
        broker
      );

      return this.jsonResponse(
        {
          status: "success",
          data: {
            broker,
            range: {
              start: startDate,
              end: endDate,
            },
            count: performance.length,
            days: performance.map((p) => ({
              date: p.tradingDate,
              trades: p.totalTrades,
              winRate: `${p.winRate.toFixed(2)}%`,
              totalPnL: `₩${p.totalPnl.toLocaleString()}`,
              totalPnLPercent: `${p.totalPnlPercent.toFixed(2)}%`,
              sharpeRatio: p.sharpeRatio.toFixed(2),
            })),
          },
        },
        200
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return this.jsonResponse(
        {
          status: "error",
          error: `Failed to fetch performance range: ${errorMsg}`,
        },
        500
      );
    }
  }

  // ============ Private Helpers ============

  /**
   * Create a JSON response with proper headers
   */
  private jsonResponse<T>(
    data: T,
    status: number = 200
  ): Response {
    return new Response(JSON.stringify(data, null, 2), {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }
}
