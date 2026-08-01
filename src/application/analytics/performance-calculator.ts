/**
 * Performance Calculator
 * Calculates performance metrics from trading data.
 * All calculations are mathematical without assumptions about market conditions.
 */

export interface TradeData {
  pnl: number;
  pnlPercent: number;
}

export interface PerformanceMetrics {
  winRate: number;           // Percentage (0-100)
  sharpeRatio: number;       // Unitless ratio
  profitFactor: number;      // Gross profit / Gross loss
  maxDrawdown: number;       // Percentage (-100 to 0)
  roi: number;               // Return on Investment percentage
}

/**
 * Calculates win rate from trade counts.
 * Win Rate = (Winning Trades / Total Trades) * 100
 *
 * @param winningTrades - Number of trades that resulted in profit
 * @param totalTrades - Total number of trades
 * @returns Win rate as percentage (0-100)
 */
export function calculateWinRate(winningTrades: number, totalTrades: number): number {
  if (totalTrades === 0) {
    return 0;
  }

  const rate = (winningTrades / totalTrades) * 100;
  return Math.min(100, Math.max(0, rate)); // Clamp to 0-100
}

/**
 * Calculates Sharpe Ratio.
 * Sharpe Ratio = (Average Return - Risk Free Rate) / Standard Deviation of Returns
 *
 * Standard Sharpe Ratio assumes:
 * - Risk-free rate is typically government bond yield (here using 0% default)
 * - We calculate standard deviation of all returns
 *
 * @param returns - Array of periodic returns (decimals, e.g., 0.05 for 5%)
 * @param riskFreeRate - Annual risk-free rate (default 0)
 * @returns Sharpe ratio
 */
export function calculateSharpeRatio(returns: number[], riskFreeRate: number = 0): number {
  if (returns.length === 0) {
    return 0;
  }

  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  // Use epsilon to handle floating-point precision
  if (stdDev < 1e-10) {
    return 0; // No volatility = no meaningful Sharpe ratio
  }

  return (avgReturn - riskFreeRate) / stdDev;
}

/**
 * Calculates Profit Factor.
 * Profit Factor = Gross Profit / Gross Loss
 *
 * A ratio > 1.0 means profitable, > 2.0 is good, > 3.0 is excellent
 *
 * @param grossProfit - Sum of all winning trades
 * @param grossLoss - Sum of all losing trades (absolute value)
 * @returns Profit factor ratio
 */
export function calculateProfitFactor(grossProfit: number, grossLoss: number): number {
  if (grossLoss === 0) {
    // No losses - either perfect strategy or no trades
    return grossProfit > 0 ? Infinity : 0;
  }

  return grossProfit / Math.abs(grossLoss);
}

/**
 * Calculates Maximum Drawdown from cumulative P&L.
 * Max Drawdown = (Peak Value - Trough Value) / Peak Value
 * Returns as negative percentage (e.g., -25.5)
 *
 * @param cumulativePnL - Array of cumulative P&L values in chronological order
 * @returns Maximum drawdown as negative percentage
 */
export function calculateMaxDrawdown(cumulativePnL: number[]): number {
  if (cumulativePnL.length === 0) {
    return 0;
  }

  let peakValue: number = cumulativePnL[0] ?? 0;
  let maxDrawdownValue = 0;

  for (const value of cumulativePnL) {
    if (value > peakValue) {
      peakValue = value;
    }

    const drawdown = value - peakValue;
    if (drawdown < maxDrawdownValue) {
      maxDrawdownValue = drawdown;
    }
  }

  // Convert to percentage
  if (peakValue === 0) {
    return 0;
  }

  return (maxDrawdownValue / peakValue) * 100;
}

/**
 * Calculates Return on Investment (ROI).
 * ROI = ((End Capital - Start Capital) / Start Capital) * 100
 *
 * @param startCapital - Initial capital at start of period
 * @param endCapital - Capital value at end of period
 * @returns ROI as percentage
 */
export function calculateROI(startCapital: number, endCapital: number): number {
  if (startCapital === 0) {
    return 0;
  }

  return ((endCapital - startCapital) / startCapital) * 100;
}

