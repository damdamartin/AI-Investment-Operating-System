import { containsSecretLikeOrRawBrokerData } from "../scheduler/scheduler-job-runner.js";

export type IncidentRunbookScenario =
  | "BROKER_API_FAILURE"
  | "UNKNOWN_ORDER_STATE"
  | "RECONCILIATION_MISMATCH"
  | "CLAUDE_API_FAILURE"
  | "NAVER_API_FAILURE"
  | "KILL_SWITCH_ACTIVATION"
  | "SCHEDULER_JOB_FAILURE"
  | "LOCAL_PHASE5_STATE_MISSING"
  | "AUDIT_COVERAGE_GAP";

/**
 * The Phase 6 round 2 operator runbook (`docs/phase6/phase6-operator-runbook.md`)
 * must cover every scenario in this list. `IncidentRunbookReview.reviewSet`
 * flags any scenario missing from a supplied runbook document, not just
 * incomplete fields within a section that does exist.
 */
export const PHASE6_REQUIRED_RUNBOOK_SCENARIOS: readonly IncidentRunbookScenario[] = [
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

export interface IncidentRunbookSection {
  scenario: IncidentRunbookScenario;
  symptoms: string[];
  immediateActions: string[];
  investigation: string[];
  recovery: string[];
  postmortemNotes: string[];
  tradingSafetyState: "CLEAR" | "PAUSED" | "BLOCKED";
  prefersNoTrade: boolean;
}

export interface IncidentRunbookReviewResult {
  ok: boolean;
  scenario: IncidentRunbookScenario;
  reasonCodes: string[];
  safetyType: "INCIDENT_RUNBOOK_REVIEW_ONLY";
}

export interface RunbookSetReviewResult {
  ok: boolean;
  reasonCodes: string[];
  perScenario: IncidentRunbookReviewResult[];
  safetyType: "INCIDENT_RUNBOOK_SET_REVIEW_ONLY";
}

export class IncidentRunbookReview {
  review(section: IncidentRunbookSection): IncidentRunbookReviewResult {
    const reasonCodes: string[] = [];

    if (section.symptoms.length === 0) reasonCodes.push("missing_symptoms");
    if (section.immediateActions.length === 0) reasonCodes.push("missing_immediate_actions");
    if (section.investigation.length === 0) reasonCodes.push("missing_investigation");
    if (section.recovery.length === 0) reasonCodes.push("missing_recovery");
    if (section.postmortemNotes.length === 0) reasonCodes.push("missing_postmortem_notes");
    if (section.tradingSafetyState === "CLEAR") reasonCodes.push("trading_safety_state_not_explicitly_restrictive");
    if (!section.prefersNoTrade) reasonCodes.push("does_not_prefer_no_trade_over_uncertain_trade");
    if (sectionContainsSecretLikeOrRawBrokerData(section)) {
      reasonCodes.push("runbook_section_may_contain_secret_or_raw_broker_data");
    }

    return {
      ok: reasonCodes.length === 0,
      scenario: section.scenario,
      reasonCodes: reasonCodes.sort(),
      safetyType: "INCIDENT_RUNBOOK_REVIEW_ONLY"
    };
  }

  /**
   * Reviews an entire runbook document (one section per scenario). Catches
   * two distinct kinds of gaps: a required scenario missing from the
   * document entirely, and a scenario present but incomplete (delegated to
   * `review`).
   */
  reviewSet(sections: IncidentRunbookSection[]): RunbookSetReviewResult {
    const reasonCodes: string[] = [];
    const seenScenarios = new Set(sections.map((section) => section.scenario));

    for (const requiredScenario of PHASE6_REQUIRED_RUNBOOK_SCENARIOS) {
      if (!seenScenarios.has(requiredScenario)) {
        reasonCodes.push(`missing_runbook_scenario_${requiredScenario.toLowerCase()}`);
      }
    }

    const perScenario = sections.map((section) => this.review(section));
    for (const sectionResult of perScenario) {
      if (!sectionResult.ok) {
        reasonCodes.push(`incomplete_runbook_scenario_${sectionResult.scenario.toLowerCase()}`);
      }
    }

    return {
      ok: reasonCodes.length === 0,
      reasonCodes: [...new Set(reasonCodes)].sort(),
      perScenario,
      safetyType: "INCIDENT_RUNBOOK_SET_REVIEW_ONLY"
    };
  }
}

function sectionContainsSecretLikeOrRawBrokerData(section: IncidentRunbookSection): boolean {
  const fields = [...section.symptoms, ...section.immediateActions, ...section.investigation, ...section.recovery, ...section.postmortemNotes];
  return fields.some((field) => containsSecretLikeOrRawBrokerData(field));
}
