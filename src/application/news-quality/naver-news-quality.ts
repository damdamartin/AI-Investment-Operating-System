import type { NormalizedNewsArticle } from "../../adapters/contracts/index.js";
import { normalizeNaverNewsItem, type NaverNewsRawItem } from "../../adapters/naver/naver-news-adapter.js";

/**
 * Fixture-based Naver News data quality measurement.
 *
 * This module is analysis metadata only. It must never be used to create a
 * trading signal or an order, and duplicate or stale news must never be able
 * to increase trading conviction. See docs/11_AI_RULES.md Rule 2 and Rule 8,
 * and docs/reviews/Codex_Phase5_Architecture_Review.md finding M1.
 *
 * All functions here are pure and operate only on data passed in by the
 * caller (fixtures in tests). Nothing in this file performs network calls.
 */

export type NaverNewsQualityFindingType =
  | "MALFORMED_PUBLISHED_DATE"
  | "MISSING_REQUIRED_FIELD"
  | "DUPLICATE_ARTICLE"
  | "OLD_RESURFACED_ARTICLE"
  | "WEAK_URL_CONSISTENCY"
  | "WEAK_SOURCE_CONSISTENCY"
  | "KOREAN_COMPANY_AMBIGUITY_WARNING"
  | "US_COVERAGE_GAP_WARNING";

export type NaverNewsQualityFindingSeverity = "INFO" | "WARNING" | "ERROR";

export interface NaverNewsQualityFinding {
  type: NaverNewsQualityFindingType;
  severity: NaverNewsQualityFindingSeverity;
  key: string;
  reason: string;
}

export interface KoreanCompanyAmbiguityFixture {
  alias: string;
  possibleCompanies: string[];
  note: string;
}

export interface USCoverageGapFixture {
  symbol: string;
  keywords: string[];
  note: string;
}

/**
 * Example warning fixtures for Korean company name ambiguity. These are
 * illustrative examples (not a complete registry) of aliases that map to
 * more than one separately listed company, so a naive text match on the
 * alias alone cannot safely resolve a single ticker.
 */
export const DEFAULT_KOREAN_COMPANY_AMBIGUITY_FIXTURES: readonly KoreanCompanyAmbiguityFixture[] = [
  {
    alias: "SK",
    possibleCompanies: ["SK하이닉스", "SK이노베이션", "SK텔레콤", "SK스퀘어"],
    note: "SK alone is ambiguous across multiple separately listed SK Group affiliates."
  },
  {
    alias: "삼성",
    possibleCompanies: ["삼성전자", "삼성SDI", "삼성물산", "삼성바이오로직스"],
    note: "The Samsung group alias spans several independently listed affiliates."
  },
  {
    alias: "카카오",
    possibleCompanies: ["카카오", "카카오뱅크", "카카오페이", "카카오게임즈"],
    note: "The Kakao alias spans the parent company and separately listed spin-offs."
  },
  {
    alias: "현대",
    possibleCompanies: ["현대차", "현대모비스", "현대건설", "현대중공업"],
    note: "The Hyundai alias spans multiple unrelated Hyundai-affiliated listings."
  }
];

/**
 * Example warning fixtures for U.S. stock/ETF coverage gaps. Naver News is
 * Korean-language oriented, so even well-known U.S. tickers and ETFs may be
 * sparsely or inconsistently covered. These are illustrative defaults used
 * to demonstrate the coverage-gap check; callers should pass their own
 * `usCoverageGapFixtures` for real query targets.
 */
export const DEFAULT_US_COVERAGE_GAP_FIXTURES: readonly USCoverageGapFixture[] = [
  {
    symbol: "AAPL",
    keywords: ["apple", "aapl"],
    note: "U.S. large-cap coverage on Naver News may still be sparse or delayed relative to Korean-market coverage."
  },
  {
    symbol: "SPY",
    keywords: ["spy", "s&p 500 etf"],
    note: "Broad U.S. index ETFs are frequently underrepresented in Naver News search results."
  },
  {
    symbol: "QQQ",
    keywords: ["qqq", "nasdaq 100 etf"],
    note: "Sector or thematic U.S. ETFs may have minimal Korean-language coverage."
  }
];

const AGGREGATOR_HOSTS = new Set(["news.naver.com", "n.news.naver.com", "m.news.naver.com"]);

export interface NaverNewsQualityOptions {
  now: Date;
  /** Age gap (published -> collected) beyond which an article is treated as resurfaced. Default 3 days. */
  resurfaceAfterMs?: number;
  /** Duplicate keys observed in a prior collection run, injected by the caller (fixture, never a live store). */
  previouslySeenDuplicateKeys?: readonly string[];
  koreanCompanyAmbiguityFixtures?: readonly KoreanCompanyAmbiguityFixture[];
  usCoverageGapFixtures?: readonly USCoverageGapFixture[];
}

