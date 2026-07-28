import { describe, expect, it } from "vitest";
import {
  Phase4ReadinessReview,
  type Phase4ReadinessInput
} from "../../src/index.js";

describe("Phase4ReadinessReview", () => {
  it("approves the read-only next phase when safe foundation checks pass", () => {
    const result = new Phase4ReadinessReview().review(readyInput());

    expect(result.decision).toBe("APPROVED_FOR_READ_ONLY_NEXT_PHASE");
    expect(result.implementationAllowed).toBe(true);
    expect(result.readOnlyNextPhaseAllowed).toBe(true);
    expect(result.liveBrokerWriteAllowed).toBe(false);
    expect(result.safetyType).toBe("PHASE4_READINESS_REVIEW_ONLY");
  });

  it("keeps live broker write blocked even when foundation readiness passes", () => {
    const result = new Phase4ReadinessReview().review({
      ...readyInput(),
      liveBrokerWriteRequested: true
    });

    expect(result.liveBrokerWriteAllowed).toBe(false);
    expect(result.readOnlyNextPhaseAllowed).toBe(false);
    expect(result.blockedScopes).toContain("live_broker_write");
    expect(result.reasonCodes).toContain("live_broker_write_requested_before_gates");
  });

  it("maps unresolved high priority open questions to blocked scopes", () => {
    const result = new Phase4ReadinessReview().review({
      ...readyInput(),
      openQuestions: [
        {
          questionId: "OQ-001",
          priority: "CRITICAL",
          status: "OPEN",
          blockedScopes: ["live_broker_write", "small_capital_live_trading"]
        }
      ]
    });

    expect(result.blockedScopes).toContain("live_broker_write");
    expect(result.blockedScopes).toContain("small_capital_live_trading");
    expect(result.reasonCodes).toContain("unresolved_high_priority_question_OQ-001");
  });

  it("defers implementation when required safety rules are missing", () => {
    const result = new Phase4ReadinessReview().review({
      ...readyInput(),
      safetyRulesCovered: ["AI_IS_NOT_TRADER"]
    });

    expect(result.decision).toBe("DEFER_IMPLEMENTATION");
    expect(result.implementationAllowed).toBe(false);
    expect(result.reasonCodes).toContain("missing_safety_rule_risk_engine_required");
  });

  it("defers implementation when tasks are incomplete or checks fail", () => {
    const result = new Phase4ReadinessReview().review({
      ...readyInput(),
      latestProjectCheckPassed: false,
      tasks: [
        { taskId: "Task-059", status: "COMPLETE", liveBrokerWriteScope: false },
        { taskId: "Task-060", status: "DRAFT", liveBrokerWriteScope: false }
      ]
    });

    expect(result.decision).toBe("DEFER_IMPLEMENTATION");
    expect(result.reasonCodes).toContain("latest_project_check_not_passed");
    expect(result.reasonCodes).toContain("task_not_complete_Task-060");
  });
});

function readyInput(): Phase4ReadinessInput {
  return {
    tasks: [
      { taskId: "Task-001", status: "COMPLETE", liveBrokerWriteScope: false },
      { taskId: "Task-060", status: "COMPLETE", liveBrokerWriteScope: false }
    ],
    openQuestions: [],
    safetyRulesCovered: [
      "AI_IS_NOT_TRADER",
      "NEWS_IS_NOT_ORDER_TRIGGER",
      "SIGNAL_IS_NOT_ORDER",
      "RISK_ENGINE_REQUIRED",
      "MONEY_MANAGEMENT_REQUIRED",
      "ORDER_APPROVAL_REQUIRED",
      "BROKER_WRITE_GUARD_REQUIRED"
    ],
    latestProjectCheckPassed: true,
    liveBrokerWriteRequested: false
  };
}
