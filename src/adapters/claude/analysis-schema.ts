import type { ClaudeAnalysisResult } from "../contracts/index.js";

export interface ClaudeValidationResult {
  ok: boolean;
  analysis?: ClaudeAnalysisResult;
  errors: string[];
}

const sentiments = new Set(["positive", "neutral", "negative"]);
const horizons = new Set(["short", "medium", "long"]);
// Keep in sync with the recursive AI-context scan in
// src/application/broker-write-guard/broker-write-command-guard.ts.
// Claude output must never be able to carry an executable broker command at
// any nesting depth, so the whole analysis is rejected outright rather than
// silently dropping unrecognized fields.
const forbiddenCommandKeys = new Set([
  "order",
  "orders",
  "brokerCommand",
  "broker_command",
  "submitOrder",
  "cancelOrder",
  "replaceOrder",
  "tossRequest"
]);

export function validateClaudeAnalysis(value: unknown): ClaudeValidationResult {
  const errors: string[] = [];

  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, errors: ["analysis_must_be_object"] };
  }

  const record = value as Record<string, unknown>;

  for (const forbiddenKey of findForbiddenCommandKeys(record)) {
    errors.push(`forbidden_command_key_${forbiddenKey}`);
  }

  const analysisId = requireString(record.analysisId, "analysisId", errors);
  const sentiment = requireEnum(record.sentiment, sentiments, "sentiment", errors);
  const eventType = requireString(record.eventType, "eventType", errors);
  const impactScore = requireNumberRange(record.impactScore, "impactScore", 0, 100, errors);
  const confidence = requireNumberRange(record.confidence, "confidence", 0, 1, errors);
  const timeHorizon = requireEnum(record.timeHorizon, horizons, "timeHorizon", errors);
  const evidence = requireStringArray(record.evidence, "evidence", errors);
  const risks = requireStringArray(record.risks, "risks", errors);
  const contradictions = requireStringArray(record.contradictions, "contradictions", errors);
  const requiresReview = requireBoolean(record.requiresReview, "requiresReview", errors);
  const schemaVersion = requireString(record.schemaVersion, "schemaVersion", errors);
  const model = requireString(record.model, "model", errors);

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    analysis: {
      analysisId: analysisId!,
      sentiment: sentiment! as ClaudeAnalysisResult["sentiment"],
      eventType: eventType!,
      impactScore: impactScore!,
      confidence: confidence!,
      timeHorizon: timeHorizon! as ClaudeAnalysisResult["timeHorizon"],
      evidence: evidence!,
      risks: risks!,
      contradictions: contradictions!,
      requiresReview: requiresReview!,
      schemaVersion: schemaVersion!,
      model: model!
    },
    errors: []
  };
}

function findForbiddenCommandKeys(value: unknown): string[] {
  const found = new Set<string>();
  scanForForbiddenCommandKeys(value, found);
  return [...found].sort();
}

function scanForForbiddenCommandKeys(value: unknown, found: Set<string>): void {
  if (value === null || value === undefined) return;

  if (Array.isArray(value)) {
    for (const item of value) {
      scanForForbiddenCommandKeys(item, found);
    }
    return;
  }

  if (typeof value !== "object") return;

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (forbiddenCommandKeys.has(key)) {
      found.add(key);
    }
    scanForForbiddenCommandKeys(nested, found);
  }
}

function requireString(value: unknown, field: string, errors: string[]): string | undefined {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${field}_must_be_non_empty_string`);
    return undefined;
  }

  return value;
}

function requireEnum(value: unknown, allowed: Set<string>, field: string, errors: string[]): string | undefined {
  if (typeof value !== "string" || !allowed.has(value)) {
    errors.push(`${field}_has_unsupported_value`);
    return undefined;
  }

  return value;
}

function requireNumberRange(
  value: unknown,
  field: string,
  min: number,
  max: number,
  errors: string[]
): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    errors.push(`${field}_must_be_between_${min}_and_${max}`);
    return undefined;
  }

  return value;
}

function requireStringArray(value: unknown, field: string, errors: string[]): string[] | undefined {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    errors.push(`${field}_must_be_string_array`);
    return undefined;
  }

  return value;
}

function requireBoolean(value: unknown, field: string, errors: string[]): boolean | undefined {
  if (typeof value !== "boolean") {
    errors.push(`${field}_must_be_boolean`);
    return undefined;
  }

  return value;
}
