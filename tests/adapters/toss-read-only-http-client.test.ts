import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { TOSS_READ_ONLY_HTTP_CLIENT_ALLOWED_OPERATIONS, TossReadOnlyHttpClient } from "../../src/index.js";

// SAFETY: every server started in this file is a local node:http mock bound to
// 127.0.0.1 on an OS-assigned ephemeral port. No test in this file ever
// contacts the real Toss Securities API or the real internet. No `.env` file
// is read, printed, or referenced anywhere in this file.

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections();
          server.close(() => resolve());
        })
    )
  );
});

describe("TossReadOnlyHttpClient", () => {
  it("exposes hardcoded safety metadata that matches the fixed read-only allow-list", () => {
    const client = new TossReadOnlyHttpClient({
      baseUrl: "https://openapi.tossinvest.com",
      clientId: "client-id",
      clientSecret: "client-secret"
    });

    expect(client.liveBrokerWriteAllowed).toBe(false);
    expect(client.allowedOperations).toEqual([
      "AUTHENTICATION_READ",
      "ACCOUNT_SNAPSHOT_READ",
      "POSITION_QUERY_READ",
      "MARKET_DATA_READ"
    ]);
    expect(client.getSafetyReport()).toEqual({
      liveBrokerWriteAllowed: false,
      allowedOperations: TOSS_READ_ONLY_HTTP_CLIENT_ALLOWED_OPERATIONS,
      safetyType: "TOSS_READ_ONLY_HTTP_CLIENT_REPORT"
    });
  });

  it("has no public API surface capable of constructing a write-looking request", () => {
    const client = new TossReadOnlyHttpClient({
      baseUrl: "https://openapi.tossinvest.com",
      clientId: "client-id",
      clientSecret: "client-secret"
    });

    // Only these methods are reachable at runtime. Internal helpers (token
    // caching, URL building, error shaping) are true ES `#private` methods, not
    // just TypeScript `private` - they never appear on the prototype and cannot
    // be called or reflected on from outside the class. There is no generic
    // request(path, method, body) method, so no caller can reach
    // POST /api/v1/orders or any other write path through this client - this is
    // "cannot construct one", not merely "reject a write request".
    const publicMethodNames = Object.getOwnPropertyNames(Object.getPrototypeOf(client)).filter(
      (name) => name !== "constructor"
    );
    expect(publicMethodNames.sort()).toEqual([
      "authenticate",
      "getAccounts",
      "getHoldings",
      "getMarketPrices",
      "getSafetyReport"
    ]);
    expect(publicMethodNames).not.toContain("request");
    expect(publicMethodNames).not.toContain("submitOrder");
    expect(publicMethodNames).not.toContain("cancelOrder");
    expect(publicMethodNames).not.toContain("ensureToken");
    expect((client as unknown as Record<string, unknown>)["submitOrder"]).toBeUndefined();
  });

  it("authenticates against the token endpoint and never returns the raw token value", async () => {
    const server = await startMockTossServer({
      tokenStatus: 200,
      tokenBody: { access_token: "mock-access-token-should-never-leak", token_type: "Bearer", expires_in: 3600 },
      accountsStatus: 200,
      accountsBody: { result: [] },
      holdingsStatus: 200,
      holdingsBody: { result: [] }
    });
    const client = clientFor(server.url);

    const result = await client.authenticate();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.data).toEqual({
      tokenType: "Bearer",
      obtainedAt: expect.any(Date),
      expiresInSeconds: 3600
    });
    expect(result.metadata.liveBrokerWriteAllowed).toBe(false);
    expect(result.metadata.allowedOperations).toEqual(TOSS_READ_ONLY_HTTP_CLIENT_ALLOWED_OPERATIONS);

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("mock-access-token-should-never-leak");
    expect(serialized).not.toContain("client-secret-value");
  });

  it("fetches account snapshots and masks account numbers, never returning them raw", async () => {
    const server = await startMockTossServer({
      tokenStatus: 200,
      tokenBody: { access_token: "mock-access-token", token_type: "Bearer" },
      accountsStatus: 200,
      accountsBody: {
        result: [
          { accountSeq: 7, accountNo: "123-456-SECRET-7890" },
          { accountSeq: 8 }
        ]
      },
      holdingsStatus: 200,
      holdingsBody: { result: [] }
    });
    const client = clientFor(server.url);

    const result = await client.getAccounts();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.data).toEqual([
      { accountRef: "7", maskedAccountNumber: "***************7890" },
      { accountRef: "8" }
    ]);
    expect(result.metadata.liveBrokerWriteAllowed).toBe(false);

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("123-456-SECRET-7890");
    expect(serialized).not.toContain("mock-access-token");
  });

  it("fetches holdings and returns only typed, sanitized summaries", async () => {
    const server = await startMockTossServer({
      tokenStatus: 200,
      tokenBody: { access_token: "mock-access-token", token_type: "Bearer" },
      accountsStatus: 200,
      accountsBody: { result: [] },
      holdingsStatus: 200,
      holdingsBody: {
        result: {
          items: [
            { symbol: "005930", quantity: "10", market: "KR", currency: "KRW" },
            { notASymbolField: "ignored" }
          ]
        }
      }
    });
    const client = clientFor(server.url);

    const result = await client.getHoldings();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.data).toEqual([{ symbol: "005930", quantity: "10", market: "KR", currency: "KRW" }]);
    expect(result.metadata.liveBrokerWriteAllowed).toBe(false);
  });

  it("reuses a cached token across getAccounts, getHoldings, and getMarketPrices instead of re-authenticating", async () => {
    let tokenRequestCount = 0;
    const server = await startMockTossServer({
      tokenStatus: 200,
      tokenBody: { access_token: "mock-access-token", token_type: "Bearer" },
      accountsStatus: 200,
      accountsBody: { result: [] },
      holdingsStatus: 200,
      holdingsBody: { result: [] },
      pricesStatus: 200,
      pricesBody: { result: [] },
      onTokenRequest: () => {
        tokenRequestCount += 1;
      }
    });
    const client = clientFor(server.url);

    await client.getAccounts();
    await client.getHoldings();
    await client.getMarketPrices();

    expect(tokenRequestCount).toBe(1);
  });

  it("fetches market prices and returns only a sanitized item count, never raw prices or symbols", async () => {
    const server = await startMockTossServer({
      tokenStatus: 200,
      tokenBody: { access_token: "mock-access-token", token_type: "Bearer" },
      accountsStatus: 200,
      accountsBody: { result: [] },
      holdingsStatus: 200,
      holdingsBody: { result: [] },
      pricesStatus: 200,
      pricesBody: {
        result: [
          { symbol: "005930", price: "71000" },
          { symbol: "AAPL", price: "150.25" }
        ]
      }
    });
    const client = clientFor(server.url);

    const result = await client.getMarketPrices();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.data).toEqual({ itemCount: 2 });
    expect(result.metadata.liveBrokerWriteAllowed).toBe(false);
    expect(result.metadata.allowedOperations).toEqual(TOSS_READ_ONLY_HTTP_CLIENT_ALLOWED_OPERATIONS);

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("005930");
    expect(serialized).not.toContain("AAPL");
    expect(serialized).not.toContain("71000");
    expect(serialized).not.toContain("150.25");
    expect(serialized).not.toContain("mock-access-token");
  });

  it("fails closed with a sanitized reason code when the market-prices endpoint returns non-2xx", async () => {
    const server = await startMockTossServer({
      tokenStatus: 200,
      tokenBody: { access_token: "mock-access-token", token_type: "Bearer" },
      accountsStatus: 200,
      accountsBody: { result: [] },
      holdingsStatus: 200,
      holdingsBody: { result: [] },
      pricesStatus: 503,
      pricesBody: { error: "service_unavailable" }
    });
    const client = clientFor(server.url);

    const result = await client.getMarketPrices();

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure result");
    expect(result.error.code).toBe("TOSS_HTTP_MARKET_PRICES_REQUEST_FAILED_STATUS_503");
    expect(result.error.retryable).toBe(true);
    expect(result.error.liveBrokerWriteAllowed).toBe(false);
  });

  it("fails closed with a sanitized reason code when the market-prices response is not a list shape", async () => {
    const server = await startMockTossServer({
      tokenStatus: 200,
      tokenBody: { access_token: "mock-access-token", token_type: "Bearer" },
      accountsStatus: 200,
      accountsBody: { result: [] },
      holdingsStatus: 200,
      holdingsBody: { result: [] },
      pricesStatus: 200,
      pricesBody: { unexpected: "shape" }
    });
    const client = clientFor(server.url);

    const result = await client.getMarketPrices();

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure result");
    expect(result.error.code).toBe("TOSS_HTTP_MARKET_PRICES_RESPONSE_INVALID_SHAPE");
    expect(result.error.liveBrokerWriteAllowed).toBe(false);
  });

  it("sends only the bearer token to market prices, with no account-scoped header", async () => {
    const receivedHeaders: IncomingMessage["headers"][] = [];
    const server = await startMockTossServer({
      tokenStatus: 200,
      tokenBody: { access_token: "mock-access-token", token_type: "Bearer" },
      accountsStatus: 200,
      accountsBody: { result: [] },
      holdingsStatus: 200,
      holdingsBody: { result: [] },
      pricesStatus: 200,
      pricesBody: { result: [] },
      onPricesRequest: (headers) => {
        receivedHeaders.push(headers);
      }
    });
    const client = clientFor(server.url);

    await client.getMarketPrices();

    expect(receivedHeaders).toHaveLength(1);
    expect(receivedHeaders[0]?.authorization).toBe("Bearer mock-access-token");
    expect(receivedHeaders[0]?.["x-tossinvest-account"]).toBeUndefined();
  });

  it("fails closed with a sanitized reason code when the token endpoint returns non-2xx", async () => {
    const server = await startMockTossServer({
      tokenStatus: 401,
      tokenBody: { error: "invalid_client", error_description: "client-secret-value-should-not-leak" },
      accountsStatus: 200,
      accountsBody: { result: [] },
      holdingsStatus: 200,
      holdingsBody: { result: [] }
    });
    const client = clientFor(server.url);

    const result = await client.authenticate();

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure result");
    expect(result.error.code).toBe("TOSS_HTTP_TOKEN_REQUEST_FAILED_STATUS_401");
    expect(result.error.liveBrokerWriteAllowed).toBe(false);
    expect(result.error.retryable).toBe(false);

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("client-secret-value-should-not-leak");
    expect(serialized).not.toContain("invalid_client");
  });

  it("fails closed with a sanitized reason code when the accounts endpoint returns non-2xx", async () => {
    const server = await startMockTossServer({
      tokenStatus: 200,
      tokenBody: { access_token: "mock-access-token", token_type: "Bearer" },
      accountsStatus: 500,
      accountsBody: { error: "internal_error" },
      holdingsStatus: 200,
      holdingsBody: { result: [] }
    });
    const client = clientFor(server.url);

    const result = await client.getAccounts();

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure result");
    expect(result.error.code).toBe("TOSS_HTTP_ACCOUNTS_REQUEST_FAILED_STATUS_500");
    expect(result.error.retryable).toBe(true);
    expect(result.error.liveBrokerWriteAllowed).toBe(false);
  });

  it("fails closed with a sanitized reason code when the holdings endpoint returns non-2xx", async () => {
    const server = await startMockTossServer({
      tokenStatus: 200,
      tokenBody: { access_token: "mock-access-token", token_type: "Bearer" },
      accountsStatus: 200,
      accountsBody: { result: [] },
      holdingsStatus: 403,
      holdingsBody: { error: "forbidden" }
    });
    const client = clientFor(server.url);

    const result = await client.getHoldings();

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure result");
    expect(result.error.code).toBe("TOSS_HTTP_HOLDINGS_REQUEST_FAILED_STATUS_403");
    expect(result.error.retryable).toBe(false);
    expect(result.error.liveBrokerWriteAllowed).toBe(false);
  });

  it("fails closed when the token response is missing an access token", async () => {
    const server = await startMockTossServer({
      tokenStatus: 200,
      tokenBody: { token_type: "Bearer" },
      accountsStatus: 200,
      accountsBody: { result: [] },
      holdingsStatus: 200,
      holdingsBody: { result: [] }
    });
    const client = clientFor(server.url);

    const result = await client.authenticate();

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure result");
    expect(result.error.code).toBe("TOSS_HTTP_TOKEN_RESPONSE_MISSING_ACCESS_TOKEN");
    expect(result.error.liveBrokerWriteAllowed).toBe(false);
  });

  it("rejects a non-https, non-local base URL at construction time", () => {
    expect(
      () =>
        new TossReadOnlyHttpClient({
          baseUrl: "http://example.com",
          clientId: "client-id",
          clientSecret: "client-secret"
        })
    ).toThrow(/https/);
  });

  it("accepts the official https Toss base URL without making a network call", () => {
    expect(
      () =>
        new TossReadOnlyHttpClient({
          baseUrl: "https://openapi.tossinvest.com",
          clientId: "client-id",
          clientSecret: "client-secret"
        })
    ).not.toThrow();
  });

  it("sends only the bearer token to accounts and adds the account header for holdings", async () => {
    const receivedAuthHeaders: string[] = [];
    const receivedAccountHeaders: string[] = [];
    const server = await startMockTossServer({
      tokenStatus: 200,
      tokenBody: { access_token: "mock-access-token", token_type: "Bearer" },
      accountsStatus: 200,
      accountsBody: { result: [] },
      holdingsStatus: 200,
      holdingsBody: { result: [] },
      onAccountsRequest: (headers) => {
        receivedAuthHeaders.push(String(headers.authorization ?? ""));
      },
      onHoldingsRequest: (headers) => {
        receivedAuthHeaders.push(String(headers.authorization ?? ""));
        receivedAccountHeaders.push(String(headers["x-tossinvest-account"] ?? ""));
      }
    });
    const client = clientFor(server.url);

    await client.getAccounts();
    await client.getHoldings();

    expect(receivedAuthHeaders).toEqual(["Bearer mock-access-token", "Bearer mock-access-token"]);
    expect(receivedAccountHeaders).toEqual(["fixture-account-ref"]);
    expect(receivedAuthHeaders.join(" ")).not.toContain("client-secret-value");
    expect(receivedAccountHeaders.join(" ")).not.toContain("client-secret-value");
  });
});

