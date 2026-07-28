import { describe, expect, it } from "vitest";
import {
  AssetType,
  Currency,
  DataQualityMonitor,
  Market,
  MarketDataSnapshot,
  Price,
  Quantity,
  type AIAnalysisValidationFailureRecord,
  type NewsEventCandidate
} from "../../src/index.js";

describe("DataQualityMonitor", () => {
  it("marks complete fresh data as green and dashboard-ready", () => {
    const report = new DataQualityMonitor().evaluate(baseInput());

    expect(report.status).toBe("GREEN");
    expect(report.blocksTradingDependentFlows).toBe(false);
    expect(report.dashboardSummary).toEqual({
      marketData: "GREEN",
      newsData: "GREEN",
      aiValidation: "GREEN"
    });
    expect(report.safetyType).toBe("DATA_QUALITY_REPORT_ONLY");
  });

  it("flags stale market data and blocks trading-dependent flows", () => {
    const report = new DataQualityMonitor().evaluate(
      baseInput({
        marketSnapshots: [marketSnapshot({ collectedAt: new Date("2025-12-31T23:50:00Z") })]
      })
    );

    expect(report.status).toBe("BLOCKED");
    expect(report.blocksTradingDependentFlows).toBe(true);
    expect(report.findings[0]?.type).toBe("MARKET_DATA_STALE");
    expect(report.alertEvent?.category).toBe("STALE_DATA");
  });

  it("flags missing expected market data as critical", () => {
    const report = new DataQualityMonitor().evaluate(
      baseInput({
        expectedMarketAssetIds: ["asset-aapl", "asset-msft"],
        marketSnapshots: [marketSnapshot({ assetId: "asset-aapl" })]
      })
    );

    expect(report.status).toBe("BLOCKED");
    expect(report.findings.map((finding) => finding.type)).toContain("MARKET_DATA_MISSING");
  });

  it("flags stale news without blocking trading by itself", () => {
    const report = new DataQualityMonitor().evaluate(
      baseInput({
        newsEvents: [newsEvent({ stale: true, publishedAt: new Date("2025-12-31T00:00:00Z") })]
      })
    );

    expect(report.status).toBe("YELLOW");
    expect(report.blocksTradingDependentFlows).toBe(false);
    expect(report.dashboardSummary.newsData).toBe("YELLOW");
  });

  it("flags high AI validation failure rate", () => {
    const report = new DataQualityMonitor().evaluate(
      baseInput({
        aiValidationFailures: [aiFailure("failure-1"), aiFailure("failure-2")],
        aiValidationTotalCount: 4
      })
    );

    expect(report.status).toBe("RED");
    expect(report.blocksTradingDependentFlows).toBe(false);
    expect(report.findings[0]?.type).toBe("AI_VALIDATION_FAILURE_RATE");
    expect(report.alertEvent?.category).toBe("CLAUDE_SCHEMA_FAILURE");
  });
});

function baseInput(overrides: Partial<Parameters<DataQualityMonitor["evaluate"]>[0]> = {}) {
  return {
    id: "quality-report-1",
    now: now(),
    expectedMarketAssetIds: ["asset-aapl"],
    marketSnapshots: [marketSnapshot()],
    newsEvents: [newsEvent()],
    aiValidationFailures: [],
    aiValidationTotalCount: 10,
    policy: {
      marketFreshnessPolicy: {
        maxCollectedAgeMs: 60 * 1000,
        maxLastTradeAgeMs: 60 * 1000
      },
      newsStaleAfterMs: 60 * 60 * 1000,
      maxAIValidationFailureRate: 0.2,
      minNewsEventCount: 1
    },
    ...overrides
  };
}

function marketSnapshot(overrides: Partial<ConstructorParameters<typeof MarketDataSnapshot>[0]> = {}) {
  return new MarketDataSnapshot({
    assetId: "asset-aapl",
    symbol: "AAPL",
    market: Market.from("US"),
    assetType: AssetType.from("STOCK"),
    price: Price.from("100.00", Currency.from("USD")),
    volume: Quantity.from("1000"),
    lastTradeAt: now(),
    collectedAt: now(),
    source: "TOSS_SECURITIES",
    ...overrides
  });
}

function newsEvent(overrides: Partial<NewsEventCandidate> = {}): NewsEventCandidate {
  return {
    eventId: "news-event-1",
    duplicateKey: "news-1",
    articles: [],
    title: "Apple earnings",
    publishedAt: now(),
    collectedAt: now(),
    companyReferences: [{ alias: "apple", resolution: "RESOLVED", symbols: ["AAPL"] }],
    keywordReferences: ["earnings"],
    stale: false,
    validTimestamps: true,
    safetyType: "NEWS_EVENT_CANDIDATE_ONLY",
    ...overrides
  };
}

function aiFailure(id: string): AIAnalysisValidationFailureRecord {
  return {
    id,
    provider: "CLAUDE",
    promptTemplateId: "template-1",
    promptTemplateVersion: "1.0.0",
    schemaValid: false,
    inputReferences: ["news-event-1"],
    validationErrors: ["missing_field"],
    createdAt: now(),
    safetyType: "AI_ANALYSIS_VALIDATION_FAILURE_ONLY"
  };
}

function now(): Date {
  return new Date("2026-01-01T00:00:00Z");
}
