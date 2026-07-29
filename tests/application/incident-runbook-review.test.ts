import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

    it("keeps the committed Phase 6 operator runbook aligned with required scenarios", () => {
      const markdown = readFileSync(resolve(process.cwd(), "docs/phase6/phase6-operator-runbook.md"), "utf8");
      const sections = runbookSectionsFromMarkdown(markdown);
      const result = new IncidentRunbookReview().reviewSet(sections);

      expect(sections.map((section) => section.scenario)).toEqual(PHASE6_REQUIRED_RUNBOOK_SCENARIOS);
      expect(result.ok).toBe(true);
      expect(result.reasonCodes).toEqual([]);
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

function runbookSectionsFromMarkdown(markdown: string): IncidentRunbookSection[] {
  return PHASE6_REQUIRED_RUNBOOK_SCENARIOS.map((scenario) => {
    const body = scenarioSectionBody(markdown, scenario);
    return {
      scenario,
      symptoms: requiredRunbookListValue(body, "Symptoms"),
      immediateActions: requiredRunbookListValue(body, "Immediate actions"),
      investigation: requiredRunbookListValue(body, "Investigation"),
      recovery: requiredRunbookListValue(body, "Recovery"),
      postmortemNotes: requiredRunbookListValue(body, "Postmortem notes"),
      tradingSafetyState: requiredTradingSafetyState(body),
      prefersNoTrade: requiredPrefersNoTrade(body)
    };
  });
}

function scenarioSectionBody(markdown: string, scenario: IncidentRunbookScenario): string {
  const match = new RegExp(`^### ${scenario}\\n([\\s\\S]*?)(?=^### |^## |(?![\\s\\S]))`, "m").exec(markdown);
  const body = match?.[1];
  if (body === undefined) {
    throw new Error(`Missing runbook scenario section: ${scenario}`);
  }
  return body;
}

function requiredRunbookListValue(body: string, label: string): string[] {
  const match = new RegExp(`^- \\*\\*${escapeRegExp(label)}\\*\\*: ([\\s\\S]*?)(?=\\n- \\*\\*|\\n### |\\n## |(?![\\s\\S]))`, "m").exec(body);
  const value = match?.[1];
  if (value === undefined) {
    throw new Error(`Missing runbook field: ${label}`);
  }
  return [value.replace(/\s+/g, " ").trim()];
}

function requiredTradingSafetyState(body: string): IncidentRunbookSection["tradingSafetyState"] {
  const value = requiredRunbookListValue(body, "Trading safety state")[0];
  if (value === undefined) {
    throw new Error("Missing trading safety state");
  }
  const match = /`(CLEAR|PAUSED|BLOCKED)`/.exec(value);
  const state = match?.[1];
  if (state === undefined) {
    throw new Error("Missing explicit trading safety state");
  }
  return state as IncidentRunbookSection["tradingSafetyState"];
}

function requiredPrefersNoTrade(body: string): boolean {
  const value = requiredRunbookListValue(body, "Prefers no-trade under uncertainty")[0];
  if (value === undefined) {
    throw new Error("Missing no-trade preference");
  }
  return value.includes("`true`");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
