import type { AdapterResult } from "./common.js";

export type ClaudeSentiment = "positive" | "neutral" | "negative";
export type ClaudeTimeHorizon = "short" | "medium" | "long";

export interface ClaudeAnalysisRequest {
  promptTemplateId: string;
  promptTemplateVersion: string;
  inputReferences: string[];
  variables: Record<string, unknown>;
}

export interface ClaudeAnalysisResult {
  analysisId: string;
  sentiment: ClaudeSentiment;
  eventType: string;
  impactScore: number;
  confidence: number;
  timeHorizon: ClaudeTimeHorizon;
  evidence: string[];
  risks: string[];
  contradictions: string[];
  requiresReview: boolean;
  schemaVersion: string;
  model: string;
}

export interface ClaudeAIAdapter {
  analyze(request: ClaudeAnalysisRequest): Promise<AdapterResult<ClaudeAnalysisResult>>;
}
