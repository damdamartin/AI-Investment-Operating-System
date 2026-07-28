import type { AdapterError, AdapterMetadata } from "../contracts/index.js";
import type { TossReadOnlyOperation } from "./toss-read-only-dry-run-client.js";

/**
 * Minimal fetch-compatible interface this client depends on. A default binding
 * to the global `fetch` is used when no override is supplied.
 *
 * SAFETY NOTE: this client CAN make real HTTP calls when constructed with real
 * credentials and pointed at the real Toss base URL - that is its purpose. Tests
 * for this client must never do that. Tests must supply either a local
 * `node:http` mock server bound to 127.0.0.1/localhost, or a fetch stub. This
 * client is never to be exercised against the real internet from a test.
 */
export type TossReadOnlyHttpFetchLike = (
  url: string,
  init: TossReadOnlyHttpRequestInit
) => Promise<TossReadOnlyHttpFetchResponse>;

export interface TossReadOnlyHttpRequestInit {
  method: "GET" | "POST";
  headers: Record<string, string>;
  body?: string;
}

export interface TossReadOnlyHttpFetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export interface TossReadOnlyHttpClientOptions {
  /**
   * Official Toss base URL is `https://openapi.tossinvest.com`
   * (see docs/phase5/toss-official-api-source-notes.md). Only `https://` URLs
   * are accepted, except `http://127.0.0.1` / `http://localhost` which are
   * accepted solely so tests can point this client at a local mock server.
   */
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  /** Safe local Toss `accountSeq`, used only for account-scoped read-only calls such as holdings. */
  accountRef?: string;
  fetch?: TossReadOnlyHttpFetchLike;
  now?: () => Date;
}

/**
 * The fixed, hardcoded set of operations this client is capable of performing.
 * There is no public method on this class that can construct a request outside
 * this list. Order creation, order cancellation, order modification, transfer,
 * withdrawal, and currency conversion have no code path anywhere in this file -
 * there is no generic `request(path, method, body)` escape hatch.
 */
export const TOSS_READ_ONLY_HTTP_CLIENT_ALLOWED_OPERATIONS = [
  "AUTHENTICATION_READ",
  "ACCOUNT_SNAPSHOT_READ",
  "POSITION_QUERY_READ",
  "MARKET_DATA_READ"
] as const satisfies readonly TossReadOnlyOperation[];

export interface TossReadOnlyHttpSafetyReport {
  liveBrokerWriteAllowed: false;
  allowedOperations: readonly TossReadOnlyOperation[];
  safetyType: "TOSS_READ_ONLY_HTTP_CLIENT_REPORT";
}

export interface TossReadOnlyHttpMetadata extends AdapterMetadata {
  liveBrokerWriteAllowed: false;
  allowedOperations: readonly TossReadOnlyOperation[];
}

export interface TossReadOnlyHttpError extends AdapterError {
  liveBrokerWriteAllowed: false;
}

export type TossReadOnlyHttpResult<T> =
  | { ok: true; data: T; metadata: TossReadOnlyHttpMetadata }
  | { ok: false; error: TossReadOnlyHttpError };

export interface TossReadOnlyAuthenticationSummary {
  tokenType: string;
  obtainedAt: Date;
  expiresInSeconds?: number;
}

export interface TossReadOnlyAccountSummary {
  /** Safe local reference (Toss `accountSeq`), not a full account number. */
  accountRef: string;
  /** Present only when the API returned an account number; always masked. */
  maskedAccountNumber?: string;
}

export interface TossReadOnlyHoldingSummary {
  symbol: string;
  quantity: string;
  market?: string;
  currency?: string;
}

/**
 * Intentionally count-only. Official Toss documentation confirms the
 * `GET /api/v1/prices` path and required `symbols` query parameter for Phase 5
 * (see docs/phase5/toss-official-api-source-notes.md). Even though the
 * response documents symbol and price fields, this client never extracts a
 * per-item value from a market-prices response at all - only how many items
 * came back - matching the task requirement that raw prices and raw symbols
 * must never be stored or exposed anywhere in this pipeline.
 */
export interface TossReadOnlyMarketDataSummary {
  itemCount: number;
}

interface CachedToken {
  accessToken: string;
  tokenType: string;
  obtainedAt: Date;
  expiresAt?: Date;
}

const TOKEN_PATH = "/oauth2/token";
const ACCOUNTS_PATH = "/api/v1/accounts";
const HOLDINGS_PATH = "/api/v1/holdings";
const MARKET_PRICES_PATH = "/api/v1/prices";
const MARKET_PRICES_SYMBOLS = "005930";

