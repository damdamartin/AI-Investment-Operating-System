export type AIHealthStatus = "GREEN" | "YELLOW" | "RED" | "BLOCKED";

export interface AIHealthMetricsInput {
  periodStart: Date;
  periodEnd: Date;
  strategyWinRateDelta?: number | undefined;
  strategyMaxDrawdownRatio?: number | undefined;
  orderFailureRate?: number | undefined;
  apiErrorRate?: number | undefined;
  staleDataCount?: number | undefined;
  claudeSchemaFailureRate?: number | undefined;
  aiCostBudgetUsedRatio?: number | undefined;
  unresolvedBrokerStateCount?: number | undefined;
  reconciliationMismatchCount?: number | undefined;
}

export interface AIHealthPolicy {
  yellowApiErrorRate: number;
  redApiErrorRate: number;
  yellowOrderFailureRate: number;
  redOrderFailureRate: number;
  redDrawdownRatio: number;
  yellowClaudeSchemaFailureRate: number;
  redClaudeSchemaFailureRate: number;
  yellowCostBudgetUsedRatio: number;
  redCostBudgetUsedRatio: number;
}

export interface ClaudeHealthCheckOutput {
  schemaVersion: "ai_health_check.v1";
  analysisType: "AI_HEALTH_CHECK";
  periodStart: string;
  periodEnd: string;
  status: AIHealthStatus;
  summary: string;
  strategyFindings: string[];
  executionFindings: string[];
  riskFindings: string[];
  apiFindings: string[];
  dataQualityFindings: string[];
  costFindings: string[];
  recommendedActions: string[];
  requiresTradingPause: boolean;
  requiresHumanReview: boolean;
}

export interface AIHealthCheckRecord {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  status: AIHealthStatus;
  summary: string;
  findings: string[];
  recommendedActions: string[];
  requiresTradingPause: boolean;
  requiresHumanReview: boolean;
  fallbackStatus: AIHealthStatus;
  claudeOutputAccepted: boolean;
  validationErrors: string[];
  inputReferences: string[];
  createdAt: Date;
  safetyType: "AI_HEALTH_CHECK_AUDIT_ONLY";
}

export interface AIHealthCheckInput {
  id: string;
  metrics: AIHealthMetricsInput;
  policy: AIHealthPolicy;
  inputReferences: string[];
  createdAt: Date;
  claudeOutput?: unknown;
}

export interface AIHealthValidationResult {
  ok: boolean;
  output?: ClaudeHealthCheckOutput | undefined;
  errors: string[];
}

const allowedStatuses = new Set(["GREEN", "YELLOW", "RED", "BLOCKED"]);
const forbiddenCommandKeys = new Set([
  "order",
  "orders",
  "brokerCommand",
  "broker_command",
  "submitOrder",
  "cancelOrder",
  "tossRequest",
  "activateStrategy",
  "allocateCapital"
]);

export class AIHealthCheckService {
  run(input: AIHealthCheckInput): AIHealthCheckRecord {
    const fallback = fallbackStatus(input.metrics, input.policy);
    const validation = input.claudeOutput === undefined
      ? { ok: false, errors: ["missing_claude_health_output"] }
      : validateClaudeHealthCheck(input.claudeOutput);
    const accepted = validation.ok && validation.output !== undefined;
    const status = accepted ? worseStatus(fallback, validation.output!.status) : fallback;
    const claudeFindings = accepted ? findingsFrom(validation.output!) : [];

    return {
      id: input.id,
      periodStart: input.metrics.periodStart,
      periodEnd: input.metrics.periodEnd,
      status,
      summary: accepted ? validation.output!.summary : summaryFor(status),
      findings: [...fallbackFindings(input.metrics, input.policy), ...claudeFindings],
      recommendedActions: accepted ? [...validation.output!.recommendedActions] : [],
      requiresTradingPause: accepted ? validation.output!.requiresTradingPause || status === "BLOCKED" : status === "BLOCKED",
      requiresHumanReview: accepted
        ? validation.output!.requiresHumanReview || status === "RED" || status === "BLOCKED"
        : status === "RED" || status === "BLOCKED",
      fallbackStatus: fallback,
      claudeOutputAccepted: accepted,
      validationErrors: validation.errors,
      inputReferences: [...input.inputReferences],
      createdAt: input.createdAt,
      safetyType: "AI_HEALTH_CHECK_AUDIT_ONLY"
    };
  }
}

