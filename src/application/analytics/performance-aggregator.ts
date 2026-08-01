/**
 * Performance Aggregator
 *
 * Automatically records and aggregates trade completion data (stop-loss/take-profit triggers).
 * - Records each trade completion immediately
 * - Updates daily performance metrics (cumulative)
 * - Updates symbol-level performance
 * - Aggregates monthly performance metrics (daily cron job)
 *
 * Integration Flow:
 * 1. StopLossMonitor/TakeProfitMonitor trigger → PerformanceAggregator.recordTradeCompletion()
 * 2. Daily performance updated incrementally
 * 3. Daily cron (00:00 UTC) → aggregateMonthlyPerformance()
 * 4. Dashboard queries daily/monthly/symbol performance
 */

import { PerformanceRepository, type DailyPerformance, type SymbolPerformance } from "../../persistence/performance-repository.js";
import {
  calculateWinRate,
  calculateSharpeRatio,
  calculateMaxDrawdown,
  calculateProfitFactor,
  calculateROI,
  calculateAverageWinLoss,
  calculateGrossPnL,
} from "./performance-calculator.js";

/**
 * Position data from trading system
 */
export interface Position {
  id: string;
  symbol: string;
  quantity: number;
  entry_price: number;
  entry_date: string;
  stop_loss_price: number;
  take_profit_price: number;
  broker: "KIS" | "TOSS";
}

/**
 * Order data from trading system
 */
export interface Order {
  id: string;
  positionId: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  executedAt: string;
  status: "PENDING" | "EXECUTED" | "CANCELLED";
}

/**
 * PerformanceAggregator: Records and aggregates trading performance
 */
export class PerformanceAggregator {
  constructor(private readonly repository: PerformanceRepository, private readonly db: any) {}

  /**
   * Main entry point: Record trade completion (called after SL/TP trigger)
   *
   * Flow:
   * 1. Calculate P&L
   * 2. Update daily performance (cumulative)
   * 3. Update symbol performance
   * 4. Optionally trigger monthly aggregation if needed
   */
  async recordTradeCompletion(
    position: Position,
    closedPrice: number,
    triggerType: "SL" | "TP",
    order: Order
  ): Promise<void> {
    try {
      const now = new Date();
      const tradingDate = now.toISOString().split("T")[0]!;
      const broker = position.broker as "KIS" | "TOSS";

      // Calculate P&L
      const pnl = (closedPrice - position.entry_price) * position.quantity;
      const pnlPercent = ((closedPrice - position.entry_price) / position.entry_price) * 100;

      console.log(
        `[PerformanceAggregator] Recording: ${position.symbol} (${broker}) ` +
        `${triggerType} @ ${closedPrice}, P&L: ₩${pnl.toLocaleString()} (${pnlPercent.toFixed(2)}%)`
      );

      // 1. Update daily performance
      await this.updateDailyPerformance(tradingDate, broker, {
        symbol: position.symbol,
        pnl,
        pnlPercent,
        triggerType,
      });

      // 2. Update symbol performance
      await this.updateSymbolPerformance(position.symbol, broker, {
        pnl,
        pnlPercent,
      });

      // 3. Record position close event (for audit trail)
      await this.recordPositionClosed(position, closedPrice, triggerType, pnl, pnlPercent, broker);

      console.log(
        `[PerformanceAggregator] ✅ Trade recorded: ${position.symbol} (${broker})`
      );
    } catch (error) {
      console.error(`[PerformanceAggregator] Error recording trade:`, error);
      throw error;
    }
  }

