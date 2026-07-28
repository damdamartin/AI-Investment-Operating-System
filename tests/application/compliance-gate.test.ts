import { describe, expect, it } from "vitest";
import {
  evaluateLiveTradingCompliance,
  type ComplianceReview,
  type ComplianceReviewType,
  type OpenQuestionGate
} from "../../src/index.js";

const requiredReviewTypes: ComplianceReviewType[] = [
  "TOSS_API_TERMS",
  "BROKER_ACCOUNT_PERMISSION",
  "DATA_LICENSING",
  "AI_DATA_HANDLING",
  "TAX_RECORDING",
  "PERSONAL_USE_BOUNDARY",
  "OPERATOR_RISK_ACCEPTANCE"
];

describe("evaluateLiveTradingCompliance", () => {
  it("blocks live trading by default", () => {
    const result = evaluateLiveTradingCompliance();

    expect(result.allowed).toBe(false);
    expect(result.reasons).toContain("missing_review_toss_api_terms");
  });

  it("allows only when every required review is approved and live-blocking questions are resolved", () => {
    const result = evaluateLiveTradingCompliance({
      reviews: approvedReviews(),
      openQuestions: [
        {
          id: "OQ-001",
          priority: "CRITICAL",
          status: "RESOLVED",
          blocksLiveTrading: true
        }
      ]
    });

    expect(result.allowed).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it("enforces approved-with-limitations as allowed with explicit limitations", () => {
    const reviews = approvedReviews().map((review) =>
      review.reviewType === "DATA_LICENSING"
        ? {
            ...review,
            status: "APPROVED_WITH_LIMITATIONS" as const,
            limitations: ["do_not_store_article_body"]
          }
        : review
    );

    const result = evaluateLiveTradingCompliance({ reviews });

    expect(result.allowed).toBe(true);
    expect(result.limitations).toContain("do_not_store_article_body");
  });

  it("blocks rejected and unverified reviews", () => {
    const reviews = approvedReviews().map((review) =>
      review.reviewType === "TOSS_API_TERMS" ? { ...review, status: "REJECTED" as const } : review
    );

    const result = evaluateLiveTradingCompliance({ reviews });

    expect(result.allowed).toBe(false);
    expect(result.reasons).toContain("review_toss_api_terms_rejected");
  });

  it("blocks critical or high open questions that affect live trading", () => {
    const result = evaluateLiveTradingCompliance({
      reviews: approvedReviews(),
      openQuestions: [
        {
          id: "OQ-001",
          priority: "CRITICAL",
          status: "OPEN",
          blocksLiveTrading: true
        },
        {
          id: "OQ-009",
          priority: "MEDIUM",
          status: "OPEN",
          blocksLiveTrading: true
        }
      ]
    });

    expect(result.allowed).toBe(false);
    expect(result.reasons).toEqual(["open_question_oq-001_open"]);
  });
});

function approvedReviews(): ComplianceReview[] {
  return requiredReviewTypes.map((reviewType) => ({
    reviewType,
    status: "APPROVED",
    reviewedAt: new Date("2026-01-01T00:00:00Z")
  }));
}