export function validateClaudeHealthCheck(value: unknown): AIHealthValidationResult {
  const errors: string[] = [];

  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, errors: ["health_check_must_be_object"] };
  }

  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (forbiddenCommandKeys.has(key)) errors.push(`forbidden_command_key_${key}`);
  }

  const schemaVersion = requireString(record.schema_version ?? record.schemaVersion, "schemaVersion", errors);
  const analysisType = requireString(record.analysis_type ?? record.analysisType, "analysisType", errors);
  const periodStart = requireString(record.period_start ?? record.periodStart, "periodStart", errors);
  const periodEnd = requireString(record.period_end ?? record.periodEnd, "periodEnd", errors);
  const status = requireEnum(record.status, allowedStatuses, "status", errors);
  const summary = requireString(record.summary, "summary", errors);
  const strategyFindings = requireStringArray(record.strategy_findings ?? record.strategyFindings, "strategyFindings", errors);
  const executionFindings = requireStringArray(record.execution_findings ?? record.executionFindings, "executionFindings", errors);
  const riskFindings = requireStringArray(record.risk_findings ?? record.riskFindings, "riskFindings", errors);
  const apiFindings = requireStringArray(record.api_findings ?? record.apiFindings, "apiFindings", errors);
  const dataQualityFindings = requireStringArray(
    record.data_quality_findings ?? record.dataQualityFindings,
    "dataQualityFindings",
    errors
  );
  const costFindings = requireStringArray(record.cost_findings ?? record.costFindings, "costFindings", errors);
  const recommendedActions = requireStringArray(
    record.recommended_actions ?? record.recommendedActions,
    "recommendedActions",
    errors
  );
  const requiresTradingPause = requireBoolean(
    record.requires_trading_pause ?? record.requiresTradingPause,
    "requiresTradingPause",
    errors
  );
  const requiresHumanReview = requireBoolean(
    record.requires_human_review ?? record.requiresHumanReview,
    "requiresHumanReview",
    errors
  );

  if (schemaVersion !== undefined && schemaVersion !== "ai_health_check.v1") {
    errors.push("schemaVersion_has_unsupported_value");
  }

  if (analysisType !== undefined && analysisType !== "AI_HEALTH_CHECK") {
    errors.push("analysisType_has_unsupported_value");
  }

  if (periodStart && Number.isNaN(Date.parse(periodStart))) errors.push("periodStart_must_be_valid_datetime");
  if (periodEnd && Number.isNaN(Date.parse(periodEnd))) errors.push("periodEnd_must_be_valid_datetime");

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    output: {
      schemaVersion: "ai_health_check.v1",
      analysisType: "AI_HEALTH_CHECK",
      periodStart: periodStart!,
      periodEnd: periodEnd!,
      status: status! as AIHealthStatus,
      summary: summary!,
      strategyFindings: strategyFindings!,
      executionFindings: executionFindings!,
      riskFindings: riskFindings!,
      apiFindings: apiFindings!,
      dataQualityFindings: dataQualityFindings!,
      costFindings: costFindings!,
      recommendedActions: recommendedActions!,
      requiresTradingPause: requiresTradingPause!,
      requiresHumanReview: requiresHumanReview!
    },
    errors: []
  };
}

export const defaultAIHealthPolicy: AIHealthPolicy = {
  yellowApiErrorRate: 0.02,
  redApiErrorRate: 0.08,
  yellowOrderFailureRate: 0.01,
  redOrderFailureRate: 0.05,
  redDrawdownRatio: 0.15,
  yellowClaudeSchemaFailureRate: 0.02,
  redClaudeSchemaFailureRate: 0.1,
  yellowCostBudgetUsedRatio: 0.8,
  redCostBudgetUsedRatio: 1
};

