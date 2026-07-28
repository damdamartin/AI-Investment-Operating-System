export type StrategyCategory =
  | "VALUE"
  | "GROWTH"
  | "QUALITY"
  | "MOMENTUM"
  | "DIVIDEND"
  | "MEAN_REVERSION"
  | "EVENT_DRIVEN"
  | "SECTOR_ROTATION"
  | "LOW_VOLATILITY"
  | "ETF_ALLOCATION"
  | "MARKET_DEFENSE"
  | "CASH_EXPANSION";

export interface StrategyDiversityCandidate {
  strategyVersionId: string;
  strategyId: string;
  category: StrategyCategory;
  heldAssetIds: string[];
  signalTimestamps: Date[];
  returnSeries: number[];
  totalReturnRatio: number;
  maxDrawdownRatio: number;
  volatilityRatio: number;
  isDefensive?: boolean | undefined;
}

export interface StrategyDiversityPolicy {
  maxHoldingsOverlapRatio: number;
  maxReturnCorrelationRatio: number;
  minDefensiveDrawdownAdvantageRatio: number;
}

export interface StrategyPairReview {
  firstStrategyVersionId: string;
  secondStrategyVersionId: string;
  holdingsOverlapRatio: number;
  signalTimingSimilarityRatio: number;
  returnCorrelationRatio: number | undefined;
  warnings: string[];
}

export interface StrategyDiversityReview {
  reviewedAt: Date;
  strategyCount: number;
  pairReviews: StrategyPairReview[];
  redundantStrategyVersionIds: string[];
  diversificationCandidateIds: string[];
  warnings: string[];
  promotionReference: {
    reviewId: string;
    safetyType: "STRATEGY_DIVERSITY_REVIEW_ONLY";
  };
  safetyType: "STRATEGY_DIVERSITY_REVIEW_ONLY";
}

export interface StrategyDiversityEngineInput {
  reviewId: string;
  reviewedAt: Date;
  candidates: StrategyDiversityCandidate[];
  policy: StrategyDiversityPolicy;
}

export class StrategyDiversityEngine {
  review(input: StrategyDiversityEngineInput): StrategyDiversityReview {
    const pairReviews: StrategyPairReview[] = [];
    const redundant = new Set<string>();
    const warnings = new Set<string>();

    for (let firstIndex = 0; firstIndex < input.candidates.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < input.candidates.length; secondIndex += 1) {
        const first = input.candidates[firstIndex]!;
        const second = input.candidates[secondIndex]!;
        const holdingsOverlapRatio = jaccard(first.heldAssetIds, second.heldAssetIds);
        const signalTimingSimilarityRatio = jaccard(
          first.signalTimestamps.map(dayKey),
          second.signalTimestamps.map(dayKey)
        );
        const returnCorrelationRatio = pearson(first.returnSeries, second.returnSeries);
        const pairWarnings = pairWarningCodes(
          holdingsOverlapRatio,
          returnCorrelationRatio,
          first,
          second,
          input.policy
        );

        if (pairWarnings.includes("holdings_overlap_too_high") || pairWarnings.includes("return_correlation_too_high")) {
          redundant.add(lowerQualityCandidate(first, second).strategyVersionId);
        }

        pairWarnings.forEach((warning) => warnings.add(warning));
        pairReviews.push({
          firstStrategyVersionId: first.strategyVersionId,
          secondStrategyVersionId: second.strategyVersionId,
          holdingsOverlapRatio,
          signalTimingSimilarityRatio,
          returnCorrelationRatio,
          warnings: pairWarnings
        });
      }
    }

    const diversificationCandidateIds = input.candidates
      .filter((candidate) => isDiversificationCandidate(candidate, input.candidates, input.policy))
      .map((candidate) => candidate.strategyVersionId);

    if (hasRecentWinnerConcentrationRisk(input.candidates)) {
      warnings.add("recent_high_return_alone_cannot_justify_concentrated_allocation");
    }