export interface NaverNewsQualityMetrics {
  totalRawItems: number;
  normalizedArticleCount: number;
  malformedOrMissingDateCount: number;
  malformedOrMissingDateRate: number;
  duplicateArticleCount: number;
  duplicateArticleRate: number;
  oldResurfacedArticleCount: number;
  weakUrlConsistencyCount: number;
  weakSourceConsistencyCount: number;
}

export interface NaverNewsQualityReport {
  id: string;
  generatedAt: Date;
  metrics: NaverNewsQualityMetrics;
  findings: NaverNewsQualityFinding[];
  koreanCompanyAmbiguityWarnings: NaverNewsQualityFinding[];
  usCoverageGapWarnings: NaverNewsQualityFinding[];
  /** Hard safety invariants. These must always be false for this report type. */
  createsTradingSignal: false;
  createsOrder: false;
  increasesTradingConviction: false;
  safetyType: "NAVER_NEWS_QUALITY_REPORT_ONLY";
}

/**
 * Measures fixture-based Naver News data quality from raw (pre-normalization)
 * search items so malformed items that the adapter silently drops are still
 * visible to the quality report. Performs no network calls and requires no
 * credentials.
 */
export function measureNaverNewsQuality(
  rawItems: readonly NaverNewsRawItem[],
  options: NaverNewsQualityOptions
): NaverNewsQualityReport {
  const resurfaceAfterMs = options.resurfaceAfterMs ?? 3 * 24 * 60 * 60 * 1000;
  const previouslySeen = new Set(options.previouslySeenDuplicateKeys ?? []);
  const findings: NaverNewsQualityFinding[] = [];

  const { normalizedArticles, malformedOrMissingDateCount } = normalizeAndClassify(rawItems, options.now, findings);

  const duplicateArticleCount = detectDuplicates(normalizedArticles, findings);
  const oldResurfacedArticleCount = detectOldResurfacedArticles(
    normalizedArticles,
    options.now,
    resurfaceAfterMs,
    previouslySeen,
    findings
  );
  const { weakUrlConsistencyCount, weakSourceConsistencyCount } = detectUrlAndSourceConsistency(
    normalizedArticles,
    findings
  );

  const koreanCompanyAmbiguityWarnings = detectKoreanCompanyAmbiguity(
    normalizedArticles,
    options.koreanCompanyAmbiguityFixtures ?? DEFAULT_KOREAN_COMPANY_AMBIGUITY_FIXTURES
  );
  const usCoverageGapWarnings = detectUSCoverageGaps(
    normalizedArticles,
    options.usCoverageGapFixtures ?? DEFAULT_US_COVERAGE_GAP_FIXTURES
  );
  findings.push(...koreanCompanyAmbiguityWarnings, ...usCoverageGapWarnings);

  const totalRawItems = rawItems.length;
  const normalizedArticleCount = normalizedArticles.length;

  return {
    id: `naver-news-quality:${options.now.toISOString()}`,
    generatedAt: options.now,
    metrics: {
      totalRawItems,
      normalizedArticleCount,
      malformedOrMissingDateCount,
      malformedOrMissingDateRate: totalRawItems === 0 ? 0 : malformedOrMissingDateCount / totalRawItems,
      duplicateArticleCount,
      duplicateArticleRate: normalizedArticleCount === 0 ? 0 : duplicateArticleCount / normalizedArticleCount,
      oldResurfacedArticleCount,
      weakUrlConsistencyCount,
      weakSourceConsistencyCount
    },
    findings,
    koreanCompanyAmbiguityWarnings,
    usCoverageGapWarnings,
    createsTradingSignal: false,
    createsOrder: false,
    increasesTradingConviction: false,
    safetyType: "NAVER_NEWS_QUALITY_REPORT_ONLY"
  };
}

function normalizeAndClassify(
  rawItems: readonly NaverNewsRawItem[],
  now: Date,
  findings: NaverNewsQualityFinding[]
): { normalizedArticles: NormalizedNewsArticle[]; malformedOrMissingDateCount: number } {
  const normalizedArticles: NormalizedNewsArticle[] = [];
  let malformedOrMissingDateCount = 0;

  for (const [index, item] of rawItems.entries()) {
    const article = normalizeNaverNewsItem(item, now);
    if (article) {
      normalizedArticles.push(article);
      continue;
    }

    const type = classifyMalformedRawItem(item);
    if (type === "MALFORMED_PUBLISHED_DATE") {
      malformedOrMissingDateCount += 1;
    }

    findings.push({
      type,
      severity: "WARNING",
      key: `raw-item-${index}`,
      reason: type === "MALFORMED_PUBLISHED_DATE" ? "unparseable_or_missing_publication_date" : "missing_required_field"
    });
  }

  return { normalizedArticles, malformedOrMissingDateCount };
}

function classifyMalformedRawItem(item: NaverNewsRawItem): "MALFORMED_PUBLISHED_DATE" | "MISSING_REQUIRED_FIELD" {
  if (!item.title || !item.link) return "MISSING_REQUIRED_FIELD";
  if (!item.pubDate) return "MALFORMED_PUBLISHED_DATE";
  return Number.isNaN(new Date(item.pubDate).getTime()) ? "MALFORMED_PUBLISHED_DATE" : "MISSING_REQUIRED_FIELD";
}