function fallbackStatus(metrics: AIHealthMetricsInput, policy: AIHealthPolicy): AIHealthStatus {
  if ((metrics.unresolvedBrokerStateCount ?? 0) > 0 || (metrics.reconciliationMismatchCount ?? 0) > 0) {
    return "BLOCKED";
  }

  if (
    (metrics.apiErrorRate ?? 0) >= policy.redApiErrorRate ||
    (metrics.orderFailureRate ?? 0) >= policy.redOrderFailureRate ||
    (metrics.strategyMaxDrawdownRatio ?? 0) >= policy.redDrawdownRatio ||
    (metrics.claudeSchemaFailureRate ?? 0) >= policy.redClaudeSchemaFailureRate ||
    (metrics.aiCostBudgetUsedRatio ?? 0) >= policy.redCostBudgetUsedRatio
  ) {
    return "RED";
  }

  if (
    (metrics.apiErrorRate ?? 0) >= policy.yellowApiErrorRate ||
    (metrics.orderFailureRate ?? 0) >= policy.yellowOrderFailureRate ||
    (metrics.staleDataCount ?? 0) > 0 ||
    (metrics.claudeSchemaFailureRate ?? 0) >= policy.yellowClaudeSchemaFailureRate ||
    (metrics.aiCostBudgetUsedRatio ?? 0) >= policy.yellowCostBudgetUsedRatio ||
    (metrics.strategyWinRateDelta ?? 0) < -0.1
  ) {
    return "YELLOW";
  }

  return "GREEN";
}

function fallbackFindings(metrics: AIHealthMetricsInput, policy: AIHealthPolicy): string[] {
  const findings: string[] = [];
  if ((metrics.unresolvedBrokerStateCount ?? 0) > 0) findings.push("unresolved_broker_state_detected");
  if ((metrics.reconciliationMismatchCount ?? 0) > 0) findings.push("reconciliation_mismatch_detected");
  if ((metrics.apiErrorRate ?? 0) >= policy.yellowApiErrorRate) findings.push("api_error_rate_elevated");
  if ((metrics.orderFailureRate ?? 0) >= policy.yellowOrderFailureRate) findings.push("order_failure_rate_elevated");
  if ((metrics.staleDataCount ?? 0) > 0) findings.push("stale_data_detected");
  if ((metrics.claudeSchemaFailureRate ?? 0) >= policy.yellowClaudeSchemaFailureRate) {
    findings.push("claude_schema_failure_rate_elevated");
  }
  if ((metrics.aiCostBudgetUsedRatio ?? 0) >= policy.yellowCostBudgetUsedRatio) findings.push("ai_cost_budget_usage_elevated");
  if ((metrics.strategyMaxDrawdownRatio ?? 0) >= policy.redDrawdownRatio) findings.push("strategy_drawdown_red_threshold");
  if ((metrics.strategyWinRateDelta ?? 0) < -0.1) findings.push("strategy_win_rate_declining");
  return findings;
}

function worseStatus(first: AIHealthStatus, second: AIHealthStatus): AIHealthStatus {
  const rank: Record<AIHealthStatus, number> = {
    GREEN: 0,
    YELLOW: 1,
    RED: 2,
    BLOCKED: 3
  };

  return rank[first] >= rank[second] ? first : second;
}

function findingsFrom(output: ClaudeHealthCheckOutput): string[] {
  return [
    ...output.strategyFindings,
    ...output.executionFindings,
    ...output.riskFindings,
    ...output.apiFindings,
    ...output.dataQualityFindings,
    ...output.costFindings
  ];
}

function summaryFor(status: AIHealthStatus): string {
  if (status === "GREEN") return "Deterministic health metrics are normal.";
  if (status === "YELLOW") return "Deterministic health metrics require attention.";
  if (status === "RED") return "Deterministic health metrics indicate elevated risk.";
  return "Deterministic health metrics indicate blocked or uncertain operating state.";
}

function requireString(value: unknown, field: string, errors: string[]): string | undefined {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${field}_must_be_non_empty_string`);
    return undefined;
  }
  return value;
}

function requireEnum(value: unknown, allowed: Set<string>, field: string, errors: string[]): string | undefined {
  if (typeof value !== "string" || !allowed.has(value)) {
    errors.push(`${field}_has_unsupported_value`);
    return undefined;
  }
  return value;
}

function requireStringArray(value: unknown, field: string, errors: string[]): string[] | undefined {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    errors.push(`${field}_must_be_string_array`);
    return undefined;
  }
  return value;
}

function requireBoolean(value: unknown, field: string, errors: string[]): boolean | undefined {
  if (typeof value !== "boolean") {
    errors.push(`${field}_must_be_boolean`);
    return undefined;
  }
  return value;
}
