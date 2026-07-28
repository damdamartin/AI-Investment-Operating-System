import type { StrategyVersion, StrategyVersionStatus } from "../../domain/strategy/index.js";

export type PromotionEvidenceType =
  | "BACKTEST"
  | "WALK_FORWARD"
  | "SHADOW_PORTFOLIO"
  | "PAPER_TRADING"
  | "SMALL_CAPITAL_LIVE"
  | "RISK_REVIEW"
  | "COST_REVIEW"
  | "STRATEGY_DIVERSITY_REVIEW"
  | "AI_HEALTH_CHECK"
  | "COMPLIANCE_REVIEW"
  | "ROLLBACK_PLAN"
  | "HUMAN_APPROVAL";

export type PromotionEvidenceStatus = "PASS" | "WARN" | "FAIL" | "UNVERIFIED";

export interface PromotionEvidence {
  type: PromotionEvidenceType;
  status: PromotionEvidenceStatus;
  referenceId: string;
  summary?: string | undefined;
}

export interface PromotionRequest {
  requestId: string;
  strategyVersion: StrategyVersion;
  targetStatus: StrategyVersionStatus;
  evidence: PromotionEvidence[];
  openQuestions?: string[] | undefined;
  requestedAt: Date;
  earlyOperationRequiresHumanApproval?: boolean | undefined;
}

export interface PromotionDecision {
  requestId: string;
  strategyVersionId: string;
  fromStatus: StrategyVersionStatus;
  targetStatus: StrategyVersionStatus;
  approved: boolean;
  promotedStrategyVersion: StrategyVersion | undefined;
  reasonCodes: string[];
  evidenceReferences: string[];
  rollbackPlanReference: string | undefined;
  decidedAt: Date;
  safetyType: "STRATEGY_PROMOTION_DECISION_ONLY";
}

const requiredEvidenceByTarget: Record<StrategyVersionStatus, PromotionEvidenceType[]> = {
  DRAFT: [],
  BACKTESTED: ["BACKTEST"],
  WALK_FORWARD_VALIDATED: ["BACKTEST", "WALK_FORWARD"],
  SHADOW: ["BACKTEST", "WALK_FORWARD", "SHADOW_PORTFOLIO"],
  PAPER: ["BACKTEST", "WALK_FORWARD", "SHADOW_PORTFOLIO", "PAPER_TRADING"],
  SMALL_CAPITAL_LIVE: [
    "BACKTEST",
    "WALK_FORWARD",
    "SHADOW_PORTFOLIO",
    "PAPER_TRADING",
    "RISK_REVIEW",
    "COST_REVIEW",
    "STRATEGY_DIVERSITY_REVIEW",
    "AI_HEALTH_CHECK",
    "COMPLIANCE_REVIEW",
    "ROLLBACK_PLAN"
  ],
  PRODUCTION_APPROVED: [
    "BACKTEST",
    "WALK_FORWARD",
    "SHADOW_PORTFOLIO",
    "PAPER_TRADING",
    "SMALL_CAPITAL_LIVE",
    "RISK_REVIEW",
    "COST_REVIEW",
    "STRATEGY_DIVERSITY_REVIEW",
    "AI_HEALTH_CHECK",
    "COMPLIANCE_REVIEW",
    "ROLLBACK_PLAN",
    "HUMAN_APPROVAL"
  ],
  PRODUCTION_ACTIVE: ["HUMAN_APPROVAL"],
  RETIRED: []
};

export class StrategyPromotionWorkflow {
  evaluate(request: PromotionRequest): PromotionDecision {
    const reasonCodes = rejectionReasons(request);
    const promotedStrategyVersion = reasonCodes.length === 0
      ? request.strategyVersion.transitionTo(request.targetStatus)
      : undefined;

    return {
      requestId: request.requestId,
      strategyVersionId: request.strategyVersion.id,
      fromStatus: request.strategyVersion.status,
      targetStatus: request.targetStatus,
      approved: reasonCodes.length === 0,
      promotedStrategyVersion,
      reasonCodes,
      evidenceReferences: request.evidence.map((item) => item.referenceId),
      rollbackPlanReference: request.evidence.find((item) => item.type === "ROLLBACK_PLAN")?.referenceId,
      decidedAt: request.requestedAt,
      safetyType: "STRATEGY_PROMOTION_DECISION_ONLY"
    };
  }
}

function rejectionReasons(request: PromotionRequest): string[] {
  const reasons: string[] = [];

  if (!request.strategyVersion.canTransitionTo(request.targetStatus)) {
    reasons.push("invalid_strategy_stage_transition");
  }

  for (const type of requiredEvidenceByTarget[request.targetStatus]) {
    const evidence = request.evidence.find((item) => item.type === type);
    if (!evidence) {
      reasons.push(`missing_${type.toLowerCase()}`);
      continue;
    }

    if (evidence.status === "FAIL") reasons.push(`${type.toLowerCase()}_failed`);
    if (evidence.status === "UNVERIFIED") reasons.push(`${type.toLowerCase()}_unverified`);
  }

  const compliance = request.evidence.find((item) => item.type === "COMPLIANCE_REVIEW");
  if (requiresCompliance(request.targetStatus) && !compliance) {
    reasons.push("missing_compliance_review");
  }

  if (request.openQuestions && request.openQuestions.length > 0) {
    reasons.push("open_questions_block_promotion");
  }

  if (
    request.earlyOperationRequiresHumanApproval !== false &&
    (request.targetStatus === "PRODUCTION_APPROVED" || request.targetStatus === "PRODUCTION_ACTIVE") &&
    !hasPassingEvidence(request.evidence, "HUMAN_APPROVAL")
  ) {
    reasons.push("human_approval_required_for_production_promotion");
  }

  return [...new Set(reasons)].sort();
}

function requiresCompliance(status: StrategyVersionStatus): boolean {
  return status === "SMALL_CAPITAL_LIVE" || status === "PRODUCTION_APPROVED" || status === "PRODUCTION_ACTIVE";
}

function hasPassingEvidence(evidence: PromotionEvidence[], type: PromotionEvidenceType): boolean {
  return evidence.some((item) => item.type === type && (item.status === "PASS" || item.status === "WARN"));
}
