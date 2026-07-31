import { Position } from "../../domain/portfolio/index.js";
import { Price, Currency } from "../../domain/value-objects/index.js";

export interface StopLossCheckResult {
  triggered: boolean;
  position?: Position;
  currentPrice?: Price;
  reason?: string;
}

/**
 * StopLossEngine monitors open positions and triggers stop-loss orders
 * when current price falls below or equals the stop-loss price.
 *
 * This engine runs as part of the regular trading cycle to check all
 * OPEN positions against current market prices.
 */
export class StopLossEngine {
  /**
   * Evaluate a single position against current market price
   * Returns the position if SL is triggered, undefined otherwise
   */
  evaluatePosition(position: Position, currentPrice: Price): StopLossCheckResult {
    if (!position.isOpen()) {
      return { triggered: false };
    }

    if (position.isStopLossTriggered(currentPrice)) {
      return {
        triggered: true,
        position: position.closeWithStopLoss(new Date()),
        currentPrice,
        reason: `Stop loss hit at ${currentPrice.toString()}`
      };
    }

    return { triggered: false };
  }

  /**
   * Batch evaluate multiple positions
   * Returns only positions that triggered stop loss
   */
  evaluatePositions(positions: Position[], currentPrices: Map<string, Price>): StopLossCheckResult[] {
    const results: StopLossCheckResult[] = [];

    for (const position of positions) {
      const price = currentPrices.get(position.assetId);
      if (!price) {
        continue;
      }

      const result = this.evaluatePosition(position, price);
      if (result.triggered) {
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Calculate recommended stop-loss price based on entry price
   * Default: entry price × (1 - stopLossPercent%)
   */
  calculateStopLossPrice(entryPrice: Price, stopLossPercent: number): Price {
    const priceStr = entryPrice.toString();
    const parts = priceStr.split(" ");
    const entryMajor = Number(parts[0]);
    const currencyCode = parts[1] || "KRW"; // Default to KRW if not specified

    if (stopLossPercent < 0 || stopLossPercent > 100) {
      throw new Error("Stop loss percent must be between 0 and 100");
    }

    const slPrice = entryMajor * (1 - stopLossPercent / 100);
    return Price.from(slPrice.toFixed(0), Currency.from(currencyCode));
  }
}
