import type { AIHealthCheckRecord } from "../ai-health-check/index.js";
import { redactObject } from "../../config/index.js";

export type AlertSeverity = "INFO" | "WARNING" | "ERROR" | "CRITICAL";
export type AlertCategory =
  | "NORMAL_TRADING"
  | "API_FAILURE"
  | "API_USAGE_WARNING"
  | "BROKER_UNAVAILABLE"
  | "ORDER_FAILURE"
  | "UNKNOWN_BROKER_STATE"
  | "RECONCILIATION_MISMATCH"
  | "DUPLICATE_ORDER_RISK"
  | "KILL_SWITCH"
  | "RISK_LIMIT"
  | "RISK_VETO"
  | "STALE_APPROVAL"
  | "BROKER_WRITE_GUARD_BLOCKED"
  | "PAPER_INTENT_BLOCKED"
  | "STALE_DATA"
  | "AI_HEALTH"
  | "CLAUDE_SCHEMA_FAILURE"
  | "DATABASE_BACKUP_FAILURE"
  | "WORKER_DOWN";

export type OperationalEventType =
  | "NORMAL_BUY"
  | "NORMAL_SELL"
  | "NORMAL_FILL"
  | "DAILY_PROFIT"
  | "DAILY_LOSS_WITHIN_LIMIT"
  | "ROUTINE_HEALTH_GREEN"
  | "API_AUTH_FAILURE"
  | "BROKER_UNAVAILABLE"
  | "ORDER_SUBMISSION_FAILURE"
  | "UNKNOWN_BROKER_ORDER_STATE"
  | "RECONCILIATION_MISMATCH"
  | "DUPLICATE_ORDER_RISK"
  | "KILL_SWITCH_ACTIVATED"
  | "KILL_SWITCH_STATE_UNKNOWN"
  | "DAILY_LOSS_LIMIT_BREACH"
  | "MONTHLY_LOSS_LIMIT_BREACH"
  | "MAX_DRAWDOWN_BREACH"
  | "STALE_MARKET_DATA"
  | "AI_HEALTH_RED"
  | "AI_HEALTH_BLOCKED"
  | "REPEATED_CLAUDE_SCHEMA_FAILURE"
  | "DATABASE_BACKUP_FAILURE"
  | "PRODUCTION_WORKER_DOWN";

export interface OperationalEvent {
  id: string;
  type: OperationalEventType;
  occurredAt: Date;
  source: string;
  payload?: Record<string, unknown> | undefined;
}

export interface AlertEvent {
  id: string;
  sourceEventId: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  message: string;
  immediateNotification: boolean;
  payload: Record<string, unknown>;
  createdAt: Date;
  /**
   * Always `false`. An alert is an observation, never an authorization. No
   * builder method on this service can set this to anything else — it is a
   * literal, not a computed value — so an alert can never be mistaken for a
   * broker-write approval regardless of category or severity.
   */
  liveBrokerWriteAllowed: false;
  /**
   * Always `false`. Alerts describe operational and safety state; they
   * never grant, imply, or resume live trading authorization. Clearing an
   * alert condition (for example, an operator resolving a reconciliation
   * mismatch) still requires the normal risk / money / approval / kill
   * switch chain before any order can be approved.
   */
  impliesLiveTradingAuthorization: false;
  safetyType: "OPERATIONAL_ALERT_EVENT_ONLY";
}

/**
 * Deterministic risk-level-like severity used to classify a candidate
 * trade's risk outcome. Matches `RiskCheckResult` from
 * `src/domain/risk/risk.ts`, duck-typed locally so this module never needs
 * to import the round-1 risk-engine module.
 */
export type RiskCheckResultLike = "PASS" | "PASS_WITH_WARNING" | "FAIL" | "BLOCKED";

/** Matches `ReconciliationSeverity` from the round-1 reconciliation workflow, duck-typed locally. */
export type ReconciliationSeverityLike = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "UNKNOWN";