/**
 * Narrowly scoped, real Toss Securities read-only HTTP client.
 *
 * This is a real client: given real credentials, a real base URL, and the
 * default (global `fetch`) transport, it issues real HTTP requests to the
 * Toss Securities Open API. It must only ever be pointed at the real API by a
 * caller that has independently passed every Phase 5 safety gate documented in
 * `docs/phase5/toss-read-only-call-gate.md`. This class itself performs none of
 * those gate checks - it is a thin, safety-shaped transport, not the gate.
 *
 * Safety comes from what this class exposes, not from being fake:
 *
 * - `authenticate()`     -> POST /oauth2/token    (AUTHENTICATION_READ)
 * - `getAccounts()`      -> GET  /api/v1/accounts (ACCOUNT_SNAPSHOT_READ)
 * - `getHoldings()`      -> GET  /api/v1/holdings (POSITION_QUERY_READ)
 * - `getMarketPrices()`  -> GET  /api/v1/prices   (MARKET_DATA_READ)
 *
 * Those are the only four operations reachable through this class's public
 * API. There is no generic request method, so no caller can construct an
 * order-write request (or any other unlisted request) through this client.
 *
 * Every result carries a hardcoded (non-computed) `liveBrokerWriteAllowed:
 * false`. Every error is sanitized: it never carries a raw response body,
 * request headers, the access token, or the client secret.
 */
export class TossReadOnlyHttpClient {
  readonly liveBrokerWriteAllowed = false as const;
  readonly allowedOperations = TOSS_READ_ONLY_HTTP_CLIENT_ALLOWED_OPERATIONS;

  // True (ES) private fields, not just TypeScript `private`: these are not
  // reachable, enumerable, or spoofable from outside the class at runtime,
  // which is what keeps the public prototype surface limited to exactly
  // authenticate/getAccounts/getHoldings/getMarketPrices/getSafetyReport (see
  // this class's corresponding test, "has no public API surface capable of
  // constructing a write-looking request").
  readonly #baseUrl: URL;
  readonly #clientId: string;
  readonly #clientSecret: string;
  readonly #accountRef: string | undefined;
  readonly #fetchImpl: TossReadOnlyHttpFetchLike;
  readonly #now: () => Date;
  #cachedToken: CachedToken | undefined;

  constructor(options: TossReadOnlyHttpClientOptions) {
    const baseUrl = normalizeBaseUrl(options.baseUrl);
    if (!baseUrl) {
      throw new Error(
        "TossReadOnlyHttpClient requires an https:// base URL, or http://127.0.0.1 / http://localhost for local test doubles only."
      );
    }

    this.#baseUrl = baseUrl;
    this.#clientId = options.clientId;
    this.#clientSecret = options.clientSecret;
    this.#accountRef = options.accountRef;
    this.#fetchImpl = options.fetch ?? defaultFetch;
    this.#now = options.now ?? (() => new Date());
  }

  /** Hardcoded, non-computed safety report. Identical shape and values on every call. */
  getSafetyReport(): TossReadOnlyHttpSafetyReport {
    return {
      liveBrokerWriteAllowed: false,
      allowedOperations: TOSS_READ_ONLY_HTTP_CLIENT_ALLOWED_OPERATIONS,
      safetyType: "TOSS_READ_ONLY_HTTP_CLIENT_REPORT"
    };
  }