  /**
   * Update daily performance metrics (cumulative)
   * Called after each trade completion
   */
  private async updateDailyPerformance(
    tradingDate: string,
    broker: "KIS" | "TOSS",
    tradeData: { symbol: string; pnl: number; pnlPercent: number; triggerType: "SL" | "TP" }
  ): Promise<void> {
    try {
      // Get or create daily performance
      const existing = await this.repository.getDailyPerformance(tradingDate, broker);

      if (existing) {
        // Update existing
        const isWin = tradeData.pnl > 0;
        const isLoss = tradeData.pnl < 0;
        const newTotalTrades = existing.totalTrades + 1;
        const newWinningTrades = existing.winningTrades + (isWin ? 1 : 0);
        const newLosingTrades = existing.losingTrades + (isLoss ? 1 : 0);
        const newTotalPnL = existing.totalPnl + tradeData.pnl;

        // Recalculate aggregated metrics
        const winRate = calculateWinRate(newWinningTrades, newTotalTrades);
        const avgWin = newWinningTrades > 0 ? (newTotalPnL + Math.abs(existing.avgLoss * existing.losingTrades)) / newWinningTrades : 0;
        const avgLoss = newLosingTrades > 0 ? Math.abs(newTotalPnL - (avgWin * newWinningTrades)) / newLosingTrades : 0;
        const profitFactor = calculateProfitFactor(
          newWinningTrades * avgWin,
          newLosingTrades * avgLoss
        );

        const updated = await this.repository.updateDailyPerformance(
          tradingDate,
          broker,
          {
            totalTrades: newTotalTrades,
            winningTrades: newWinningTrades,
            losingTrades: newLosingTrades,
            totalPnl: newTotalPnL,
            totalPnlPercent: (newTotalPnL / 1000000) * 100, // Assuming 1M initial capital
            avgWin,
            avgLoss,
            winRate,
            maxDrawdown: 0, // Will be calculated in aggregation
            sharpeRatio: 0, // Will be calculated in aggregation
            profitFactor,
            slTriggeredCount: tradeData.triggerType === "SL" ? existing.slTriggeredCount + 1 : existing.slTriggeredCount,
            tpTriggeredCount: tradeData.triggerType === "TP" ? existing.tpTriggeredCount + 1 : existing.tpTriggeredCount,
          }
        );

        console.log(
          `[DailyPerformance] Updated: ${tradingDate}/${broker} - ` +
          `Trades: ${updated.totalTrades}, Win Rate: ${updated.winRate.toFixed(1)}%, P&L: ₩${updated.totalPnl.toLocaleString()}`
        );
      } else {
        // Create new
        const isWin = tradeData.pnl > 0;
        const isLoss = tradeData.pnl < 0;
        const winRate = isWin ? 100 : (isLoss ? 0 : 0); // Break-even has 0 win rate but doesn't count as loss

        const created = await this.repository.updateDailyPerformance(
          tradingDate,
          broker,
          {
            totalTrades: 1,
            winningTrades: isWin ? 1 : 0,
            losingTrades: isLoss ? 1 : 0,
            totalPnl: tradeData.pnl,
            totalPnlPercent: (tradeData.pnl / 1000000) * 100,
            avgWin: isWin ? tradeData.pnl : 0,
            avgLoss: !isWin ? Math.abs(tradeData.pnl) : 0,
            winRate,
            maxDrawdown: 0,
            sharpeRatio: 0,
            profitFactor: isWin ? Infinity : 0,
            slTriggeredCount: tradeData.triggerType === "SL" ? 1 : 0,
            tpTriggeredCount: tradeData.triggerType === "TP" ? 1 : 0,
          }
        );

        console.log(
          `[DailyPerformance] Created: ${tradingDate}/${broker} - ` +
          `First trade, P&L: ₩${created.totalPnl.toLocaleString()}`
        );
      }
    } catch (error) {
      console.error(`[PerformanceAggregator] Error updating daily performance:`, error);
      throw error;
    }
  }

