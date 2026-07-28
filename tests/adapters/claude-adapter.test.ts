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

  describe("invalid JSON-like output rejection", () => {
    it("rejects raw string output that looks like JSON but was never parsed into an object", () => {
      const result = validateClaudeAnalysis('{"analysisId":"analysis-1","sentiment":"neutral"}');

      expect(result.ok).toBe(false);
      expect(result.errors).toEqual(["analysis_must_be_object"]);
    });

    it("rejects null output", () => {
      const result = validateClaudeAnalysis(null);

      expect(result.ok).toBe(false);
      expect(result.errors).toEqual(["analysis_must_be_object"]);
    });

    it("rejects array-shaped output", () => {
      const result = validateClaudeAnalysis([validAnalysis]);

      expect(result.ok).toBe(false);
      expect(result.errors).toEqual(["analysis_must_be_object"]);
    });

    it("rejects a JSON parse failure surfaced from the raw generation step", async () => {
      const adapter = new ValidatingClaudeAdapter({
        generate: async () => {
          // Simulates a raw Claude Messages API response whose text content
          // was not valid JSON, so the caller's JSON.parse threw before
          // reaching schema validation.
          JSON.parse("{not valid json");
          return undefined;
        }
      });

      const result = await adapter.analyze({
        promptTemplateId: "template-1",
        promptTemplateVersion: "1.0.0",
        inputReferences: ["news-1"],
        variables: {}
      });

      expect(result.ok).toBe(false);
      expect(!result.ok && result.error.code).toBe("CLAUDE_ADAPTER_ERROR");
      expect(!result.ok && result.error.retryable).toBe(true);
    });
  });

  describe("missing confidence rejection", () => {
    it("rejects output with confidence entirely absent", () => {
      const { confidence: _confidence, ...withoutConfidence } = validAnalysis;
      const result = validateClaudeAnalysis(withoutConfidence);

      expect(result.ok).toBe(false);
      expect(result.errors).toContain("confidence_must_be_between_0_and_1");
    });

    it("rejects output with confidence explicitly null", () => {
      const result = validateClaudeAnalysis({ ...validAnalysis, confidence: null });

      expect(result.ok).toBe(false);
      expect(result.errors).toContain("confidence_must_be_between_0_and_1");
    });

    it("rejects confidence expressed as a string", () => {
      const result = validateClaudeAnalysis({ ...validAnalysis, confidence: "0.5" });

      expect(result.ok).toBe(false);
      expect(result.errors).toContain("confidence_must_be_between_0_and_1");
    });
  });

  describe("unsupported enum value rejection", () => {
    it("rejects unsupported sentiment values", () => {
      const result = validateClaudeAnalysis({ ...validAnalysis, sentiment: "very_bullish" });

      expect(result.ok).toBe(false);
      expect(result.errors).toContain("sentiment_has_unsupported_value");
    });

    it("rejects unsupported time horizon values", () => {
      const result = validateClaudeAnalysis({ ...validAnalysis, timeHorizon: "eternal" });

      expect(result.ok).toBe(false);
      expect(result.errors).toContain("timeHorizon_has_unsupported_value");
    });

    it("does not accept case-mismatched enum values", () => {
      const result = validateClaudeAnalysis({ ...validAnalysis, sentiment: "NEUTRAL" });

      expect(result.ok).toBe(false);
      expect(result.errors).toContain("sentiment_has_unsupported_value");
    });
  });

  describe("requires_review behavior", () => {
    it("accepts requiresReview=true alongside contradictions and stores it verbatim", () => {
      const result = validateClaudeAnalysis({
        ...validAnalysis,
        requiresReview: true,
        contradictions: ["volume did not confirm the move"]
      });

      expect(result.ok).toBe(true);
      expect(result.analysis?.requiresReview).toBe(true);
      expect(result.analysis?.contradictions).toEqual(["volume did not confirm the move"]);
    });

    it("accepts requiresReview=false when no contradictions are present", () => {
      const result = validateClaudeAnalysis({ ...validAnalysis, requiresReview: false });

      expect(result.ok).toBe(true);
      expect(result.analysis?.requiresReview).toBe(false);
    });

    it("rejects a non-boolean requiresReview flag rather than coercing it", () => {
      const result = validateClaudeAnalysis({ ...validAnalysis, requiresReview: "true" });

      expect(result.ok).toBe(false);
      expect(result.errors).toContain("requiresReview_must_be_boolean");
    });
  });

  describe("contradictions handling", () => {
    it("rejects a non-array contradictions field", () => {
      const result = validateClaudeAnalysis({ ...validAnalysis, contradictions: "none" });

      expect(result.ok).toBe(false);
      expect(result.errors).toContain("contradictions_must_be_string_array");
    });

    it("rejects contradictions containing non-string entries", () => {
      const result = validateClaudeAnalysis({
        ...validAnalysis,
        contradictions: ["ok", { note: "not a string" }]
      });

      expect(result.ok).toBe(false);
      expect(result.errors).toContain("contradictions_must_be_string_array");
    });

    it("preserves multiple contradiction entries in order", () => {
      const result = validateClaudeAnalysis({
        ...validAnalysis,
        contradictions: ["signal A conflicts with signal B", "source reliability is unclear"]
      });

      expect(result.ok).toBe(true);
      expect(result.analysis?.contradictions).toEqual([
        "signal A conflicts with signal B",
        "source reliability is unclear"
      ]);
    });
  });

  describe("unknown field handling", () => {
    it("ignores benign unknown top-level fields without leaking them into the validated analysis", () => {
      const result = validateClaudeAnalysis({
        ...validAnalysis,
        experimentalNote: "not part of the schema"
      });

      expect(result.ok).toBe(true);
      expect(result.analysis).not.toHaveProperty("experimentalNote");
      expect(Object.keys(result.analysis ?? {})).not.toContain("experimentalNote");
    });

    it("rejects a forbidden command key nested inside an otherwise-benign unknown field", () => {
      // A Claude response could try to smuggle an executable broker command
      // inside a field the schema does not know about (e.g. "debugInfo").
      // The whole analysis must be rejected outright, not silently trimmed.
      const result = validateClaudeAnalysis({
        ...validAnalysis,
        debugInfo: {
          traceId: "trace-1",
          suggestedAction: {
            submitOrder: { assetId: "asset-1", side: "BUY" }
          }
        }
      });

      expect(result.ok).toBe(false);
      expect(result.errors).toContain("forbidden_command_key_submitOrder");
    });

    it("rejects a forbidden replaceOrder key at any nesting depth", () => {
      const result = validateClaudeAnalysis({
        ...validAnalysis,
        analysisMeta: { followUp: { replaceOrder: { orderId: "order-1" } } }
      });

      expect(result.ok).toBe(false);
      expect(result.errors).toContain("forbidden_command_key_replaceOrder");
    });

    it("rejects a forbidden command key hidden inside an array", () => {
      const result = validateClaudeAnalysis({
        ...validAnalysis,
        evidence: ["source-1"],
        relatedActions: [{ cancelOrder: { orderId: "order-1" } }]
      });

      expect(result.ok).toBe(false);
      expect(result.errors).toContain("forbidden_command_key_cancelOrder");
    });
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

  it("rejects low-confidence output the same way as any other schema-valid output (never boosted)", async () => {
    const adapter = new ValidatingClaudeAdapter({
      generate: async () => ({ ...validAnalysis, confidence: 0.02, requiresReview: true })
    });

    const result = await adapter.analyze({
      promptTemplateId: "template-1",
      promptTemplateVersion: "1.0.0",
      inputReferences: ["news-1"],
      variables: {}
    });

    expect(result.ok).toBe(true);
    // The adapter must persist the confidence value exactly as validated; it
    // must never round up, clamp upward, or otherwise increase conviction.
    expect(result.ok && result.data.confidence).toBe(0.02);
    expect(result.ok && result.data.requiresReview).toBe(true);
  });

  it("never returns an adapter result shaped like an executable broker command", async () => {
    const adapter = new ValidatingClaudeAdapter({
      generate: async () => validAnalysis
    });

    const result = await adapter.analyze({
      promptTemplateId: "template-1",
      promptTemplateVersion: "1.0.0",
      inputReferences: ["news-1"],
      variables: {}
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).not.toHaveProperty("order");
      expect(result.data).not.toHaveProperty("submitOrder");
      expect(result.data).not.toHaveProperty("brokerCommand");
    }
  });

  it("attaches CLAUDE provider metadata (model and adapter-level metadata references)", async () => {
    const adapter = new ValidatingClaudeAdapter({
      generate: async () => validAnalysis,
      now: () => new Date("2026-01-01T00:00:00Z")
    });

    const result = await adapter.analyze({
      promptTemplateId: "news-event-template",
      promptTemplateVersion: "2.3.0",
      inputReferences: ["news-1"],
      variables: {}
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.metadata.provider).toBe("CLAUDE");
      expect(result.metadata.collectedAt).toEqual(new Date("2026-01-01T00:00:00Z"));
      expect(result.data.model).toBe("claude");
      expect(result.data.schemaVersion).toBe("ai-analysis-v1");
    }
  });

  it("tags schema validation failures with CLAUDE provider metadata for audit", async () => {
    const adapter = new ValidatingClaudeAdapter({
      generate: async () => ({ ...validAnalysis, confidence: 5 })
    });

    const result = await adapter.analyze({
      promptTemplateId: "template-1",
      promptTemplateVersion: "1.0.0",
      inputReferences: ["news-1"],
      variables: {}
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.metadata?.provider).toBe("CLAUDE");
      expect(result.error.code).toBe("CLAUDE_SCHEMA_VALIDATION_FAILED");
    }
  });
});