  /**
   * POST /oauth2/token - issues an OAuth2 client-credentials access token.
   * The raw access token is cached in a private field for use by
   * `getAccounts()` / `getHoldings()` and is never included in the returned
   * summary, never logged, and never otherwise exposed by this class.
   */
  async authenticate(): Promise<TossReadOnlyHttpResult<TossReadOnlyAuthenticationSummary>> {
    const collectedAt = this.#now();
    const startedAt = Date.now();
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.#clientId,
      client_secret: this.#clientSecret
    }).toString();

    let response: TossReadOnlyHttpFetchResponse;
    try {
      response = await this.#fetchImpl(this.#buildUrl(TOKEN_PATH), {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body
      });
    } catch {
      return this.#errorResult(
        "TOSS_HTTP_TOKEN_NETWORK_ERROR",
        "Toss token request failed before receiving a response.",
        true,
        collectedAt,
        startedAt
      );
    }

    if (!response.ok) {
      return this.#errorResult(
        `TOSS_HTTP_TOKEN_REQUEST_FAILED_STATUS_${response.status}`,
        "Toss token request returned a non-success status.",
        response.status >= 500,
        collectedAt,
        startedAt
      );
    }

    const payload = await safeJson(response);
    const accessToken = readStringField(payload, "access_token");
    if (!accessToken) {
      return this.#errorResult(
        "TOSS_HTTP_TOKEN_RESPONSE_MISSING_ACCESS_TOKEN",
        "Toss token response did not include a usable access token.",
        false,
        collectedAt,
        startedAt
      );
    }

    const tokenType = readStringField(payload, "token_type") ?? "Bearer";
    const expiresInSeconds = readNumberField(payload, "expires_in");
    const obtainedAt = collectedAt;
    const expiresAt =
      expiresInSeconds !== undefined ? new Date(obtainedAt.getTime() + expiresInSeconds * 1000) : undefined;

    this.#cachedToken =
      expiresAt !== undefined ? { accessToken, tokenType, obtainedAt, expiresAt } : { accessToken, tokenType, obtainedAt };

    const summary: TossReadOnlyAuthenticationSummary =
      expiresInSeconds !== undefined ? { tokenType, obtainedAt, expiresInSeconds } : { tokenType, obtainedAt };

    return {
      ok: true,
      data: summary,
      metadata: this.#metadataFor(collectedAt, startedAt)
    };
  }

  /**
   * GET /api/v1/accounts - returns sanitized account summaries. Full account
   * numbers are never returned; when present they are masked to at most the
   * last 4 characters.
   */
  async getAccounts(): Promise<TossReadOnlyHttpResult<TossReadOnlyAccountSummary[]>> {
    const collectedAt = this.#now();
    const startedAt = Date.now();
    const tokenResult = await this.#ensureToken(collectedAt, startedAt);
    if (!tokenResult.ok) return tokenResult;

    let response: TossReadOnlyHttpFetchResponse;
    try {
      response = await this.#fetchImpl(this.#buildUrl(ACCOUNTS_PATH), {
        method: "GET",
        headers: { authorization: `Bearer ${tokenResult.data}` }
      });
    } catch {
      return this.#errorResult(
        "TOSS_HTTP_ACCOUNTS_NETWORK_ERROR",
        "Toss accounts request failed before receiving a response.",
        true,
        collectedAt,
        startedAt
      );
    }

    if (!response.ok) {
      return this.#errorResult(
        `TOSS_HTTP_ACCOUNTS_REQUEST_FAILED_STATUS_${response.status}`,
        "Toss accounts request returned a non-success status.",
        response.status >= 500,
        collectedAt,
        startedAt
      );
    }

    const payload = await safeJson(response);
    const items = extractArray(payload);
    if (!items) {
      return this.#errorResult(
        "TOSS_HTTP_ACCOUNTS_RESPONSE_INVALID_SHAPE",
        "Toss accounts response was not a recognizable list shape.",
        false,
        collectedAt,
        startedAt
      );
    }

    const accounts: TossReadOnlyAccountSummary[] = [];
    for (const item of items) {
      const summary = normalizeAccountItem(item);
      if (summary) accounts.push(summary);
    }

    return {
      ok: true,
      data: accounts,
      metadata: this.#metadataFor(collectedAt, startedAt)
    };
  }

  /**
   * GET /api/v1/holdings - returns sanitized holding summaries. Items that
   * cannot be safely mapped to a symbol and quantity are skipped rather than
   * failing the whole call, mirroring how other adapters in this codebase
   * skip malformed items defensively.
   */
  async getHoldings(): Promise<TossReadOnlyHttpResult<TossReadOnlyHoldingSummary[]>> {
    const collectedAt = this.#now();
    const startedAt = Date.now();
    const tokenResult = await this.#ensureToken(collectedAt, startedAt);
    if (!tokenResult.ok) return tokenResult;

    let response: TossReadOnlyHttpFetchResponse;
    try {
      response = await this.#fetchImpl(this.#buildUrl(HOLDINGS_PATH), {
        method: "GET",
        headers: this.#accountScopedHeaders(tokenResult.data)
      });
    } catch {
      return this.#errorResult(
        "TOSS_HTTP_HOLDINGS_NETWORK_ERROR",
        "Toss holdings request failed before receiving a response.",
        true,
        collectedAt,
        startedAt
      );
    }

    if (!response.ok) {
      return this.#errorResult(
        `TOSS_HTTP_HOLDINGS_REQUEST_FAILED_STATUS_${response.status}`,
        "Toss holdings request returned a non-success status.",
        response.status >= 500,
        collectedAt,
        startedAt
      );
    }

    const payload = await safeJson(response);
    const items = extractHoldingsArray(payload);
    if (!items) {
      return this.#errorResult(
        "TOSS_HTTP_HOLDINGS_RESPONSE_INVALID_SHAPE",
        "Toss holdings response was not a recognizable list shape.",
        false,
        collectedAt,
        startedAt
      );
    }

    const holdings: TossReadOnlyHoldingSummary[] = [];
    for (const item of items) {
      const summary = normalizeHoldingItem(item);
      if (summary) holdings.push(summary);
    }

    return {
      ok: true,
      data: holdings,
      metadata: this.#metadataFor(collectedAt, startedAt)
    };
  }

  /**
   * GET /api/v1/prices - narrowly scoped current-price lookup
   * (MARKET_DATA_READ, OQ-004; see docs/phase5/toss-official-api-source-notes.md).
   * Unlike `getAccounts()`/`getHoldings()`, this method deliberately never
   * extracts a per-item symbol or price value from the response - only how
   * many items came back. This is stricter than the account/holding methods
   * on purpose: the task this method was added under (P5-016) explicitly
   * requires that raw prices and raw symbols never be stored or exposed
   * anywhere in this pipeline, at every layer - not just in the sanitized
   * evidence a caller later writes to disk.
   */
  async getMarketPrices(): Promise<TossReadOnlyHttpResult<TossReadOnlyMarketDataSummary>> {
    const collectedAt = this.#now();
    const startedAt = Date.now();
    const tokenResult = await this.#ensureToken(collectedAt, startedAt);
    if (!tokenResult.ok) return tokenResult;

    let response: TossReadOnlyHttpFetchResponse;
    try {
      response = await this.#fetchImpl(this.#buildMarketPricesUrl(), {
        method: "GET",
        headers: { authorization: `Bearer ${tokenResult.data}` }
      });
    } catch {
      return this.#errorResult(
        "TOSS_HTTP_MARKET_PRICES_NETWORK_ERROR",
        "Toss market prices request failed before receiving a response.",
        true,
        collectedAt,
        startedAt
      );
    }

    if (!response.ok) {
      return this.#errorResult(
        `TOSS_HTTP_MARKET_PRICES_REQUEST_FAILED_STATUS_${response.status}`,
        "Toss market prices request returned a non-success status.",
        response.status >= 500,
        collectedAt,
        startedAt
      );
    }

    const payload = await safeJson(response);
    const items = extractArray(payload);
    if (!items) {
      return this.#errorResult(
        "TOSS_HTTP_MARKET_PRICES_RESPONSE_INVALID_SHAPE",
        "Toss market prices response was not a recognizable list shape.",
        false,
        collectedAt,
        startedAt
      );
    }

    return {
      ok: true,
      data: { itemCount: items.length },
      metadata: this.#metadataFor(collectedAt, startedAt)
    };
  }

  /**
   * Returns a cached access token if one is present and not expired, otherwise
   * authenticates first. The access token value itself never leaves this
   * private method - callers only ever receive `ok`/`error`.
   */
  async #ensureToken(
    collectedAt: Date,
    startedAt: number
  ): Promise<{ ok: true; data: string } | { ok: false; error: TossReadOnlyHttpError }> {
    if (this.#cachedToken && !isExpired(this.#cachedToken, this.#now())) {
      return { ok: true, data: this.#cachedToken.accessToken };
    }

    const authResult = await this.authenticate();
    if (!authResult.ok) {
      return authResult;
    }

    if (!this.#cachedToken) {
      return this.#errorResult(
        "TOSS_HTTP_TOKEN_UNAVAILABLE_AFTER_AUTHENTICATION",
        "Authentication reported success but no token was cached.",
        false,
        collectedAt,
        startedAt
      );
    }

    return { ok: true, data: this.#cachedToken.accessToken };
  }

  #buildUrl(path: string): string {
    return new URL(path, this.#baseUrl).toString();
  }

  #buildMarketPricesUrl(): string {
    const url = new URL(MARKET_PRICES_PATH, this.#baseUrl);
    url.searchParams.set("symbols", MARKET_PRICES_SYMBOLS);
    return url.toString();
  }

  #accountScopedHeaders(accessToken: string): Record<string, string> {
    const headers: Record<string, string> = { authorization: `Bearer ${accessToken}` };
    if (this.#accountRef) {
      headers["X-Tossinvest-Account"] = this.#accountRef;
    }
    return headers;
  }

  #metadataFor(collectedAt: Date, startedAt: number): TossReadOnlyHttpMetadata {
    return {
      provider: "TOSS_SECURITIES",
      collectedAt,
      latencyMs: Date.now() - startedAt,
      liveBrokerWriteAllowed: false,
      allowedOperations: TOSS_READ_ONLY_HTTP_CLIENT_ALLOWED_OPERATIONS
    };
  }

  #errorResult(
    code: string,
    message: string,
    retryable: boolean,
    collectedAt: Date,
    startedAt: number
  ): { ok: false; error: TossReadOnlyHttpError } {
    return {
      ok: false,
      error: {
        provider: "TOSS_SECURITIES",
        code,
        message,
        retryable,
        metadata: this.#metadataFor(collectedAt, startedAt),
        liveBrokerWriteAllowed: false
      }
    };
  }
}

