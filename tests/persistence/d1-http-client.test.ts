import { describe, expect, it, vi } from "vitest";
import { D1HttpClient, D1HttpClientError, type D1HttpFetchLike } from "../../src/persistence/d1-http-client.js";

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe("D1HttpClient", () => {
  it("sends the sql and params to the correct D1 REST endpoint with the bearer token", async () => {
    const fetchMock = vi.fn<D1HttpFetchLike>(async () =>
      jsonResponse(200, { result: [{ results: [{ id: "abc" }], success: true, meta: {} }] })
    );
    const client = new D1HttpClient({ accountId: "acct-1", databaseId: "db-1", apiToken: "secret-token", fetch: fetchMock });

    const result = await client.query("select * from assets where id = ?", ["abc"]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.cloudflare.com/client/v4/accounts/acct-1/d1/database/db-1/query");
    expect(init.headers.authorization).toBe("Bearer secret-token");
    expect(JSON.parse(init.body)).toEqual({ sql: "select * from assets where id = ?", params: ["abc"] });
    expect(result.results).toEqual([{ id: "abc" }]);
  });

  it("throws a sanitized error (no token leakage) when the request fails", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(401, { errors: [{ message: "Invalid token" }] }));
    const client = new D1HttpClient({ accountId: "acct-1", databaseId: "db-1", apiToken: "secret-token", fetch: fetchMock });

    await expect(client.query("select 1")).rejects.toThrow(D1HttpClientError);
    await expect(client.query("select 1")).rejects.not.toThrow(/secret-token/);
  });

  it("throws when the network call itself fails", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("network down");
    });
    const client = new D1HttpClient({ accountId: "acct-1", databaseId: "db-1", apiToken: "secret-token", fetch: fetchMock });

    await expect(client.query("select 1")).rejects.toThrow(D1HttpClientError);
  });

  it("requires accountId, databaseId, and apiToken", () => {
    expect(() => new D1HttpClient({ accountId: "", databaseId: "db-1", apiToken: "t" })).toThrow(D1HttpClientError);
    expect(() => new D1HttpClient({ accountId: "a", databaseId: "", apiToken: "t" })).toThrow(D1HttpClientError);
    expect(() => new D1HttpClient({ accountId: "a", databaseId: "db-1", apiToken: "" })).toThrow(D1HttpClientError);
  });
});
