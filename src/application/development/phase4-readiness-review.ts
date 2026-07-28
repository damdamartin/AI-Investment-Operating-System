export type Phase4TaskStatus = "COMPLETE" | "DRAFT" | "BLOCKED";
export type Phase4OpenQuestionPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type Phase4OpenQuestionStatus = "OPEN" | "IN_REVIEW" | "RESOLVED" | "DEFERRED" | "BLOCKED";
export type Phase4ReadinessDecision =
  | "APPROVED_FOR_SAFE_FOUNDATION"
  | "APPROVED_FOR_READ_ONLY_NEXT_PHASE"
  | "DEFER_IMPLEMENTATION";

export interface Phase4TaskReviewItem {
  taskId: string;
  status: Phase4TaskStatus;
  liveBrokerWriteScope: boolean;
}

export interface Phase4OpenQuestionReviewItem {
  questionId: string;
  priority: Phase4OpenQuestionPriority;
  status: Phase4OpenQuestionStatus;
  blockedScopes: string[];
}

export interface Phase4ReadinessInput {
  tasks: Phase4TaskReviewItem[];
  openQuestions: Phase4OpenQuestionReviewItem[];
  safetyRulesCovered: string[];
  latestProjectCheckPassed: boolean;
  liveBrokerWriteRequested: boolean;
}

export interface Phase4ReadinessResult {
  decision: Phase4ReadinessDecision;
  implementationAllowed: boolean;
  readOnlyNextPhaseAllowed: boolean;
  liveBrokerWriteAllowed: boolean;
  blockedScopes: string[];
  reasonCodes: string[];
  recommendedNextSteps: string[];
  safetyType: "PHASE4_READINESS_REVIEW_ONLY";
}

const requiredSafetyRules = [
  "AI_IS_NOT_TRADER",
  "NEWS_IS_NOT_ORDER_TRIGGER",
  "SIGNAL_IS_NOT_ORDER",
  "RISK_ENGINE_REQUIRED",
  "MONEY_MANAGEMENT_REQUIRED",
  "ORDER_APPROVAL_REQUIRED",
  "BROKER_WRITE_GUARD_REQUIRED"
];

export class Phase4ReadinessReview {
  review(input: Phase4ReadinessInput): Phase4ReadinessResult {
    const reasonCodes: string[] = [];
    const blockedScopes = new Set<string>();
    const incompleteTasks = input.tasks.filter((task) => task.status !== "COMPLETE");
    const unresolvedHighQuestions = input.openQuestions.filter(
      (question) =>
        ["CRITICAL", "HIGH"].includes(question.priority) &&
        ["OPEN", "IN_REVIEW", "BLOCKED"].includes(question.status)
    );

    for (const task of incompleteTasks) {
      reasonCodes.push(`task_not_complete_${task.taskId}`);
    }

    if (!input.latestProjectCheckPassed) {
      reasonCodes.push("latest_project_check_not_passed");
    }

    for (const rule of requiredSafetyRules) {
      if (!input.safetyRulesCovered.includes(rule)) {
        reasonCodes.push(`missing_safety_rule_${rule.toLowerCase()}`);
      }
    }

    for (const question of unresolvedHighQuestions) {
      reasonCodes.push(`unresolved_high_priority_question_${question.questionId}`);
      for (const scope of question.blockedScopes) {
        blockedScopes.add(scope);
      }
    }

    if (input.liveBrokerWriteRequested) {
      reasonCodes.push("live_broker_write_requested_before_gates");
      blockedScopes.add("live_broker_write");
    }

    const safeFoundationReady =
      incompleteTasks.length === 0 &&
      input.latestProjectCheckPassed &&
      requiredSafetyRules.every((rule) => input.safetyRulesCovered.includes(rule));

    const readOnlyNextPhaseAllowed =
      safeFoundationReady &&
      !input.liveBrokerWriteRequested;

    return {
      decision: this.decisionFor(safeFoundationReady, readOnlyNextPhaseAllowed),
      implementationAllowed: safeFoundationReady,
      readOnlyNextPhaseAllowed,
      liveBrokerWriteAllowed: false,
      blockedScopes: [...blockedScopes].sort(),
      reasonCodes: [...new Set(reasonCodes)].sort(),
      recommendedNextSteps: this.nextSteps(readOnlyNextPhaseAllowed),
      safetyType: "PHASE4_READINESS_REVIEW_ONLY"
    };
  }

  private decisionFor(
    safeFoundationReady: boolean,
    readOnlyNextPhaseAllowed: boolean
  ): Phase4ReadinessDecision {
    if (!safeFoundationReady) return "DEFER_IMPLEMENTATION";
    if (readOnlyNextPhaseAllowed) return "APPROVED_FOR_READ_ONLY_NEXT_PHASE";

    return "APPROVED_FOR_SAFE_FOUNDATION";
  }

  private nextSteps(readOnlyNextPhaseAllowed: boolean): string[] {
    if (!readOnlyNextPhaseAllowed) {
      return [
        "Complete remaining safe foundation tasks.",
        "Run the full project check.",
        "Confirm all required safety rules remain covered."
      ];
    }

    return [
      "Keep live Toss write operations blocked.",
      "Resolve or evidence Toss API permission and identifier open questions.",
      "Collect historical data provider evidence before credible strategy validation.",
      "Run read-only adapter and data-ingestion work before any live execution work."
    ];
  }
}