function isExpired(token: CachedToken, now: Date): boolean {
  if (!token.expiresAt) return false;
  // Treat a token as expired 5 seconds before its stated expiry to avoid
  // racing a real request against the boundary.
  return now.getTime() >= token.expiresAt.getTime() - 5000;
}

function defaultFetch(url: string, init: TossReadOnlyHttpRequestInit): Promise<TossReadOnlyHttpFetchResponse> {
  return fetch(url, init);
}

/**
 * Only `https://` base URLs are accepted for real use. `http://127.0.0.1` and
 * `http://localhost` are accepted solely so tests can point this client at a
 * local mock server - this is the only sanctioned way to test this client.
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

async function safeJson(response: TossReadOnlyHttpFetchResponse): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function readStringField(payload: unknown, key: string): string | undefined {
  if (payload === null || typeof payload !== "object") return undefined;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readNumberField(payload: unknown, key: string): number | undefined {
  if (payload === null || typeof payload !== "object") return undefined;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** Accepts either `{ result: [...] }` or a bare array response envelope. */
function extractArray(payload: unknown): unknown[] | undefined {
  if (Array.isArray(payload)) return payload;
  if (payload !== null && typeof payload === "object") {
    const result = (payload as Record<string, unknown>).result;
    if (Array.isArray(result)) return result;
  }
  return undefined;
}

