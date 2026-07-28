import { describe, expect, it } from "vitest";
import { StrategyDiversityEngine, type StrategyDiversityCandidate, type StrategyDiversityPolicy } from "../../src/index.js";

const policy: StrategyDiversityPolicy = {
  maxHoldingsOverlapRatio: 0.6,
  maxReturnCorrelationRatio: 0.9,
  minDefensiveDrawdownAdvantageRatio: 0.05
};

describe("StrategyDiversityEngine", () => {
  it("flags highly overlapping strategies as redundant", () => {
    const review = new StrategyDiversityEngine().review({
      reviewId: "diversity-review-1",
      reviewedAt: new Date("2026-01-10T00:00:00Z"),
      policy,
      candidates: [
        candidate("strategy-version-1", {
          heldAssetIds: ["asset-aapl", "asset-msft", "asset-nvda"],
          totalReturnRatio: 0.1,
          maxDrawdownRatio: 0.08
        }),
        candidate("strategy-version-2", {
          heldAssetIds: ["asset-aapl", "asset-msft", "asset-nvda", "asset-googl"],
          totalReturnRatio: 0.12,
          maxDrawdownRatio: 0.15
        })
      ]
    });

    expect(review.pairReviews[0]?.holdingsOverlapRatio).toBe(0.75);
    expect(review.pairReviews[0]?.warnings).toContain("holdings_overlap_too_high");
    expect(review.redundantStrategyVersionIds).toContain("strategy-version-2");
    expect(review.safetyType).toBe("STRATEGY_DIVERSITY_REVIEW_ONLY");
    expect(review).not.toHaveProperty("allocateCapital");
  });

  it("uses return correlation threshold as a baseline placeholder", () => {
    const review = new StrategyDiversityEngine().review({
      reviewId: "diversity-review-1",
      reviewedAt: new Date("2026-01-10T00:00:00Z"),
      policy,
      candidates: [
        candidate("strategy-version-1", { returnSeries: [0.01, 0.02, -0.01, 0.03] }),
        candidate("strategy-version-2", { returnSeries: [0.02, 0.04, -0.02, 0.06] })
      ]
    });

    expect(review.pairReviews[0]?.returnCorrelationRatio).toBe(1);
    expect(review.pairReviews[0]?.warnings).toContain("return_correlation_too_high");
  });

  it("marks lower-return defensive strategies as diversification candidates", () => {
    const review = new StrategyDiversityEngine().review({
      reviewId: "diversity-review-1",
      reviewedAt: new Date("2026-01-10T00:00:00Z"),
      policy,
      candidates: [
        candidate("strategy-version-growth", {
          category: "GROWTH",
          totalReturnRatio: 0.24,
          maxDrawdownRatio: 0.22
        }),
        candidate("strategy-version-defense", {
          category: "MARKET_DEFENSE",
          heldAssetIds: ["asset-cash"],
          totalReturnRatio: 0.02,
          maxDrawdownRatio: 0.01,
          isDefensive: true
        })
      ]
    });

    expect(review.diversificationCandidateIds).toContain("strategy-version-defense");
    expect(review.promotionReference.reviewId).toBe("diversity-review-1");
  });

  it("warns that recent high return alone must not justify concentration", () => {
    const review = new StrategyDiversityEngine().review({
      reviewId: "diversity-review-1",
      reviewedAt: new Date("2026-01-10T00:00:00Z"),
      policy,
      candidates: [
        candidate("strategy-version-hot", { totalReturnRatio: 0.5 }),
        candidate("strategy-version-normal", { totalReturnRatio: 0.1 })
      ]
    });

    expect(review.warnings).toContain("recent_high_return_alone_cannot_justify_concentrated_allocation");
  });

  it("calculates signal timing similarity separately from holdings overlap", () => {
    const review = new StrategyDiversityEngine().review({
      reviewId: "diversity-review-1",
      reviewedAt: new Date("2026-01-10T00:00:00Z"),
      policy,
      candidates: [
        candidate("strategy-version-1", {
          signalTimestamps: [new Date("2026-01-01T10:00:00Z"), new Date("2026-01-02T10:00:00Z")]
        }),
        candidate("strategy-version-2", {
          signalTimestamps: [new Date("2026-01-02T11:00:00Z"), new Date("2026-01-03T10:00:00Z")]
        })
      ]
    });

    expect(review.pairReviews[0]?.signalTimingSimilarityRatio).toBe(0.3333);
  });
});

function candidate(
  strategyVersionId: string,
  overrides: Partial<StrategyDiversityCandidate> = {}
): StrategyDiversityCandidate {
  return {
    strategyVersionId,
    strategyId: strategyVersionId.replace("version", "strategy"),
    category: "MOMENTUM",
    heldAssetIds: ["asset-aapl"],
    signalTimestamps: [new Date("2026-01-01T00:00:00Z")],
    returnSeries: [0.01, -0.01, 0.02],
    totalReturnRatio: 0.1,
    maxDrawdownRatio: 0.1,
    volatilityRatio: 0.2,
    ...overrides
  };
}
