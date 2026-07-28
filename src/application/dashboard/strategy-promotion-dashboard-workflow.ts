import type { AuditRecordProps } from "../audit/index.js";
import {
  DashboardSensitiveControlGate,
  type DashboardActorAuthState,
  type DashboardSensitiveControlDecision
} from "./sensitive-control-gate.js";
import {
  StrategyPromotionWorkflow,
  type PromotionDecision,
  type PromotionEvidence,
  type PromotionRequest
} from "../strategy-promotion/index.js";

export interface StrategyPromotionEvidenceView {
  requestId: string;
  strategyVersionId: string;
  currentStatus: string;
  targetStatus: string;
  evidence: PromotionEvidence[];
  evidenceReferences: string[];
  openQuestions: string[];
  generatedAt: Date;
  readOnly: true;
  safetyType: "STRATEGY_PROMOTION_EVIDENCE_READ_ONLY_VIEW";
}

export interface StrategyPromotionDashboardDecisionInput {
  request: PromotionRequest;
  auth: DashboardActorAuthState | undefined;
  reason?: string | undefined;
  confirmedAt?: Date | undefined;
  requestedAt: Date;
}

export interface StrategyPromotionDashboardDecisionResult {
  accepted: boolean;
  gateDecision: DashboardSensitiveControlDecision;
  promotionDecision: PromotionDecision | undefined;
  reasonCodes: string[];
  auditRecord: AuditRecordProps;
  safetyType: "STRATEGY_PROMOTION_DASHBOARD_DECISION_ONLY";
}

export class StrategyPromotionDashboardWorkflow {
  constructor(
    private readonly sensitiveControlGate = new DashboardSensitiveControlGate(),
    private readonly promotionWorkflow = new StrategyPromotionWorkflow()
  ) {}

  buildEvidenceView(request: PromotionRequest, generatedAt: Date): StrategyPromotionEvidenceView {
    return {
      requestId: request.requestId,
      strategyVersionId: request.strategyVersion.id,
      currentStatus: request.strategyVersion.status,
      targetStatus: request.targetStatus,
      evidence: request.evidence.map((item) => ({ ...item })),
      evidenceReferences: request.evidence.map((item) => item.referenceId),
      openQuestions: [...(request.openQuestions ?? [])],
      generatedAt,
      readOnly: true,
      safetyType: "STRATEGY_PROMOTION_EVIDENCE_READ_ONLY_VIEW"
    };
  }

  requestDecision(input: StrategyPromotionDashboardDecisionInput): StrategyPromotionDashboardDecisionResult {
    const gateDecision = this.sensitiveControlGate.evaluate({
      actionType: "PROMOTE_STRATEGY",
      resourceId: input.request.strategyVersion.id,
      auth: input.auth,
      reason: input.reason,
      confirmedAt: input.confirmedAt,
      requestedAt: input.requestedAt
    });

    if (!gateDecision.allowed) {
      return decisionResult({
        accepted: false,
        gateDecision,
        promotionDecision: undefined,
        reasonCodes: gateDecision.reasonCodes,
        auditRecord: dashboardAuditRecord(input, gateDecision, undefined, false, gateDecision.reasonCodes)
      });
    }

    const promotionDecision = this.promotionWorkflow.evaluate(input.request);
    const reasonCodes = promotionDecision.approved ? [] : promotionDecision.reasonCodes;

    return decisionResult({
      accepted: promotionDecision.approved,
      gateDecision,
      promotionDecision,
      reasonCodes,
      auditRecord: dashboardAuditRecord(input, gateDecision, promotionDecision, promotionDecision.approved, reasonCodes)
    });
  }
}

function decisionResult(
  fields: Omit<StrategyPromotionDashboardDecisionResult, "safetyType">
): StrategyPromotionDashboardDecisionResult {
  return {
    ...fields,
    safetyType: "STRATEGY_PROMOTION_DASHBOARD_DECISION_ONLY"
  };
}

function dashboardAuditRecord(
  input: StrategyPromotionDashboardDecisionInput,
  gateDecision: DashboardSensitiveControlDecision,
  promotionDecision: PromotionDecision | undefined,
  accepted: boolean,
  reasonCodes: string[]
): AuditRecordProps {
  const record: AuditRecordProps = {
    id: `audit-strategy-promotion-dashboard-${input.request.requestId}-${input.requestedAt.getTime()}`,
    actor: input.auth?.actorId || "unknown-dashboard-actor",
    action: accepted ? "STRATEGY_PROMOTION_DASHBOARD_ACCEPTED" : "STRATEGY_PROMOTION_DASHBOARD_BLOCKED",
    resourceType: "STRATEGY_PROMOTION_REQUEST",
    resourceId: input.request.requestId,
    metadata: {
      strategyVersionId: input.request.strategyVersion.id,
      fromStatus: input.request.strategyVersion.status,
      targetStatus: input.request.targetStatus,
      gateAllowed: gateDecision.allowed,
      promotionApproved: promotionDecision?.approved ?? false,
      evidenceReferences: input.request.evidence.map((item) => item.referenceId),
      reasonCodes
    },
    createdAt: input.requestedAt
  };

  if (input.reason !== undefined) record.reason = input.reason;
  return record;
}
