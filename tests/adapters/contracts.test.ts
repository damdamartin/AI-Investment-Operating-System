import { describe, expect, it } from "vitest";
import type {
  AdapterResult,
  ClaudeAIAdapter,
  NewsProviderAdapter,
  TossReadOnlyAdapter,
  TossWriteAdapter
} from "../../src/index.js";

describe("adapter interface contracts", () => {
  it("allows read-only Toss adapters to be replaced with fakes", async () => {
    const adapter: TossReadOnlyAdapter = {
      async getCapabilities() {
        return ok([
          {
            capability: "ACCOUNT_BALANCE_QUERY",
            status: "SUPPORTED",
            checkedAt: new Date("2026-01-01T00:00:00Z")
          },
          {
            capability: "US_STOCK_LIMIT_ORDER",
            status: "UNVERIFIED",
            checkedAt: new Date("2026-01-01T00:00:00Z")
          }
        ]);
      },
      async getAccountSnapshot() {
        return ok({
          brokerAccountId: "broker-account-1",
          permissionStatus: "UNVERIFIED",
          readOnlyEnabled: true,
          liveTradingEnabled: false,
          checkedAt: new Date("2026-01-01T00:00:00Z")
        });
      },
      async getPositions() {
        return ok([]);
      }
    };

    const capabilities = await adapter.getCapabilities();

    expect(capabilities.ok).toBe(true);
    expect(capabilities.ok && capabilities.data[1]?.status).toBe("UNVERIFIED");
  });

  it("keeps Toss write adapter contract separate from read-only contract", () => {
    const readOnlyKeys: Array<keyof TossReadOnlyAdapter> = [
      "getCapabilities",
      "getAccountSnapshot",
      "getPositions"
    ];
    const writeKeys: Array<keyof TossWriteAdapter> = ["submitOrder", "cancelOrder"];

    expect(readOnlyKeys).not.toContain(writeKeys[0]);
    expect(readOnlyKeys).not.toContain(writeKeys[1]);
  });

  it("allows Naver news adapter fakes without trading behavior", async () => {
    const adapter: NewsProviderAdapter = {
      async search() {
        return ok([
          {
            provider: "NAVER_NEWS",
            title: "Example",
            description: "Example news",
            originalLink: "https://example.com/original",
            providerLink: "https://example.com/provider",
            publishedAt: new Date("2026-01-01T00:00:00Z"),
            collectedAt: new Date("2026-01-01T00:01:00Z"),
            duplicateKey: "example-key"
          }
        ]);
      }
    };

    const result = await adapter.search({ query: "AAPL" });

    expect(result.ok && result.data[0]?.provider).toBe("NAVER_NEWS");
  });

  it("keeps Claude analysis advisory and schema-shaped", async () => {
    const adapter: ClaudeAIAdapter = {
      async analyze() {
        return ok({
          analysisId: "analysis-1",
          sentiment: "neutral",
          eventType: "earnings",
          impactScore: 50,
          confidence: 0.5,
          timeHorizon: "short",
          evidence: [],
          risks: ["insufficient evidence"],
          contradictions: [],
          requiresReview: true,
          schemaVersion: "ai-analysis-v1",
          model: "claude"
        });
      }
    };

    const result = await adapter.analyze({
      promptTemplateId: "template-1",
      promptTemplateVersion: "1.0.0",
      inputReferences: ["news-1"],
      variables: {}
    });

    expect(result.ok && result.data.requiresReview).toBe(true);
    expect(result.ok && result.data).not.toHaveProperty("order");
    expect(result.ok && result.data).not.toHaveProperty("brokerCommand");
  });
});

function ok<T>(data: T): AdapterResult<T> {
  return {
    ok: true,
    data,
    metadata: {
      provider: "CLAUDE",
      collectedAt: new Date("2026-01-01T00:00:00Z")
    }
  };
}
