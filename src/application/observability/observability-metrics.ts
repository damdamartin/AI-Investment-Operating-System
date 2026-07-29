import type { AlertCategory, AlertEvent, AlertSeverity } from "../alerting/index.js";
import { redactObject } from "../../config/index.js";

export type MetricCategory = "SYSTEM" | "SCHEDULER" | "API" | "TRADING_SAFETY" | "ORDER" | "VALIDATION";
export type MetricKind = "COUNTER" | "GAUGE" | "HISTOGRAM";

export type BaselineMetricName =
  | "system.health_state"
  | "scheduler.job_started"
  | "scheduler.job_succeeded"
  | "scheduler.job_failed"
  | "scheduler.job_skipped"
  | "api.call_latency_ms"
  | "api.call_failure"
  | "api.rate_limited"
  | "api.cost_warning"
  | "trading.risk_rejection"
  | "trading.kill_switch_active"
  | "trading.reconciliation_block"
  | "trading.stale_approval"
  | "trading.broker_write_guard_blocked"
  | "order.simulated_submitted"
  | "order.simulated_failed"
  | "order.unknown_state"
  | "order.paper_intent_rejected"
  | "order.paper_intent_deferred"
  | "validation.data_quality_block"
  | "validation.ai_schema_failure";

export interface MetricEvent {
  name: BaselineMetricName;
  category: MetricCategory;
  kind: MetricKind;
  value: number;
  labels: Record<string, string>;
  payload: Record<string, unknown>;
  emittedAt: Date;
  safetyType: "OBSERVABILITY_METRIC_EVENT_SAFE_ONLY";
}

export interface EmitMetricInput {
  name: BaselineMetricName;
  value: number;
  labels?: Record<string, string> | undefined;
  payload?: Record<string, unknown> | undefined;
  emittedAt: Date;
}

export interface MetricDefinition {
  name: BaselineMetricName;
  category: MetricCategory;
  kind: MetricKind;
  description: string;
}

export const baselineMetricDefinitions: MetricDefinition[] = [
  definition("system.health_state", "SYSTEM", "GAUGE", "Overall system health state."),
  definition("scheduler.job_started", "SCHEDULER", "COUNTER", "Scheduled job started."),
  definition("scheduler.job_succeeded", "SCHEDULER", "COUNTER", "Scheduled job succeeded."),
  definition("scheduler.job_failed", "SCHEDULER", "COUNTER", "Scheduled job failed."),
  definition("scheduler.job_skipped", "SCHEDULER", "COUNTER", "Scheduled job skipped."),
  definition("api.call_latency_ms", "API", "HISTOGRAM", "External API call latency in milliseconds."),
  definition("api.call_failure", "API", "COUNTER", "External API call failure."),
  definition("api.rate_limited", "API", "COUNTER", "External API rate limit event."),
  definition("api.cost_warning", "API", "COUNTER", "External API estimated cost crossed a warning or critical threshold."),
  definition("trading.risk_rejection", "TRADING_SAFETY", "COUNTER", "Risk engine rejection."),
  definition("trading.kill_switch_active", "TRADING_SAFETY", "GAUGE", "Active kill switch state."),
  definition("trading.reconciliation_block", "TRADING_SAFETY", "GAUGE", "Reconciliation blocking trading."),
  definition("trading.stale_approval", "TRADING_SAFETY", "COUNTER", "Order approval blocked by a stale or clock-skewed risk/money check."),
  definition("trading.broker_write_guard_blocked", "TRADING_SAFETY", "COUNTER", "BrokerWriteCommandGuard rejected a broker write command."),
  definition("order.simulated_submitted", "ORDER", "COUNTER", "Simulated order submitted."),
  definition("order.simulated_failed", "ORDER", "COUNTER", "Simulated order failed."),
  definition("order.unknown_state", "ORDER", "COUNTER", "Unknown order state."),
  definition("order.paper_intent_rejected", "ORDER", "COUNTER", "Paper order intent rejected."),
  definition("order.paper_intent_deferred", "ORDER", "COUNTER", "Paper order intent deferred pending a missing check."),
  definition("validation.data_quality_block", "VALIDATION", "COUNTER", "Data quality blocked dependent trading."),
  definition("validation.ai_schema_failure", "VALIDATION", "COUNTER", "AI schema validation failure.")
];

