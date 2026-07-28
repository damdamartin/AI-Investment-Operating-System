import { describe, expect, it } from "vitest";
import { TossReadOnlyDryRunClient } from "../../src/index.js";

describe("TossReadOnlyDryRunClient", () => {
  it("prepares sanitized dry-run GET requests", () => {
    const client = clientForTest();
    const result = client.prepare({
      operation: "ACCOUNT_SNAPSHOT_READ",
      method: "GET",
      path: "/account",
      query: { market: "KR" }
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.data.url).toBe("https://toss.example/account?market=KR");
    expect(result.ok && result.data.headers["X-Toss-Client-Secret"]).toBe("****");
    expect(result.ok && result.data.body).toBeUndefined();
    expect(result.ok && result.data.dryRun).toBe(true);
  });

  it("allows POST only for authentication read dry-runs", () => {
    const client = clientForTest();
    const result = client.prepare({
      operation: "AUTHENTICATION_READ",
      method: "POST",
      path: "/oauth/token",
      body: { grantType: "client_credentials" }
    });

    expect(result.ok).toBe(true);
  });

  it("rejects POST for non-authentication reads", () => {
    const client = clientForTest();
    const result = client.prepare({
      operation: "POSITION_QUERY_READ",
      method: "POST",
      path: "/positions"
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe(
      "TOSS_READ_ONLY_POST_ALLOWED_ONLY_FOR_AUTHENTICATION_READ"
    );
  });

  it("rejects write-shaped request bodies", () => {
    const client = clientForTest();
    const result = client.prepare({
      operation: "ORDER_STATUS_QUERY_READ",
      method: "GET",
      path: "/orders/status",
      body: { submitOrder: { symbol: "005930" } }
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe("TOSS_READ_ONLY_FORBIDDEN_BODY_KEY");
  });

  it("requires normalized paths", () => {
    const client = clientForTest();
    const result = client.prepare({
      operation: "MARKET_DATA_READ",
      method: "GET",
      path: "market/price"
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe("TOSS_READ_ONLY_PATH_MUST_START_WITH_SLASH");
  });
});

function clientForTest(): TossReadOnlyDryRunClient {
  return new TossReadOnlyDryRunClient({
    baseUrl: "https://toss.example",
    clientId: "client-id",
    clientSecret: "client-secret",
    accountRef: "account-ref",
    now: () => new Date("2026-07-28T00:00:00Z")
  });
}
