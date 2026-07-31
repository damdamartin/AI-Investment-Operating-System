import type { WatchlistAsset, MarketDataProvider } from "../../application/pipeline/market-data-provider.js";
import { MarketDataSnapshot } from "../../domain/market-data/index.js";
import { Currency, Price, Quantity } from "../../domain/value-objects/index.js";

/**
 * Fetch-compatible interface for HTTP requests
 */
export type KISMarketDataFetchLike = (
  url: string,
  init: KISMarketDataRequestInit
) => Promise<KISMarketDataFetchResponse>;

export interface KISMarketDataRequestInit {
  method: "GET" | "POST";
  headers: Record<string, string>;
  body?: string | undefined;
}

export interface KISMarketDataFetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

/**
 * Options for KISMarketDataProvider
 */
export interface KISMarketDataProviderOptions {
  /** Korea Investment & Securities base URL: `https://openapi.kisrating.com` */
  baseUrl?: string | undefined;
  appKey: string;
  appSecret: string;
  accountNumber?: string | undefined;
  /** Optional fetch implementation for testing; defaults to global fetch */
  fetch?: KISMarketDataFetchLike | undefined;
  /** Optional time provider for testing; defaults to Date.now() */
  now?: (() => Date) | undefined;
}

interface CachedToken {
  accessToken: string;
  tokenType: string;
  obtainedAt: Date;
  expiresAt: Date | undefined;
}

// KIS Open API Endpoints
// Production: https://openapi.koreainvestment.com:9443
// Sandbox: https://openapivts.koreainvestment.com:29443
const DEFAULT_BASE_URL = "https://openapi.koreainvestment.com:9443";
const TOKEN_PATH = "/oauth2/token";
const DOMESTIC_PRICE_PATH = "/uapi/domestic-stock/v1/quotations/inquire-price";
const OVERSEAS_PRICE_PATH = "/uapi/overseas-stock/v1/quotations/inquire-price";

/**
 * Market data provider that fetches real stock prices from Korea Investment & Securities.
 *
 * This provider:
 * - Fetches current prices for symbols via KIS Open API
 * - Converts KIS API responses into `MarketDataSnapshot` domain objects
 * - Handles authentication, caching, and error cases independently
 * - Supports both KRX (Korea, domestic) and US (overseas) market symbols
 * - Returns the most recent snapshot for each asset
 *
 * Authentication uses OAuth2 client credentials flow with app key and secret.
 */
export class KISMarketDataProvider implements MarketDataProvider {
  readonly #baseUrl: URL;
  readonly #appKey: string;
  readonly #appSecret: string;
  readonly #accountNumber: string;
  readonly #fetchImpl: KISMarketDataFetchLike;
  readonly #now: () => Date;
  #cachedToken: CachedToken | undefined;

  constructor(options: KISMarketDataProviderOptions) {
    const baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_BASE_URL);
    if (!baseUrl) {
      throw new Error(
        "KISMarketDataProvider requires an https:// base URL, or http://127.0.0.1 / http://localhost for local test doubles only."
      );
    }