export type PaperOrderIntentDecisionLike = "ACCEPTED" | "REJECTED" | "DEFERRED";

export interface KillSwitchGateAlertInput {
  /** Identifier for the evaluated kill-switch gate (e.g. a kill-switch state id or workflow id). */
  id: string;
  occurredAt: Date;
  /** Kill-switch scope, e.g. GLOBAL, MARKET, PORTFOLIO, STRATEGY, ASSET. */
  scope: string;
  allowed: boolean;
  reasonCodes: string[];
}

export interface RiskCheckAlertInput {
  id: string;
  occurredAt: Date;
  subjectId: string;
  result: RiskCheckResultLike;
  reasonCodes: string[];
}

export interface OrderApprovalAlertInput {
  id: string;
  occurredAt: Date;
  approvalId: string;
  approved: boolean;
  reasonCodes: string[];
}

export interface BrokerWriteGuardAlertInput {
  id: string;
  occurredAt: Date;
  commandType: string;
  allowed: boolean;
  reasonCodes: string[];
}

export interface PaperOrderIntentAlertInput {
  id: string;
  occurredAt: Date;
  candidateId: string;
  decision: PaperOrderIntentDecisionLike;
  reasonCodes: string[];
}

export interface ReconciliationWorkflowAlertInput {
  workflowId: string;
  reportId: string;
  occurredAt: Date;
  severity: ReconciliationSeverityLike;
  stale: boolean;
  reasonCodes: string[];
}

export interface ApiUsageAlertThresholds {
  costWarningUsd: number;
  costCriticalUsd: number;
  /** Fraction (0..1) of calls in the period that must fail to trigger a failure-rate warning. */
  failureRateWarning: number;
}

export const defaultApiUsageAlertThresholds: ApiUsageAlertThresholds = {
  costWarningUsd: 5,
  costCriticalUsd: 25,
  failureRateWarning: 0.2
};

export interface ApiUsageSummaryAlertInput {
  id: string;
  occurredAt: Date;
  totalCalls: number;
  totalFailures: number;
  totalRateLimited: number;
  totalEstimatedCostUsd: number;
  thresholds?: Partial<ApiUsageAlertThresholds> | undefined;
}

export class OperationalAlertingService {
  classify(event: OperationalEvent): AlertEvent | undefined {
    const classification = classificationFor(event.type);
    if (!classification) return undefined;

    return buildAlert({
      id: `alert-${event.id}`,
      sourceEventId: event.id,
      category: classification.category,
      severity: classification.severity,
      title: classification.title,
      message: classification.message,
      payload: event.payload ?? {},
      createdAt: event.occurredAt
    });
  }

  fromAIHealthCheck(record: AIHealthCheckRecord): AlertEvent | undefined {
    if (record.status !== "RED" && record.status !== "BLOCKED") return undefined;

    return this.classify({
      id: record.id,
      type: record.status === "BLOCKED" ? "AI_HEALTH_BLOCKED" : "AI_HEALTH_RED",
      occurredAt: record.createdAt,
      source: "AI_HEALTH_CHECK",
      payload: {
        healthCheckId: record.id,
        status: record.status,
        summary: record.summary,
        findings: record.findings,
        requiresTradingPause: record.requiresTradingPause,
        requiresHumanReview: record.requiresHumanReview
      }
    });
  }

