import { describe, expect, it } from "vitest";
import { normalizeNewsEventCandidates, type NormalizedNewsArticle } from "../../src/index.js";

const collectedAt = new Date("2026-01-01T00:05:00Z");

describe("normalizeNewsEventCandidates", () => {
  it("groups duplicate articles into one event candidate", () => {
    const candidates = normalizeNewsEventCandidates(
      [
        article({ title: "Apple earnings", duplicateKey: "apple|2026-01-01" }),
        article({ title: "Apple earnings repeated", duplicateKey: "apple|2026-01-01" })
      ],
      {
        now: new Date("2026-01-01T00:10:00Z"),
        staleAfterMs: 60 * 60 * 1000,
        symbolAliases: [{ symbol: "AAPL", aliases: ["Apple"] }]
      }
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.articles).toHaveLength(2);
    expect(candidates[0]?.companyReferences[0]).toMatchObject({
      resolution: "RESOLVED",
      symbols: ["AAPL"]
    });
    expect(candidates[0]?.safetyType).toBe("NEWS_EVENT_CANDIDATE_ONLY");
  });

  it("flags old news as stale", () => {
    const candidates = normalizeNewsEventCandidates(
      [
        article({
          title: "Old market story",
          publishedAt: new Date("2026-01-01T00:00:00Z")
        })
      ],
      {
        now: new Date("2026-01-02T00:00:00Z"),
        staleAfterMs: 60 * 60 * 1000
      }
    );

    expect(candidates[0]?.stale).toBe(true);
  });

  it("keeps ambiguous company references unresolved instead of guessing", () => {
    const candidates = normalizeNewsEventCandidates(
      [article({ title: "ABC announces major contract" })],
      {
        now: new Date("2026-01-01T00:10:00Z"),
        staleAfterMs: 60 * 60 * 1000,
        symbolAliases: [
          { symbol: "ABC", aliases: ["ABC"] },
          { symbol: "ABCI", aliases: ["ABC"] }
        ]
      }
    );

    expect(candidates[0]?.companyReferences).toEqual([
      {
        alias: "abc",
        resolution: "AMBIGUOUS",
        symbols: ["ABC", "ABCI"]
      }
    ]);
  });

  it("marks invalid timestamp ordering as stale and invalid", () => {
    const candidates = normalizeNewsEventCandidates(
      [
        article({
          collectedAt: new Date("2026-01-01T00:00:00Z"),
          publishedAt: new Date("2026-01-01T00:05:00Z")
        })
      ],
      {
        now: new Date("2026-01-01T00:10:00Z"),
        staleAfterMs: 60 * 60 * 1000
      }
    );

    expect(candidates[0]?.validTimestamps).toBe(false);
    expect(candidates[0]?.stale).toBe(true);
  });

  it("extracts keyword references without creating trading signals", () => {
    const candidates = normalizeNewsEventCandidates(
      [article({ title: "ETF inflow rises after rate cut" })],
      {
        now: new Date("2026-01-01T00:10:00Z"),
        staleAfterMs: 60 * 60 * 1000,
        keywords: ["ETF", "rate cut", "unmatched"]
      }
    );

    expect(candidates[0]?.keywordReferences).toEqual(["etf", "rate cut"]);
    expect(candidates[0]).not.toHaveProperty("direction");
    expect(candidates[0]).not.toHaveProperty("order");
  });
});

function article(overrides: Partial<NormalizedNewsArticle>): NormalizedNewsArticle {
  return {
    provider: "NAVER_NEWS",
    title: "Apple earnings",
    description: "",
    originalLink: "https://example.com/news",
    providerLink: "https://news.naver.com/news",
    publishedAt: new Date("2026-01-01T00:00:00Z"),
    collectedAt,
    duplicateKey: "default-key",
    ...overrides
  };
}
