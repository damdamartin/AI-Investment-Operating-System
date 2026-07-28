import type { ClaudeAnalysisRequest, ClaudeAnalysisResult } from "../../adapters/contracts/index.js";
import type { ClaudeValidationResult } from "../../adapters/claude/index.js";
import { DomainValidationError } from "../../shared/errors.js";

export interface AIAnalysisUsageMetadata {
  tokenInputCount?: number;
  tokenOutputCount?: number;
  estimatedCost?: string;
}

export interface AIAnalysisRecord {
  id: string;
  provider: "CLAUDE";
  model: string;
  promptTemplateId: string;
  promptTemplateVersion: string;
  schemaVersion: string;
  schemaValid: true;
  confidence: number;
  inputReferences: string[];
  normalizedOutput: ClaudeAnalysisResult;
  evidence: string[];
  contradictions: string[];
  risks: string[];
  rawPayloadId?: string | undefined;
  usage?: AIAnalysisUsageMetadata | undefined;
  createdAt: Date;
  safetyType: "AI_ANALYSIS_ADVISORY_ONLY";
}

export interface AIAnalysisValidationFailureRecord {
  id: string;
  provider: "CLAUDE";
  model?: string | undefined;
  promptTemplateId: string;
  promptTemplateVersion: string;
  schemaValid: false;
  inputReferences: string[];
  validationErrors: string[];
  rawPayloadId?: string | undefined;
  createdAt: Date;
  safetyType: "AI_ANALYSIS_VALIDATION_FAILURE_ONLY";
}

export interface AIAnalysisRepository {
  saveValid(record: AIAnalysisRecord): Promise<void>;
  saveValidationFailure(record: AIAnalysisValidationFailureRecord): Promise<void>;
  findValidById(id: string): Promise<AIAnalysisRecord | undefined>;
  findValidationFailureById(id: string): Promise<AIAnalysisValidationFailureRecord | undefined>;
}

export interface BuildAIAnalysisRecordOptions {
  request: ClaudeAnalysisRequest;
  validation: ClaudeValidationResult;
  now: Date;
  rawPayloadId?: string;
  usage?: AIAnalysisUsageMetadata;
}

export function buildAIAnalysisRecord(options: BuildAIAnalysisRecordOptions): AIAnalysisRecord {
  const { request, validation, now } = options;

  if (!validation.ok || !validation.analysis) {
    throw new DomainValidationError("Cannot store invalid AI output as a valid analysis.");
  }

  assertPromptReference(request);
  assertInputReferences(request.inputReferences);

  return {
    id: validation.analysis.analysisId,
    provider: "CLAUDE",
    model: validation.analysis.model,
    promptTemplateId: request.promptTemplateId,
    promptTemplateVersion: request.promptTemplateVersion,
    schemaVersion: validation.analysis.schemaVersion,
    schemaValid: true,
    confidence: validation.analysis.confidence,
    inputReferences: [...request.inputReferences],
    normalizedOutput: validation.analysis,
    evidence: [...validation.analysis.evidence],
    contradictions: [...validation.analysis.contradictions],
    risks: [...validation.analysis.risks],
    rawPayloadId: options.rawPayloadId,
    usage: options.usage,
    createdAt: now,
    safetyType: "AI_ANALYSIS_ADVISORY_ONLY"
  };
}

export interface BuildAIAnalysisValidationFailureOptions {
  id: string;
  request: ClaudeAnalysisRequest;
  validation: ClaudeValidationResult;
  now: Date;
  rawPayloadId?: string;
  model?: string;
}

export function buildAIAnalysisValidationFailureRecord(
  options: BuildAIAnalysisValidationFailureOptions
): AIAnalysisValidationFailureRecord {
  if (options.validation.ok) {
    throw new DomainValidationError("Cannot store valid AI output as a validation failure.");
  }

  assertPromptReference(options.request);
  assertInputReferences(options.request.inputReferences);

  if (options.validation.errors.length === 0) {
    throw new DomainValidationError("Validation failure records require errors.");
  }

  return {
    id: options.id,
    provider: "CLAUDE",
    model: options.model,
    promptTemplateId: options.request.promptTemplateId,
    promptTemplateVersion: options.request.promptTemplateVersion,
    schemaValid: false,
    inputReferences: [...options.request.inputReferences],
    validationErrors: [...options.validation.errors],
    rawPayloadId: options.rawPayloadId,
    createdAt: options.now,
    safetyType: "AI_ANALYSIS_VALIDATION_FAILURE_ONLY"
  };
}

