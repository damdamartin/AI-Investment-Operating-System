import { describe, expect, it } from "vitest";
import {
  createNewsDuplicateKey,
  NaverNewsAdapter,
  normalizeNaverNewsItem,
  stripHtml,
  type FetchLike
} from "../../src/index.js";

describe("NaverNewsAdapter", () => {
  it("normalizes Naver news responses and strips HTML", async () => {
    const adapter = new NaverNewsAdapter({
      clientId: "client-id",
      clientSecret: "client-secret",
      now: () => new Date("2026-01-01T00:01:00Z"),
      fetch: fakeFetch({
        ok: true,
        status: 200,
        body: {
          items: [
            {
              title: "<b>Apple</b> earnings &amp; guidance",
              originallink: "https://example.com/apple",
              link: "https://news.naver.com/apple",
              description: "Strong &quot;quarter&quot;",
              pubDate: "Thu, 01 Jan 2026 00:00:00 GMT"
            }
          ]
        }
      })
    });

    const result = await adapter.search({ query: "Apple", display: 10, sort: "date" });

    expect(result.ok).toBe(true);
    expect(result.ok && result.data[0]).toMatchObject({
      provider: "NAVER_NEWS",
      title: "Apple earnings & guidance",
      description: "Strong \"quarter\"",
      originalLink: "https://example.com/apple",
      providerLink: "https://news.naver.com/apple"
    });
  });

  it("skips malformed news items safely", () => {
    expect(
      normalizeNaverNewsItem(
        {
          title: "Missing date",
          link: "https://example.com"
        },
        new Date("2026-01-01T00:00:00Z")
      )
    ).toBeUndefined();
  });

  it("returns safe adapter errors on API failure", async () => {
    const adapter = new NaverNewsAdapter({
      clientId: "client-id",
      clientSecret: "client-secret",
      fetch: fakeFetch({
        ok: false,
        status: 429,
        body: {}
      })
    });

    const result = await adapter.search({ query: "Apple" });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.retryable).toBe(true);
    expect(!result.ok && result.error.code).toBe("HTTP_429");
  });

  it("creates stable duplicate keys from normalized title, link, and date", () => {
    const date = new Date("2026-01-01T10:00:00Z");

    expect(createNewsDuplicateKey("  Apple   Earnings ", "https://example.com/a", date)).toBe(
      "apple earnings|https://example.com/a|2026-01-01"
    );
  });

  it("strips simple HTML and entities", () => {
    expect(stripHtml("<b>A&amp;B</b> &quot;test&quot;")).toBe("A&B \"test\"");
  });
});

function fakeFetch(response: { ok: boolean; status: number; body: unknown }): FetchLike {
  return async () => ({
    ok: response.ok,
    status: response.status,
    async json() {
      return response.body;
    }
  });
}