  /**
   * Update symbol-level performance metrics
   * Called after each trade completion
   */
  private async updateSymbolPerformance(
    symbol: string,
    broker: "KIS" | "TOSS",
    tradeData: { pnl: number; pnlPercent: number }
  ): Promise<void> {
    try {
      const existing = await this.repository.getSymbolPerformance(symbol, broker);

      if (existing) {
        // Update existing
        const isWin = tradeData.pnl > 0;
        const isLoss = tradeData.pnl < 0;
        const newTotalTrades = existing.totalTrades + 1;
        const newWinningTrades = existing.winningTrades + (isWin ? 1 : 0);
        const newTotalPnL = existing.totalPnl + tradeData.pnl;

        // Recalculate averages
        const grossProfit = newWinningTrades > 0 ? (newTotalPnL + Math.abs(existing.avgLoss * (existing.totalTrades - existing.winningTrades))) : 0;
        const grossLoss = (existing.totalTrades - existing.winningTrades + (isWin ? 0 : 1)) > 0
          ? Math.abs(newTotalPnL - grossProfit)
          : 0;
        const newAvgWin = newWinningTrades > 0 ? grossProfit / newWinningTrades : 0;
        const newAvgLoss = newTotalTrades - newWinningTrades > 0 ? grossLoss / (newTotalTrades - newWinningTrades) : 0;
        const winRate = calculateWinRate(newWinningTrades, newTotalTrades);

        const updated = await this.repository.updateSymbolPerformance(
          symbol,
          broker,
          {
            totalTrades: newTotalTrades,
            winningTrades: newWinningTrades,
            avgWin: newAvgWin,
            avgLoss: newAvgLoss,
            winRate,
            totalPnl: newTotalPnL,
            roiPercent: (newTotalPnL / 1000000) * 100, // Assuming 1M per position
          }
        );

        console.log(
          `[SymbolPerformance] Updated: ${symbol}/${broker} - ` +
          `Trades: ${updated.totalTrades}, Win Rate: ${updated.winRate.toFixed(1)}%, P&L: ₩${updated.totalPnl.toLocaleString()}`
        );
      } else {
        // Create new
        const isWin = tradeData.pnl > 0;
        const isLoss = tradeData.pnl < 0;
        const winRate = isWin ? 100 : (isLoss ? 0 : 0);

        const created = await this.repository.updateSymbolPerformance(
          symbol,
          broker,
          {
            totalTrades: 1,
            winningTrades: isWin ? 1 : 0,
            avgWin: isWin ? tradeData.pnl : 0,
            avgLoss: isLoss ? Math.abs(tradeData.pnl) : 0,
            winRate,
            totalPnl: tradeData.pnl,
            roiPercent: (tradeData.pnl / 1000000) * 100,
          }
        );

        console.log(
          `[SymbolPerformance] Created: ${symbol}/${broker} - ` +
          `First trade, P&L: ₩${created.totalPnl.toLocaleString()}`
        );
      }
    } catch (error) {
      console.error(`[PerformanceAggregator] Error updating symbol performance:`, error);
      throw error;
    }
  }

  /**
   * Record position close event (audit trail)
   */
  private async recordPositionClosed(
    position: Position,
    exitPrice: number,
    triggerType: "SL" | "TP",
    pnl: number,
    pnlPercent: number,
    broker: "KIS" | "TOSS"
  ): Promise<void> {
    try {
      const exitReason = triggerType === "SL" ? "STOP_LOSS" : "TAKE_PROFIT";

      await this.repository.recordPositionClosed({
        positionId: position.id,
        symbol: position.symbol,
        quantity: position.quantity,
        entryPrice: position.entry_price,
        exitPrice,
        exitReason,
        pnl,
        pnlPercent,
        broker,
        exitedAt: new Date().toISOString(),
      });

      console.log(
        `[PositionClosedEvent] Recorded: ${position.symbol} (${broker}) ` +
        `via ${exitReason}`
      );
    } catch (error) {
      console.error(`[PerformanceAggregator] Error recording position close:`, error);
      throw error;
    }
  }

