import type { WatchlistAsset, MarketDataProvider } from "../../application/pipeline/market-data-provider.js";
import { MarketDataSnapshot } from "../../domain/market-data/index.js";
import { Currency, Price, Quantity } from "../../domain/value-objects/index.js";
import type { TossReadOnlyHttpClientOptions } from "./toss-read-only-http-client.js";

/**
 * Fetch-compatible interface for HTTP requests. This is the same interface
 * used by TossReadOnlyHttpClient to maintain consistency.
 */
export type TossMarketDataFetchLike = (
  url: string,
  init: TossMarketDataRequestInit
) => Promise<TossMarketDataFetchResponse>;

export interface TossMarketDataRequestInit {
  method: "GET" | "POST";
  headers: Record<string, string>;
  body?: string;
}

export interface TossMarketDataFetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

/**
 * Options for TossMarketDataProvider
 */
export interface TossMarketDataProviderOptions {
  /** Official Toss base URL: `https://openapi.tossinvest.com` */
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  /** Optional fetch implementation for testing; defaults to global fetch */
  fetch?: TossMarketDataFetchLike;
  /** Optional time provider for testing; defaults to Date.now() */
  now?: () => Date;
}

interface CachedToken {
  accessToken: string;
  tokenType: string;
  obtainedAt: Date;
  expiresAt: Date | undefined;
}

const TOKEN_PATH = "/oauth2/token";
const MARKET_PRICES_PATH = "/api/v1/prices";

/**
 * Market data provider that fetches real stock prices from Toss Securities.
 *
 * This provider:
 * - Fetches current prices for one or more symbols via the Toss `/api/v1/prices` endpoint
 * - Converts Toss API responses into `MarketDataSnapshot` domain objects
 * - Handles authentication, caching, and error cases independently
 * - Supports both KRX (Korea) and US market symbols
 * - Returns the most recent snapshot only (as per `MarketDataProvider` interface)
 *
 * Unlike `TossReadOnlyHttpClient` (which intentionally never extracts raw prices
 * per P5-016), this provider is explicitly designed to extract and transform
 * actual market data for use in strategy models.
 */
export class TossMarketDataProvider implements MarketDataProvider {
  readonly #baseUrl: URL;
  readonly #clientId: string;
  readonly #clientSecret: string;
  readonly #fetchImpl: TossMarketDataFetchLike;
  readonly #now: () => Date;
  #cachedToken: CachedToken | undefined;

  constructor(options: TossMarketDataProviderOptions) {
    const baseUrl = normalizeBaseUrl(options.baseUrl);
    if (!baseUrl) {
      throw new Error(
        "TossMarketDataProvider requires an https:// base URL, or http://127.0.0.1 / http://localhost for local test doubles only."
      );
    }

    this.#baseUrl = baseUrl;
    this.#clientId = options.clientId;
    this.#clientSecret = options.clientSecret;
    this.#fetchImpl = options.fetch ?? defaultFetch;
    this.#now = options.now ?? (() => new Date());
  }

  async fetchRecentSnapshots(asset: WatchlistAsset, now: Date): Promise<MarketDataSnapshot[]> {
    try {
      const accessToken = await this.#ensureAccessToken();
      const priceData = await this.#fetchPriceData([asset.symbol], accessToken);

      if (!priceData) {
        return this.#createSuspectSnapshot(asset, now, "failed_to_fetch_price_data");
      }

      const snapshot = this.#convertToSnapshot(asset, priceData, now);
      return [snapshot];
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown_error";
      return this.#createSuspectSnapshot(asset, now, reason);
    }
  }

  /**
   * Authenticates with Toss and caches the access token, reusing cached tokens
   * if they're not expired.
   */
  async #ensureAccessToken(): Promise<string> {
    if (this.#cachedToken && !isExpired(this.#cachedToken, this.#now())) {
      return this.#cachedToken.accessToken;
    }