  /**
   * Kill switch active or unknown state. Both are treated as high severity:
   * an unknown state is not the same as "no kill switch" (per
   * docs/07_Trading_System.md Rule 16 equivalent, section 22) and must pause
   * dependent trading exactly like an active switch.
   */
  fromKillSwitchGate(input: KillSwitchGateAlertInput): AlertEvent | undefined {
    if (input.allowed) return undefined;

    const unknown = input.reasonCodes.some((code) => code.includes("unknown") || code.includes("missing"));

    return buildAlert({
      id: `alert-kill-switch-gate-${input.id}`,
      sourceEventId: input.id,
      category: "KILL_SWITCH",
      severity: "CRITICAL",
      title: unknown ? "Kill switch state unknown" : "Kill switch active",
      message: unknown
        ? "Kill switch state could not be determined; dependent trading is paused pending reconciliation. This alert does not authorize any order."
        : "An active kill switch is blocking new trading in its scope. This alert does not authorize any order.",
      payload: { scope: input.scope, reasonCodes: input.reasonCodes },
      createdAt: input.occurredAt
    });
  }

  /** Risk Engine veto (FAIL or BLOCKED). Quiet for PASS / PASS_WITH_WARNING, per "normal operation should be quiet". */
  fromRiskCheck(input: RiskCheckAlertInput): AlertEvent | undefined {
    if (input.result === "PASS" || input.result === "PASS_WITH_WARNING") return undefined;

    const classification = classifyReasonCodes(input.reasonCodes);
    const severity: AlertSeverity = input.result === "BLOCKED" || classification.severity === "CRITICAL" ? "CRITICAL" : "ERROR";

    return buildAlert({
      id: `alert-risk-veto-${input.id}`,
      sourceEventId: input.id,
      category: "RISK_VETO",
      severity,
      title: input.result === "BLOCKED" ? "Risk engine blocked candidate trade" : "Risk engine rejected candidate trade",
      message: "Risk Engine vetoed a candidate trade before any order was submitted. No order was placed or authorized.",
      payload: { subjectId: input.subjectId, result: input.result, reasonCodes: input.reasonCodes },
      createdAt: input.occurredAt
    });
  }

  /**
   * Order approval rejection, including stale/clock-skewed risk or money
   * checks. Staleness rejections are actionable (re-run the check) but
   * never executing: they still keep the order unapproved.
   */
  fromOrderApprovalRejection(input: OrderApprovalAlertInput): AlertEvent | undefined {
    if (input.approved || input.reasonCodes.length === 0) return undefined;

    const classification = classifyReasonCodes(input.reasonCodes);
    const category: AlertCategory = classification.rule === "staleness"
      ? "STALE_APPROVAL"
      : classification.rule === "kill_switch"
        ? "KILL_SWITCH"
        : classification.rule === "reconciliation"
          ? "RECONCILIATION_MISMATCH"
          : "ORDER_FAILURE";

    return buildAlert({
      id: `alert-order-approval-${input.id}`,
      sourceEventId: input.id,
      category,
      severity: classification.severity,
      title: classification.rule === "staleness" ? "Order approval blocked by stale checks" : "Order approval rejected",
      message: classification.rule === "staleness"
        ? "The risk or money checks backing this approval are stale or clock-skewed. The approval was rejected pending a fresh check. No order was submitted."
        : "Order approval was rejected before any broker submission was attempted. No order was submitted.",
      payload: { approvalId: input.approvalId, reasonCodes: input.reasonCodes },
      createdAt: input.occurredAt
    });
  }

  /** BrokerWriteCommandGuard rejection. The guard blocked before any network call was attempted. */
  fromBrokerWriteGuardResult(input: BrokerWriteGuardAlertInput): AlertEvent | undefined {
    if (input.allowed) return undefined;

    const classification = classifyReasonCodes(input.reasonCodes);

    return buildAlert({
      id: `alert-broker-write-guard-${input.id}`,
      sourceEventId: input.id,
      category: "BROKER_WRITE_GUARD_BLOCKED",
      severity: classification.severity,
      title: "Broker write command blocked",
      message: "BrokerWriteCommandGuard rejected a broker write command; no network call was attempted and no order was submitted.",
      payload: { commandType: input.commandType, reasonCodes: input.reasonCodes },
      createdAt: input.occurredAt
    });
  }

