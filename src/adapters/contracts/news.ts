import type { AdapterResult } from "./common.js";

export interface NewsSearchQuery {
  query: string;
  display?: number;
  start?: number;
  sort?: "sim" | "date";
}

export interface NormalizedNewsArticle {
  provider: "NAVER_NEWS";
  title: string;
  description: string;
  originalLink: string;
  providerLink: string;
  publishedAt: Date;
  collectedAt: Date;
  duplicateKey: string;
}

export interface NewsProviderAdapter {
  search(query: NewsSearchQuery): Promise<AdapterResult<NormalizedNewsArticle[]>>;
}
