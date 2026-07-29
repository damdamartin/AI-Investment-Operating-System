import { describe, expect, it } from "vitest";
import {
  IncidentRunbookReview,
  PHASE6_REQUIRED_RUNBOOK_SCENARIOS,
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

  it("flags secret-like or raw-broker-data-shaped text inside a runbook section", () => {
    const result = new IncidentRunbookReview().review({
      ...section("SCHEDULER_JOB_FAILURE"),
      investigation: ["check logs for client_secret=abc123 and account_number 12345678901"]
    });

    expect(result.ok).toBe(false);
    expect(result.reasonCodes).toContain("runbook_section_may_contain_secret_or_raw_broker_data");
  });

  it("covers the required incident scenarios", () => {
    const scenarios: IncidentRunbookScenario[] = [
      "BROKER_API_FAILURE",
      "UNKNOWN_ORDER_STATE",
      "RECONCILIATION_MISMATCH",
      "CLAUDE_API_FAILURE",
      "NAVER_API_FAILURE",
      "KILL_SWITCH_ACTIVATION",
      "SCHEDULER_JOB_FAILURE",
      "LOCAL_PHASE5_STATE_MISSING",
      "AUDIT_COVERAGE_GAP"
    ];

    const results = scenarios.map((scenario) => new IncidentRunbookReview().review(section(scenario)));

    expect(results.every((result) => result.ok)).toBe(true);
    expect(results.map((result) => result.scenario)).toEqual(scenarios);
    expect(scenarios).toEqual(PHASE6_REQUIRED_RUNBOOK_SCENARIOS);
  });

  describe("reviewSet", () => {
    it("accepts a complete runbook document covering every required scenario", () => {
      const sections = PHASE6_REQUIRED_RUNBOOK_SCENARIOS.map((scenario) => section(scenario));
      const result = new IncidentRunbookReview().reviewSet(sections);

      expect(result.ok).toBe(true);
      expect(result.reasonCodes).toEqual([]);
      expect(result.perScenario).toHaveLength(PHASE6_REQUIRED_RUNBOOK_SCENARIOS.length);
      expect(result.safetyType).toBe("INCIDENT_RUNBOOK_SET_REVIEW_ONLY");
    });

    it("catches an entire scenario missing from the runbook document", () => {
      const sections = PHASE6_REQUIRED_RUNBOOK_SCENARIOS.filter((scenario) => scenario !== "LOCAL_PHASE5_STATE_MISSING").map(
        (scenario) => section(scenario)
      );
      const result = new IncidentRunbookReview().reviewSet(sections);

      expect(result.ok).toBe(false);
      expect(result.reasonCodes).toContain("missing_runbook_scenario_local_phase5_state_missing");
    });

    it("catches a present-but-incomplete scenario inside the runbook document", () => {
      const sections = PHASE6_REQUIRED_RUNBOOK_SCENARIOS.map((scenario) =>
        scenario === "AUDIT_COVERAGE_GAP" ? { ...section(scenario), recovery: [] } : section(scenario)
      );
      const result = new IncidentRunbookReview().reviewSet(sections);

      expect(result.ok).toBe(false);
      expect(result.reasonCodes).toContain("incomplete_runbook_scenario_audit_coverage_gap");
    });
  });
});

function section(scenario: IncidentRunbookScenario): IncidentRunbookSection {
  const pausedScenarios: IncidentRunbookScenario[] = [
    "CLAUDE_API_FAILURE",
    "NAVER_API_FAILURE",
    "SCHEDULER_JOB_FAILURE",
    "LOCAL_PHASE5_STATE_MISSING"
  ];

  return {
    scenario,
    symptoms: ["alert fired"],
    immediateActions: ["pause affected trading flows"],
    investigation: ["review logs and state"],
    recovery: ["resume only after safety gates pass"],
    postmortemNotes: ["record root cause and follow-up"],
    tradingSafetyState: pausedScenarios.includes(scenario) ? "PAUSED" : "BLOCKED",
    prefersNoTrade: true
  };
}