    this.#baseUrl = baseUrl;
    this.#appKey = options.appKey;
    this.#appSecret = options.appSecret;
    this.#accountNumber = options.accountNumber ?? "";
    this.#fetchImpl = options.fetch ?? defaultFetch;
    this.#now = options.now ?? (() => new Date());
  }

  async fetchRecentSnapshots(asset: WatchlistAsset, now: Date): Promise<MarketDataSnapshot[]> {
    try {
      const accessToken = await this.#ensureAccessToken();
      const priceData = await this.#fetchPriceData(asset, accessToken, now);

      if (!priceData) {
        return this.#createSuspectSnapshot(asset, now, "failed_to_fetch_price_data");
      }

      const snapshot = this.#convertToSnapshot(asset, priceData, now);
      return [snapshot];
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown_error";
      console.error(`[KISMarketDataProvider] Error fetching ${asset.symbol}: ${reason}`);
      return this.#createSuspectSnapshot(asset, now, reason);
    }
  }

  /**
   * Authenticates with KIS and caches the access token, reusing cached tokens
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
   * POST /oauth2/token - Issues an OAuth2 access token using app key and secret
   */
  async #authenticate(): Promise<CachedToken> {
    const body = JSON.stringify({
      grant_type: "client_credentials",
      appkey: this.#appKey,
      appsecret: this.#appSecret
    });

    const tokenUrl = this.#buildUrl(TOKEN_PATH).toString();
    const requestInit = {
      method: "POST" as const,
      headers: {
        "content-type": "application/json"
      },
      body
    } satisfies KISMarketDataRequestInit;

    let response: KISMarketDataFetchResponse;
    try {
      response = await this.#fetchImpl(tokenUrl, requestInit);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to reach KIS authentication endpoint: ${message}`);
    }

    if (!response.ok) {
      try {
        const errorBody = await response.json().catch(() => ({})) as any;
        const errorMsg = errorBody?.msg || errorBody?.message || "Unknown error";
        const errorCode = errorBody?.cd || errorBody?.code || "Unknown";
        console.error(`[KIS Auth Error] Status: ${response.status}, Code: ${errorCode}, Message: ${errorMsg}`);
        throw new Error(`KIS authentication failed: [${errorCode}] ${errorMsg} (HTTP ${response.status})`);
      } catch (parseError) {
        throw new Error(`KIS authentication failed with status ${response.status}`);
      }
    }

    const payload = await safeJson(response);
    if (!isTokenPayload(payload)) {
      throw new Error("KIS returned unexpected token response format");
    }

    const expiresInSeconds = typeof payload.expires_in === "number" ? payload.expires_in : 3600;
    const obtainedAt = this.#now();
    const expiresAt = new Date(obtainedAt.getTime() + expiresInSeconds * 1000);

    return {
      accessToken: payload.access_token,
      tokenType: payload.token_type ?? "Bearer",
      obtainedAt,
      expiresAt
    };
  }

  /**
   * Fetch price data from KIS API (domestic or overseas based on market)
   */
  async #fetchPriceData(asset: WatchlistAsset, accessToken: string, now: Date): Promise<unknown> {
    const isDomestic = asset.market.code === "KR";
    const apiPath = isDomestic ? DOMESTIC_PRICE_PATH : OVERSEAS_PRICE_PATH;
    const symbol = isDomestic ? normalizeDomesticSymbol(asset.symbol) : asset.symbol;

    const priceUrl = this.#buildUrl(apiPath);
    if (isDomestic) {
      priceUrl.searchParams.append("fid_cond_mrkt_div_code", "J");
      priceUrl.searchParams.append("fid_input_iscd", symbol);
    }

    const requestInit: KISMarketDataRequestInit = {
      method: "GET" as const,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
        "appKey": this.#appKey,
        "appSecret": this.#appSecret,
        "tr_id": isDomestic ? "FHKST01010100" : "HHDFS76200200",
        "custtype": "P" // Customer type: Personal
      }
    };

    if (!isDomestic) {
      requestInit.body = JSON.stringify({
        AUTH: "0",
        EXCD: getExchangeCode(asset.symbol),
        SYMB: asset.symbol
      });
    }

    let response: KISMarketDataFetchResponse;
    try {
      response = await this.#fetchImpl(priceUrl.toString(), requestInit);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to fetch ${asset.symbol} from KIS: ${message}`);
    }

    if (!response.ok) {
      try {
        const errorBody = await response.json().catch(() => ({})) as any;
        const errorMsg = errorBody?.msg || errorBody?.message || "Unknown error";
        const errorCode = errorBody?.cd || errorBody?.code || "Unknown";
        console.error(`[KIS Price Error] Symbol: ${asset.symbol}, Status: ${response.status}, Code: ${errorCode}, Message: ${errorMsg}`);
        throw new Error(`KIS price fetch failed for ${asset.symbol}: [${errorCode}] ${errorMsg} (HTTP ${response.status})`);
      } catch (parseError) {
        throw new Error(`KIS price fetch failed with status ${response.status} for ${asset.symbol}`);
      }
    }

    return await safeJson(response);
  }

  /**
   * Convert KIS API response to MarketDataSnapshot
   */
  #convertToSnapshot(asset: WatchlistAsset, data: unknown, now: Date): MarketDataSnapshot {
    const isDomestic = asset.market.code === "KR";
    const fields = isDomestic ? extractDomesticFields(data) : extractOverseasFields(data);

    if (!fields) {
      return this.#createSuspectSnapshot(asset, now, "failed_to_parse_kis_response")[0]!;
    }

    const currency = asset.market.code === "US" ? "USD" : "KRW";
    const price = Price.from(String(fields.price), Currency.from(currency));
    const volume = Quantity.from(String(fields.volume));

    return new MarketDataSnapshot({
      assetId: asset.symbol, // Using symbol as temporary ID
      symbol: asset.symbol,
      market: asset.market,
      assetType: asset.assetType,
      price,
      volume,
      lastTradeAt: now,
      collectedAt: now,
      source: "UNKNOWN",
      suspectReasons: fields.suspectReasons ?? []
    });
  }

  /**
   * Create a snapshot marked as suspect when data fetch fails
   */
  #createSuspectSnapshot(asset: WatchlistAsset, now: Date, reason: string): MarketDataSnapshot[] {
    const currency = asset.market.code === "US" ? "USD" : "KRW";
    return [
      new MarketDataSnapshot({
        assetId: asset.symbol,
        symbol: asset.symbol,
        market: asset.market,
        assetType: asset.assetType,
        price: Price.from("0", Currency.from(currency)),
        volume: Quantity.from("0"),
        lastTradeAt: now,
        collectedAt: now,
        source: "UNKNOWN",
        suspectReasons: [reason]
      })
    ];
  }

  /**
   * Build full URL from path
   */
  #buildUrl(path: string): URL {
    const url = new URL(this.#baseUrl);
    url.pathname = path;
    return url;
  }
}

