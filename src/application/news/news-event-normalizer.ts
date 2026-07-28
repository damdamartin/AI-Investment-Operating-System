import type { NormalizedNewsArticle } from "../../adapters/contracts/index.js";

export type NewsReferenceResolution = "RESOLVED" | "AMBIGUOUS" | "UNRESOLVED";

export interface NewsSymbolAlias {
  symbol: string;
  aliases: string[];
}

export interface NewsEventNormalizationOptions {
  now: Date;
  staleAfterMs: number;
  symbolAliases?: NewsSymbolAlias[];
  keywords?: string[];
}

export interface NewsCompanyReference {
  alias: string;
  resolution: NewsReferenceResolution;
  symbols: string[];
}

export interface NewsEventCandidate {
  eventId: string;
  duplicateKey: string;
  articles: NormalizedNewsArticle[];
  title: string;
  publishedAt: Date;
  collectedAt: Date;
  companyReferences: NewsCompanyReference[];
  keywordReferences: string[];
  stale: boolean;
  validTimestamps: boolean;
  safetyType: "NEWS_EVENT_CANDIDATE_ONLY";
}

export function normalizeNewsEventCandidates(
  articles: NormalizedNewsArticle[],
  options: NewsEventNormalizationOptions
): NewsEventCandidate[] {
  const groups = new Map<string, NormalizedNewsArticle[]>();

  for (const article of articles) {
    const group = groups.get(article.duplicateKey) ?? [];
    group.push(article);
    groups.set(article.duplicateKey, group);
  }

  return [...groups.entries()].map(([duplicateKey, group]) =>
    createCandidate(duplicateKey, group, options)
  );
}

function createCandidate(
  duplicateKey: string,
  articles: NormalizedNewsArticle[],
  options: NewsEventNormalizationOptions
): NewsEventCandidate {
  const sorted = [...articles].sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime());
  const primary = sorted[0]!;
  const text = sorted.map((article) => `${article.title} ${article.description}`).join(" ");
  const validTimestamps = sorted.every(
    (article) =>
      Number.isFinite(article.publishedAt.getTime()) &&
      Number.isFinite(article.collectedAt.getTime()) &&
      article.collectedAt.getTime() >= article.publishedAt.getTime()
  );
  const newestPublishedAt = new Date(Math.max(...sorted.map((article) => article.publishedAt.getTime())));
  const newestCollectedAt = new Date(Math.max(...sorted.map((article) => article.collectedAt.getTime())));

  return {
    eventId: `news-event:${duplicateKey}`,
    duplicateKey,
    articles: sorted,
    title: primary.title,
    publishedAt: newestPublishedAt,
    collectedAt: newestCollectedAt,
    companyReferences: extractCompanyReferences(text, options.symbolAliases ?? []),
    keywordReferences: extractKeywordReferences(text, options.keywords ?? []),
    stale: !validTimestamps || options.now.getTime() - newestPublishedAt.getTime() > options.staleAfterMs,
    validTimestamps,
    safetyType: "NEWS_EVENT_CANDIDATE_ONLY"
  };
}

function extractCompanyReferences(text: string, symbolAliases: NewsSymbolAlias[]): NewsCompanyReference[] {
  const normalizedText = text.toLowerCase();
  const aliasMap = new Map<string, Set<string>>();

  for (const item of symbolAliases) {
    for (const alias of item.aliases) {
      const normalizedAlias = alias.toLowerCase().trim();
      if (normalizedAlias === "") continue;
      const symbols = aliasMap.get(normalizedAlias) ?? new Set<string>();
      symbols.add(item.symbol);
      aliasMap.set(normalizedAlias, symbols);
    }
  }

  const references: NewsCompanyReference[] = [];

  for (const [alias, symbols] of aliasMap.entries()) {
    if (!normalizedText.includes(alias)) continue;
    const symbolList = [...symbols].sort();

    references.push({
      alias,
      symbols: symbolList,
      resolution: symbolList.length === 1 ? "RESOLVED" : "AMBIGUOUS"
    });
  }

  if (references.length === 0) {
    return [
      {
        alias: "",
        symbols: [],
        resolution: "UNRESOLVED"
      }
    ];
  }

  return references.sort((a, b) => a.alias.localeCompare(b.alias));
}

function extractKeywordReferences(text: string, keywords: string[]): string[] {
  const normalizedText = text.toLowerCase();
  return [...new Set(
    keywords
      .map((keyword) => keyword.toLowerCase().trim())
      .filter((keyword) => keyword !== "" && normalizedText.includes(keyword))
  )].sort();
}
