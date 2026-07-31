import { Position } from "../../domain/portfolio/index.js";
import { Price, Quantity, Currency } from "../../domain/value-objects/index.js";

export interface TakeProfitCheckResult {
  triggered: boolean;
  position?: Position;
  currentPrice?: Price;
  closeQuantity?: Quantity;
  partialClose?: boolean;
  reason?: string;
}

/**
 * TakeProfitEngine monitors open positions and triggers take-profit orders
 * when current price reaches or exceeds the take-profit price.
 *
 * Supports both full and partial take-profit scenarios:
 * - Full close: entire position is closed
 * - Partial close: 50% of position is closed, rest remains open (optional)
 */
export class TakeProfitEngine {
  private readonly partialCloseRatio: number; // Default 0.5 for 50% partial close

  constructor(partialCloseRatio: number = 0.5) {
    if (partialCloseRatio < 0 || partialCloseRatio > 1) {
      throw new Error("Partial close ratio must be between 0 and 1");
    }
    this.partialCloseRatio = partialCloseRatio;
  }

  /**
   * Evaluate a single position against current market price
   * Returns the position if TP is triggered, undefined otherwise
   */
  evaluatePosition(position: Position, currentPrice: Price, partialClose: boolean = false): TakeProfitCheckResult {
    if (!position.isOpen()) {
      return { triggered: false };
    }

    if (position.isTakeProfitTriggered(currentPrice)) {
      if (!partialClose) {
        // Full close
        return {
          triggered: true,
          position: position.closeWithTakeProfit(new Date()),
          currentPrice,
          closeQuantity: position.quantity,
          partialClose: false,
          reason: `Take profit hit at ${currentPrice.toString()} (full close)`
        };
      } else {
        // Partial close - only return the calculation, actual position update
        // will be handled by the orchestrator
        const partialQty = Quantity.from(
          Math.floor(Number(position.quantity.toString()) * this.partialCloseRatio).toString()
        );

        return {
          triggered: true,
          position: position.closeWithTakeProfit(new Date()),
          currentPrice,
          closeQuantity: partialQty,
          partialClose: true,
          reason: `Take profit hit at ${currentPrice.toString()} (partial close: ${(this.partialCloseRatio * 100).toFixed(0)}%)`
        };
      }
    }

    return { triggered: false };
  }

  /**
   * Batch evaluate multiple positions
   * Returns only positions that triggered take profit
   */
  evaluatePositions(
    positions: Position[],
    currentPrices: Map<string, Price>,
    partialClose: boolean = false
  ): TakeProfitCheckResult[] {
    const results: TakeProfitCheckResult[] = [];

    for (const position of positions) {
      const price = currentPrices.get(position.assetId);
      if (!price) {
        continue;
      }

      const result = this.evaluatePosition(position, price, partialClose);
      if (result.triggered) {
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Calculate recommended take-profit price based on entry price
   * Default: entry price × (1 + takeProfitPercent%)
   */
  calculateTakeProfitPrice(entryPrice: Price, takeProfitPercent: number): Price {
    const priceStr = entryPrice.toString();
    const parts = priceStr.split(" ");
    const entryMajor = Number(parts[0]);
    const currencyCode = parts[1] || "KRW"; // Default to KRW if not specified

    if (takeProfitPercent < 0 || takeProfitPercent > 1000) {
      throw new Error("Take profit percent must be between 0 and 1000");
    }

    const tpPrice = entryMajor * (1 + takeProfitPercent / 100);
    return Price.from(tpPrice.toFixed(0), Currency.from(currencyCode));
  }
}
