import { describe, expect, it } from "vitest";
import {
  Asset,
  AssetType,
  EngineScoreSet,
  Market,
  StrategyScoringService,
  StrategyVersion,
  type FundamentalEngineScoreOutput,
  type MarketEngineScoreOutput,
  type NewsEventEngineScoreOutput
} from "../../src/index.js";

describe("StrategyScoringService", () => {
  it("creates a Signal from complete required weighted engine outputs", () => {
    const result = new StrategyScoringService().score({
      asset: asset(),
      strategyVersion: strategyVersion(),
      signalId: "signal-1",
      market: marketOutput(),
      fundamental: fundamentalOutput(),
      newsEvent: newsEventOutput(),
      requiredEngines: ["MARKET", "FUNDAMENTAL", "NEWS_EVENT"],
      weights: {
        MARKET: 0.4,
        FUNDAMENTAL: 0.3,
        NEWS_EVENT: 0.3
      },
      buyThreshold: 65,
      sellThreshold: 35,
      scoringVersion: "strategy-score-v1",
      now: new Date("2026-01-01T00:10:00Z")
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.output.signal.direction).toBe("BUY");
    expect(result.ok && result.output.signal.scoreSet.scoringVersion).toBe("strategy-score-v1");
    expect(result.ok && result.output.inputReferences).toEqual(
      expect.arrayContaining(["market-ref", "fundamental-ref", "news-event-ref"])
    );
    expect(result.ok && result.output.safetyType).toBe("STRATEGY_SCORING_SIGNAL_ONLY");
    expect(result.ok && result.output.signal).not.toHaveProperty("side");
    expect(result.ok && result.output.signal).not.toHaveProperty("quantity");
  });

  it("blocks scoring when required engine output is missing", () => {
    const result = new StrategyScoringService().score({
      asset: asset(),
      strategyVersion: strategyVersion(),
      signalId: "signal-1",
      market: marketOutput(),
      requiredEngines: ["MARKET", "FUNDAMENTAL"],
      weights: {
        MARKET: 1
      },
      buyThreshold: 65,
      sellThreshold: 35,
      scoringVersion: "strategy-score-v1",
      now: new Date("2026-01-01T00:10:00Z")
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.refusal.reasons).toContain("missing_required_engine_output");
    expect(!result.ok && result.refusal.missingRequiredEngines).toEqual(["FUNDAMENTAL"]);
  });

  it("does not use review-required news event output as available input", () => {
    const result = new StrategyScoringService().score({
      asset: asset(),
      strategyVersion: strategyVersion(),
      signalId: "signal-1",
      market: marketOutput(),
      newsEvent: {
        ...newsEventOutput(),
        automatedTradeCandidateAllowed: false,
        reviewRequired: true
      },
      requiredEngines: ["MARKET", "NEWS_EVENT"],
      weights: {
        MARKET: 0.5,
        NEWS_EVENT: 0.5
      },
      buyThreshold: 65,
      sellThreshold: 35,
      scoringVersion: "strategy-score-v1",
      now: new Date("2026-01-01T00:10:00Z")
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.refusal.missingRequiredEngines).toContain("NEWS_EVENT");
  });

  it("creates HOLD and SELL signals based on thresholds without creating orders", () => {
    const service = new StrategyScoringService();

    const hold = service.score({
      asset: asset(),
      strategyVersion: strategyVersion(),
      signalId: "signal-hold",
      market: marketOutput([{ engine: "MARKET_TREND", score: 50, confidence: 0.7 }]),
      requiredEngines: ["MARKET"],
      weights: { MARKET: 1 },
      buyThreshold: 65,
      sellThreshold: 35,
      scoringVersion: "strategy-score-v1",
      now: new Date("2026-01-01T00:10:00Z")
    });
    const sell = service.score({
      asset: asset(),
      strategyVersion: strategyVersion(),
      signalId: "signal-sell",
      market: marketOutput([{ engine: "MARKET_TREND", score: 20, confidence: 0.7 }]),
      requiredEngines: ["MARKET"],
      weights: { MARKET: 1 },
      buyThreshold: 65,
      sellThreshold: 35,
      scoringVersion: "strategy-score-v1",
      now: new Date("2026-01-01T00:10:00Z")
    });

    expect(hold.ok && hold.output.signal.direction).toBe("HOLD");
    expect(sell.ok && sell.output.signal.direction).toBe("SELL");
    expect(hold.ok && hold.output.signal).not.toHaveProperty("limitPrice");
    expect(sell.ok && sell.output.signal).not.toHaveProperty("brokerOrder");
  });
});

function asset(): Asset {
  return new Asset({
    id: "asset-aapl",
    symbol: "AAPL",
    name: "Apple",
    market: Market.from("US"),
    assetType: AssetType.from("STOCK"),
    tradingStatus: "TRADABLE"
  });
}

function strategyVersion(): StrategyVersion {
  return new StrategyVersion({
    id: "strategy-version-1",
    strategyId: "strategy-1",
    version: "1.0.0",
    status: "PAPER",
    definitionHash: "hash-1"
  });
}

function marketOutput(scores = [{ engine: "MARKET_TREND", score: 80, confidence: 0.7 }]): MarketEngineScoreOutput {
  return {
    assetId: "asset-aapl",
    symbol: "AAPL",
    scoreSet: new EngineScoreSet(scores, "market-v1"),
    inputReferences: ["market-ref"],
    scoringVersion: "market-v1",
    generatedAt: new Date("2026-01-01T00:00:00Z"),
    safetyType: "MARKET_ENGINE_ANALYSIS_ONLY"
  };
}

function fundamentalOutput(): FundamentalEngineScoreOutput {
  return {
    assetId: "asset-aapl",
    symbol: "AAPL",
    scoreSet: new EngineScoreSet([{ engine: "FUNDAMENTAL_QUALITY", score: 70, confidence: 0.6 }], "fundamental-v1"),
    inputReferences: ["fundamental-ref"],
    scoringVersion: "fundamental-v1",
    generatedAt: new Date("2026-01-01T00:00:00Z"),
    missingMetrics: [],
    safetyType: "FUNDAMENTAL_ENGINE_ANALYSIS_ONLY"
  };
}

function newsEventOutput(): NewsEventEngineScoreOutput {
  return {
    eventId: "news-event:apple",
    analysisId: "analysis-1",
    scoreSet: new EngineScoreSet([{ engine: "NEWS_EVENT_IMPORTANCE", score: 75, confidence: 0.8 }], "news-v1"),
    sentiment: "positive",
    inputReferences: ["news-event-ref"],
    scoringVersion: "news-v1",
    generatedAt: new Date("2026-01-01T00:00:00Z"),
    automatedTradeCandidateAllowed: true,
    reviewRequired: false,
    safetyType: "NEWS_EVENT_ENGINE_ANALYSIS_ONLY"
  };
}
