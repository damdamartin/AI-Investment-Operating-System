export type ComplianceReviewStatus = "APPROVED" | "APPROVED_WITH_LIMITATIONS" | "REJECTED" | "UNVERIFIED";

export type ComplianceReviewType =
  | "TOSS_API_TERMS"
  | "BROKER_ACCOUNT_PERMISSION"
  | "DATA_LICENSING"
  | "AI_DATA_HANDLING"
  | "TAX_RECORDING"
  | "PERSONAL_USE_BOUNDARY"
  | "OPERATOR_RISK_ACCEPTANCE";

export interface ComplianceReview {
  reviewType: ComplianceReviewType;
  status: ComplianceReviewStatus;
  limitations?: string[];
  reviewedAt?: Date;
}

export interface OpenQuestionGate {
  id: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  status: "OPEN" | "IN_REVIEW" | "RESOLVED" | "DEFERRED" | "BLOCKED";
  blocksLiveTrading: boolean;
}

export interface ComplianceGateInput {
  reviews?: ComplianceReview[];
  openQuestions?: OpenQuestionGate[];
}

export interface ComplianceGateResult {
  allowed: boolean;
  reasons: string[];
  limitations: string[];
}

const requiredLiveReviewTypes: ComplianceReviewType[] = [
  "TOSS_API_TERMS",
  "BROKER_ACCOUNT_PERMISSION",
  "DATA_LICENSING",
  "AI_DATA_HANDLING",
  "TAX_RECORDING",
  "PERSONAL_USE_BOUNDARY",
  "OPERATOR_RISK_ACCEPTANCE"
];

export function evaluateLiveTradingCompliance(input: ComplianceGateInput = {}): ComplianceGateResult {
  const reviews = new Map((input.reviews ?? []).map((review) => [review.reviewType, review]));
  const reasons: string[] = [];
  const limitations: string[] = [];

  for (const reviewType of requiredLiveReviewTypes) {
    const review = reviews.get(reviewType);

    if (!review) {
      reasons.push(`missing_review_${reviewType.toLowerCase()}`);
      continue;
    }

    if (review.status === "REJECTED" || review.status === "UNVERIFIED") {
      reasons.push(`review_${reviewType.toLowerCase()}_${review.status.toLowerCase()}`);
    }

    if (review.status === "APPROVED_WITH_LIMITATIONS") {
      limitations.push(...(review.limitations ?? [`review_${reviewType.toLowerCase()}_has_limitations`]));
    }
  }

  for (const question of input.openQuestions ?? []) {
    if (
      question.blocksLiveTrading &&
      (question.status === "OPEN" || question.status === "IN_REVIEW" || question.status === "BLOCKED") &&
      (question.priority === "CRITICAL" || question.priority === "HIGH")
    ) {
      reasons.push(`open_question_${question.id.toLowerCase()}_${question.status.toLowerCase()}`);
    }
  }

  return {
    allowed: reasons.length === 0,
    reasons,
    limitations
  };
}
