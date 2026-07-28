import { redactObject } from "../../config/index.js";

export type ExternalApiProvider = "TOSS_SECURITIES" | "NAVER_NEWS" | "CLAUDE";
export type ApiCallOutcome = "SUCCESS" | "FAILURE" | "RATE_LIMITED";

export interface ApiUsageRecord {
  id: string;
  provider: ExternalApiProvider;
  operation: string;
  outcome: ApiCallOutcome;
  latencyMs: number;
  occurredAt: Date;
  retryCount: number;
  rateLimited: boolean;
  statusCode?: number | undefined;
  safeMetadata: Record<string, unknown>;
  claudeUsage?: {
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
  } | undefined;
  safetyType: "API_USAGE_RECORD_SAFE_LOG_ONLY";
}

export interface ApiUsageLogInput {
  id: string;
  provider: ExternalApiProvider;
  operation: string;
  outcome: ApiCallOutcome;
  latencyMs: number;
  occurredAt: Date;
  retryCount?: number | undefined;
  rateLimited?: boolean | undefined;
  statusCode?: number | undefined;
  metadata?: Record<string, unknown> | undefined;
  claudeUsage?: {
    inputTokens?: number | undefined;
    outputTokens?: number | undefined;
    estimatedCostUsd?: number | undefined;
  } | undefined;
}

export interface ApiUsagePeriod {
  startedAt: Date;
  endedAt: Date;
}

export interface ProviderUsageSummary {
  provider: ExternalApiProvider;
  totalCalls: number;
  successCount: number;
  failureCount: number;
  rateLimitedCount: number;
  averageLatencyMs: number;
  retryCount: number;
  claudeInputTokens: number;
  claudeOutputTokens: number;
  estimatedCostUsd: number;
}

export interface ApiUsageSummary {
  period: ApiUsagePeriod;
  providerSummaries: ProviderUsageSummary[];
  totalCalls: number;
  totalFailures: number;
  totalRateLimited: number;
  totalEstimatedCostUsd: number;
  rateLimitEvents: ApiUsageRecord[];
  safetyType: "API_USAGE_SUMMARY_ONLY";
}

export class ApiUsageMonitor {
  log(input: ApiUsageLogInput): ApiUsageRecord {
    return {
      id: input.id,
      provider: input.provider,
      operation: input.operation,
      outcome: input.outcome,
      latencyMs: Math.max(0, Math.round(input.latencyMs)),
      occurredAt: input.occurredAt,
      retryCount: input.retryCount ?? 0,
      rateLimited: input.rateLimited ?? input.outcome === "RATE_LIMITED",
      statusCode: input.statusCode,
      safeMetadata: redactObject(input.metadata ?? {}),
      claudeUsage: input.claudeUsage
        ? {
            inputTokens: input.claudeUsage.inputTokens ?? 0,
            outputTokens: input.claudeUsage.outputTokens ?? 0,
            estimatedCostUsd: roundCost(input.claudeUsage.estimatedCostUsd ?? 0)
          }
        : undefined,
      safetyType: "API_USAGE_RECORD_SAFE_LOG_ONLY"
    };
  }

  summarize(records: ApiUsageRecord[], period: ApiUsagePeriod): ApiUsageSummary {
    const inPeriod = records.filter(
      (record) => record.occurredAt.getTime() >= period.startedAt.getTime() &&
        record.occurredAt.getTime() <= period.endedAt.getTime()
    );
    const providerSummaries = [...new Set(inPeriod.map((record) => record.provider))]
      .sort()
      .map((provider) => providerSummary(provider, inPeriod.filter((record) => record.provider === provider)));

    return {
      period,
      providerSummaries,
      totalCalls: inPeriod.length,
      totalFailures: inPeriod.filter((record) => record.outcome === "FAILURE").length,
      totalRateLimited: inPeriod.filter((record) => record.rateLimited).length,
      totalEstimatedCostUsd: roundCost(providerSummaries.reduce((sum, item) => sum + item.estimatedCostUsd, 0)),
      rateLimitEvents: inPeriod.filter((record) => record.rateLimited),
      safetyType: "API_USAGE_SUMMARY_ONLY"
    };
  }
}

function providerSummary(provider: ExternalApiProvider, records: ApiUsageRecord[]): ProviderUsageSummary {
  const latencySum = records.reduce((sum, record) => sum + record.latencyMs, 0);

  return {
    provider,
    totalCalls: records.length,
    successCount: records.filter((record) => record.outcome === "SUCCESS").length,
    failureCount: records.filter((record) => record.outcome === "FAILURE").length,
    rateLimitedCount: records.filter((record) => record.rateLimited).length,
    averageLatencyMs: records.length === 0 ? 0 : Math.round(latencySum / records.length),
    retryCount: records.reduce((sum, record) => sum + record.retryCount, 0),
    claudeInputTokens: records.reduce((sum, record) => sum + (record.claudeUsage?.inputTokens ?? 0), 0),
    claudeOutputTokens: records.reduce((sum, record) => sum + (record.claudeUsage?.outputTokens ?? 0), 0),
    estimatedCostUsd: roundCost(records.reduce((sum, record) => sum + (record.claudeUsage?.estimatedCostUsd ?? 0), 0))
  };
}

function roundCost(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}
