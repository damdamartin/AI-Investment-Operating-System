import { describe, expect, it } from "vitest";
import {
  DEFAULT_KOREAN_COMPANY_AMBIGUITY_FIXTURES,
  DEFAULT_US_COVERAGE_GAP_FIXTURES,
  measureNaverNewsQuality,
  type NaverNewsRawItem
} from "../../../src/index.js";

const NOW = new Date("2026-07-27T00:00:00Z");

function item(overrides: Partial<Record<keyof NaverNewsRawItem, string | undefined>> = {}): NaverNewsRawItem {
  const merged: Record<string, string | undefined> = {
    title: "Sample title",
    originallink: "https://press.example.com/a",
    link: "https://news.naver.com/a",
    description: "Sample description",
    pubDate: "Mon, 27 Jul 2026 00:00:00 GMT",
    ...overrides
  };

  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(merged)) {
    if (value !== undefined) result[key] = value;
  }

  return result as NaverNewsRawItem;
}

describe("measureNaverNewsQuality", () => {
  it("never creates a trading signal or order and never increases trading conviction", () => {
    const report = measureNaverNewsQuality([item(), item(), item()], { now: NOW });

    expect(report.createsTradingSignal).toBe(false);
    expect(report.createsOrder).toBe(false);
    expect(report.increasesTradingConviction).toBe(false);
    expect(report.safetyType).toBe("NAVER_NEWS_QUALITY_REPORT_ONLY");
  });

  it("does not let duplicate volume flip the safety invariants even with many duplicates", () => {
    const duplicateItems = Array.from({ length: 50 }, () =>
      item({
        title: "Repeated headline",
        originallink: "https://press.example.com/repeat",
        link: "https://news.naver.com/repeat",
        pubDate: "Mon, 27 Jul 2026 00:00:00 GMT"
      })
    );

    const report = measureNaverNewsQuality(duplicateItems, { now: NOW });

    expect(report.metrics.duplicateArticleCount).toBe(49);
    expect(report.createsTradingSignal).toBe(false);
    expect(report.createsOrder).toBe(false);
    expect(report.increasesTradingConviction).toBe(false);
  });

  it("counts duplicate articles sharing the same duplicate key", () => {
    const report = measureNaverNewsQuality(
      [
        item({ title: "Same headline", originallink: "https://press.example.com/x", link: "https://news.naver.com/x" }),
        item({ title: "Same headline", originallink: "https://press.example.com/x", link: "https://news.naver.com/x" }),
        item({ title: "Different headline", originallink: "https://press.example.com/y", link: "https://news.naver.com/y" })
      ],
      { now: NOW }
    );

    expect(report.metrics.duplicateArticleCount).toBe(1);
    expect(report.metrics.normalizedArticleCount).toBe(3);
    expect(report.findings.some((finding) => finding.type === "DUPLICATE_ARTICLE")).toBe(true);
  });

  it("flags malformed or missing publication dates without dropping visibility into the raw item", () => {
    const report = measureNaverNewsQuality(
      [item({ pubDate: "not-a-real-date" }), item({ pubDate: undefined }), item()],
      { now: NOW }
    );

    expect(report.metrics.malformedOrMissingDateCount).toBe(2);
    expect(report.metrics.totalRawItems).toBe(3);
    expect(report.metrics.normalizedArticleCount).toBe(1);
    expect(
      report.findings.filter((finding) => finding.type === "MALFORMED_PUBLISHED_DATE").length
    ).toBe(2);
  });

  it("flags a missing required field separately from a malformed date", () => {
    const report = measureNaverNewsQuality([item({ title: undefined, link: undefined })], { now: NOW });

    expect(report.findings).toContainEqual(
      expect.objectContaining({ type: "MISSING_REQUIRED_FIELD" })
    );
    expect(report.metrics.malformedOrMissingDateCount).toBe(0);
  });

  it("flags an article collected long after it was published as an old resurfaced article", () => {
    const report = measureNaverNewsQuality(
      [item({ pubDate: "Mon, 01 Jun 2026 00:00:00 GMT" })],
      { now: NOW, resurfaceAfterMs: 24 * 60 * 60 * 1000 }
    );

    expect(report.metrics.oldResurfacedArticleCount).toBe(1);
    expect(report.findings.some((finding) => finding.type === "OLD_RESURFACED_ARTICLE")).toBe(true);
  });

  it("flags an article as resurfaced when its duplicate key was previously seen long ago", () => {
    // Same title/link/date combination as createNewsDuplicateKey would produce: "old story|https://press.example.com/old|2026-06-01".
    const previousItem = item({
      title: "Old story",
      originallink: "https://press.example.com/old",
      link: "https://news.naver.com/old",
      pubDate: "Mon, 01 Jun 2026 00:00:00 GMT"
    });
    const duplicateKey = "old story|https://press.example.com/old|2026-06-01";

    const report = measureNaverNewsQuality([previousItem], {
      now: NOW,
      previouslySeenDuplicateKeys: [duplicateKey],
      resurfaceAfterMs: 24 * 60 * 60 * 1000
    });

    expect(report.metrics.oldResurfacedArticleCount).toBe(1);
    expect(
      report.findings.some(
        (finding) =>
          finding.type === "OLD_RESURFACED_ARTICLE" &&
          finding.reason === "previously_seen_duplicate_key_reappeared_as_if_new"
      )
    ).toBe(true);
  });

  it("flags a malformed original link as weak URL consistency", () => {
    const report = measureNaverNewsQuality([item({ originallink: "not a url" })], { now: NOW });

    expect(report.metrics.weakUrlConsistencyCount).toBe(1);
    expect(report.findings.some((finding) => finding.type === "WEAK_URL_CONSISTENCY")).toBe(true);
  });

  it("flags weak source consistency when the original link cannot be distinguished from the aggregator link", () => {
    const report = measureNaverNewsQuality(
      [item({ originallink: "https://news.naver.com/a", link: "https://news.naver.com/a" })],
      { now: NOW }
    );

    expect(report.metrics.weakSourceConsistencyCount).toBe(1);
    expect(report.findings.some((finding) => finding.type === "WEAK_SOURCE_CONSISTENCY")).toBe(true);
  });

  it("does not flag weak source consistency when the original link points to a distinct publisher domain", () => {
    const report = measureNaverNewsQuality(
      [item({ originallink: "https://press.example.com/a", link: "https://news.naver.com/a" })],
      { now: NOW }
    );

    expect(report.metrics.weakSourceConsistencyCount).toBe(0);
  });

  it("emits Korean company ambiguity warnings using the default fixture examples", () => {
    const report = measureNaverNewsQuality(
      [item({ title: "SK 관련 소식", description: "SK 그룹 계열사 실적 발표" })],
      { now: NOW }
    );

    expect(report.koreanCompanyAmbiguityWarnings.length).toBeGreaterThan(0);
    expect(
      report.koreanCompanyAmbiguityWarnings.some((warning) => warning.key.includes("SK"))
    ).toBe(true);
    expect(DEFAULT_KOREAN_COMPANY_AMBIGUITY_FIXTURES.some((fixture) => fixture.alias === "SK")).toBe(true);
  });

  it("accepts caller-provided Korean company ambiguity fixtures instead of the defaults", () => {
    const report = measureNaverNewsQuality([item({ title: "Custom Alias mention", description: "" })], {
      now: NOW,
      koreanCompanyAmbiguityFixtures: [
        { alias: "Custom Alias", possibleCompanies: ["Company A", "Company B"], note: "test fixture" }
      ]
    });

    expect(report.koreanCompanyAmbiguityWarnings).toHaveLength(1);
    expect(report.koreanCompanyAmbiguityWarnings[0]?.key).toContain("Custom Alias");
  });

  it("emits U.S. coverage gap warnings when no article matches a default fixture symbol", () => {
    const report = measureNaverNewsQuality([item({ title: "국내 증시 마감", description: "코스피 상승" })], {
      now: NOW
    });

    expect(report.usCoverageGapWarnings.length).toBe(DEFAULT_US_COVERAGE_GAP_FIXTURES.length);
    expect(report.usCoverageGapWarnings.every((warning) => warning.type === "US_COVERAGE_GAP_WARNING")).toBe(true);
  });

  it("does not emit a U.S. coverage gap warning once a matching article is present", () => {
    const report = measureNaverNewsQuality(
      [item({ title: "Apple AAPL earnings beat expectations", description: "" })],
      { now: NOW, usCoverageGapFixtures: [{ symbol: "AAPL", keywords: ["apple", "aapl"], note: "test" }] }
    );

    expect(report.usCoverageGapWarnings).toHaveLength(0);
  });

  it("handles an empty input list safely without dividing by zero", () => {
    const report = measureNaverNewsQuality([], { now: NOW });

    expect(report.metrics.totalRawItems).toBe(0);
    expect(report.metrics.malformedOrMissingDateRate).toBe(0);
    expect(report.metrics.duplicateArticleRate).toBe(0);
  });
});
