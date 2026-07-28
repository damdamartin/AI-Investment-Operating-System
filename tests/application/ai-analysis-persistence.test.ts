import { describe, expect, it } from "vitest";
import {
  buildAIAnalysisRecord,
  buildAIAnalysisValidationFailureRecord,
  DomainValidationError,
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
});