function detectDuplicates(articles: readonly NormalizedNewsArticle[], findings: NaverNewsQualityFinding[]): number {
  const byDuplicateKey = new Map<string, NormalizedNewsArticle[]>();

  for (const article of articles) {
    const group = byDuplicateKey.get(article.duplicateKey) ?? [];
    group.push(article);
    byDuplicateKey.set(article.duplicateKey, group);
  }

  let duplicateArticleCount = 0;

  for (const [duplicateKey, group] of byDuplicateKey.entries()) {
    if (group.length <= 1) continue;
    duplicateArticleCount += group.length - 1;
    findings.push({
      type: "DUPLICATE_ARTICLE",
      severity: "INFO",
      key: duplicateKey,
      reason: `duplicate_article_group_size_${group.length}`
    });
  }

  return duplicateArticleCount;
}

function detectOldResurfacedArticles(
  articles: readonly NormalizedNewsArticle[],
  now: Date,
  resurfaceAfterMs: number,
  previouslySeen: ReadonlySet<string>,
  findings: NaverNewsQualityFinding[]
): number {
  let oldResurfacedArticleCount = 0;

  for (const article of articles) {
    const publishToCollectGapMs = article.collectedAt.getTime() - article.publishedAt.getTime();
    const resurfacedByGap = publishToCollectGapMs > resurfaceAfterMs;
    const resurfacedByPriorSighting =
      previouslySeen.has(article.duplicateKey) && now.getTime() - article.publishedAt.getTime() > resurfaceAfterMs;

    if (!resurfacedByGap && !resurfacedByPriorSighting) continue;

    oldResurfacedArticleCount += 1;
    findings.push({
      type: "OLD_RESURFACED_ARTICLE",
      severity: "WARNING",
      key: article.duplicateKey,
      reason: resurfacedByPriorSighting
        ? "previously_seen_duplicate_key_reappeared_as_if_new"
        : "collected_long_after_published"
    });
  }

  return oldResurfacedArticleCount;
}

function detectUrlAndSourceConsistency(
  articles: readonly NormalizedNewsArticle[],
  findings: NaverNewsQualityFinding[]
): { weakUrlConsistencyCount: number; weakSourceConsistencyCount: number } {
  let weakUrlConsistencyCount = 0;
  let weakSourceConsistencyCount = 0;

  for (const article of articles) {
    const originalHost = parseHost(article.originalLink);

    if (!originalHost) {
      weakUrlConsistencyCount += 1;
      findings.push({
        type: "WEAK_URL_CONSISTENCY",
        severity: "WARNING",
        key: article.duplicateKey,
        reason: "original_link_not_a_valid_url"
      });
      continue;
    }

    const providerHost = parseHost(article.providerLink);
    if (providerHost && originalHost === providerHost && AGGREGATOR_HOSTS.has(providerHost)) {
      weakSourceConsistencyCount += 1;
      findings.push({
        type: "WEAK_SOURCE_CONSISTENCY",
        severity: "INFO",
        key: article.duplicateKey,
        reason: "original_link_not_distinguishable_from_aggregator_link"
      });
    }
  }

  return { weakUrlConsistencyCount, weakSourceConsistencyCount };
}

function parseHost(url: string): string | undefined {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

function detectKoreanCompanyAmbiguity(
  articles: readonly NormalizedNewsArticle[],
  fixtures: readonly KoreanCompanyAmbiguityFixture[]
): NaverNewsQualityFinding[] {
  const findings: NaverNewsQualityFinding[] = [];

  for (const article of articles) {
    const text = `${article.title} ${article.description}`;

    for (const fixture of fixtures) {
      if (!text.includes(fixture.alias)) continue;

      findings.push({
        type: "KOREAN_COMPANY_AMBIGUITY_WARNING",
        severity: "WARNING",
        key: `${article.duplicateKey}:${fixture.alias}`,
        reason: `ambiguous_alias_${fixture.alias}_maps_to_${fixture.possibleCompanies.length}_companies`
      });
    }
  }

  return findings;
}

function detectUSCoverageGaps(
  articles: readonly NormalizedNewsArticle[],
  fixtures: readonly USCoverageGapFixture[]
): NaverNewsQualityFinding[] {
  const findings: NaverNewsQualityFinding[] = [];

  for (const fixture of fixtures) {
    const matched = articles.some((article) => {
      const text = `${article.title} ${article.description}`.toLowerCase();
      return fixture.keywords.some((keyword) => text.includes(keyword.toLowerCase()));
    });

    if (matched) continue;

    findings.push({
      type: "US_COVERAGE_GAP_WARNING",
      severity: "WARNING",
      key: fixture.symbol,
      reason: "no_matching_articles_found_for_us_symbol_or_etf"
    });
  }

  return findings;
}