  /** Paper order intent rejection or deferment. Both are non-executing: no paper or live order is submitted. */
  fromPaperOrderIntentDecision(input: PaperOrderIntentAlertInput): AlertEvent | undefined {
    if (input.decision === "ACCEPTED") return undefined;

    const classification = classifyReasonCodes(input.reasonCodes);
    const severity: AlertSeverity = input.decision === "DEFERRED"
      ? (classification.severity === "CRITICAL" ? "CRITICAL" : "WARNING")
      : classification.severity;

    return buildAlert({
      id: `alert-paper-intent-${input.id}`,
      sourceEventId: input.id,
      category: "PAPER_INTENT_BLOCKED",
      severity,
      title: input.decision === "DEFERRED" ? "Paper order intent deferred" : "Paper order intent rejected",
      message: input.decision === "DEFERRED"
        ? "A candidate paper order intent is deferred pending a missing risk or money check. No paper or live order was submitted."
        : "A candidate paper order intent was rejected. No paper or live order was submitted.",
      payload: { candidateId: input.candidateId, decision: input.decision, reasonCodes: input.reasonCodes },
      createdAt: input.occurredAt
    });
  }

  /**
   * Reconciliation workflow severity-aware alert. Any severity above `NONE`
   * produces an alert; `HIGH`, `CRITICAL`, and `UNKNOWN` always map to
   * `CRITICAL` (high-severity operator alert), matching
   * `ReconciliationWorkflowResult.blocksDependentTrading`.
   */
  fromReconciliationWorkflow(input: ReconciliationWorkflowAlertInput): AlertEvent | undefined {
    if (input.severity === "NONE") return undefined;

    return buildAlert({
      id: `alert-reconciliation-workflow-${input.workflowId}`,
      sourceEventId: input.workflowId,
      category: "RECONCILIATION_MISMATCH",
      severity: reconciliationAlertSeverity(input.severity),
      title: input.stale ? "Reconciliation report is stale" : "Reconciliation discrepancy detected",
      message: "Internal and broker state do not fully agree. Dependent trading may be paused until this is resolved. This alert does not authorize any corrective order.",
      payload: { reportId: input.reportId, severity: input.severity, stale: input.stale, reasonCodes: input.reasonCodes },
      createdAt: input.occurredAt
    });
  }

  /**
   * API usage and cost warnings, derived only from already-sanitized
   * aggregate numbers (call counts, failure counts, estimated cost). Never
   * accepts or echoes raw tokens, keys, or headers.
   */
  fromApiUsageSummary(input: ApiUsageSummaryAlertInput): AlertEvent[] {
    const thresholds = { ...defaultApiUsageAlertThresholds, ...input.thresholds };
    const alerts: AlertEvent[] = [];

    if (input.totalEstimatedCostUsd >= thresholds.costCriticalUsd) {
      alerts.push(buildAlert({
        id: `alert-api-usage-cost-${input.id}`,
        sourceEventId: input.id,
        category: "API_USAGE_WARNING",
        severity: "CRITICAL",
        title: "API usage cost critical",
        message: "Estimated external API cost for the period has crossed the critical threshold.",
        payload: { totalEstimatedCostUsd: roundForAlert(input.totalEstimatedCostUsd), thresholdUsd: thresholds.costCriticalUsd },
        createdAt: input.occurredAt
      }));
    } else if (input.totalEstimatedCostUsd >= thresholds.costWarningUsd) {
      alerts.push(buildAlert({
        id: `alert-api-usage-cost-${input.id}`,
        sourceEventId: input.id,
        category: "API_USAGE_WARNING",
        severity: "WARNING",
        title: "API usage cost warning",
        message: "Estimated external API cost for the period has crossed the warning threshold.",
        payload: { totalEstimatedCostUsd: roundForAlert(input.totalEstimatedCostUsd), thresholdUsd: thresholds.costWarningUsd },
        createdAt: input.occurredAt
      }));
    }

    const failureRate = input.totalCalls === 0 ? 0 : input.totalFailures / input.totalCalls;
    if (input.totalCalls > 0 && failureRate >= thresholds.failureRateWarning) {
      alerts.push(buildAlert({
        id: `alert-api-usage-failure-rate-${input.id}`,
        sourceEventId: input.id,
        category: "API_USAGE_WARNING",
        severity: "ERROR",
        title: "API failure rate warning",
        message: "External API failure rate for the period has crossed the warning threshold.",
        payload: {
          totalCalls: input.totalCalls,
          totalFailures: input.totalFailures,
          failureRate: roundForAlert(failureRate)
        },
        createdAt: input.occurredAt
      }));
    }

    if (input.totalRateLimited > 0) {
      alerts.push(buildAlert({
        id: `alert-api-usage-rate-limited-${input.id}`,
        sourceEventId: input.id,
        category: "API_USAGE_WARNING",
        severity: "WARNING",
        title: "API rate limiting observed",
        message: "One or more external API calls were rate limited during the period.",
        payload: { totalRateLimited: input.totalRateLimited },
        createdAt: input.occurredAt
      }));
    }

    return alerts;
  }
}

