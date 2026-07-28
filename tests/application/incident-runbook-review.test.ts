import { describe, expect, it } from "vitest";
import {
  IncidentRunbookReview,
  type IncidentRunbookScenario,
  type IncidentRunbookSection
} from "../../src/index.js";

describe("IncidentRunbookReview", () => {
  it("accepts complete broker API failure runbooks", () => {
    const result = new IncidentRunbookReview().review(section("BROKER_API_FAILURE"));

    expect(result.ok).toBe(true);
    expect(result.reasonCodes).toEqual([]);
    expect(result.safetyType).toBe("INCIDENT_RUNBOOK_REVIEW_ONLY");
  });

  it("requires symptoms, immediate action, investigation, recovery, and postmortem notes", () => {
    const result = new IncidentRunbookReview().review({
      ...section("UNKNOWN_ORDER_STATE"),
      symptoms: [],
      immediateActions: [],
      investigation: [],
      recovery: [],
      postmortemNotes: []
    });

    expect(result.ok).toBe(false);
    expect(result.reasonCodes).toEqual([
      "missing_immediate_actions",
      "missing_investigation",
      "missing_postmortem_notes",
      "missing_recovery",
      "missing_symptoms"
    ]);
  });

  it("requires an explicitly restrictive trading safety state", () => {
    const result = new IncidentRunbookReview().review({
      ...section("RECONCILIATION_MISMATCH"),
      tradingSafetyState: "CLEAR"
    });

    expect(result.ok).toBe(false);
    expect(result.reasonCodes).toContain("trading_safety_state_not_explicitly_restrictive");
  });

  it("requires no-trade preference under uncertainty", () => {
    const result = new IncidentRunbookReview().review({
      ...section("CLAUDE_API_FAILURE"),
      prefersNoTrade: false
    });

    expect(result.ok).toBe(false);
    expect(result.reasonCodes).toContain("does_not_prefer_no_trade_over_uncertain_trade");
  });

  it("covers the required incident scenarios", () => {
    const scenarios: IncidentRunbookScenario[] = [
      "BROKER_API_FAILURE",
      "UNKNOWN_ORDER_STATE",
      "RECONCILIATION_MISMATCH",
      "CLAUDE_API_FAILURE",
      "NAVER_API_FAILURE",
      "KILL_SWITCH_ACTIVATION"
    ];

    const results = scenarios.map((scenario) => new IncidentRunbookReview().review(section(scenario)));

    expect(results.every((result) => result.ok)).toBe(true);
    expect(results.map((result) => result.scenario)).toEqual(scenarios);
  });
});

function section(scenario: IncidentRunbookScenario): IncidentRunbookSection {
  return {
    scenario,
    symptoms: ["alert fired"],
    immediateActions: ["pause affected trading flows"],
    investigation: ["review logs and state"],
    recovery: ["resume only after safety gates pass"],
    postmortemNotes: ["record root cause and follow-up"],
    tradingSafetyState: scenario === "CLAUDE_API_FAILURE" || scenario === "NAVER_API_FAILURE" ? "PAUSED" : "BLOCKED",
    prefersNoTrade: true
  };
}
