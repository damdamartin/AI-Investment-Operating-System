import type { AdapterMetadata, AdapterResult, NewsProviderAdapter, NewsSearchQuery, NormalizedNewsArticle } from "../contracts/index.js";

export interface NaverNewsRawItem {
  title?: string;
  originallink?: string;
  link?: string;
  description?: string;
  pubDate?: string;
}

export interface NaverNewsRawResponse {
  items?: NaverNewsRawItem[];
}

export type FetchLike = (url: string, init: { headers: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export interface NaverNewsAdapterOptions {
  clientId: string;
  clientSecret: string;
  fetch: FetchLike;
  endpoint?: string;
  now?: () => Date;
}

export class NaverNewsAdapter implements NewsProviderAdapter {
  private readonly endpoint: string;
  private readonly now: () => Date;

  constructor(private readonly options: NaverNewsAdapterOptions) {
    this.endpoint = options.endpoint ?? "https://openapi.naver.com/v1/search/news.json";
    this.now = options.now ?? (() => new Date());
  }

  async search(query: NewsSearchQuery): Promise<AdapterResult<NormalizedNewsArticle[]>> {
    const collectedAt = this.now();
    const startedAt = Date.now();
    const url = buildSearchUrl(this.endpoint, query);

    try {
      const response = await this.options.fetch(url, {
        headers: {
          "X-Naver-Client-Id": this.options.clientId,
          "X-Naver-Client-Secret": this.options.clientSecret
        }
      });
      const metadata = metadataFor(collectedAt, startedAt);

      if (!response.ok) {
        return {
          ok: false,
          error: {
            provider: "NAVER_NEWS",
            code: `HTTP_${response.status}`,
            message: "Naver News API request failed.",
            retryable: response.status >= 500 || response.status === 429,
            metadata
          }
        };
      }

      const raw = responseToRaw(await response.json());
      const articles: NormalizedNewsArticle[] = [];

      for (const item of raw.items ?? []) {
        const article = normalizeNaverNewsItem(item, collectedAt);
        if (article) articles.push(article);
      }

      return {
        ok: true,
        data: articles,
        metadata
      };
    } catch (error) {
      return {
        ok: false,
        error: {
          provider: "NAVER_NEWS",
          code: "NAVER_NEWS_ADAPTER_ERROR",
          message: error instanceof Error ? error.message : "Unknown Naver News adapter error.",
          retryable: true,
          metadata: metadataFor(collectedAt, startedAt)
        }
      };
    }
  }
}

export function normalizeNaverNewsItem(
  item: NaverNewsRawItem,
  collectedAt: Date
): NormalizedNewsArticle | undefined {
  if (!item.title || !item.link || !item.pubDate) return undefined;

  const publishedAt = new Date(item.pubDate);
  if (Number.isNaN(publishedAt.getTime())) return undefined;

  const title = stripHtml(item.title);
  const description = stripHtml(item.description ?? "");
  const originalLink = item.originallink ?? item.link;
  const providerLink = item.link;

  return {
    provider: "NAVER_NEWS",
    title,
    description,
    originalLink,
    providerLink,
    publishedAt,
    collectedAt,
    duplicateKey: createNewsDuplicateKey(title, originalLink, publishedAt)
  };
}

export function stripHtml(value: string): string {
  return value
    .replaceAll(/<[^>]+>/g, "")
    .replaceAll("&quot;", "\"")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .trim();
}

export function createNewsDuplicateKey(title: string, originalLink: string, publishedAt: Date): string {
  const normalizedTitle = title.toLowerCase().replaceAll(/\s+/g, " ").trim();
  const date = publishedAt.toISOString().slice(0, 10);
  return `${normalizedTitle}|${originalLink}|${date}`;
}

function buildSearchUrl(endpoint: string, query: NewsSearchQuery): string {
  const url = new URL(endpoint);
  url.searchParams.set("query", query.query);
  if (query.display !== undefined) url.searchParams.set("display", String(query.display));
  if (query.start !== undefined) url.searchParams.set("start", String(query.start));
  if (query.sort !== undefined) url.searchParams.set("sort", query.sort);
  return url.toString();
}

function responseToRaw(value: unknown): NaverNewsRawResponse {
  if (value !== null && typeof value === "object" && "items" in value) {
    return value as NaverNewsRawResponse;
  }

  return { items: [] };
}

function metadataFor(collectedAt: Date, startedAt: number): AdapterMetadata {
  return {
    provider: "NAVER_NEWS",
    collectedAt,
    latencyMs: Date.now() - startedAt
  };
}
