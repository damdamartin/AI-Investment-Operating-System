import { describe, expect, it } from "vitest";
import {
  TossReadOnlyEndpointCatalogValidator,
  type TossReadOnlyEndpointCatalog,
  type TossReadOnlyEndpointCatalogItem
} from "../../src/index.js";

describe("TossReadOnlyEndpointCatalogValidator", () => {
  it("accepts verified read-only endpoint catalog items", () => {
    const result = new TossReadOnlyEndpointCatalogValidator().review(
      catalog([
        endpoint({
          id: "account-snapshot",
          operation: "ACCOUNT_SNAPSHOT_READ",
          method: "GET",
          path: "/v1/accounts/snapshot",
          evidenceKind: "ACCOUNT_SNAPSHOT_READ",
          relatedOpenQuestion: "OQ-002",
          verified: true
        })
      ])
    );

    expect(result.valid).toBe(true);
    expect(result.verifiedEndpointCount).toBe(1);
    expect(result.liveBrokerWriteAllowed).toBe(false);
  });

  it("rejects duplicate endpoint IDs", () => {
    const result = new TossReadOnlyEndpointCatalogValidator().review(
      catalog([
        endpoint({ id: "duplicate" }),
        endpoint({ id: "duplicate", path: "/v1/positions" })
      ])
    );

    expect(result.valid).toBe(false);
    expect(result.reasonCodes).toContain("duplicate_endpoint_id_duplicate");
  });

  it("requires normalized paths and open-question mapping", () => {
    const result = new TossReadOnlyEndpointCatalogValidator().review(
      catalog([
        endpoint({
          id: "bad",
          path: "v1/account",
          relatedOpenQuestion: "missing"
        })
      ])
    );

    expect(result.valid).toBe(false);
    expect(result.reasonCodes).toContain("endpoint_path_must_start_with_slash_bad");
    expect(result.reasonCodes).toContain("endpoint_missing_open_question_bad");
  });

  it("allows POST only for authentication reads", () => {
    const result = new TossReadOnlyEndpointCatalogValidator().review(
      catalog([
        endpoint({
          id: "bad-post",
          operation: "POSITION_QUERY_READ",
          method: "POST",
          path: "/v1/positions"
        })
      ])
    );

    expect(result.valid).toBe(false);
    expect(result.reasonCodes).toContain("post_allowed_only_for_authentication_bad-post");
  });

  it("warns about unverified endpoints without failing the catalog", () => {
    const result = new TossReadOnlyEndpointCatalogValidator().review(
      catalog([endpoint({ id: "unverified", verified: false })])
    );

    expect(result.valid).toBe(true);
    expect(result.warnings).toContain("endpoint_not_verified_unverified");
  });
});

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
    id: "market-data",
    operation: "MARKET_DATA_READ",
    method: "GET",
    path: "/v1/market/price",
    evidenceKind: "MARKET_DATA_READ",
    relatedOpenQuestion: "OQ-004",
    source: "TOSS_OFFICIAL_DOCS",
    verified: true,
    notes: "Example sanitized endpoint entry.",
    ...overrides
  };
}
