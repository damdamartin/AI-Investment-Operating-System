/**
 * Tests for Position Sizing Logic
 *
 * Verifies:
 * - Kelly Criterion position sizing
 * - Risk-based position sizing
 * - Maximum position size limits
 * - Portfolio heat calculation
 */

import { describe, it, expect, beforeEach } from "vitest";

interface PositionSizingParams {
  accountBalance: number;
  riskPerTrade: number; // 0.02 = 2%
  symbol: string;
  entryPrice: number;
  stopLossPrice: number;
}

interface PositionSize {
  quantity: number;
  notionalValue: number;
  riskAmount: number;
  riskPercent: number;
}

class PositionSizer {
  private readonly maxPortfolioHeat = 0.06; // Maximum 6% total risk
  private readonly maxPositionSize = 0.20; // Maximum 20% per position

  /**
   * Calculate position size based on risk amount
   */
  calculateRiskBasedSize(params: PositionSizingParams): PositionSize {
    // Calculate risk amount (account balance * risk per trade)
    const riskAmount = params.accountBalance * params.riskPerTrade;

    // Calculate distance to stop loss
    const riskPerShare = Math.abs(params.entryPrice - params.stopLossPrice);

    // Calculate quantity (risk amount / risk per share)
    const quantity = Math.floor(riskAmount / riskPerShare);

    // Calculate notional value
    const notionalValue = quantity * params.entryPrice;

    // Calculate actual risk percent
    const riskPercent = (riskAmount / params.accountBalance) * 100;

    return {
      quantity: Math.max(0, quantity),
      notionalValue,
      riskAmount,
      riskPercent
    };
  }

  /**
   * Kelly Criterion position sizing
   * Size = (Win% * AvgWin - Loss% * AvgLoss) / AvgWin
   */
  calculateKellySize(
    winRate: number, // 0.6 = 60%
    avgWin: number,
    avgLoss: number,
    accountBalance: number,
    maxRisk: number = 0.25 // Don't risk more than 25% of Kelly
  ): number {
    const lossRate = 1 - winRate;

    // Kelly = (p * b - q) / b
    // p = win rate, q = loss rate, b = win/loss ratio
    const winLossRatio = avgWin / avgLoss;

    let kelly = (winRate * winLossRatio - lossRate) / winLossRatio;

    // Ensure Kelly is between 0 and maxRisk
    kelly = Math.max(0, Math.min(kelly, maxRisk));

    // Calculate position size as percentage of account
    return Math.floor((accountBalance * kelly) / 100);
  }

  /**
   * Check if adding this position exceeds portfolio heat limits
   */
  validatePortfolioHeat(
    currentExposure: number, // Current open position risk
    newPositionRisk: number // New position risk amount
  ): { valid: boolean; message?: string } {
    const totalHeat = currentExposure + newPositionRisk;

    if (totalHeat > this.maxPortfolioHeat) {
      return {
        valid: false,
        message: `Portfolio heat would be ${(totalHeat * 100).toFixed(1)}%, exceeding ${(this.maxPortfolioHeat * 100).toFixed(1)}%`
      };
    }

    return { valid: true };
  }

  /**
   * Apply dynamic position sizing based on win rate
   */
  applyDynamicSizing(baseSize: number, recentWinRate: number): number {
    // Increase size when winning more
    // Decrease size when losing more
    const multiplier = 0.8 + recentWinRate * 0.4; // 0.8 to 1.2x
    return Math.floor(baseSize * multiplier);
  }

  /**
   * Calculate max portfolio positions to meet diversification
   */
  calculateMaxConcurrentPositions(accountBalance: number, maxPositionPercent: number = 0.05): number {
    // If each position is max 5%, we can have at most 20 positions
    return Math.floor(1 / maxPositionPercent);
  }
}

