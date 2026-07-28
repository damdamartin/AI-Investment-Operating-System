import { EngineScoreSet, type EngineScore } from "../../domain/strategy/index.js";
import type { AIAnalysisRecord } from "../ai/index.js";
import type { NewsEventCandidate } from "../news/index.js";

export interface NewsEventEngineInput {
  event: NewsEventCandidate;
  analysis?: AIAnalysisRecord | undefined;
  now: Date;
  scoringVersion: string;
  minConfidence: number;
}

export interface NewsEventEngineScoreOutput {
  eventId: string;
  analysisId: string;
  scoreSet: EngineScoreSet;
  sentiment: "positive" | "neutral" | "negative";
  inputReferences: string[];
  scoringVersion: string;
  generatedAt: Date;
  automatedTradeCandidateAllowed: boolean;
  reviewRequired: boolean;
  safetyType: "NEWS_EVENT_ENGINE_ANALYSIS_ONLY";
}

export interface NewsEventEngineRefusal {
  refused: true;
  reasons: string[];
  inputReferences: string[];
  analysisId?: string | undefined;
  safetyType: "NEWS_EVENT_ENGINE_REFUSAL_ONLY";
}

export type NewsEventEngineResult =
  | {
      ok: true;
      output: NewsEventEngineScoreOutput;
    }
  | {
      ok: false;
      refusal: NewsEventEngineRefusal;
    };

export class NewsEventEngine {
  evaluate(input: NewsEventEngineInput): NewsEventEngineResult {
    const eventReferences = [`news-event:${input.event.eventId}`];

    if (input.event.stale) {
      return refused(["stale_news_event"], eventReferences, input.analysis?.id);
    }

    if (!input.event.validTimestamps) {
      return refused(["invalid_news_event_timestamps"], eventReferences, input.analysis?.id);
    }

    if (!input.analysis) {
      return refused(["missing_ai_analysis"], eventReferences);
    }

    if (!input.analysis.inputReferences.includes(input.event.eventId)) {
      return refused(["analysis_not_traceable_to_event"], inputReferences(input.event, input.analysis), input.analysis.id);
    }

    if (input.analysis.confidence < input.minConfidence) {
      return refused(["low_ai_confidence"], inputReferences(input.event, input.analysis), input.analysis.id);
    }

    const contradictionPenalty = Math.min(input.analysis.contradictions.length * 15, 45);
    const reviewRequired = input.analysis.normalizedOutput.requiresReview || input.analysis.contradictions.length > 0;
    const impactScore = Math.max(0, input.analysis.normalizedOutput.impactScore - contradictionPenalty);
    const sentimentScore = sentimentToScore(input.analysis.normalizedOutput.sentiment, impactScore);
    const confidenceScore = Math.round(input.analysis.confidence * 100);

    const scores: EngineScore[] = [
      {
        engine: "NEWS_EVENT_IMPORTANCE",
        score: impactScore,
        confidence: input.analysis.confidence
      },
      {
        engine: "NEWS_EVENT_SENTIMENT",
        score: sentimentScore,
        confidence: input.analysis.confidence
      },
      {
        engine: "NEWS_EVENT_CONFIDENCE",
        score: confidenceScore,
        confidence: input.analysis.confidence
      }
    ];

    return {
      ok: true,
      output: {
        eventId: input.event.eventId,
        analysisId: input.analysis.id,
        scoreSet: new EngineScoreSet(scores, input.scoringVersion),
        sentiment: input.analysis.normalizedOutput.sentiment,
        inputReferences: inputReferences(input.event, input.analysis),
        scoringVersion: input.scoringVersion,
        generatedAt: input.now,
        automatedTradeCandidateAllowed: !reviewRequired,
        reviewRequired,
        safetyType: "NEWS_EVENT_ENGINE_ANALYSIS_ONLY"
      }
    };
  }
}

function refused(reasons: string[], inputReferences: string[], analysisId?: string): NewsEventEngineResult {
  return {
    ok: false,
    refusal: {
      refused: true,
      reasons,
      inputReferences,
      analysisId,
      safetyType: "NEWS_EVENT_ENGINE_REFUSAL_ONLY"
    }
  };
}

function inputReferences(event: NewsEventCandidate, analysis: AIAnalysisRecord): string[] {
  return [
    `news-event:${event.eventId}`,
    `ai-analysis:${analysis.id}`,
    ...analysis.inputReferences.map((reference) => `analysis-input:${reference}`)
  ];
}

function sentimentToScore(sentiment: "positive" | "neutral" | "negative", impactScore: number): number {
  if (sentiment === "positive") return impactScore;
  if (sentiment === "negative") return Math.max(0, 100 - impactScore);
  return 50;
}
