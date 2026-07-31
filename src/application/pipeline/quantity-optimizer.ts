import { Money, Quantity, Price } from "../../domain/value-objects/index.js";

export interface QuantityOptimizerInput {
  baseQuantity: number; // Starting quantity (e.g., 1)
  compositeScore: number; // Signal strength (0-100)
  volatility: number; // Current market volatility (percent)
  currentExposureRatio: number; // Portfolio exposure (0-1)
  maxQuantityMultiplier: number; // Config: max multiplier (e.g., 3.0)
}

export interface QuantityOptimizerResult {
  finalQuantity: number;
  scoreMultiplier: number;
  volatilityMultiplier: number;
  exposureMultiplier: number;
  reasoning: string;
}

/**
 * QuantityOptimizer dynamically adjusts order quantity based on:
 * 1. Signal strength (composite score)
 * 2. Market volatility
 * 3. Current portfolio exposure
 *
 * This replaces the fixed quantity (1 share) with adaptive sizing.
 */
export class QuantityOptimizer {
  /**
   * Calculate recommended quantity with all adjustments
   */
  optimizeQuantity(input: QuantityOptimizerInput): QuantityOptimizerResult {
    const scoreMultiplier = this.calculateScoreMultiplier(input.compositeScore);
    const volatilityMultiplier = this.calculateVolatilityMultiplier(input.volatility);
    const exposureMultiplier = this.calculateExposureMultiplier(input.currentExposureRatio);

    let finalQuantity =
      input.baseQuantity * scoreMultiplier * volatilityMultiplier * exposureMultiplier;

    // Cap at maximum multiplier
    const actualMultiplier = (scoreMultiplier * volatilityMultiplier * exposureMultiplier);
    if (actualMultiplier > input.maxQuantityMultiplier) {
      finalQuantity = input.baseQuantity * input.maxQuantityMultiplier;
    }

    // Floor at 0 (no position if too risky)
    finalQuantity = Math.max(0, Math.floor(finalQuantity));

    const reasoning = this.buildReasoning(input, scoreMultiplier, volatilityMultiplier, exposureMultiplier, finalQuantity);

    return {
      finalQuantity,
      scoreMultiplier,
      volatilityMultiplier,
      exposureMultiplier,
      reasoning
    };
  }

  /**
   * Calculate multiplier based on signal strength (composite score)
   * Score 0-100 → Multiplier 0.5-2.0
   */
  private calculateScoreMultiplier(score: number): number {
    if (score >= 90) return 2.0; // Very strong signal
    if (score >= 80) return 1.75; // Strong signal
    if (score >= 75) return 1.5; // Good signal
    if (score >= 70) return 1.25; // Decent signal
    if (score >= 65) return 1.0; // Weak but passing
    if (score >= 55) return 0.75; // Very weak
    return 0.5; // Barely passing (risky)
  }

  /**
   * Calculate multiplier based on market volatility
   * Lower volatility = safer = more aggressive
   * Higher volatility = riskier = more conservative
   */
  private calculateVolatilityMultiplier(volatility: number): number {
    if (volatility < 1.5) return 1.3; // Very stable market
    if (volatility < 2.0) return 1.2; // Stable
    if (volatility < 2.5) return 1.1; // Slightly stable
    if (volatility < 3.0) return 1.0; // Normal
    if (volatility < 4.0) return 0.9; // Slightly volatile
    if (volatility < 5.0) return 0.8; // Volatile
    if (volatility < 6.0) return 0.6; // Very volatile
    return 0.4; // Extremely volatile (high risk)
  }

  /**
   * Calculate multiplier based on portfolio exposure ratio
   * Already high exposure = reduce new positions
   * Low exposure = can take more
   */
  private calculateExposureMultiplier(exposureRatio: number): number {
    if (exposureRatio < 0.2) return 1.0; // Very low exposure
    if (exposureRatio < 0.3) return 0.95;
    if (exposureRatio < 0.4) return 0.9;
    if (exposureRatio < 0.5) return 0.8;
    if (exposureRatio < 0.6) return 0.6;
    if (exposureRatio < 0.7) return 0.4;
    if (exposureRatio < 0.8) return 0.2;
    return 0.0; // Portfolio almost full - don't trade
  }

  private buildReasoning(
    input: QuantityOptimizerInput,
    scoreMul: number,
    volMul: number,
    expMul: number,
    finalQty: number
  ): string {
    const parts: string[] = [];

    // Signal strength reasoning
    if (input.compositeScore >= 90) {
      parts.push(`Very strong signal (${input.compositeScore}/100) → 2.0x`);
    } else if (input.compositeScore >= 75) {
      parts.push(`Strong signal (${input.compositeScore}/100) → ${scoreMul.toFixed(1)}x`);
    } else if (input.compositeScore >= 65) {
      parts.push(`Weak signal (${input.compositeScore}/100) → ${scoreMul.toFixed(1)}x`);
    }

    // Volatility reasoning
    if (input.volatility < 2.0) {
      parts.push(`Low volatility (${input.volatility.toFixed(1)}%) → ${volMul.toFixed(1)}x (safe)`);
    } else if (input.volatility < 4.0) {
      parts.push(`Normal volatility (${input.volatility.toFixed(1)}%) → ${volMul.toFixed(1)}x`);
    } else {
      parts.push(`High volatility (${input.volatility.toFixed(1)}%) → ${volMul.toFixed(1)}x (risky)`);
    }

    // Exposure reasoning
    if (input.currentExposureRatio < 0.5) {
      parts.push(`Low portfolio exposure (${(input.currentExposureRatio * 100).toFixed(0)}%) → Normal`);
    } else if (input.currentExposureRatio < 0.7) {
      parts.push(`High exposure (${(input.currentExposureRatio * 100).toFixed(0)}%) → Reduced`);
    } else {
      parts.push(`Portfolio near full (${(input.currentExposureRatio * 100).toFixed(0)}%) → Minimal`);
    }

    // Final result
    parts.push(
      `Final: ${input.baseQuantity} × ${(scoreMul * volMul * expMul).toFixed(2)} = ${finalQty} shares`
    );

    return parts.join(" | ");
  }
}
