import { EngineScoreSet, type EngineScore } from "../../domain/strategy/index.js";
import type { MarketDataFreshnessAssessment, MarketDataFreshnessPolicy, MarketDataSnapshot } from "../../domain/market-data/index.js";

export interface MarketEngineInput {
  snapshots: MarketDataSnapshot[];
  freshnessPolicy: MarketDataFreshnessPolicy;
  now: Date;
  scoringVersion: string;
}

export interface MarketEngineScoreOutput {
  assetId: string;
  symbol: string;
  scoreSet: EngineScoreSet;
  inputReferences: string[];
  scoringVersion: string;
  generatedAt: Date;
  safetyType: "MARKET_ENGINE_ANALYSIS_ONLY";
}

export interface MarketEngineRefusal {
  refused: true;
  reasons: string[];
  freshnessAssessments: MarketDataFreshnessAssessment[];
  inputReferences: string[];
  safetyType: "MARKET_ENGINE_REFUSAL_ONLY";
}

export type MarketEngineResult =
  | {
      ok: true;
      output: MarketEngineScoreOutput;
    }
  | {
      ok: false;
      refusal: MarketEngineRefusal;
    };

export class MarketEngine {
  evaluate(input: MarketEngineInput): MarketEngineResult {
    const snapshots = [...input.snapshots].sort((a, b) => a.collectedAt.getTime() - b.collectedAt.getTime());
    const inputReferences = snapshots.map(snapshotToInputReference);

    if (snapshots.length === 0) {
      return refused(["missing_market_data_snapshots"], [], inputReferences);
    }

    const assessments = snapshots.map((snapshot) => snapshot.assessFreshness(input.freshnessPolicy, input.now));
    const blockingAssessment = assessments.find((assessment) => assessment.blocksTradingDecision);

    if (blockingAssessment) {
      return refused(
        [...new Set(assessments.flatMap((assessment) => assessment.reasons))],
        assessments,
        inputReferences
      );
    }

    const latest = snapshots[snapshots.length - 1]!;
    const scores: EngineScore[] = [
      {
        engine: "MARKET_TREND",
        score: trendScore(snapshots),
        confidence: snapshots.length >= 2 ? 0.6 : 0.25
      },
      {
        engine: "MARKET_VOLUME",
        score: volumeScore(latest),
        confidence: 0.5
      },
      {
        engine: "MARKET_VOLATILITY",
        score: volatilityScore(snapshots),
        confidence: snapshots.length >= 3 ? 0.5 : 0.25
      }
    ];

    return {
      ok: true,
      output: {
        assetId: latest.assetId,
        symbol: latest.symbol,
        scoreSet: new EngineScoreSet(scores, input.scoringVersion),
        inputReferences,
        scoringVersion: input.scoringVersion,
        generatedAt: input.now,
        safetyType: "MARKET_ENGINE_ANALYSIS_ONLY"
      }
    };
  }
}

function refused(
  reasons: string[],
  freshnessAssessments: MarketDataFreshnessAssessment[],
  inputReferences: string[]
): MarketEngineResult {
  return {
    ok: false,
    refusal: {
      refused: true,
      reasons,
      freshnessAssessments,
      inputReferences,
      safetyType: "MARKET_ENGINE_REFUSAL_ONLY"
    }
  };
}

function trendScore(snapshots: MarketDataSnapshot[]): number {
  if (snapshots.length < 2) return 50;

  const first = priceAsNumber(snapshots[0]!);
  const latest = priceAsNumber(snapshots[snapshots.length - 1]!);
  const changeRatio = first === 0 ? 0 : (latest - first) / first;

  return clampScore(50 + changeRatio * 500);
}

function volumeScore(snapshot: MarketDataSnapshot): number {
  const volume = Number(snapshot.volume?.units ?? 0n);
  if (volume <= 0) return 0;
  if (volume >= 100_000_000_000_000n) return 90;
  if (volume >= 10_000_000_000_000n) return 75;
  if (volume >= 1_000_000_000_000n) return 60;
  return 40;
}

function volatilityScore(snapshots: MarketDataSnapshot[]): number {
  if (snapshots.length < 3) return 50;

  const prices = snapshots.map(priceAsNumber);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const latest = prices[prices.length - 1]!;
  const rangeRatio = latest === 0 ? 1 : (max - min) / latest;

  return clampScore(100 - rangeRatio * 500);
}

function priceAsNumber(snapshot: MarketDataSnapshot): number {
  return Number(snapshot.price?.units ?? 0n);
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function snapshotToInputReference(snapshot: MarketDataSnapshot): string {
  return `market-data:${snapshot.source}:${snapshot.assetId}:${snapshot.collectedAt.toISOString()}`;
}