  /**
   * Aggregate monthly performance (called daily at 00:00 UTC)
   * Recalculates all metrics for the completed month
   */
  async aggregateMonthlyPerformance(date: Date, broker: "KIS" | "TOSS"): Promise<void> {
    try {
      const year = date.getFullYear();
      const month = date.getMonth() + 1;

      console.log(
        `[MonthlyAggregation] Starting: ${year}-${String(month).padStart(2, "0")} (${broker})`
      );

      // Get all closed positions for the month
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endDate = `${year}-${String(month).padStart(2, "0")}-31`; // Will work for all months

      const closedPositions = await this.repository.getClosedPositionsInRange(
        startDate,
        endDate,
        broker
      );

      if (closedPositions.length === 0) {
        console.log(
          `[MonthlyAggregation] No closed positions for ${year}-${String(month).padStart(2, "0")} (${broker})`
        );

        // Still create record with zeros
        await this.repository.updateMonthlyPerformance(year, month, broker, {
          totalPnl: 0,
          roiPercent: 0,
          winRate: 0,
          maxDrawdown: 0,
          sharpeRatio: 0,
          tradesCount: 0,
        });

        return;
      }

      // Calculate metrics
      const pnlValues = closedPositions.map(p => p.pnl);
      const winAmounts = closedPositions
        .filter(p => p.pnl > 0)
        .map(p => p.pnl);
      const lossAmounts = closedPositions
        .filter(p => p.pnl < 0)
        .map(p => Math.abs(p.pnl));

      const totalPnL = pnlValues.reduce((a, b) => a + b, 0);
      const { avgWin, avgLoss } = calculateAverageWinLoss(winAmounts, lossAmounts);
      const { grossProfit, grossLoss } = calculateGrossPnL(pnlValues);

      // For Sharpe ratio, convert PnL to returns (assuming 1M capital)
      const capitalPerTrade = 1000000;
      const returns = pnlValues.map(pnl => pnl / capitalPerTrade);

      // For drawdown, calculate cumulative P&L
      const cumulativePnL: number[] = [];
      let cumSum = 0;
      for (const pnl of pnlValues) {
        cumSum += pnl;
        cumulativePnL.push(cumSum);
      }

      const metrics = {
        totalPnl: totalPnL,
        roiPercent: calculateROI(capitalPerTrade, capitalPerTrade + totalPnL),
        winRate: calculateWinRate(winAmounts.length, closedPositions.length),
        maxDrawdown: calculateMaxDrawdown(cumulativePnL),
        sharpeRatio: calculateSharpeRatio(returns),
        tradesCount: closedPositions.length,
      };

      await this.repository.updateMonthlyPerformance(year, month, broker, metrics);

      console.log(
        `[MonthlyAggregation] ✅ Completed: ${year}-${String(month).padStart(2, "0")} (${broker})`
      );
      console.log(`   Trades: ${metrics.tradesCount}`);
      console.log(`   Total P&L: ₩${metrics.totalPnl.toLocaleString()}`);
      console.log(`   Win Rate: ${metrics.winRate.toFixed(1)}%`);
      console.log(`   Sharpe Ratio: ${metrics.sharpeRatio.toFixed(2)}`);
      console.log(`   Max Drawdown: ${metrics.maxDrawdown.toFixed(2)}%`);
    } catch (error) {
      console.error(
        `[PerformanceAggregator] Error aggregating monthly performance:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get performance summary for dashboard
   */
  async getPerformanceSummary(broker: "KIS" | "TOSS", limit: number = 5) {
    try {
      const today = new Date().toISOString().split("T")[0]!;
      const dailyPerformance = await this.repository.getDailyPerformance(today, broker);
      const topSymbols = await this.repository.getTopPerformingSymbols(limit, broker);

      return {
        daily: dailyPerformance,
        topSymbols,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`[PerformanceAggregator] Error fetching summary:`, error);
      throw error;
    }
  }
}