    const token = await this.#authenticate();
    this.#cachedToken = token;
    return token.accessToken;
  }

  /**
   * POST /oauth2/token - Issues an OAuth2 client-credentials access token.
   */
  async #authenticate(): Promise<CachedToken> {
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.#clientId,
      client_secret: this.#clientSecret
    }).toString();

    const url = this.#buildUrl(TOKEN_PATH);
    console.error(`[TossMarketDataProvider] Authenticating at ${url}`);

    let response: TossMarketDataFetchResponse;
    try {
      response = await this.#fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body
      });
    } catch (error) {
      throw new Error("Failed to reach Toss authentication endpoint");
    }

    if (!response.ok) {
      console.error(`[TossMarketDataProvider] Authentication response status: ${response.status}`);
      const responseBody = await response.json().catch(() => ({}));
      console.error(`[TossMarketDataProvider] Response body:`, responseBody);
      throw new Error(`Toss authentication failed with status ${response.status}`);
    }

    const payload = await safeJson(response);
    const accessToken = readStringField(payload, "access_token");
    if (!accessToken) {
      throw new Error("Toss authentication response missing access_token");
    }

    const tokenType = readStringField(payload, "token_type") ?? "Bearer";
    const expiresInSeconds = readNumberField(payload, "expires_in");
    const obtainedAt = this.#now();
    const expiresAt =
      expiresInSeconds !== undefined ? new Date(obtainedAt.getTime() + expiresInSeconds * 1000) : undefined;

    return { accessToken, tokenType, obtainedAt, expiresAt };
  }

  /**
   * GET /api/v1/prices - Fetches current market prices for given symbols.
   */
  async #fetchPriceData(symbols: string[], accessToken: string): Promise<MarketPrice | undefined> {
    if (!symbols || symbols.length === 0) {
      throw new Error("At least one symbol is required");
    }

    if (symbols.length > 200) {
      throw new Error("Maximum 200 symbols per request");
    }

    let response: TossMarketDataFetchResponse;
    try {
      const url = this.#buildMarketPricesUrl(symbols);
      response = await this.#fetchImpl(url, {
        method: "GET",
        headers: { authorization: `Bearer ${accessToken}` }
      });
    } catch (error) {
      throw new Error("Failed to reach Toss market prices endpoint");
    }

    if (!response.ok) {
      throw new Error(`Toss market prices request failed with status ${response.status}`);
    }

    const payload = await safeJson(response);
    const items = extractArray(payload);
    if (!items || items.length === 0) {
      throw new Error("Toss market prices response was empty or malformed");
    }

    // Return the first matching price record (typically only one symbol per request)
    for (const item of items) {
      const price = normalizeMarketPriceItem(item);
      if (price) return price;
    }

    return undefined;
  }

  #buildUrl(path: string): string {
    return new URL(path, this.#baseUrl).toString();
  }

  #buildMarketPricesUrl(symbols: string[]): string {
    const url = new URL(MARKET_PRICES_PATH, this.#baseUrl);
    // Toss API expects symbols without market codes (e.g., "005930" not "005930.KS")
    const normalizedSymbols = symbols.map((s) => s.split(".")[0]);
    url.searchParams.set("symbols", normalizedSymbols.join(","));
    return url.toString();
  }

  #convertToSnapshot(asset: WatchlistAsset, priceData: MarketPrice, collectedAt: Date): MarketDataSnapshot {
    const price = Price.from(priceData.price, Currency.from(priceData.currency));
    const volume = Quantity.from("0"); // Toss API doesn't provide volume in /prices endpoint

    return new MarketDataSnapshot({
      assetId: asset.assetId,
      symbol: asset.symbol,
      market: asset.market,
      assetType: asset.assetType,
      price,
      volume,
      lastTradeAt: parseTimestamp(priceData.timestamp),
      collectedAt,
      source: "TOSS_SECURITIES"
    });
  }

  #createSuspectSnapshot(asset: WatchlistAsset, collectedAt: Date, reason: string): MarketDataSnapshot[] {
    return [
      new MarketDataSnapshot({
        assetId: asset.assetId,
        symbol: asset.symbol,
        market: asset.market,
        assetType: asset.assetType,
        collectedAt,
        source: "TOSS_SECURITIES",
        suspectReasons: [`toss_market_data_error: ${reason}`]
      })
    ];
  }
}

/**
 * Extracted price data from Toss API response item
 */
interface MarketPrice {
  symbol: string;
  price: string;
  currency: string;
  timestamp: string;
}

/**
 * Only `https://` base URLs are accepted for real use. `http://127.0.0.1` and
 * `http://localhost` are accepted solely for local test doubles.
 */
function normalizeBaseUrl(value: string): URL | undefined {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }

  if (url.protocol === "https:") return url;
  if (url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost")) return url;

  return undefined;
}

/**
 * Default fetch implementation using the global fetch API
 */
function defaultFetch(url: string, init: TossMarketDataRequestInit): Promise<TossMarketDataFetchResponse> {
  return fetch(url, init);
}

/**
 * Safely parses JSON from response, returning undefined if parsing fails
 */
async function safeJson(response: TossMarketDataFetchResponse): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

/**
 * Extracts a string field from a payload object
 */
function readStringField(payload: unknown, key: string): string | undefined {
  if (payload === null || typeof payload !== "object") return undefined;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Extracts a number field from a payload object
 */
function readNumberField(payload: unknown, key: string): number | undefined {
  if (payload === null || typeof payload !== "object") return undefined;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * Checks if a token is expired, with a 5-second buffer before actual expiry
 */
function isExpired(token: CachedToken, now: Date): boolean {
  if (!token.expiresAt) return false;
  return now.getTime() >= token.expiresAt.getTime() - 5000;
}

/**
 * Extracts an array from the payload, handling both bare array and { result: [...] } formats
 */
function extractArray(payload: unknown): unknown[] | undefined {
  if (Array.isArray(payload)) return payload;
  if (payload !== null && typeof payload === "object") {
    const result = (payload as Record<string, unknown>).result;
    if (Array.isArray(result)) return result;
  }
  return undefined;
}

/**
 * Extracts market price data from a Toss API response item.
 * Returns undefined if the item cannot be safely mapped to a price record.
 */
function normalizeMarketPriceItem(item: unknown): MarketPrice | undefined {
  if (item === null || typeof item !== "object") return undefined;
  const record = item as Record<string, unknown>;

  const symbol = firstString(record, ["symbol", "ticker", "stockCode", "code"]);
  if (!symbol) return undefined;

  const price = firstString(record, ["lastPrice", "price", "currentPrice"]);
  if (!price) return undefined;

  const currency = firstString(record, ["currency"]) ?? "KRW";

  const timestamp = firstString(record, ["timestamp", "time", "quoteTime"]);
  if (!timestamp) return undefined;

  return {
    symbol,
    price,
    currency,
    timestamp
  };
}

/**
 * Helper to find first non-empty string value from record using multiple possible keys
 */
function firstString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}

/**
 * Parses ISO 8601 timestamp string to Date, returning undefined if invalid
 */
function parseTimestamp(timestamp: string): Date | undefined {
  try {
    const date = new Date(timestamp);
    if (Number.isFinite(date.getTime())) return date;
  } catch {
    // ignore
  }
  return undefined;
}
