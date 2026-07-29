/**
 * Thin HTTP client for Cloudflare D1's REST query API. Used by the
 * orchestrator when it runs outside a Cloudflare Worker (e.g. a GitHub
 * Actions Node process), where there is no native D1 binding available.
 *
 * This client only ever issues SQL the caller supplies - it has no
 * broker/order semantics of its own. Safety for the trading pipeline lives in
 * the application layer (risk engine, money management, kill switch), not
 * here.
 */

export type D1HttpFetchLike = (url: string, init: D1HttpRequestInit) => Promise<D1HttpFetchResponse>;

export interface D1HttpRequestInit {
  method: "POST";
  headers: Record<string, string>;
  body: string;
}

export interface D1HttpFetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export interface D1HttpClientOptions {
  accountId: string;
  databaseId: string;
  apiToken: string;
  fetch?: D1HttpFetchLike;
  baseUrl?: string;
}

export interface D1QueryResultRow {
  [column: string]: string | number | boolean | null;
}

export interface D1QueryResult {
  results: D1QueryResultRow[];
  success: boolean;
  meta: {
    changes?: number;
    last_row_id?: number;
    rows_read?: number;
    rows_written?: number;
  };
}

export class D1HttpClientError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "D1HttpClientError";
  }
}

const DEFAULT_BASE_URL = "https://api.cloudflare.com/client/v4";

/**
 * Narrow, single-purpose D1 REST client. The API token is held in a private
 * field and never included in any thrown error or returned value.
 */
export class D1HttpClient {
  readonly #accountId: string;
  readonly #databaseId: string;
  readonly #apiToken: string;
  readonly #fetchImpl: D1HttpFetchLike;
  readonly #baseUrl: string;

  constructor(options: D1HttpClientOptions) {
    if (!options.accountId) throw new D1HttpClientError("D1HttpClient requires accountId.");
    if (!options.databaseId) throw new D1HttpClientError("D1HttpClient requires databaseId.");
    if (!options.apiToken) throw new D1HttpClientError("D1HttpClient requires apiToken.");

    this.#accountId = options.accountId;
    this.#databaseId = options.databaseId;
    this.#apiToken = options.apiToken;
    this.#fetchImpl = options.fetch ?? defaultFetch;
    this.#baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  }

  async query(sql: string, params: ReadonlyArray<string | number | boolean | null> = []): Promise<D1QueryResult> {
    const url = `${this.#baseUrl}/accounts/${this.#accountId}/d1/database/${this.#databaseId}/query`;

    let response: D1HttpFetchResponse;
    try {
      response = await this.#fetchImpl(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.#apiToken}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({ sql, params })
      });
    } catch {
      throw new D1HttpClientError("D1 query request failed before receiving a response.");
    }

    const payload = (await safeJson(response)) as
      | { result?: D1QueryResult[]; errors?: Array<{ message: string }> }
      | undefined;

    if (!response.ok) {
      const message = payload?.errors?.map((error) => error.message).join("; ") ?? `status ${response.status}`;
      throw new D1HttpClientError(`D1 query failed: ${message}`, response.status);
    }

    const result = payload?.result?.[0];
    if (!result) {
      throw new D1HttpClientError("D1 query response had no result.");
    }

    return result;
  }
}

async function safeJson(response: D1HttpFetchResponse): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function defaultFetch(url: string, init: D1HttpRequestInit): Promise<D1HttpFetchResponse> {
  return fetch(url, init);
}
