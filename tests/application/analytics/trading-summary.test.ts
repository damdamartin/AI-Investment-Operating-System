/**
 * Tests for Trading Summary Analytics
 *
 * Verifies:
 * - Daily trading summary calculation
 * - Broker-specific performance
 * - Trade execution statistics
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

interface TradingDay {
  date: string;
  broker: string;
  totalTrades: number;
  winnersCount: number;
  losersCount: number;
  avgWinSize: number;
  avgLossSize: number;
  totalPnL: number;
}

class TradingSummaryAnalytics {
  calculateDailySummary(trades: any[]): TradingDay {
    const grouped = trades.reduce(
      (acc: any, trade: any) => {
        acc.winners += trade.pnl > 0 ? 1 : 0;
        acc.losers += trade.pnl <= 0 ? 1 : 0;
        acc.winTotal += Math.max(0, trade.pnl);
        acc.lossTotal += Math.min(0, trade.pnl);
        acc.totalPnL += trade.pnl;
        return acc;
      },
      { winners: 0, losers: 0, winTotal: 0, lossTotal: 0, totalPnL: 0 }
    );

    return {
      date: new Date().toISOString().split("T")[0],
      broker: trades[0]?.broker || "UNKNOWN",
      totalTrades: trades.length,
      winnersCount: grouped.winners,
      losersCount: grouped.losers,
      avgWinSize: grouped.winners > 0 ? grouped.winTotal / grouped.winners : 0,
      avgLossSize: grouped.losers > 0 ? grouped.lossTotal / grouped.losers : 0,
      totalPnL: grouped.totalPnL
    };
  }

  calculateWinRate(winnersCount: number, totalTrades: number): number {
    return totalTrades === 0 ? 0 : (winnersCount / totalTrades) * 100;
  }

  calculateProfitFactor(totalWins: number, totalLosses: number): number {
    return totalLosses === 0 ? (totalWins > 0 ? Infinity : 0) : totalWins / Math.abs(totalLosses);
  }
}

describe("TradingSummaryAnalytics", () => {
  let analytics: TradingSummaryAnalytics;

  beforeEach(() => {
    analytics = new TradingSummaryAnalytics();
  });

  describe("calculateDailySummary", () => {
    it("should calculate summary for winning trades", () => {
      const trades = [
        { pnl: 1000, broker: "KIS" },
        { pnl: 1500, broker: "KIS" },
        { pnl: 2000, broker: "KIS" }
      ];

      const summary = analytics.calculateDailySummary(trades);

      expect(summary.totalTrades).toBe(3);
      expect(summary.winnersCount).toBe(3);
      expect(summary.losersCount).toBe(0);
      expect(summary.totalPnL).toBe(4500);
      expect(summary.avgWinSize).toBe(1500);
    });

    it("should calculate summary for losing trades", () => {
      const trades = [
        { pnl: -500, broker: "KIS" },
        { pnl: -1000, broker: "KIS" }
      ];

      const summary = analytics.calculateDailySummary(trades);

      expect(summary.totalTrades).toBe(2);
      expect(summary.winnersCount).toBe(0);
      expect(summary.losersCount).toBe(2);
      expect(summary.totalPnL).toBe(-1500);
      expect(summary.avgLossSize).toBe(-750);
    });

    it("should calculate summary for mixed trades", () => {
      const trades = [
        { pnl: 1000, broker: "KIS" },
        { pnl: -500, broker: "KIS" },
        { pnl: 2000, broker: "KIS" },
        { pnl: -800, broker: "KIS" }
      ];

      const summary = analytics.calculateDailySummary(trades);

      expect(summary.totalTrades).toBe(4);
      expect(summary.winnersCount).toBe(2);
      expect(summary.losersCount).toBe(2);
      expect(summary.totalPnL).toBe(1700);
    });

    it("should handle empty trade list", () => {
      const summary = analytics.calculateDailySummary([]);

      expect(summary.totalTrades).toBe(0);
      expect(summary.winnersCount).toBe(0);
      expect(summary.losersCount).toBe(0);
      expect(summary.totalPnL).toBe(0);
    });
  });

  describe("calculateWinRate", () => {
    it("should calculate win rate for 100% winners", () => {
      const winRate = analytics.calculateWinRate(10, 10);
      expect(winRate).toBe(100);
    });

    it("should calculate win rate for 50% winners", () => {
      const winRate = analytics.calculateWinRate(5, 10);
      expect(winRate).toBe(50);
    });

    it("should calculate win rate for 0% winners", () => {
      const winRate = analytics.calculateWinRate(0, 10);
      expect(winRate).toBe(0);
    });

    it("should handle zero total trades", () => {
      const winRate = analytics.calculateWinRate(0, 0);
      expect(winRate).toBe(0);
    });
  });

  describe("calculateProfitFactor", () => {
    it("should calculate profit factor for positive trades", () => {
      const pf = analytics.calculateProfitFactor(5000, -2000);
      expect(pf).toBe(2.5);
    });

    it("should return Infinity for all winning trades", () => {
      const pf = analytics.calculateProfitFactor(5000, 0);
      expect(pf).toBe(Infinity);
    });

    it("should return 0 for all losing trades", () => {
      const pf = analytics.calculateProfitFactor(0, -5000);
      expect(pf).toBe(0);
    });

    it("should calculate profit factor for breakeven", () => {
      const pf = analytics.calculateProfitFactor(0, 0);
      expect(pf).toBe(0);
    });
  });
});