    return {
      reviewedAt: input.reviewedAt,
      strategyCount: input.candidates.length,
      pairReviews,
      redundantStrategyVersionIds: [...redundant].sort(),
      diversificationCandidateIds: [...new Set(diversificationCandidateIds)].sort(),
      warnings: [...warnings].sort(),
      promotionReference: {
        reviewId: input.reviewId,
        safetyType: "STRATEGY_DIVERSITY_REVIEW_ONLY"
      },
      safetyType: "STRATEGY_DIVERSITY_REVIEW_ONLY"
    };
  }
}

function pairWarningCodes(
  holdingsOverlapRatio: number,
  returnCorrelationRatio: number | undefined,
  first: StrategyDiversityCandidate,
  second: StrategyDiversityCandidate,
  policy: StrategyDiversityPolicy
): string[] {
  const warnings: string[] = [];

  if (holdingsOverlapRatio >= policy.maxHoldingsOverlapRatio) {
    warnings.push("holdings_overlap_too_high");
  }

  if (returnCorrelationRatio !== undefined && returnCorrelationRatio >= policy.maxReturnCorrelationRatio) {
    warnings.push("return_correlation_too_high");
  }

  if (first.category === second.category && holdingsOverlapRatio > 0.5) {
    warnings.push("same_category_crowding");
  }

  return warnings;
}

function isDiversificationCandidate(
  candidate: StrategyDiversityCandidate,
  candidates: StrategyDiversityCandidate[],
  policy: StrategyDiversityPolicy
): boolean {
  if (!candidate.isDefensive && candidate.category !== "MARKET_DEFENSE" && candidate.category !== "CASH_EXPANSION") {
    return false;
  }

  const averageReturn = average(candidates.map((item) => item.totalReturnRatio));
  const averageDrawdown = average(candidates.map((item) => item.maxDrawdownRatio));
  const lowerReturn = candidate.totalReturnRatio < averageReturn;
  const lowerDrawdown = candidate.maxDrawdownRatio <= Math.max(0, averageDrawdown - policy.minDefensiveDrawdownAdvantageRatio);

  return lowerReturn && lowerDrawdown;
}

function hasRecentWinnerConcentrationRisk(candidates: StrategyDiversityCandidate[]): boolean {
  if (candidates.length < 2) return false;
  const sorted = [...candidates].sort((a, b) => b.totalReturnRatio - a.totalReturnRatio);
  const best = sorted[0]!;
  const second = sorted[1]!;
  return best.totalReturnRatio > 0 && best.totalReturnRatio >= second.totalReturnRatio * 2;
}

function lowerQualityCandidate(
  first: StrategyDiversityCandidate,
  second: StrategyDiversityCandidate
): StrategyDiversityCandidate {
  if (first.maxDrawdownRatio !== second.maxDrawdownRatio) {
    return first.maxDrawdownRatio > second.maxDrawdownRatio ? first : second;
  }

  return first.totalReturnRatio <= second.totalReturnRatio ? first : second;
}

function jaccard(firstValues: string[], secondValues: string[]): number {
  const first = new Set(firstValues);
  const second = new Set(secondValues);
  const union = new Set([...first, ...second]);
  if (union.size === 0) return 0;
  const intersection = [...first].filter((value) => second.has(value));
  return roundRatio(intersection.length / union.size);
}

function pearson(first: number[], second: number[]): number | undefined {
  const length = Math.min(first.length, second.length);
  if (length < 2) return undefined;

  const firstValues = first.slice(0, length);
  const secondValues = second.slice(0, length);
  const firstAverage = average(firstValues);
  const secondAverage = average(secondValues);
  const numerator = firstValues.reduce(
    (sum, value, index) => sum + ((value - firstAverage) * (secondValues[index]! - secondAverage)),
    0
  );
  const firstVariance = firstValues.reduce((sum, value) => sum + ((value - firstAverage) ** 2), 0);
  const secondVariance = secondValues.reduce((sum, value) => sum + ((value - secondAverage) ** 2), 0);
  const denominator = Math.sqrt(firstVariance * secondVariance);
  if (denominator === 0) return undefined;

  return roundRatio(numerator / denominator);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function dayKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function roundRatio(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