function buildAlert(input: {
  id: string;
  sourceEventId: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  message: string;
  payload: Record<string, unknown>;
  createdAt: Date;
}): AlertEvent {
  return {
    id: input.id,
    sourceEventId: input.sourceEventId,
    category: input.category,
    severity: input.severity,
    title: input.title,
    message: input.message,
    immediateNotification: input.severity === "ERROR" || input.severity === "CRITICAL",
    payload: redactObject(input.payload),
    createdAt: input.createdAt,
    liveBrokerWriteAllowed: false,
    impliesLiveTradingAuthorization: false,
    safetyType: "OPERATIONAL_ALERT_EVENT_ONLY"
  };
}

/**
 * Deterministic, order-independent severity classification driven purely by
 * the fixed reason-code vocabulary produced by the round-1 risk / kill
 * switch / approval / broker-write-guard / paper-trading modules. The same
 * reason code set always yields the same severity and rule, regardless of
 * array order, satisfying the "alert severity is deterministic" test
 * requirement. Rule precedence (checked in order):
 *
 * 1. `kill_switch` — any kill-switch related reason code -> CRITICAL.
 * 2. `reconciliation` — any reconciliation-blocking reason code -> CRITICAL.
 * 3. `live_account_in_paper_flow` — a live-write-capable broker account was
 *    attached to a paper-only candidate; this is an active safety
 *    violation, not a missing input -> CRITICAL.
 * 4. `staleness` — a stale or clock-skewed check/approval, or a missing
 *    evaluation time -> WARNING (actionable, not an active veto).
 * 5. `missing_input` — a required gate was never supplied -> ERROR.
 * 6. `active_veto` — any other active rejection reason -> ERROR.
 */
function classifyReasonCodes(reasonCodes: string[]): { severity: AlertSeverity; rule: string } {
  if (reasonCodes.length === 0) return { severity: "INFO", rule: "none" };
  if (reasonCodes.some((code) => code.includes("kill_switch"))) return { severity: "CRITICAL", rule: "kill_switch" };
  if (reasonCodes.some((code) => code.includes("reconciliation"))) return { severity: "CRITICAL", rule: "reconciliation" };
  if (reasonCodes.some((code) => code === "live_broker_account_not_allowed_for_paper_trading")) {
    return { severity: "CRITICAL", rule: "live_account_in_paper_flow" };
  }
  if (reasonCodes.some((code) => code.includes("stale") || code.includes("timestamp_in_future") || code === "missing_evaluation_time")) {
    return { severity: "WARNING", rule: "staleness" };
  }
  if (reasonCodes.some((code) => code.startsWith("missing_"))) return { severity: "ERROR", rule: "missing_input" };
  return { severity: "ERROR", rule: "active_veto" };
}

