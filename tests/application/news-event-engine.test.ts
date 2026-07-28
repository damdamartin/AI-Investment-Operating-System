import { describe, expect, it } from "vitest";
import {
  buildAIAnalysisRecord,
  NewsEventEngine,
  type AIAnalysisRecord,
  type NewsEventCandidate,
  type NormalizedNewsArticle,
  validateClaudeAnalysis
} from "../../src/index.js";

describe("NewsEventEngine", () => {
  it("creates versioned event scores from traceable validated analysis", () => {
    const event = eventCandidate();
    const analysis = analysisRecord({ inputReferences: [event.eventId] });

    const result = new NewsEventEngine().evaluate({
      event,
      analysis,
      now: new Date("2026-01-01T00:10:00Z"),
      scoringVersion: "news-event-engine-v1",
      minConfidence: 0.6
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.output.scoreSet.scoringVersion).toBe("news-event-engine-v1");
    expect(result.ok && result.output.inputReferences).toEqual(
      expect.arrayContaining([`news-event:${event.eventId}`, "ai-analysis:analysis-1"])
    );
    expect(result.ok && result.output.automatedTradeCandidateAllowed).toBe(true);
    expect(result.ok && result.output.safetyType).toBe("NEWS_EVENT_ENGINE_ANALYSIS_ONLY");
    expect(result.ok && result.output).not.toHaveProperty("order");
  });

  it("refuses low-confidence AI analysis", () => {
    const event = eventCandidate();
    const analysis = analysisRecord({
      inputReferences: [event.eventId],
      confidence: 0.3
    });

    const result = new NewsEventEngine().evaluate({
      event,
      analysis,
      now: new Date("2026-01-01T00:10:00Z"),
      scoringVersion: "news-event-engine-v1",
      minConfidence: 0.6
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.refusal.reasons).toContain("low_ai_confidence");
  });

  it("reduces importance and blocks automated candidates when contradictions exist", () => {
    const event = eventCandidate();
    const analysis = analysisRecord({
      inputReferences: [event.eventId],
      contradictions: ["price reaction is weak", "source conflicts with filing"]
    });

    const result = new NewsEventEngine().evaluate({
      event,
      analysis,
      now: new Date("2026-01-01T00:10:00Z"),
      scoringVersion: "news-event-engine-v1",
      minConfidence: 0.6
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.output.automatedTradeCandidateAllowed).toBe(false);
    expect(result.ok && result.output.reviewRequired).toBe(true);
    expect(result.ok && result.output.scoreSet.scores).toContainEqual(
      expect.objectContaining({ engine: "NEWS_EVENT_IMPORTANCE", score: 40 })
    );
  });

  it("blocks review-required analysis from automated trade candidates", () => {
    const event = eventCandidate();
    const analysis = analysisRecord({
      inputReferences: [event.eventId],
      requiresReview: true
    });

    const result = new NewsEventEngine().evaluate({
      event,
      analysis,
      now: new Date("2026-01-01T00:10:00Z"),
      scoringVersion: "news-event-engine-v1",
      minConfidence: 0.6
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.output.reviewRequired).toBe(true);
    expect(result.ok && result.output.automatedTradeCandidateAllowed).toBe(false);
  });

  it("refuses stale events and untraceable analysis", () => {
    const staleEvent = eventCandidate({ stale: true });
    const engine = new NewsEventEngine();

    const staleResult = engine.evaluate({
      event: staleEvent,
      analysis: analysisRecord({ inputReferences: [staleEvent.eventId] }),
      now: new Date("2026-01-01T00:10:00Z"),
      scoringVersion: "news-event-engine-v1",
      minConfidence: 0.6
    });

    expect(staleResult.ok).toBe(false);
    expect(!staleResult.ok && staleResult.refusal.reasons).toContain("stale_news_event");

    const event = eventCandidate();
    const untraceableResult = engine.evaluate({
      event,
      analysis: analysisRecord({ inputReferences: ["other-event"] }),
      now: new Date("2026-01-01T00:10:00Z"),
      scoringVersion: "news-event-engine-v1",
      minConfidence: 0.6
    });

    expect(untraceableResult.ok).toBe(false);
    expect(!untraceableResult.ok && untraceableResult.refusal.reasons).toContain("analysis_not_traceable_to_event");
  });
});

function eventCandidate(overrides: Partial<NewsEventCandidate> = {}): NewsEventCandidate {
  const article: NormalizedNewsArticle = {
    provider: "NAVER_NEWS",
    title: "Apple earnings",
    description: "",
    originalLink: "https://example.com/a",
    providerLink: "https://news.naver.com/a",
    publishedAt: new Date("2026-01-01T00:00:00Z"),
    collectedAt: new Date("2026-01-01T00:01:00Z"),
    duplicateKey: "apple|2026-01-01"
  };

  return {
    eventId: "news-event:apple|2026-01-01",
    duplicateKey: "apple|2026-01-01",
    articles: [article],
    title: "Apple earnings",
    publishedAt: article.publishedAt,
    collectedAt: article.collectedAt,
    companyReferences: [{ alias: "apple", resolution: "RESOLVED", symbols: ["AAPL"] }],
    keywordReferences: ["earnings"],
    stale: false,
    validTimestamps: true,
    safetyType: "NEWS_EVENT_CANDIDATE_ONLY",
    ...overrides
  };
}

function analysisRecord(overrides: Partial<{
  inputReferences: string[];
  confidence: number;
  contradictions: string[];
  requiresReview: boolean;
}> = {}): AIAnalysisRecord {
  const raw = {
    analysisId: "analysis-1",
    sentiment: "positive",
    eventType: "earnings",
    impactScore: 70,
    confidence: overrides.confidence ?? 0.8,
    timeHorizon: "short",
    evidence: ["guidance improved"],
    risks: ["already priced in"],
    contradictions: overrides.contradictions ?? [],
    requiresReview: overrides.requiresReview ?? false,
    schemaVersion: "ai-analysis-v1",
    model: "claude-test"
  };

  return buildAIAnalysisRecord({
    request: {
      promptTemplateId: "news-event-template",
      promptTemplateVersion: "1.0.0",
      inputReferences: overrides.inputReferences ?? ["news-event:apple|2026-01-01"],
      variables: {}
    },
    validation: validateClaudeAnalysis(raw),
    now: new Date("2026-01-01T00:05:00Z")
  });
}
