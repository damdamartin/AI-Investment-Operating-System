export type IncidentRunbookScenario =
  | "BROKER_API_FAILURE"
  | "UNKNOWN_ORDER_STATE"
  | "RECONCILIATION_MISMATCH"
  | "CLAUDE_API_FAILURE"
  | "NAVER_API_FAILURE"
  | "KILL_SWITCH_ACTIVATION";

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

    return {
      ok: reasonCodes.length === 0,
      scenario: section.scenario,
      reasonCodes: reasonCodes.sort(),
      safetyType: "INCIDENT_RUNBOOK_REVIEW_ONLY"
    };
  }
}