function clientFor(baseUrl: string): TossReadOnlyHttpClient {
  return new TossReadOnlyHttpClient({
    baseUrl,
    clientId: "client-id-value",
    clientSecret: "client-secret-value",
    accountRef: "fixture-account-ref",
    now: () => new Date("2026-07-28T00:00:00Z")
  });
}

function startMockTossServer(config: {
  tokenStatus: number;
  tokenBody: unknown;
  accountsStatus: number;
  accountsBody: unknown;
  holdingsStatus: number;
  holdingsBody: unknown;
  pricesStatus?: number;
  pricesBody?: unknown;
  onTokenRequest?: () => void;
  onAccountsRequest?: (headers: IncomingMessage["headers"]) => void;
  onHoldingsRequest?: (headers: IncomingMessage["headers"]) => void;
  onPricesRequest?: (headers: IncomingMessage["headers"]) => void;
}): Promise<{ url: string }> {
  return new Promise((resolve) => {
    const server = createServer((request: IncomingMessage, response: ServerResponse) => {
      response.setHeader("connection", "close");

      if (request.method === "POST" && request.url === "/oauth2/token") {
        config.onTokenRequest?.();
        request.on("data", () => {});
        request.on("end", () => {
          response.writeHead(config.tokenStatus, { "content-type": "application/json" });
          response.end(JSON.stringify(config.tokenBody));
        });
        return;
      }

      if (request.method === "GET" && request.url === "/api/v1/accounts") {
        config.onAccountsRequest?.(request.headers);
        request.on("data", () => {});
        request.on("end", () => {
          response.writeHead(config.accountsStatus, { "content-type": "application/json" });
          response.end(JSON.stringify(config.accountsBody));
        });
        return;
      }

      if (request.method === "GET" && request.url === "/api/v1/holdings") {
        config.onHoldingsRequest?.(request.headers);
        request.on("data", () => {});
        request.on("end", () => {
          response.writeHead(config.holdingsStatus, { "content-type": "application/json" });
          response.end(JSON.stringify(config.holdingsBody));
        });
        return;
      }

      if (request.method === "GET" && request.url?.startsWith("/api/v1/prices")) {
        const url = new URL(request.url, "http://127.0.0.1");
        if (url.searchParams.get("symbols") !== "005930") {
          response.writeHead(400, { "content-type": "application/json" });
          response.end(JSON.stringify({ error: "missing-symbols" }));
          return;
        }
        config.onPricesRequest?.(request.headers);
        request.on("data", () => {});
        request.on("end", () => {
          response.writeHead(config.pricesStatus ?? 200, { "content-type": "application/json" });
          response.end(JSON.stringify(config.pricesBody ?? { result: [] }));
        });
        return;
      }

      // Any other path (e.g. a write-looking /api/v1/orders) is not implemented
      // by this mock server at all - it deliberately does not exist, mirroring
      // that the client has no code path that could reach it.
      request.resume();
      request.on("end", () => {
        response.writeHead(404, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: "not-found" }));
      });
    });

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (typeof address === "object" && address) {
        servers.push(server);
        resolve({ url: `http://127.0.0.1:${address.port}` });
      }
    });
  });
}
