import type { Asset } from "../../domain/assets/index.js";
import { EngineScoreSet, Signal, type EngineScore, type SignalDirection, type StrategyVersion } from "../../domain/strategy/index.js";
import type { FundamentalEngineScoreOutput } from "../fundamental/index.js";
import type { MarketEngineScoreOutput } from "../market/index.js";
import type { NewsEventEngineScoreOutput } from "../news-event-engine/index.js";

export type StrategyScoreEngine = "MARKET" | "FUNDAMENTAL" | "NEWS_EVENT";

export interface StrategyScoringWeights {
  MARKET?: number | undefined;
  FUNDAMENTAL?: number | undefined;
  NEWS_EVENT?: number | undefined;
}

export interface StrategyScoringInput {
  asset: Asset;
  strategyVersion: StrategyVersion;
  signalId: string;
  market?: MarketEngineScoreOutput | undefined;
  fundamental?: FundamentalEngineScoreOutput | undefined;
  newsEvent?: NewsEventEngineScoreOutput | undefined;
  requiredEngines: StrategyScoreEngine[];
  weights: StrategyScoringWeights;
  buyThreshold: number;
  sellThreshold: number;
  scoringVersion: string;
  now: Date;
}

export interface StrategyScoringOutput {
  signal: Signal;
  compositeScore: number;
  compositeConfidence: number;
  inputReferences: string[];
  requiredEngines: StrategyScoreEngine[];
  safetyType: "STRATEGY_SCORING_SIGNAL_ONLY";
}

export interface StrategyScoringRefusal {
  refused: true;
  reasons: string[];
  missingRequiredEngines: StrategyScoreEngine[];
  safetyType: "STRATEGY_SCORING_REFUSAL_ONLY";
}

export type StrategyScoringResult =
  | {
      ok: true;
      output: StrategyScoringOutput;
    }
  | {
      ok: false;
      refusal: StrategyScoringRefusal;
    };

export class StrategyScoringService {
  score(input: StrategyScoringInput): StrategyScoringResult {
    const available = availableEngineOutputs(input);
    const missingRequiredEngines = input.requiredEngines.filter((engine) => !available.has(engine));

    if (missingRequiredEngines.length > 0) {
      return refused(["missing_required_engine_output"], missingRequiredEngines);
    }

    const weightedInputs = [...available.entries()].map(([engine, output]) => ({
      engine,
      output,
      weight: input.weights[engine] ?? 0
    })).filter((item) => item.weight > 0);

    if (weightedInputs.length === 0) {
      return refused(["missing_positive_strategy_weights"], []);
    }

    const totalWeight = weightedInputs.reduce((sum, item) => sum + item.weight, 0);
    const compositeScore = weightedInputs.reduce(
      (sum, item) => sum + averageScore(item.output.scoreSet.scores) * item.weight,
      0
    ) / totalWeight;
    const compositeConfidence = weightedInputs.reduce(
      (sum, item) => sum + averageConfidence(item.output.scoreSet.scores) * item.weight,
      0
    ) / totalWeight;
    const direction = directionFor(compositeScore, input.buyThreshold, input.sellThreshold);
    const componentScores = weightedInputs.map(({ engine, output }) => ({
      engine: `STRATEGY_${engine}`,
      score: averageScore(output.scoreSet.scores),
      confidence: averageConfidence(output.scoreSet.scores)
    }));
    const scores: EngineScore[] = [
      ...componentScores,
      {
        engine: "STRATEGY_COMPOSITE",
        score: Math.round(compositeScore),
        confidence: roundConfidence(compositeConfidence)
      }
    ];
    const scoreSet = new EngineScoreSet(scores, input.scoringVersion);
    const signal = new Signal({
      id: input.signalId,
      strategyVersion: input.strategyVersion,
      asset: input.asset,
      direction,
      scoreSet,
      generatedAt: input.now
    });

    return {
      ok: true,
      output: {
        signal,
        compositeScore: Math.round(compositeScore),
        compositeConfidence: roundConfidence(compositeConfidence),
        inputReferences: weightedInputs.flatMap((item) => item.output.inputReferences),
        requiredEngines: [...input.requiredEngines],
        safetyType: "STRATEGY_SCORING_SIGNAL_ONLY"
      }
    };
  }
}

function availableEngineOutputs(input: StrategyScoringInput): Map<StrategyScoreEngine, EngineOutput> {
  const available = new Map<StrategyScoreEngine, EngineOutput>();
  if (input.market) available.set("MARKET", input.market);
  if (input.fundamental) available.set("FUNDAMENTAL", input.fundamental);
  if (input.newsEvent && input.newsEvent.automatedTradeCandidateAllowed) {
    available.set("NEWS_EVENT", input.newsEvent);
  }
  return available;
}

function refused(reasons: string[], missingRequiredEngines: StrategyScoreEngine[]): StrategyScoringResult {
  return {
    ok: false,
    refusal: {
      refused: true,
      reasons,
      missingRequiredEngines,
      safetyType: "STRATEGY_SCORING_REFUSAL_ONLY"
    }
  };
}

type EngineOutput = MarketEngineScoreOutput | FundamentalEngineScoreOutput | NewsEventEngineScoreOutput;

function averageScore(scores: EngineScore[]): number {
  return scores.reduce((sum, score) => sum + score.score, 0) / scores.length;
}

function averageConfidence(scores: EngineScore[]): number {
  return scores.reduce((sum, score) => sum + score.confidence, 0) / scores.length;
}

function directionFor(score: number, buyThreshold: number, sellThreshold: number): SignalDirection {
  if (score >= buyThreshold) return "BUY";
  if (score <= sellThreshold) return "SELL";
  return "HOLD";
}

function roundConfidence(value: number): number {
  return Math.round(value * 100) / 100;
}