/**
 * Deterministic mapping from an operational alert's category to the
 * baseline metric that should be incremented when that alert fires. Not
 * every alert category has a corresponding counter/gauge (for example
 * `PAPER_INTENT_BLOCKED` covers both rejected and deferred decisions, which
 * are tracked as two separate metrics by {@link paperIntentMetricNameFor}
 * instead) — those return `undefined` and callers should not emit a metric.
 */
const alertCategoryMetricMap: Partial<Record<AlertCategory, BaselineMetricName>> = {
  API_FAILURE: "api.call_failure",
  API_USAGE_WARNING: "api.cost_warning",
  RECONCILIATION_MISMATCH: "trading.reconciliation_block",
  KILL_SWITCH: "trading.kill_switch_active",
  RISK_VETO: "trading.risk_rejection",
  STALE_APPROVAL: "trading.stale_approval",
  BROKER_WRITE_GUARD_BLOCKED: "trading.broker_write_guard_blocked",
  UNKNOWN_BROKER_STATE: "order.unknown_state",
  ORDER_FAILURE: "order.simulated_failed",
  CLAUDE_SCHEMA_FAILURE: "validation.ai_schema_failure",
  STALE_DATA: "validation.data_quality_block"
};

/** Deterministic mapping from an {@link AlertCategory} to its baseline metric name, if one exists. */
export function metricNameForAlertCategory(category: AlertCategory): BaselineMetricName | undefined {
  return alertCategoryMetricMap[category];
}

/** Deterministic mapping for the two paper-order-intent decisions that share the `PAPER_INTENT_BLOCKED` alert category. */
export function paperIntentMetricNameFor(decision: "REJECTED" | "DEFERRED"): BaselineMetricName {
  return decision === "DEFERRED" ? "order.paper_intent_deferred" : "order.paper_intent_rejected";
}

export class ObservabilityMetricsService {
  emit(input: EmitMetricInput): MetricEvent {
    const metric = baselineMetricDefinitions.find((item) => item.name === input.name);
    if (!metric) {
      throw new Error(`Unknown baseline metric: ${input.name}`);
    }

    return {
      name: input.name,
      category: metric.category,
      kind: metric.kind,
      value: normalizeValue(input.value),
      labels: redactLabels(input.labels ?? {}),
      payload: redactObject(input.payload ?? {}),
      emittedAt: input.emittedAt,
      safetyType: "OBSERVABILITY_METRIC_EVENT_SAFE_ONLY"
    };
  }

  /**
   * Emit the baseline counter/gauge associated with an operational alert's
   * category, if one exists. This never fabricates a metric: alert
   * categories without a mapped baseline metric (see
   * {@link metricNameForAlertCategory}) yield `undefined` rather than an
   * approximate or invented metric name.
   */
  emitFromAlert(alert: AlertEvent, emittedAt: Date = alert.createdAt): MetricEvent | undefined {
    const name = metricNameForAlertCategory(alert.category);
    if (!name) return undefined;

    return this.emit({
      name,
      value: 1,
      labels: { severity: alert.severity, category: alert.category },
      payload: { alertId: alert.id },
      emittedAt
    });
  }

  dashboardSnapshot(events: MetricEvent[]): Record<MetricCategory, number> {
    return events.reduce<Record<MetricCategory, number>>((snapshot, event) => {
      snapshot[event.category] = (snapshot[event.category] ?? 0) + 1;
      return snapshot;
    }, {
      SYSTEM: 0,
      SCHEDULER: 0,
      API: 0,
      TRADING_SAFETY: 0,
      ORDER: 0,
      VALIDATION: 0
    });
  }

  /** Deterministic count of alerts by severity, for dashboard/report summaries. */
  summarizeAlertSeverity(alerts: AlertEvent[]): Record<AlertSeverity, number> {
    return alerts.reduce<Record<AlertSeverity, number>>((snapshot, alertEvent) => {
      snapshot[alertEvent.severity] = (snapshot[alertEvent.severity] ?? 0) + 1;
      return snapshot;
    }, {
      INFO: 0,
      WARNING: 0,
      ERROR: 0,
      CRITICAL: 0
    });
  }
}

function definition(
  name: BaselineMetricName,
  category: MetricCategory,
  kind: MetricKind,
  description: string
): MetricDefinition {
  return { name, category, kind, description };
}

function normalizeValue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

function redactLabels(labels: Record<string, string>): Record<string, string> {
  return redactObject(labels);
}
