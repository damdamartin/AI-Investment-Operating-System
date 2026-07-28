import type { AlertEvent, OperationalEvent } from "../alerting/index.js";
import { OperationalAlertingService } from "../alerting/index.js";
import type { NewsEventCandidate } from "../news/index.js";
import type { AIAnalysisValidationFailureRecord } from "../ai/index.js";
import type { MarketDataFreshnessPolicy, MarketDataSnapshot } from "../../domain/market-data/index.js";

export type DataQualityStatus = "GREEN" | "YELLOW" | "RED" | "BLOCKED";
export type DataQualityFindingSeverity = "INFO" | "WARNING" | "ERROR" | "CRITICAL";
export type DataQualityFindingType =
  | "MARKET_DATA_MISSING"
  | "MARKET_DATA_STALE"
  | "MARKET_DATA_SUSPECT"
  | "NEWS_DATA_MISSING"
  | "NEWS_DATA_STALE"
  | "AI_VALIDATION_FAILURE_RATE";

export interface DataQualityPolicy {
  marketFreshnessPolicy: MarketDataFreshnessPolicy;
  newsStaleAfterMs: number;
  maxAIValidationFailureRate: number;
  minNewsEventCount: number;
}

export interface DataQualityMonitorInput {
  id: string;
  now: Date;
  expectedMarketAssetIds: string[];
  marketSnapshots: MarketDataSnapshot[];
  newsEvents: NewsEventCandidate[];
  aiValidationFailures: AIAnalysisValidationFailureRecord[];
  aiValidationTotalCount: number;
  policy: DataQualityPolicy;
}

export interface DataQualityFinding {
  type: DataQualityFindingType;
  severity: DataQualityFindingSeverity;
  key: string;
  reason: string;
  blocksTradingDependentFlows: boolean;
}

export interface DataQualityReport {
  id: string;
  status: DataQualityStatus;
  findings: DataQualityFinding[];
  blocksTradingDependentFlows: boolean;
  dashboardSummary: {
    marketData: DataQualityStatus;
    newsData: DataQualityStatus;
    aiValidation: DataQualityStatus;
  };
  operationalEvent: OperationalEvent | undefined;
  alertEvent: AlertEvent | undefined;
  generatedAt: Date;
  safetyType: "DATA_QUALITY_REPORT_ONLY";
}

export class DataQualityMonitor {
  constructor(private readonly alerting = new OperationalAlertingService()) {}

  evaluate(input: DataQualityMonitorInput): DataQualityReport {
    const findings = [
      ...marketFindings(input),
      ...newsFindings(input),
      ...aiFindings(input)
    ];
    const status = statusFor(findings);
    const blocksTradingDependentFlows = findings.some((finding) => finding.blocksTradingDependentFlows);
    const operationalEvent = createOperationalEvent(input, status, findings, blocksTradingDependentFlows);

    return {
      id: input.id,
      status,
      findings,
      blocksTradingDependentFlows,
      dashboardSummary: {
        marketData: statusFor(findings.filter((finding) => finding.type.startsWith("MARKET_DATA"))),
        newsData: statusFor(findings.filter((finding) => finding.type.startsWith("NEWS_DATA"))),
        aiValidation: statusFor(findings.filter((finding) => finding.type.startsWith("AI_")))
      },
      operationalEvent,
      alertEvent: operationalEvent ? this.alerting.classify(operationalEvent) : undefined,
      generatedAt: input.now,
      safetyType: "DATA_QUALITY_REPORT_ONLY"
    };
  }
}

function marketFindings(input: DataQualityMonitorInput): DataQualityFinding[] {
  const findings: DataQualityFinding[] = [];
  const snapshotsByAsset = new Map(input.marketSnapshots.map((snapshot) => [snapshot.assetId, snapshot]));

  for (const assetId of input.expectedMarketAssetIds) {
    const snapshot = snapshotsByAsset.get(assetId);
    if (!snapshot) {
      findings.push(finding("MARKET_DATA_MISSING", "CRITICAL", assetId, "market_data_missing", true));
      continue;
    }

    const assessment = snapshot.assessFreshness(input.policy.marketFreshnessPolicy, input.now);
    if (assessment.status === "STALE") {
      findings.push(finding("MARKET_DATA_STALE", "ERROR", assetId, assessment.reasons.join(","), true));
    } else if (assessment.status === "MISSING" || assessment.status === "SUSPECT") {
      findings.push(finding("MARKET_DATA_SUSPECT", "CRITICAL", assetId, assessment.reasons.join(","), true));
    }
  }

  return findings;
}

function newsFindings(input: DataQualityMonitorInput): DataQualityFinding[] {
  const findings: DataQualityFinding[] = [];

  if (input.newsEvents.length < input.policy.minNewsEventCount) {
    findings.push(finding("NEWS_DATA_MISSING", "WARNING", "news-events", "news_event_count_below_minimum", false));
  }

  for (const event of input.newsEvents) {
    const ageMs = input.now.getTime() - event.publishedAt.getTime();
    if (event.stale || ageMs > input.policy.newsStaleAfterMs || !event.validTimestamps) {
      findings.push(finding("NEWS_DATA_STALE", "WARNING", event.eventId, "stale_or_invalid_news_event", false));
    }
  }

  return findings;
}

function aiFindings(input: DataQualityMonitorInput): DataQualityFinding[] {
  if (input.aiValidationTotalCount <= 0) {
    return input.aiValidationFailures.length > 0
      ? [finding("AI_VALIDATION_FAILURE_RATE", "ERROR", "claude-validation", "ai_validation_total_count_missing", false)]
      : [];
  }

  const failureRate = input.aiValidationFailures.length / input.aiValidationTotalCount;
  if (failureRate <= input.policy.maxAIValidationFailureRate) return [];

  return [
    finding(
      "AI_VALIDATION_FAILURE_RATE",
      "ERROR",
      "claude-validation",
      `ai_validation_failure_rate_${failureRate.toFixed(4)}_exceeds_policy`,
      false
    )
  ];
}

function statusFor(findings: DataQualityFinding[]): DataQualityStatus {
  if (findings.some((finding) => finding.blocksTradingDependentFlows || finding.severity === "CRITICAL")) return "BLOCKED";
  if (findings.some((finding) => finding.severity === "ERROR")) return "RED";
  if (findings.some((finding) => finding.severity === "WARNING")) return "YELLOW";
  return "GREEN";
}

function finding(
  type: DataQualityFindingType,
  severity: DataQualityFindingSeverity,
  key: string,
  reason: string,
  blocksTradingDependentFlows: boolean
): DataQualityFinding {
  return {
    type,
    severity,
    key,
    reason,
    blocksTradingDependentFlows
  };
}

function createOperationalEvent(
  input: DataQualityMonitorInput,
  status: DataQualityStatus,
  findings: DataQualityFinding[],
  blocksTradingDependentFlows: boolean
): OperationalEvent | undefined {
  if (status === "GREEN" || status === "YELLOW") return undefined;

  return {
    id: `data-quality-${input.id}`,
    type: blocksTradingDependentFlows ? "STALE_MARKET_DATA" : "REPEATED_CLAUDE_SCHEMA_FAILURE",
    occurredAt: input.now,
    source: "DATA_QUALITY_MONITOR",
    payload: {
      reportId: input.id,
      status,
      blocksTradingDependentFlows,
      findings
    }
  };
}
