import { describe, expect, it } from "vitest";
import {
  StrategyPromotionWorkflow,
  StrategyVersion,
  type PromotionEvidence,
  type StrategyVersionStatus
} from "../../src/index.js";

describe("StrategyPromotionWorkflow", () => {
  it("allows each validation stage only when required evidence exists", () => {
    const workflow = new StrategyPromotionWorkflow();
    const backtested = workflow.evaluate(request(version("DRAFT"), "BACKTESTED", [evidence("BACKTEST")]));
    const walkForward = workflow.evaluate(
      request(backtested.promotedStrategyVersion!, "WALK_FORWARD_VALIDATED", [
        evidence("BACKTEST"),
        evidence("WALK_FORWARD")
      ])
    );
    const shadow = workflow.evaluate(
      request(walkForward.promotedStrategyVersion!, "SHADOW", [
        evidence("BACKTEST"),
        evidence("WALK_FORWARD"),
        evidence("SHADOW_PORTFOLIO")
      ])
    );
    const paper = workflow.evaluate(
      request(shadow.promotedStrategyVersion!, "PAPER", [
        evidence("BACKTEST"),
        evidence("WALK_FORWARD"),
        evidence("SHADOW_PORTFOLIO"),
        evidence("PAPER_TRADING")
      ])
    );

    expect(backtested.approved).toBe(true);
    expect(walkForward.promotedStrategyVersion?.status).toBe("WALK_FORWARD_VALIDATED");
    expect(shadow.promotedStrategyVersion?.status).toBe("SHADOW");
    expect(paper.promotedStrategyVersion?.status).toBe("PAPER");
  });

  it("rejects skipped validation stages", () => {
    const decision = new StrategyPromotionWorkflow().evaluate(
      request(version("DRAFT"), "PRODUCTION_APPROVED", allProductionEvidence())
    );

    expect(decision.approved).toBe(false);
    expect(decision.reasonCodes).toContain("invalid_strategy_stage_transition");
    expect(decision.promotedStrategyVersion).toBeUndefined();
  });

  it("rejects backtest-only production promotion", () => {
    const decision = new StrategyPromotionWorkflow().evaluate(
      request(version("SMALL_CAPITAL_LIVE"), "PRODUCTION_APPROVED", [evidence("BACKTEST")])
    );

    expect(decision.approved).toBe(false);
    expect(decision.reasonCodes).toEqual(
      expect.arrayContaining([
        "missing_walk_forward",
        "missing_shadow_portfolio",
        "missing_paper_trading",
        "missing_small_capital_live",
        "missing_strategy_diversity_review",
        "missing_human_approval"
      ])
    );
  });

  it("represents compliance and open-question blocks", () => {
    const decision = new StrategyPromotionWorkflow().evaluate(
      request(version("PAPER"), "SMALL_CAPITAL_LIVE", [
        evidence("BACKTEST"),
        evidence("WALK_FORWARD"),
        evidence("SHADOW_PORTFOLIO"),
        evidence("PAPER_TRADING"),
        evidence("RISK_REVIEW"),
        evidence("COST_REVIEW"),
        evidence("STRATEGY_DIVERSITY_REVIEW"),
        evidence("AI_HEALTH_CHECK"),
        evidence("COMPLIANCE_REVIEW", "UNVERIFIED"),
        evidence("ROLLBACK_PLAN")
      ], ["Toss automated trading terms still unverified"])
    );

    expect(decision.approved).toBe(false);
    expect(decision.reasonCodes).toContain("compliance_review_unverified");
    expect(decision.reasonCodes).toContain("open_questions_block_promotion");
  });

  it("requires human approval for early production promotion", () => {
    const decision = new StrategyPromotionWorkflow().evaluate(
      request(version("SMALL_CAPITAL_LIVE"), "PRODUCTION_APPROVED", allProductionEvidence({ humanApproval: false }))
    );

    expect(decision.approved).toBe(false);
    expect(decision.reasonCodes).toContain("missing_human_approval");
    expect(decision.reasonCodes).toContain("human_approval_required_for_production_promotion");
  });

  it("stores rollback reference and remains decision-only when production approval passes", () => {
    const decision = new StrategyPromotionWorkflow().evaluate(
      request(version("SMALL_CAPITAL_LIVE"), "PRODUCTION_APPROVED", allProductionEvidence())
    );

    expect(decision.approved).toBe(true);
    expect(decision.promotedStrategyVersion?.status).toBe("PRODUCTION_APPROVED");
    expect(decision.rollbackPlanReference).toBe("rollback_plan-ref");
    expect(decision.safetyType).toBe("STRATEGY_PROMOTION_DECISION_ONLY");
    expect(decision).not.toHaveProperty("activateProduction");
    expect(decision).not.toHaveProperty("allocateCapital");
  });
});

function request(
  strategyVersion: StrategyVersion,
  targetStatus: StrategyVersionStatus,
  evidenceItems: PromotionEvidence[],
  openQuestions: string[] = []
) {
  return {
    requestId: "promotion-request-1",
    strategyVersion,
    targetStatus,
    evidence: evidenceItems,
    openQuestions,
    requestedAt: new Date("2026-01-01T00:00:00Z")
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

function allProductionEvidence(options: { humanApproval?: boolean } = {}): PromotionEvidence[] {
  return [
    evidence("BACKTEST"),
    evidence("WALK_FORWARD"),
    evidence("SHADOW_PORTFOLIO"),
    evidence("PAPER_TRADING"),
    evidence("SMALL_CAPITAL_LIVE"),
    evidence("RISK_REVIEW"),
    evidence("COST_REVIEW"),
    evidence("STRATEGY_DIVERSITY_REVIEW"),
    evidence("AI_HEALTH_CHECK"),
    evidence("COMPLIANCE_REVIEW"),
    evidence("ROLLBACK_PLAN"),
    ...(options.humanApproval === false ? [] : [evidence("HUMAN_APPROVAL")])
  ];
}
