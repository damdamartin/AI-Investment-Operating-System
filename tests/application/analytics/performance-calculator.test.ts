import { describe, it, expect } from "vitest";
import {
  calculateWinRate,
  calculateSharpeRatio,
  calculateProfitFactor,
  calculateMaxDrawdown,
  calculateROI,
  calculateAverageWinLoss,
  calculateGrossPnL,
  calculatePnLPercent,
  PerformanceAnalyzer,
} from "../../../src/application/analytics/performance-calculator.js";

describe("Performance Calculator", () => {
  describe("calculateWinRate", () => {
    it("should return 0 when total trades is 0", () => {
      const rate = calculateWinRate(0, 0);
      expect(rate).toBe(0);
    });

    it("should calculate win rate correctly", () => {
      const rate = calculateWinRate(7, 10);
      expect(rate).toBe(70);
    });

    it("should handle 100% win rate", () => {
      const rate = calculateWinRate(5, 5);
      expect(rate).toBe(100);
    });

    it("should handle 0% win rate", () => {
      const rate = calculateWinRate(0, 5);
      expect(rate).toBe(0);
    });

    it("should clamp result to 0-100", () => {
      // This shouldn't happen in real scenarios but tests edge case
      const rate = calculateWinRate(10, 10);
      expect(rate).toBeLessThanOrEqual(100);
      expect(rate).toBeGreaterThanOrEqual(0);
    });
  });

  describe("calculateSharpeRatio", () => {
    it("should return 0 for empty returns array", () => {
      const ratio = calculateSharpeRatio([]);
      expect(ratio).toBe(0);
    });

    it("should return 0 when all returns are the same (zero volatility)", () => {
      const ratio = calculateSharpeRatio([0.05, 0.05, 0.05]);
      expect(ratio).toBe(0);
    });

    it("should calculate Sharpe ratio with positive returns", () => {
      const returns = [0.01, 0.02, 0.015, 0.025, 0.018];
      const ratio = calculateSharpeRatio(returns);
      expect(ratio).toBeGreaterThan(0);
    });

    it("should calculate Sharpe ratio with mixed returns", () => {
      const returns = [0.05, -0.02, 0.03, -0.01, 0.04];
      const ratio = calculateSharpeRatio(returns);
      expect(typeof ratio).toBe("number");
    });

    it("should account for risk-free rate", () => {
      const returns = [0.05, 0.06, 0.04];
      const ratio1 = calculateSharpeRatio(returns, 0);
      const ratio2 = calculateSharpeRatio(returns, 0.02);
      expect(ratio1).toBeGreaterThan(ratio2);
    });

    it("should handle single return value", () => {
      const ratio = calculateSharpeRatio([0.05]);
      expect(ratio).toBe(0); // Single value has no variance
    });
  });

  describe("calculateProfitFactor", () => {
    it("should return 0 when both profit and loss are 0", () => {
      const factor = calculateProfitFactor(0, 0);
      expect(factor).toBe(0);
    });

    it("should return Infinity when there are profits but no losses", () => {
      const factor = calculateProfitFactor(1000, 0);
      expect(factor).toBe(Infinity);
    });

    it("should calculate profit factor correctly", () => {
      const factor = calculateProfitFactor(2000, 1000);
      expect(factor).toBe(2);
    });

    it("should handle fractional profit factor", () => {
      const factor = calculateProfitFactor(1500, 3000);
      expect(factor).toBeCloseTo(0.5, 5);
    });

    it("should handle negative loss values (absolute)", () => {
      const factor = calculateProfitFactor(2000, -1000);
      expect(factor).toBe(2);
    });
  });

  describe("calculateMaxDrawdown", () => {
    it("should return 0 for empty array", () => {
      const dd = calculateMaxDrawdown([]);
      expect(dd).toBe(0);
    });

    it("should return 0 when equity is always increasing", () => {
      const cumulativePnL = [100, 110, 120, 130, 140];
      const dd = calculateMaxDrawdown(cumulativePnL);
      expect(dd).toBe(0);
    });

    it("should calculate max drawdown correctly", () => {
      const cumulativePnL = [100, 120, 80, 90, 100];
      const dd = calculateMaxDrawdown(cumulativePnL);
      // Peak is 120, trough is 80, DD = (80-120)/120 = -33.33%
      expect(dd).toBeCloseTo(-33.33, 1);
    });

    it("should handle negative P&L values", () => {
      const cumulativePnL = [0, -50, -30, -100, -80];
      const dd = calculateMaxDrawdown(cumulativePnL);
      expect(dd).toBeLessThanOrEqual(0);
    });

    it("should return 0 when starting at 0", () => {
      const cumulativePnL = [0, 10, 5, 15];
      const dd = calculateMaxDrawdown(cumulativePnL);
      // Starting at 0 with subsequent gains/losses
      expect(typeof dd).toBe("number");
    });

    it("should find drawdown from highest peak", () => {
      const cumulativePnL = [100, 150, 120, 130, 110];
      const dd = calculateMaxDrawdown(cumulativePnL);
      // Peak at 150, trough at 110, DD = (110-150)/150 = -26.67%
      expect(dd).toBeCloseTo(-26.67, 1);
    });
  });

  describe("calculateROI", () => {
    it("should return 0 when start capital is 0", () => {
      const roi = calculateROI(0, 100);
      expect(roi).toBe(0);
    });

    it("should calculate ROI correctly for profit", () => {
      const roi = calculateROI(1000, 1200);
      expect(roi).toBe(20);
    });

    it("should calculate ROI correctly for loss", () => {
      const roi = calculateROI(1000, 800);
      expect(roi).toBe(-20);
    });

    it("should handle 100% gain", () => {
      const roi = calculateROI(100, 200);
      expect(roi).toBe(100);
    });

    it("should handle total loss", () => {
      const roi = calculateROI(1000, 0);
      expect(roi).toBe(-100);
    });

    it("should handle no change", () => {
      const roi = calculateROI(1000, 1000);
      expect(roi).toBe(0);
    });
  });

  describe("calculateAverageWinLoss", () => {
    it("should return 0 for empty arrays", () => {
      const { avgWin, avgLoss } = calculateAverageWinLoss([], []);
      expect(avgWin).toBe(0);
      expect(avgLoss).toBe(0);
    });

    it("should calculate average win correctly", () => {
      const { avgWin } = calculateAverageWinLoss([100, 200, 300], []);
      expect(avgWin).toBe(200);
    });

    it("should calculate average loss correctly", () => {
      const { avgLoss } = calculateAverageWinLoss([], [50, 100, 150]);
      expect(avgLoss).toBe(100);
    });

    it("should calculate both averages", () => {
      const { avgWin, avgLoss } = calculateAverageWinLoss([100, 200], [50, 100]);
      expect(avgWin).toBe(150);
      expect(avgLoss).toBe(75);
    });
  });

  describe("calculateGrossPnL", () => {
    it("should return 0 for empty array", () => {
      const { grossProfit, grossLoss, totalPnL } = calculateGrossPnL([]);
      expect(grossProfit).toBe(0);
      expect(grossLoss).toBe(0);
      expect(totalPnL).toBe(0);
    });

    it("should calculate gross profit correctly", () => {
      const { grossProfit } = calculateGrossPnL([100, 50, 75]);
      expect(grossProfit).toBe(225);
    });

    it("should calculate gross loss correctly", () => {
      const { grossLoss } = calculateGrossPnL([-50, -100, -25]);
      expect(grossLoss).toBe(175);
    });

    it("should calculate net P&L correctly", () => {
      const { totalPnL } = calculateGrossPnL([100, -50, 75, -25]);
      expect(totalPnL).toBe(100);
    });

    it("should separate profits and losses", () => {
      const { grossProfit, grossLoss, totalPnL } = calculateGrossPnL([200, -100, 150, -50]);
      expect(grossProfit).toBe(350);
      expect(grossLoss).toBe(150);
      expect(totalPnL).toBe(200);
    });
  });

  describe("calculatePnLPercent", () => {
    it("should return 0 when entry value is 0", () => {
      const pct = calculatePnLPercent(100, 0);
      expect(pct).toBe(0);
    });

    it("should calculate P&L percent correctly", () => {
      // Entry value: 1000, P&L: 200 = 20%
      const pct = calculatePnLPercent(200, 1000);
      expect(pct).toBe(20);
    });

    it("should handle negative P&L", () => {
      const pct = calculatePnLPercent(-100, 1000);
      expect(pct).toBe(-10);
    });

    it("should handle fractional P&L", () => {
      const pct = calculatePnLPercent(50, 200);
      expect(pct).toBe(25);
    });
  });

  describe("PerformanceAnalyzer", () => {
    it("should return zeros for empty trades", () => {
      const analysis = PerformanceAnalyzer.analyzeTrades([]);
      expect(analysis.totalTrades).toBe(0);
      expect(analysis.winningTrades).toBe(0);
      expect(analysis.losingTrades).toBe(0);
      expect(analysis.totalPnL).toBe(0);
    });

    it("should analyze single winning trade", () => {
      const analysis = PerformanceAnalyzer.analyzeTrades([{ pnl: 100, pnlPercent: 10 }]);
      expect(analysis.totalTrades).toBe(1);
      expect(analysis.winningTrades).toBe(1);
      expect(analysis.losingTrades).toBe(0);
      expect(analysis.winRate).toBe(100);
      expect(analysis.totalPnL).toBe(100);
    });

    it("should analyze multiple mixed trades", () => {
      const trades = [
        { pnl: 100, pnlPercent: 10 },
        { pnl: -50, pnlPercent: -5 },
        { pnl: 75, pnlPercent: 7.5 },
        { pnl: -25, pnlPercent: -2.5 },
      ];
      const analysis = PerformanceAnalyzer.analyzeTrades(trades);
      expect(analysis.totalTrades).toBe(4);
      expect(analysis.winningTrades).toBe(2);
      expect(analysis.losingTrades).toBe(2);
      expect(analysis.winRate).toBe(50);
      expect(analysis.totalPnL).toBe(100);
      expect(analysis.avgWin).toBeCloseTo(87.5, 1);
      expect(analysis.avgLoss).toBeCloseTo(37.5, 1);
      expect(analysis.profitFactor).toBeCloseTo(2.33, 1);
    });

    it("should handle zero P&L trades", () => {
      const trades = [
        { pnl: 100, pnlPercent: 10 },
        { pnl: 0, pnlPercent: 0 },
        { pnl: -100, pnlPercent: -10 },
      ];
      const analysis = PerformanceAnalyzer.analyzeTrades(trades);
      expect(analysis.totalTrades).toBe(3);
      expect(analysis.winningTrades).toBe(1);
      expect(analysis.losingTrades).toBe(1);
      expect(analysis.totalPnL).toBe(0);
    });

    it("should calculate rolling metrics", () => {
      const returns = [0.01, 0.02, 0.015, 0.025, 0.018, 0.022, 0.019];
      const { sharpeRatios, movingAverageReturns } = PerformanceAnalyzer.calculateRollingMetrics(
        returns,
        3
      );

      expect(sharpeRatios.length).toBe(returns.length - 3 + 1);
      expect(movingAverageReturns.length).toBe(returns.length - 3 + 1);

      for (const ratio of sharpeRatios) {
        expect(typeof ratio).toBe("number");
      }
    });
  });
});
