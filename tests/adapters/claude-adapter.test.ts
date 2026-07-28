import { describe, expect, it } from "vitest";
import { validateClaudeAnalysis, ValidatingClaudeAdapter } from "../../src/index.js";

const validAnalysis = {
  analysisId: "analysis-1",
  sentiment: "neutral",
  eventType: "earnings",
  impactScore: 50,
  confidence: 0.5,
  timeHorizon: "short",
  evidence: ["source-1"],
  risks: ["low confidence"],
  contradictions: [],
  requiresReview: true,
  schemaVersion: "ai-analysis-v1",
  model: "claude"
};

describe("Claude analysis schema validation", () => {
  it("accepts valid schema-shaped analysis", () => {
    const result = validateClaudeAnalysis(validAnalysis);

    expect(result.ok).toBe(true);
    expect(result.analysis?.analysisId).toBe("analysis-1");
  });

  it("rejects invalid score ranges and missing fields", () => {
    const result = validateClaudeAnalysis({
      ...validAnalysis,
      impactScore: 101,
      confidence: -0.1,
      evidence: "not-array"
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "impactScore_must_be_between_0_and_100",
        "confidence_must_be_between_0_and_1",
        "evidence_must_be_string_array"
      ])
    );
  });

  it("rejects executable broker command keys", () => {
    const result = validateClaudeAnalysis({
      ...validAnalysis,
      brokerCommand: {
        submitOrder: true
      }
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("forbidden_command_key_brokerCommand");
  });
});

describe("ValidatingClaudeAdapter", () => {
  it("returns successful adapter results for valid generated analysis", async () => {
    const adapter = new ValidatingClaudeAdapter({
      generate: async () => validAnalysis,
      now: () => new Date("2026-01-01T00:00:00Z")
    });

    const result = await adapter.analyze({
      promptTemplateId: "template-1",
      promptTemplateVersion: "1.0.0",
      inputReferences: ["news-1"],
      variables: {}
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.data.requiresReview).toBe(true);
  });

  it("returns non-retryable schema errors for invalid generated analysis", async () => {
    const adapter = new ValidatingClaudeAdapter({
      generate: async () => ({
        ...validAnalysis,
        submitOrder: true
      })
    });

    const result = await adapter.analyze({
      promptTemplateId: "template-1",
      promptTemplateVersion: "1.0.0",
      inputReferences: ["news-1"],
      variables: {}
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe("CLAUDE_SCHEMA_VALIDATION_FAILED");
    expect(!result.ok && result.error.retryable).toBe(false);
  });

  it("returns retryable adapter errors for generation failures", async () => {
    const adapter = new ValidatingClaudeAdapter({
      generate: async () => {
        throw new Error("network failure");
      }
    });

    const result = await adapter.analyze({
      promptTemplateId: "template-1",
      promptTemplateVersion: "1.0.0",
      inputReferences: ["news-1"],
      variables: {}
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.retryable).toBe(true);
  });
});