/**
 * Calculates average win/loss amounts.
 *
 * @param winAmounts - Array of winning trade amounts
 * @param lossAmounts - Array of losing trade amounts (absolute values)
 * @returns Object with average win and average loss
 */
export function calculateAverageWinLoss(
  winAmounts: number[],
  lossAmounts: number[]
): { avgWin: number; avgLoss: number } {
  const avgWin = winAmounts.length > 0 ? winAmounts.reduce((a, b) => a + b, 0) / winAmounts.length : 0;
  const avgLoss =
    lossAmounts.length > 0 ? lossAmounts.reduce((a, b) => a + b, 0) / lossAmounts.length : 0;

  return { avgWin, avgLoss };
}

/**
 * Calculates total gross profit and loss.
 *
 * @param trades - Array of trade P&L values
 * @returns Object with gross profit, gross loss, and total P&L
 */
export function calculateGrossPnL(
  trades: number[]
): { grossProfit: number; grossLoss: number; totalPnL: number } {
  let grossProfit = 0;
  let grossLoss = 0;

  for (const pnl of trades) {
    if (pnl > 0) {
      grossProfit += pnl;
    } else if (pnl < 0) {
      grossLoss += Math.abs(pnl);
    }
  }

  return {
    grossProfit,
    grossLoss,
    totalPnL: grossProfit - grossLoss,
  };
}

/**
 * Calculates P&L as percentage.
 * PnL% = (P&L Amount / Entry Value) * 100
 *
 * @param pnlAmount - P&L amount in currency
 * @param entryValue - Entry value (quantity * entry price)
 * @returns P&L percentage
 */
export function calculatePnLPercent(pnlAmount: number, entryValue: number): number {
  if (entryValue === 0) {
    return 0;
  }

  return (pnlAmount / entryValue) * 100;
}

/**
 * Comprehensive performance analysis from trade data.
 * Aggregates multiple metrics into a single calculation.
 */
export class PerformanceAnalyzer {
  /**
   * Analyze a series of trades
   */
  static analyzeTrades(
    trades: TradeData[]
  ): {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    totalPnL: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
  } {
    if (trades.length === 0) {
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        totalPnL: 0,
        winRate: 0,
        avgWin: 0,
        avgLoss: 0,
        profitFactor: 0,
      };
    }

    const winAmounts: number[] = [];
    const lossAmounts: number[] = [];
    let winningTrades = 0;
    let losingTrades = 0;
    let totalPnL = 0;

    for (const trade of trades) {
      totalPnL += trade.pnl;

      if (trade.pnl > 0) {
        winningTrades++;
        winAmounts.push(trade.pnl);
      } else if (trade.pnl < 0) {
        losingTrades++;
        lossAmounts.push(Math.abs(trade.pnl));
      }
    }

    const winRate = calculateWinRate(winningTrades, trades.length);
    const { avgWin, avgLoss } = calculateAverageWinLoss(winAmounts, lossAmounts);
    const profitFactor = calculateProfitFactor(
      winAmounts.reduce((a, b) => a + b, 0),
      lossAmounts.reduce((a, b) => a + b, 0)
    );

    return {
      totalTrades: trades.length,
      winningTrades,
      losingTrades,
      totalPnL,
      winRate,
      avgWin,
      avgLoss,
      profitFactor,
    };
  }

  /**
   * Calculate rolling Sharpe ratio for time series
   */
  static calculateRollingMetrics(
    returns: number[],
    windowSize: number = 20
  ): {
    sharpeRatios: number[];
    movingAverageReturns: number[];
  } {
    const sharpeRatios: number[] = [];
    const movingAverageReturns: number[] = [];

    for (let i = 0; i <= returns.length - windowSize; i++) {
      const window = returns.slice(i, i + windowSize);
      const sharpe = calculateSharpeRatio(window);
      const avgReturn = window.reduce((a, b) => a + b, 0) / window.length;

      sharpeRatios.push(sharpe);
      movingAverageReturns.push(avgReturn);
    }

    return { sharpeRatios, movingAverageReturns };
  }
}