/**
 * Normalize domestic symbol (add leading zeros if needed)
 */
function normalizeDomesticSymbol(symbol: string): string {
  // Format: 6-digit Korean stock code with leading zeros
  return symbol.padStart(6, "0");
}

/**
 * Determine exchange code for overseas symbols
 */
function getExchangeCode(symbol: string): string {
  // NYSE: NYS, NASDAQ: NAS, AMEX: AMS
  // Default to NASDAQ for most US stocks
  if (symbol.includes("-")) {
    const market = symbol.split("-")[1];
    if (market === "NYSE") return "NYS";
    if (market === "AMEX") return "AMS";
  }
  return "NAS"; // Default to NASDAQ
}

/**
 * Extract fields from domestic (KRX) price response
 */
function extractDomesticFields(data: unknown): { price: number; volume: number; suspectReasons?: string[] } | null {
  if (typeof data !== "object" || data === null) return null;

  const obj = data as Record<string, unknown>;
  const output = obj.output as Record<string, unknown> | undefined;

  if (!output) return null;

  const stck_prpr = parseNumber(output.stck_prpr); // Current price
  const acml_vol = parseNumber(output.acml_vol); // Accumulated volume

  if (stck_prpr === null || acml_vol === null) {
    return null;
  }

  return {
    price: stck_prpr,
    volume: acml_vol
  };
}

/**
 * Extract fields from overseas price response
 */
function extractOverseasFields(data: unknown): { price: number; volume: number; suspectReasons?: string[] } | null {
  if (typeof data !== "object" || data === null) return null;

  const obj = data as Record<string, unknown>;
  const output = obj.output as Record<string, unknown> | undefined;

  if (!output) return null;

  const ovrs_prodg_prc = parseNumber(output.ovrs_prodg_prc); // Overseas product price
  const ctra_vol = parseNumber(output.ctra_vol); // Contract volume

  if (ovrs_prodg_prc === null || ctra_vol === null) {
    return null;
  }

  return {
    price: ovrs_prodg_prc,
    volume: ctra_vol
  };
}

/**
 * Safely parse number from unknown value
 */
function parseNumber(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * Type guard for token payload
 */
function isTokenPayload(obj: unknown): obj is { access_token: string; token_type?: string; expires_in?: number } {
  if (typeof obj !== "object" || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return typeof o.access_token === "string";
}

/**
 * Safely parse JSON from fetch response
 */
async function safeJson(response: KISMarketDataFetchResponse): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    throw new Error(`Failed to parse JSON from KIS response: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Default fetch implementation
 */
function defaultFetch(url: string, init: KISMarketDataRequestInit): Promise<KISMarketDataFetchResponse> {
  return fetch(url, init as RequestInit) as Promise<KISMarketDataFetchResponse>;
}

/**
 * Normalize and validate base URL
 */
function normalizeBaseUrl(input: string): URL | null {
  try {
    const url = new URL(input);
    const protocol = url.protocol.toLowerCase();

    if (protocol === "https:") {
      return url;
    }

    if (protocol === "http:") {
      const hostname = url.hostname.toLowerCase();
      if (hostname === "localhost" || hostname === "127.0.0.1") {
        return url;
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Check if cached token is expired
 */
function isExpired(token: CachedToken, now: Date): boolean {
  if (!token.expiresAt) {
    return false; // No expiration info, assume valid
  }
  // Add 5-minute buffer before actual expiration
  const bufferMs = 5 * 60 * 1000;
  return now.getTime() >= token.expiresAt.getTime() - bufferMs;
}
