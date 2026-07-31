/**
 * Position Monitor
 * Tracks open positions and triggers stop-loss at -5%
 */

export interface Position {
  id: string;
  symbol: string;
  quantity: number;
  entryPrice: number;
  entryDate: Date;
  stopLossPrice: number; // -5%
  takeProfitPrice: number; // +10%
}

export interface PositionExit {
  positionId: string;
  symbol: string;
  exitPrice: number;
  exitType: "STOP_LOSS" | "TAKE_PROFIT";
  pnl: number;
  pnlPercent: number;
}

export class PositionMonitor {
  /**
   * Check if position should be closed
   */
  shouldExit(position: Position, currentPrice: number): PositionExit | null {
    const pnl = (currentPrice - position.entryPrice) * position.quantity;
    const pnlPercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;

    // Stop loss at -5%
    if (currentPrice <= position.stopLossPrice) {
      return {
        positionId: position.id,
        symbol: position.symbol,
        exitPrice: currentPrice,
        exitType: "STOP_LOSS",
        pnl,
        pnlPercent
      };
    }

    // Take profit at +10%
    if (currentPrice >= position.takeProfitPrice) {
      return {
        positionId: position.id,
        symbol: position.symbol,
        exitPrice: currentPrice,
        exitType: "TAKE_PROFIT",
        pnl,
        pnlPercent
      };
    }

    return null;
  }

  /**
   * Portfolio summary
   */
  getPortfolioStats(positions: Position[], currentPrices: Map<string, number>) {
    let totalPnL = 0;
    let totalInvested = 0;

    for (const position of positions) {
      const price = currentPrices.get(position.symbol) || position.entryPrice;
      const invested = position.entryPrice * position.quantity;
      const pnl = (price - position.entryPrice) * position.quantity;

      totalInvested += invested;
      totalPnL += pnl;
    }

    return {
      totalPnL,
      totalPnLPercent: totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0,
      positionCount: positions.length
    };
  }
}