function extractHoldingsArray(payload: unknown): unknown[] | undefined {
  const direct = extractArray(payload);
  if (direct) return direct;

  if (payload !== null && typeof payload === "object") {
    const result = (payload as Record<string, unknown>).result;
    if (result !== null && typeof result === "object") {
      const items = (result as Record<string, unknown>).items;
      if (Array.isArray(items)) return items;
    }
  }

  return undefined;
}

function normalizeAccountItem(item: unknown): TossReadOnlyAccountSummary | undefined {
  if (item === null || typeof item !== "object") return undefined;
  const record = item as Record<string, unknown>;

  const accountSeq = record.accountSeq;
  const accountRef =
    typeof accountSeq === "number"
      ? String(accountSeq)
      : typeof accountSeq === "string" && accountSeq.length > 0
        ? accountSeq
        : undefined;
  if (!accountRef) return undefined;

  const accountNo = record.accountNo;
  const maskedAccountNumber = typeof accountNo === "string" && accountNo.length > 0 ? maskAccountNumber(accountNo) : undefined;

  return maskedAccountNumber !== undefined ? { accountRef, maskedAccountNumber } : { accountRef };
}

function normalizeHoldingItem(item: unknown): TossReadOnlyHoldingSummary | undefined {
  if (item === null || typeof item !== "object") return undefined;
  const record = item as Record<string, unknown>;

  const symbol = firstString(record, ["symbol", "ticker", "stockCode", "code"]);
  if (!symbol) return undefined;

  const quantity = firstStringOrNumber(record, ["quantity", "qty", "holdingQuantity", "balanceQuantity"]);
  if (quantity === undefined) return undefined;

  const market = firstString(record, ["market"]);
  const currency = firstString(record, ["currency"]);

  const summary: TossReadOnlyHoldingSummary = { symbol, quantity };
  if (market !== undefined) summary.market = market;
  if (currency !== undefined) summary.currency = currency;
  return summary;
}

function firstString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}

function firstStringOrNumber(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

/** Masks all but the last 4 characters of an account number. */
function maskAccountNumber(accountNo: string): string {
  if (accountNo.length <= 4) return "*".repeat(accountNo.length);
  return "*".repeat(accountNo.length - 4) + accountNo.slice(-4);
}
