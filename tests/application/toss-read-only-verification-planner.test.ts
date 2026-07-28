import { describe, expect, it } from "vitest";
import {
  loadAppConfig,
  TossReadOnlyVerificationPlanner,
  type TossReadOnlyEndpointCatalog,
  type TossReadOnlyEndpointCatalogItem
} from "../../src/index.js";

describe("TossReadOnlyVerificationPlanner", () => {
  it("builds sanitized dry-run requests from verified endpoints", () => {
    const result = new TossReadOnlyVerificationPlanner().plan({
      config: readyConfig(),
      catalog: catalog([
        endpoint({
          id: "account",
          operation: "ACCOUNT_SNAPSHOT_READ",
          path: "/v1/account"
        })
      ])
    });

    expect(result.ready).toBe(true);
    expect(result.preparedRequests).toHaveLength(1);
    expect(result.preparedRequests[0]?.url).toBe("https://toss.example/v1/account");
    expect(result.preparedRequests[0]?.headers["X-Toss-Client-Secret"]).toBe("****");
    expect(result.liveBrokerWriteAllowed).toBe(false);
    expect(result.networkCallsPerformed).toBe(false);
  });

  it("does not prepare requests when credentials are incomplete", () => {
    const result = new TossReadOnlyVerificationPlanner().plan({
      config: loadAppConfig({}, { requireExternalSecrets: false }),
      catalog: catalog([endpoint()])
    });

    expect(result.ready).toBe(false);
    expect(result.preparedRequests).toEqual([]);
    expect(result.reasonCodes).toContain("missing_or_placeholder_toss_client_secret");
  });

  it("does not prepare requests when the endpoint catalog is invalid", () => {
    const result = new TossReadOnlyVerificationPlanner().plan({
      config: readyConfig(),
      catalog: catalog([
        endpoint({
          id: "bad",
          method: "POST",
          operation: "POSITION_QUERY_READ"
        })
      ])
    });

    expect(result.ready).toBe(false);
    expect(result.preparedRequests).toEqual([]);
    expect(result.reasonCodes).toContain("post_allowed_only_for_authentication_bad");
  });

  it("skips unverified endpoints while keeping warnings visible", () => {
    const result = new TossReadOnlyVerificationPlanner().plan({
      config: readyConfig(),
      catalog: catalog([
        endpoint({
          id: "unverified",
          verified: false
        })
      ])
    });

    expect(result.ready).toBe(true);
    expect(result.preparedRequests).toEqual([]);
    expect(result.warnings).toContain("endpoint_not_verified_unverified");
  });

  it("does not leak secret values into the plan", () => {
    const result = new TossReadOnlyVerificationPlanner().plan({
      config: readyConfig(),
      catalog: catalog([endpoint()])
    });

    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("client-secret-value");
    expect(serialized).not.toContain("account-ref-value");
  });
});

function readyConfig() {
  return loadAppConfig({
    LIVE_TRADING_ENABLED: "false",
    TOSS_READ_ONLY_MODE: "true",
    TOSS_API_BASE_URL: "https://toss.example",
    TOSS_CLIENT_ID: "client-id-value",
    TOSS_CLIENT_SECRET: "client-secret-value",
    TOSS_ACCOUNT_REF: "account-ref-value"
  }, { requireExternalSecrets: false });
}

function catalog(items: TossReadOnlyEndpointCatalogItem[]): TossReadOnlyEndpointCatalog {
  return {
    catalogVersion: "1",
    updatedAt: new Date("2026-07-28T00:00:00Z"),
    items
  };
}

function endpoint(
  overrides: Partial<TossReadOnlyEndpointCatalogItem> = {}
): TossReadOnlyEndpointCatalogItem {
  return {
    id: "market",
    operation: "MARKET_DATA_READ",
    method: "GET",
    path: "/v1/market/price",
    evidenceKind: "MARKET_DATA_READ",
    relatedOpenQuestion: "OQ-004",
    source: "TOSS_OFFICIAL_DOCS",
    verified: true,
    notes: "Verified read-only endpoint.",
    ...overrides
  };
}
