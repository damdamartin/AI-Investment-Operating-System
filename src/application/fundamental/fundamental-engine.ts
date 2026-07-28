import { EngineScoreSet, type EngineScore } from "../../domain/strategy/index.js";

export interface FundamentalMetric {
  value?: number | undefined;
  source: string;
  asOf: Date;
}

export interface FundamentalSnapshot {
  assetId: string;
  symbol: string;
  revenueGrowth?: FundamentalMetric | undefined;
  operatingMargin?: FundamentalMetric | undefined;
  debtToEquity?: FundamentalMetric | undefined;
  returnOnEquity?: FundamentalMetric | undefined;
  freeCashFlowPositive?: boolean | undefined;
  inputReferences: string[];
}

export interface FundamentalEngineInput {
  snapshot?: FundamentalSnapshot | undefined;
  now: Date;
  scoringVersion: string;
  requireCompleteData?: boolean;
}

export interface FundamentalEngineScoreOutput {
  assetId: string;
  symbol: string;
  scoreSet: EngineScoreSet;
  inputReferences: string[];
  scoringVersion: string;
  generatedAt: Date;
  missingMetrics: string[];
  safetyType: "FUNDAMENTAL_ENGINE_ANALYSIS_ONLY";
}

export interface FundamentalEngineRefusal {
  refused: true;
  reasons: string[];
  missingMetrics: string[];
  inputReferences: string[];
  safetyType: "FUNDAMENTAL_ENGINE_REFUSAL_ONLY";
}

export type FundamentalEngineResult =
  | {
      ok: true;
      output: FundamentalEngineScoreOutput;
    }
  | {
      ok: false;
      refusal: FundamentalEngineRefusal;
    };

const requiredMetrics = ["revenueGrowth", "operatingMargin", "debtToEquity", "returnOnEquity"] as const;

export class FundamentalEngine {
  evaluate(input: FundamentalEngineInput): FundamentalEngineResult {
    if (!input.snapshot) {
      return refused(["missing_fundamental_snapshot"], requiredMetrics, []);
    }

    const missingMetrics = findMissingMetrics(input.snapshot);
    if (input.requireCompleteData === true && missingMetrics.length > 0) {
      return refused(["incomplete_fundamental_data"], missingMetrics, input.snapshot.inputReferences);
    }

    const invalidMetrics = findInvalidMetrics(input.snapshot);
    if (invalidMetrics.length > 0) {
      return refused(invalidMetrics.map((metric) => `invalid_${metric}`), missingMetrics, input.snapshot.inputReferences);
    }

    const completenessConfidence = (requiredMetrics.length - missingMetrics.length) / requiredMetrics.length;
    const scores: EngineScore[] = [
      {
        engine: "FUNDAMENTAL_GROWTH",
        score: scorePositiveRatio(input.snapshot.revenueGrowth?.value, 0.3),
        confidence: metricConfidence(input.snapshot.revenueGrowth, completenessConfidence)
      },
      {
        engine: "FUNDAMENTAL_QUALITY",
        score: averageScore([
          scorePositiveRatio(input.snapshot.operatingMargin?.value, 0.25),
          scorePositiveRatio(input.snapshot.returnOnEquity?.value, 0.25),
          input.snapshot.freeCashFlowPositive === undefined ? 50 : input.snapshot.freeCashFlowPositive ? 75 : 25
        ]),
        confidence: Math.min(
          metricConfidence(input.snapshot.operatingMargin, completenessConfidence),
          metricConfidence(input.snapshot.returnOnEquity, completenessConfidence)
        )
      },
      {
        engine: "FUNDAMENTAL_BALANCE_SHEET",
        score: scoreDebtToEquity(input.snapshot.debtToEquity?.value),
        confidence: metricConfidence(input.snapshot.debtToEquity, completenessConfidence)
      }
    ];

    return {
      ok: true,
      output: {
        assetId: input.snapshot.assetId,
        symbol: input.snapshot.symbol,
        scoreSet: new EngineScoreSet(scores, input.scoringVersion),
        inputReferences: [...input.snapshot.inputReferences],
        scoringVersion: input.scoringVersion,
        generatedAt: input.now,
        missingMetrics,
        safetyType: "FUNDAMENTAL_ENGINE_ANALYSIS_ONLY"
      }
    };
  }
}

function refused(
  reasons: string[],
  missingMetrics: readonly string[],
  inputReferences: string[]
): FundamentalEngineResult {
  return {
    ok: false,
    refusal: {
      refused: true,
      reasons,
      missingMetrics: [...missingMetrics],
      inputReferences,
      safetyType: "FUNDAMENTAL_ENGINE_REFUSAL_ONLY"
    }
  };
}

function findMissingMetrics(snapshot: FundamentalSnapshot): string[] {
  return requiredMetrics.filter((metric) => snapshot[metric]?.value === undefined);
}

function findInvalidMetrics(snapshot: FundamentalSnapshot): string[] {
  return requiredMetrics.filter((metric) => {
    const value = snapshot[metric]?.value;
    return value !== undefined && !Number.isFinite(value);
  });
}

function metricConfidence(metric: FundamentalMetric | undefined, completenessConfidence: number): number {
  if (!metric || metric.value === undefined) return 0.15;
  return Math.max(0.2, Math.min(0.75, completenessConfidence));
}

function scorePositiveRatio(value: number | undefined, excellentThreshold: number): number {
  if (value === undefined) return 50;
  return clampScore(50 + (value / excellentThreshold) * 50);
}

function scoreDebtToEquity(value: number | undefined): number {
  if (value === undefined) return 50;
  if (value <= 0) return 90;
  if (value >= 3) return 10;
  return clampScore(90 - (value / 3) * 80);
}

function averageScore(values: number[]): number {
  return clampScore(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