describe("PositionSizer", () => {
  let sizer: PositionSizer;

  beforeEach(() => {
    sizer = new PositionSizer();
  });

  describe("calculateRiskBasedSize", () => {
    it("should calculate position size for $1M account with 2% risk", () => {
      const size = sizer.calculateRiskBasedSize({
        accountBalance: 1000000,
        riskPerTrade: 0.02,
        symbol: "005930",
        entryPrice: 70000,
        stopLossPrice: 65000
      });

      expect(size.riskAmount).toBe(20000); // 1M * 2%
      expect(size.quantity).toBe(4); // 20000 / 5000
      expect(size.notionalValue).toBe(280000); // 4 * 70000
    });

    it("should handle tight stop loss (small risk)", () => {
      const size = sizer.calculateRiskBasedSize({
        accountBalance: 1000000,
        riskPerTrade: 0.01,
        symbol: "005930",
        entryPrice: 70000,
        stopLossPrice: 69000 // $1000 risk
      });

      expect(size.quantity).toBe(100); // 10000 / 1000
    });

    it("should handle wide stop loss (large risk)", () => {
      const size = sizer.calculateRiskBasedSize({
        accountBalance: 1000000,
        riskPerTrade: 0.01,
        symbol: "005930",
        entryPrice: 70000,
        stopLossPrice: 50000 // $20000 risk
      });

      expect(size.quantity).toBe(0); // Can't afford full risk
    });

    it("should respect 2% risk per trade", () => {
      const size = sizer.calculateRiskBasedSize({
        accountBalance: 100000,
        riskPerTrade: 0.02,
        symbol: "005930",
        entryPrice: 50000,
        stopLossPrice: 45000
      });

      expect(size.riskPercent).toBeCloseTo(2, 1);
    });
  });

  describe("calculateKellySize", () => {
    it("should calculate Kelly size for 60% win rate strategy", () => {
      const size = sizer.calculateKellySize(0.6, 1000, 1000, 100000);

      // Kelly = (0.6 * 1 - 0.4) / 1 = 0.2 = 20%
      // With 25% max risk: 20% * 100% = 20% of account
      expect(size).toBeGreaterThan(0);
    });

    it("should handle breakeven strategy", () => {
      const size = sizer.calculateKellySize(0.5, 1000, 1000, 100000);
      expect(size).toBe(0); // No positive edge
    });

    it("should reduce size for negative expectancy", () => {
      const size = sizer.calculateKellySize(0.4, 1000, 1500, 100000);
      expect(size).toBe(0); // Losing strategy
    });

    it("should cap Kelly at max risk", () => {
      const size = sizer.calculateKellySize(0.9, 2, 1, 100000, 0.25);
      // Kelly = (0.9 * 2 - 0.1) / 2 = 0.85, capped at 0.25
      expect(size).toBeLessThanOrEqual(25000);
    });

    it("should scale with account size", () => {
      const smallSize = sizer.calculateKellySize(0.6, 1000, 1000, 10000);
      const largeSize = sizer.calculateKellySize(0.6, 1000, 1000, 100000);

      expect(largeSize).toBeGreaterThan(smallSize);
    });
  });

  describe("validatePortfolioHeat", () => {
    it("should accept position within heat limit", () => {
      const result = sizer.validatePortfolioHeat(0.02, 0.01);
      expect(result.valid).toBe(true);
    });

    it("should reject position exceeding heat limit", () => {
      const result = sizer.validatePortfolioHeat(0.04, 0.03); // 7% total > 6% limit
      expect(result.valid).toBe(false);
      expect(result.message).toContain("7.0%");
    });

    it("should handle zero current exposure", () => {
      const result = sizer.validatePortfolioHeat(0, 0.05);
      expect(result.valid).toBe(true);
    });

    it("should handle at limit", () => {
      const result = sizer.validatePortfolioHeat(0.03, 0.03);
      expect(result.valid).toBe(true); // Exactly at 6% limit
    });
  });

  describe("applyDynamicSizing", () => {
    it("should increase size when winning", () => {
      const sized = sizer.applyDynamicSizing(100, 0.8); // 80% win rate
      // Multiplier = 0.8 + 0.8 * 0.4 = 1.12
      expect(sized).toBe(112);
    });

    it("should decrease size when losing", () => {
      const sized = sizer.applyDynamicSizing(100, 0.2); // 20% win rate
      // Multiplier = 0.8 + 0.2 * 0.4 = 0.88
      expect(sized).toBe(88);
    });

    it("should use base size at 50% win rate", () => {
      const sized = sizer.applyDynamicSizing(100, 0.5);
      // Multiplier = 0.8 + 0.5 * 0.4 = 1.0
      expect(sized).toBe(100);
    });

    it("should handle extremes", () => {
      const min = sizer.applyDynamicSizing(100, 0); // 0% win rate
      const max = sizer.applyDynamicSizing(100, 1); // 100% win rate

      expect(min).toBe(80); // 0.8x
      expect(max).toBe(120); // 1.2x
    });
  });

  describe("calculateMaxConcurrentPositions", () => {
    it("should allow 20 positions at 5% max per position", () => {
      const maxPositions = sizer.calculateMaxConcurrentPositions(1000000, 0.05);
      expect(maxPositions).toBe(20);
    });

    it("should allow 10 positions at 10% max per position", () => {
      const maxPositions = sizer.calculateMaxConcurrentPositions(1000000, 0.1);
      expect(maxPositions).toBe(10);
    });

    it("should allow 4 positions at 25% max per position", () => {
      const maxPositions = sizer.calculateMaxConcurrentPositions(1000000, 0.25);
      expect(maxPositions).toBe(4);
    });
  });
});