export class InMemoryAIAnalysisRepository implements AIAnalysisRepository {
  private readonly validRecords = new Map<string, AIAnalysisRecord>();
  private readonly failureRecords = new Map<string, AIAnalysisValidationFailureRecord>();

  async saveValid(record: AIAnalysisRecord): Promise<void> {
    if (record.schemaValid !== true) {
      throw new DomainValidationError("Only schema-valid analysis records can be saved as valid.");
    }

    this.validRecords.set(record.id, record);
  }

  async saveValidationFailure(record: AIAnalysisValidationFailureRecord): Promise<void> {
    if (record.schemaValid !== false) {
      throw new DomainValidationError("Only schema-invalid analysis records can be saved as validation failures.");
    }

    this.failureRecords.set(record.id, record);
  }

  async findValidById(id: string): Promise<AIAnalysisRecord | undefined> {
    return this.validRecords.get(id);
  }

  async findValidationFailureById(id: string): Promise<AIAnalysisValidationFailureRecord | undefined> {
    return this.failureRecords.get(id);
  }
}

/**
 * Raw token usage shape as documented in docs/05_API_Architecture.md section
 * 7.5 (`token_usage: { input, output }`). This describes only the Claude API
 * call itself (never broker or account data), so deriving it from an
 * already-fetched or fixture response requires no additional network calls.
 */
export interface RawClaudeUsageMetadata {
  token_usage?: {
    input?: unknown;
    output?: unknown;
  };
}

/**
 * Extracts sanitized, non-negative integer token counts from a raw Claude
 * response metadata shape. Returns undefined when no usable token usage is
 * present ("where available", per P5-005) instead of guessing values.
 */
export function extractUsageMetadata(raw: unknown): AIAnalysisUsageMetadata | undefined {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return undefined;
  }

  const tokenUsage = (raw as RawClaudeUsageMetadata).token_usage;
  if (tokenUsage === null || typeof tokenUsage !== "object") {
    return undefined;
  }

  const tokenInputCount = toNonNegativeInteger(tokenUsage.input);
  const tokenOutputCount = toNonNegativeInteger(tokenUsage.output);

  if (tokenInputCount === undefined && tokenOutputCount === undefined) {
    return undefined;
  }

  const usage: AIAnalysisUsageMetadata = {};
  if (tokenInputCount !== undefined) usage.tokenInputCount = tokenInputCount;
  if (tokenOutputCount !== undefined) usage.tokenOutputCount = tokenOutputCount;
  return usage;
}

export interface ClaudeCostRateCard {
  currency: string;
  inputPerMillionTokens: number;
  outputPerMillionTokens: number;
}

/**
 * Estimates AI API cost (never a trading Money amount) from token usage and a
 * locally supplied rate card. Returns undefined when usage is incomplete so
 * callers never fabricate a cost figure. This never touches broker capital
 * and must not be confused with domain Money used for order sizing.
 */
export function estimateAnalysisCost(
  usage: AIAnalysisUsageMetadata | undefined,
  rateCard: ClaudeCostRateCard
): string | undefined {
  if (!usage || usage.tokenInputCount === undefined || usage.tokenOutputCount === undefined) {
    return undefined;
  }

  if (rateCard.inputPerMillionTokens < 0 || rateCard.outputPerMillionTokens < 0) {
    throw new DomainValidationError("Claude cost rate card values must not be negative.");
  }

  const inputCost = (usage.tokenInputCount / 1_000_000) * rateCard.inputPerMillionTokens;
  const outputCost = (usage.tokenOutputCount / 1_000_000) * rateCard.outputPerMillionTokens;

  return (inputCost + outputCost).toFixed(6);
}

function toNonNegativeInteger(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
    return undefined;
  }

  return value;
}

function assertPromptReference(request: ClaudeAnalysisRequest): void {
  if (request.promptTemplateId.trim() === "" || request.promptTemplateVersion.trim() === "") {
    throw new DomainValidationError("AI analysis records require prompt template id and version.");
  }
}

function assertInputReferences(inputReferences: string[]): void {
  if (inputReferences.length === 0 || inputReferences.some((reference) => reference.trim() === "")) {
    throw new DomainValidationError("AI analysis records require traceable input references.");
  }
}
