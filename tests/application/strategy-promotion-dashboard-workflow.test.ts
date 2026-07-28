import { describe, expect, it } from "vitest";
import {
  StrategyPromotionDashboardWorkflow,
  StrategyVersion,
  type DashboardActorAuthState,
  type PromotionEvidence,
  type StrategyVersionStatus
} from "../../src/index.js";

describe("StrategyPromotionDashboardWorkflow", () => {
  it("builds a read-only promotion evidence view", () => {
    const view = new StrategyPromotionDashboardWorkflow().buildEvidenceView(
      request(version("PAPER"), "SMALL_CAPITAL_LIVE", smallCapitalEvidence()),
      now()
    );

    expect(view.readOnly).toBe(true);
    expect(view.evidenceReferences).toContain("backtest-ref");
    expect(view.safetyType).toBe("STRATEGY_PROMOTION_EVIDENCE_READ_ONLY_VIEW");
    expect(view).not.toHaveProperty("promoteStrategy");
    expect(view).not.toHaveProperty("allocateCapital");
  });

  it("blocks dashboard promotion when sensitive control requirements fail", () => {
    const result = new StrategyPromotionDashboardWorkflow().requestDecision({
      request: request(version("PAPER"), "SMALL_CAPITAL_LIVE", smallCapitalEvidence()),
      auth: actor(["DASHBOARD_READ"]),
      requestedAt: now()
    });

    expect(result.accepted).toBe(false);
    expect(result.promotionDecision).toBeUndefined();
    expect(result.reasonCodes).toContain("missing_permission_strategy_governance_write");
    expect(result.reasonCodes).toContain("step_up_confirmation_required");
    expect(result.auditRecord.action).toBe("STRATEGY_PROMOTION_DASHBOARD_BLOCKED");
  });

  it("blocks promotion through the strategy workflow when evidence is missing", () => {
    const result = new StrategyPromotionDashboardWorkflow().requestDecision({
      request: request(version("PAPER"), "SMALL_CAPITAL_LIVE", [evidence("BACKTEST")]),
      auth: actor(["STRATEGY_GOVERNANCE_WRITE"]),
      reason: "review candidate evidence",
      confirmedAt: now(),
      requestedAt: now()
    });

    expect(result.gateDecision.allowed).toBe(true);
    expect(result.accepted).toBe(false);
    expect(result.promotionDecision?.approved).toBe(false);
    expect(result.reasonCodes).toContain("missing_walk_forward");
    expect(result.reasonCodes).toContain("missing_rollback_plan");
  });

  it("accepts a dashboard promotion request only after gate and workflow pass", () => {
    const result = new StrategyPromotionDashboardWorkflow().requestDecision({
      request: request(version("PAPER"), "SMALL_CAPITAL_LIVE", smallCapitalEvidence()),
      auth: actor(["STRATEGY_GOVERNANCE_WRITE"]),
      reason: "all small-capital readiness evidence reviewed",
      confirmedAt: now(),
      requestedAt: now()
    });

    expect(result.accepted).toBe(true);
    expect(result.gateDecision.allowed).toBe(true);
    expect(result.promotionDecision?.approved).toBe(true);
    expect(result.promotionDecision?.promotedStrategyVersion?.status).toBe("SMALL_CAPITAL_LIVE");
    expect(result.auditRecord.action).toBe("STRATEGY_PROMOTION_DASHBOARD_ACCEPTED");
  });

  it("does not expose direct production activation or capital allocation commands", () => {
    const result = new StrategyPromotionDashboardWorkflow().requestDecision({
      request: request(version("PAPER"), "SMALL_CAPITAL_LIVE", smallCapitalEvidence()),
      auth: actor(["STRATEGY_GOVERNANCE_WRITE"]),
      reason: "all small-capital readiness evidence reviewed",
      confirmedAt: now(),
      requestedAt: now()
    });

    expect(result.safetyType).toBe("STRATEGY_PROMOTION_DASHBOARD_DECISION_ONLY");
    expect(result).not.toHaveProperty("activateProduction");
    expect(result).not.toHaveProperty("allocateCapital");
    expect(result).not.toHaveProperty("submitOrder");
  });
});

function request(strategyVersion: StrategyVersion, targetStatus: StrategyVersionStatus, evidenceItems: PromotionEvidence[]) {
  return {
    requestId: "promotion-request-1",
    strategyVersion,
    targetStatus,
    evidence: evidenceItems,
    openQuestions: [],
    requestedAt: now()
  };
}

function version(status: StrategyVersionStatus): StrategyVersion {
  return new StrategyVersion({
    id: "strategy-version-1",
    strategyId: "strategy-1",
    version: "1.0.0",
    definitionHash: "hash-1",
    status
  });
}

function evidence(type: PromotionEvidence["type"], status: PromotionEvidence["status"] = "PASS"): PromotionEvidence {
  return {
    type,
    status,
    referenceId: `${type.toLowerCase()}-ref`
  };
}

function smallCapitalEvidence(): PromotionEvidence[] {
  return [
    evidence("BACKTEST"),
    evidence("WALK_FORWARD"),
    evidence("SHADOW_PORTFOLIO"),
    evidence("PAPER_TRADING"),
    evidence("RISK_REVIEW"),
    evidence("COST_REVIEW"),
    evidence("STRATEGY_DIVERSITY_REVIEW"),
    evidence("AI_HEALTH_CHECK"),
    evidence("COMPLIANCE_REVIEW"),
    evidence("ROLLBACK_PLAN")
  ];
}

function actor(permissions: DashboardActorAuthState["permissions"]): DashboardActorAuthState {
  return {
    actorId: "operator-1",
    authenticated: true,
    permissions
  };
}

function now(): Date {
  return new Date("2026-01-01T00:00:00Z");
}
