import { Price, Currency } from "../../domain/value-objects/index.js";

export type PriceOrderType = "MARKET_ORDER" | "LIMIT_ORDER";

export interface PriceStrategyInput {
  compositeScore: number; // Signal strength (0-100)
  volatility: number; // Market volatility (percent)
  hour: number; // Hour of day (0-23, Korean time)
  dayOfWeek: number; // Day of week (0=Sunday, 6=Saturday)
}

export interface PriceStrategy {
  orderType: PriceOrderType;
  discountPercent: number; // For limit orders: -X% from current price
  maxWaitMinutes: number; // Max time to wait for limit order execution
  reasoning: string;
}

/**
 * PriceStrategySelector determines whether to use market order (시장가)
 * or limit order (지정가) based on signal strength, volatility, and time.
 *
 * Market Order (시장가):
 * - Fast execution at current price
 * - Guaranteed to fill
 * - Best for strong signals
 *
 * Limit Order (지정가):
 * - Waits for better price (discounted)
 * - May not fill within timeout
 * - Best for weak signals or high volatility
 */
export class PriceStrategySelector {
  /**
   * Select price strategy for order execution
   */
  selectStrategy(input: PriceStrategyInput): PriceStrategy {
    // Primary decision: signal strength
    const scoreStrategy = this.evaluateSignalStrength(input.compositeScore);

    // Secondary factors: volatility and time
    const volatilityFactor = this.evaluateVolatility(input.volatility);
    const timeFactor = this.evaluateTimeOfDay(input.hour);

    // Combine factors
    const finalStrategy = this.combineFactors(scoreStrategy, volatilityFactor, timeFactor, input);

    return finalStrategy;
  }

  /**
   * Evaluate based on signal strength (primary factor)
   */
  private evaluateSignalStrength(score: number): {
    orderType: PriceOrderType;
    discountPercent: number;
    reasoning: string;
  } {
    if (score >= 90) {
      return {
        orderType: "MARKET_ORDER",
        discountPercent: 0,
        reasoning: `Very strong signal (${score}/100) → Market order`
      };
    }
    if (score >= 80) {
      return {
        orderType: "MARKET_ORDER",
        discountPercent: 0,
        reasoning: `Strong signal (${score}/100) → Market order`
      };
    }
    if (score >= 75) {
      return {
        orderType: "LIMIT_ORDER",
        discountPercent: 0.5,
        reasoning: `Good signal (${score}/100) → Limit order -0.5%`
      };
    }
    if (score >= 65) {
      return {
        orderType: "LIMIT_ORDER",
        discountPercent: 1.0,
        reasoning: `Weak signal (${score}/100) → Limit order -1.0%`
      };
    }
    return {
      orderType: "LIMIT_ORDER",
      discountPercent: 1.5,
      reasoning: `Very weak signal (${score}/100) → Limit order -1.5%`
    };
  }

  /**
   * Evaluate impact of market volatility
   */
  private evaluateVolatility(volatility: number): {
    adjustment: number; // Additional discount percent
    reasoning: string;
  } {
    if (volatility < 2) {
      return {
        adjustment: -0.5, // Reduce discount (use market order)
        reasoning: `Low volatility (${volatility.toFixed(1)}%) → More aggressive`
      };
    }
    if (volatility < 3) {
      return {
        adjustment: 0, // No change
        reasoning: `Normal volatility (${volatility.toFixed(1)}%) → Standard`
      };
    }
    if (volatility < 4) {
      return {
        adjustment: 0.5, // Increase discount
        reasoning: `Higher volatility (${volatility.toFixed(1)}%) → More conservative`
      };
    }
    if (volatility < 5) {
      return {
        adjustment: 1.0,
        reasoning: `High volatility (${volatility.toFixed(1)}%) → Significant discount`
      };
    }
    return {
      adjustment: 1.5,
      reasoning: `Very high volatility (${volatility.toFixed(1)}%) → Maximum discount`
    };
  }

  /**
   * Evaluate impact of time of day
   * Korean stock market: 9:00 AM - 4:00 PM (480 minutes)
   */
  private evaluateTimeOfDay(hour: number): {
    adjustment: number;
    reasoning: string;
  } {
    // Before market open (0:00 - 8:59)
    if (hour < 9) {
      return {
        adjustment: 0,
        reasoning: "Before market open (pre-trading)"
      };
    }

    // Market open period: 9:00 - 10:00 (high volatility)
    if (hour === 9) {
      return {
        adjustment: 0.5,
        reasoning: "Market open (9:00-10:00) → Increased volatility"
      };
    }

    // Mid-market: 10:00 - 14:59 (stable)
    if (hour >= 10 && hour < 15) {
      return {
        adjustment: -0.5,
        reasoning: "Mid-market (10:00-15:00) → Stable period"
      };
    }

    // Market close period: 15:00 - 15:59 (elevated activity)
    if (hour === 15) {
      return {
        adjustment: 0.25,
        reasoning: "Near close (15:00-15:59) → Elevated activity"
      };
    }

    // After market close (16:00 - 23:59)
    return {
      adjustment: 0,
      reasoning: "After market close (pre-trading for next day)"
    };
  }

  /**
   * Combine all factors into final strategy
   */
  private combineFactors(
    scoreStrategy: { orderType: PriceOrderType; discountPercent: number; reasoning: string },
    volatilityFactor: { adjustment: number; reasoning: string },
    timeFactor: { adjustment: number; reasoning: string },
    input: PriceStrategyInput
  ): PriceStrategy {
    let finalDiscount = scoreStrategy.discountPercent + volatilityFactor.adjustment + timeFactor.adjustment;

    // Clamp discount to valid range [0%, 2%]
    finalDiscount = Math.max(0, Math.min(2.0, finalDiscount));

    // If discount is 0, use market order. If discount > 0, use limit order
    const orderType = finalDiscount > 0 ? "LIMIT_ORDER" : "MARKET_ORDER";

    // Max wait time: 3 hours (180 minutes) for limit orders
    const maxWaitMinutes = orderType === "LIMIT_ORDER" ? 180 : 0;

    const reasoning = [
      scoreStrategy.reasoning,
      `+ Volatility: ${volatilityFactor.reasoning}`,
      `+ Time: ${timeFactor.reasoning}`,
      `= Final: ${orderType} ${finalDiscount > 0 ? `-${finalDiscount.toFixed(2)}%` : ""}`
    ].join(" | ");

    return {
      orderType,
      discountPercent: finalDiscount,
      maxWaitMinutes,
      reasoning
    };
  }

  /**
   * Calculate actual limit price based on current price and strategy
   */
  calculateLimitPrice(currentPrice: Price, strategy: PriceStrategy): Price {
    if (strategy.orderType === "MARKET_ORDER" || strategy.discountPercent === 0) {
      return currentPrice; // No adjustment for market orders
    }

    const priceStr = currentPrice.toString();
    const parts = priceStr.split(" ");
    const currentMajor = Number(parts[0]);
    const currencyCode = parts[1] || "KRW"; // Default to KRW if not specified

    // Apply discount: price × (1 - discount%)
    const discountedPrice = currentMajor * (1 - strategy.discountPercent / 100);

    return Price.from(discountedPrice.toFixed(0), Currency.from(currencyCode));
  }
}
