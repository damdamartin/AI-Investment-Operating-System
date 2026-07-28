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
  | "trading.risk_rejection"
  | "trading.kill_switch_active"
  | "trading.reconciliation_block"
  | "order.simulated_submitted"
  | "order.simulated_failed"
  | "order.unknown_state"
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
  definition("trading.risk_rejection", "TRADING_SAFETY", "COUNTER", "Risk engine rejection."),
  definition("trading.kill_switch_active", "TRADING_SAFETY", "GAUGE", "Active kill switch state."),
  definition("trading.reconciliation_block", "TRADING_SAFETY", "GAUGE", "Reconciliation blocking trading."),
  definition("order.simulated_submitted", "ORDER", "COUNTER", "Simulated order submitted."),
  definition("order.simulated_failed", "ORDER", "COUNTER", "Simulated order failed."),
  definition("order.unknown_state", "ORDER", "COUNTER", "Unknown order state."),
  definition("validation.data_quality_block", "VALIDATION", "COUNTER", "Data quality blocked dependent trading."),
  definition("validation.ai_schema_failure", "VALIDATION", "COUNTER", "AI schema validation failure.")
];

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
