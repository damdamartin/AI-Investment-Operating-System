import { describe, expect, it } from "vitest";
import {
  buildAIAnalysisRecord,
  buildAIAnalysisValidationFailureRecord,
  DomainValidationError,
  estimateAnalysisCost,
  extractUsageMetadata,
  InMemoryAIAnalysisRepository,
  validateClaudeAnalysis,
  type ClaudeAnalysisRequest
} from "../../src/index.js";

const request: ClaudeAnalysisRequest = {
  promptTemplateId: "news-event-template",
  promptTemplateVersion: "1.0.0",
  inputReferences: ["news-event:apple|2026-01-01"],
  variables: {
    eventId: "news-event:apple|2026-01-01"
  }
};

const validRawAnalysis = {
  analysisId: "analysis-1",
  sentiment: "positive",
  eventType: "earnings",
  impactScore: 70,
  confidence: 0.72,
  timeHorizon: "short",
  evidence: ["earnings guidance improved"],
  risks: ["already priced in"],
  contradictions: ["volume reaction is unclear"],
  requiresReview: true,
  schemaVersion: "ai-analysis-v1",
  model: "claude-test"
};

describe("AI analysis persistence", () => {
  it("builds valid advisory analysis records from schema-validated Claude output", () => {
    const validation = validateClaudeAnalysis(validRawAnalysis);

    const record = buildAIAnalysisRecord({
      request,
      validation,
      now: new Date("2026-01-01T00:00:00Z"),
      rawPayloadId: "raw-1",
      usage: {
        tokenInputCount: 100,
        tokenOutputCount: 50,
        estimatedCost: "0.01"
      }
    });

    expect(record).toMatchObject({
      id: "analysis-1",
      provider: "CLAUDE",
      model: "claude-test",
      promptTemplateId: "news-event-template",
      promptTemplateVersion: "1.0.0",
      schemaVersion: "ai-analysis-v1",
      schemaValid: true,
      confidence: 0.72,
      inputReferences: ["news-event:apple|2026-01-01"],
      safetyType: "AI_ANALYSIS_ADVISORY_ONLY"
    });
    expect(record.normalizedOutput).not.toHaveProperty("order");
  });

  it("does not allow invalid AI output to be stored as valid analysis", () => {
    const validation = validateClaudeAnalysis({
      ...validRawAnalysis,
      brokerCommand: { submitOrder: true }
    });

    expect(() =>
      buildAIAnalysisRecord({
        request,
        validation,
        now: new Date("2026-01-01T00:00:00Z")
      })
    ).toThrow(DomainValidationError);
  });

  it("builds separate validation failure records for rejected Claude output", () => {
    const validation = validateClaudeAnalysis({
      ...validRawAnalysis,
      confidence: 2
    });

    const record = buildAIAnalysisValidationFailureRecord({
      id: "failure-1",
      request,
      validation,
      model: "claude-test",
      now: new Date("2026-01-01T00:00:00Z"),
      rawPayloadId: "raw-invalid-1"
    });

    expect(record).toMatchObject({
      id: "failure-1",
      provider: "CLAUDE",
      model: "claude-test",
      schemaValid: false,
      inputReferences: ["news-event:apple|2026-01-01"],
      safetyType: "AI_ANALYSIS_VALIDATION_FAILURE_ONLY"
    });
    expect(record.validationErrors).toContain("confidence_must_be_between_0_and_1");
  });

  it("requires traceable input references", () => {
    const validation = validateClaudeAnalysis(validRawAnalysis);

    expect(() =>
      buildAIAnalysisRecord({
        request: {
          ...request,
          inputReferences: []
        },
        validation,
        now: new Date("2026-01-01T00:00:00Z")
      })
    ).toThrow(DomainValidationError);
  });

  it("keeps valid analyses and validation failures in separate repository paths", async () => {
    const repository = new InMemoryAIAnalysisRepository();
    const valid = buildAIAnalysisRecord({
      request,
      validation: validateClaudeAnalysis(validRawAnalysis),
      now: new Date("2026-01-01T00:00:00Z")
    });
    const failure = buildAIAnalysisValidationFailureRecord({
      id: "failure-1",
      request,
      validation: validateClaudeAnalysis({
        ...validRawAnalysis,
        submitOrder: true
      }),
      now: new Date("2026-01-01T00:00:00Z")
    });

    await repository.saveValid(valid);
    await repository.saveValidationFailure(failure);

    expect(await repository.findValidById("analysis-1")).toBe(valid);
    expect(await repository.findValidationFailureById("failure-1")).toBe(failure);
    expect(await repository.findValidById("failure-1")).toBeUndefined();
  });

  it("rejects a nested forbidden broker command even when the rest of the analysis is schema-shaped", () => {
    const validation = validateClaudeAnalysis({
      ...validRawAnalysis,
      followUpSuggestion: { action: { replaceOrder: { orderId: "order-1" } } }
    });

    expect(validation.ok).toBe(false);
    expect(() =>
      buildAIAnalysisRecord({
        request,
        validation,
        now: new Date("2026-01-01T00:00:00Z")
      })
    ).toThrow(DomainValidationError);
  });

  it("stores confidence exactly as validated, never boosting a low-confidence analysis", () => {
    const lowConfidenceRaw = { ...validRawAnalysis, confidence: 0.05, requiresReview: true };
    const validation = validateClaudeAnalysis(lowConfidenceRaw);

    const record = buildAIAnalysisRecord({
      request,
      validation,
      now: new Date("2026-01-01T00:00:00Z")
    });

    expect(record.confidence).toBe(0.05);
    expect(record.normalizedOutput.confidence).toBe(0.05);
    expect(record.normalizedOutput.requiresReview).toBe(true);
    expect(record.safetyType).toBe("AI_ANALYSIS_ADVISORY_ONLY");
  });

  it("keeps model and prompt template metadata references distinct and traceable", () => {
    const validation = validateClaudeAnalysis(validRawAnalysis);

    const record = buildAIAnalysisRecord({
      request: {
        ...request,
        promptTemplateId: "news-event-template",
        promptTemplateVersion: "3.1.0"
      },
      validation,
      now: new Date("2026-01-01T00:00:00Z")
    });

    // model comes from the Claude output itself; prompt template id/version
    // come from the request that selected the template. These must never be
    // conflated, since audits need to reconstruct exactly which template
    // produced which model output.
    expect(record.model).toBe("claude-test");
    expect(record.promptTemplateId).toBe("news-event-template");
    expect(record.promptTemplateVersion).toBe("3.1.0");
    expect(record.schemaVersion).toBe("ai-analysis-v1");
  });

  it("drops unknown fields from the raw Claude output rather than persisting them", () => {
    const validation = validateClaudeAnalysis({
      ...validRawAnalysis,
      internalDebugNote: "should never be persisted"
    });

    const record = buildAIAnalysisRecord({
      request,
      validation,
      now: new Date("2026-01-01T00:00:00Z")
    });

    expect(record.normalizedOutput).not.toHaveProperty("internalDebugNote");
    expect(JSON.stringify(record)).not.toContain("internalDebugNote");
  });

  describe("token usage and cost metadata (where available)", () => {
    it("extracts token usage from a raw Claude response metadata shape", () => {
      const usage = extractUsageMetadata({
        token_usage: { input: 1000, output: 600 }
      });

      expect(usage).toEqual({ tokenInputCount: 1000, tokenOutputCount: 600 });
    });

    it("returns undefined when no token usage is present rather than guessing", () => {
      expect(extractUsageMetadata({})).toBeUndefined();
      expect(extractUsageMetadata(undefined)).toBeUndefined();
      expect(extractUsageMetadata({ token_usage: { input: "not-a-number" } })).toBeUndefined();
    });

    it("ignores negative or non-integer token counts instead of persisting bad data", () => {
      const usage = extractUsageMetadata({
        token_usage: { input: -5, output: 12.5 }
      });

      expect(usage).toBeUndefined();
    });

    it("estimates cost from extracted usage and a local rate card", () => {
      const usage = extractUsageMetadata({ token_usage: { input: 1_000_000, output: 500_000 } });

      const cost = estimateAnalysisCost(usage, {
        currency: "USD",
        inputPerMillionTokens: 3,
        outputPerMillionTokens: 15
      });

      expect(cost).toBe((3 + 7.5).toFixed(6));
    });

    it("does not estimate cost when usage is incomplete", () => {
      const cost = estimateAnalysisCost(undefined, {
        currency: "USD",
        inputPerMillionTokens: 3,
        outputPerMillionTokens: 15
      });

      expect(cost).toBeUndefined();
    });

    it("rejects a negative rate card instead of producing a nonsensical cost", () => {
      const usage = extractUsageMetadata({ token_usage: { input: 100, output: 50 } });

      expect(() =>
        estimateAnalysisCost(usage, {
          currency: "USD",
          inputPerMillionTokens: -1,
          outputPerMillionTokens: 15
        })
      ).toThrow(DomainValidationError);
    });

    it("threads extracted usage and estimated cost through into the persisted advisory record", () => {
      const rawResponse = { token_usage: { input: 800, output: 200 } };
      const usage = extractUsageMetadata(rawResponse);
      const estimatedCost = estimateAnalysisCost(usage, {
        currency: "USD",
        inputPerMillionTokens: 3,
        outputPerMillionTokens: 15
      });

      expect(estimatedCost).toBeDefined();

      const validation = validateClaudeAnalysis(validRawAnalysis);
      const record = buildAIAnalysisRecord({
        request,
        validation,
        now: new Date("2026-01-01T00:00:00Z"),
        usage: { ...usage, estimatedCost: estimatedCost as string }
      });

      expect(record.usage).toEqual({
        tokenInputCount: 800,
        tokenOutputCount: 200,
        estimatedCost: (0.0024 + 0.003).toFixed(6)
      });
    });
  });
});