function reconciliationAlertSeverity(severity: ReconciliationSeverityLike): AlertSeverity {
  switch (severity) {
    case "CRITICAL":
    case "UNKNOWN":
    case "HIGH":
      return "CRITICAL";
    case "MEDIUM":
      return "ERROR";
    case "LOW":
      return "WARNING";
    case "NONE":
      return "INFO";
  }
}

function roundForAlert(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

function classificationFor(type: OperationalEventType): {
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  message: string;
} | undefined {
  switch (type) {
    case "NORMAL_BUY":
    case "NORMAL_SELL":
    case "NORMAL_FILL":
    case "DAILY_PROFIT":
    case "DAILY_LOSS_WITHIN_LIMIT":
    case "ROUTINE_HEALTH_GREEN":
      return undefined;
    case "API_AUTH_FAILURE":
      return alert("API_FAILURE", "CRITICAL", "API authentication failure", "An API authentication failure requires attention.");
    case "BROKER_UNAVAILABLE":
      return alert("BROKER_UNAVAILABLE", "CRITICAL", "Broker unavailable", "Broker access is unavailable.");
    case "ORDER_SUBMISSION_FAILURE":
      return alert("ORDER_FAILURE", "ERROR", "Order submission failure", "A simulated or live order submission path failed.");
    case "UNKNOWN_BROKER_ORDER_STATE":
      return alert("UNKNOWN_BROKER_STATE", "CRITICAL", "Unknown broker order state", "Broker order state is uncertain and needs reconciliation.");
    case "RECONCILIATION_MISMATCH":
      return alert("RECONCILIATION_MISMATCH", "ERROR", "Reconciliation mismatch", "Internal and broker state do not match.");
    case "DUPLICATE_ORDER_RISK":
      return alert("DUPLICATE_ORDER_RISK", "CRITICAL", "Duplicate order risk", "Duplicate order risk was detected.");
    case "KILL_SWITCH_ACTIVATED":
      return alert("KILL_SWITCH", "CRITICAL", "Kill switch activated", "A kill switch has been activated.");
    case "KILL_SWITCH_STATE_UNKNOWN":
      return alert("KILL_SWITCH", "CRITICAL", "Kill switch state unknown", "Kill switch state could not be determined; dependent trading is paused pending reconciliation.");
    case "DAILY_LOSS_LIMIT_BREACH":
    case "MONTHLY_LOSS_LIMIT_BREACH":
    case "MAX_DRAWDOWN_BREACH":
      return alert("RISK_LIMIT", "CRITICAL", "Risk limit breached", "A configured loss or drawdown limit was breached.");
    case "STALE_MARKET_DATA":
      return alert("STALE_DATA", "ERROR", "Stale market data", "Stale market data is affecting trading decisions.");
    case "AI_HEALTH_RED":
      return alert("AI_HEALTH", "ERROR", "AI Health Check red", "AI Health Check reported red status.");
    case "AI_HEALTH_BLOCKED":
      return alert("AI_HEALTH", "CRITICAL", "AI Health Check blocked", "AI Health Check reported blocked status.");
    case "REPEATED_CLAUDE_SCHEMA_FAILURE":
      return alert("CLAUDE_SCHEMA_FAILURE", "ERROR", "Repeated Claude schema failures", "Claude output schema validation is repeatedly failing.");
    case "DATABASE_BACKUP_FAILURE":
      return alert("DATABASE_BACKUP_FAILURE", "ERROR", "Database backup failure", "Database backup verification failed.");
    case "PRODUCTION_WORKER_DOWN":
      return alert("WORKER_DOWN", "CRITICAL", "Production worker down", "A production worker is down.");
  }
}

function alert(category: AlertCategory, severity: AlertSeverity, title: string, message: string) {
  return {
    category,
    severity,
    title,
    message
  };
}
