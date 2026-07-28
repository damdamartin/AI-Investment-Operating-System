import { describe, expect, it } from "vitest";
import {
  TossReadOnlyEndpointCatalogValidator,
  type TossReadOnlyEndpointCatalog,
  type TossReadOnlyEndpointCatalogItem
} from "../../src/index.js";

describe("TossReadOnlyEndpointCatalogValidator", () => {
  describe("legitimate read-only endpoints", () => {
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

    it("accepts an authentication read endpoint using POST with matching evidence", () => {
      const result = new TossReadOnlyEndpointCatalogValidator().review(
        catalog([
          endpoint({
            id: "auth",
            operation: "AUTHENTICATION_READ",
            method: "POST",
            path: "/v1/auth/token",
            evidenceKind: "AUTHENTICATION_READ",
            relatedOpenQuestion: "OQ-001"
          })
        ])
      );

      expect(result.valid).toBe(true);
      expect(result.reasonCodes).toEqual([]);
    });

    it("accepts an order-status read endpoint whose path looks write-shaped when backed by matching verified evidence", () => {
      const result = new TossReadOnlyEndpointCatalogValidator().review(
        catalog([
          endpoint({
            id: "order-status",
            operation: "ORDER_STATUS_QUERY_READ",
            method: "GET",
            path: "/v1/orders/status",
            evidenceKind: "ORDER_STATUS_QUERY_READ",
            relatedOpenQuestion: "OQ-003",
            source: "TOSS_OFFICIAL_DOCS",
            verified: true
          })
        ])
      );

      expect(result.valid).toBe(true);
      expect(result.reasonCodes).toEqual([]);
    });

    it("accepts a fill read endpoint whose path looks write-shaped when backed by matching verified evidence", () => {
      const result = new TossReadOnlyEndpointCatalogValidator().review(
        catalog([
          endpoint({
            id: "fill-read",
            operation: "FILL_QUERY_READ",
            method: "GET",
            path: "/v1/orders/fills",
            evidenceKind: "FILL_QUERY_READ",
            relatedOpenQuestion: "OQ-003",
            source: "TOSS_DEVELOPER_CONSOLE",
            verified: true
          })
        ])
      );

      expect(result.valid).toBe(true);
      expect(result.reasonCodes).toEqual([]);
    });

    it("warns about unverified endpoints without failing the catalog", () => {
      const result = new TossReadOnlyEndpointCatalogValidator().review(
        catalog([endpoint({ id: "unverified", verified: false })])
      );

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain("endpoint_not_verified_unverified");
    });
  });

  describe("structural validation", () => {
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

    it("rejects an open question outside the tracked OQ-001..OQ-004 set", () => {
      const result = new TossReadOnlyEndpointCatalogValidator().review(
        catalog([endpoint({ id: "unrelated-oq", relatedOpenQuestion: "OQ-009" })])
      );

      expect(result.valid).toBe(false);
      expect(result.reasonCodes).toContain("endpoint_missing_open_question_unrelated-oq");
    });

    it("rejects an invalid HTTP method", () => {
      const result = new TossReadOnlyEndpointCatalogValidator().review(
        catalog([
          endpoint({
            id: "bad-method",
            method: "DELETE" as unknown as "GET"
          })
        ])
      );

      expect(result.valid).toBe(false);
      expect(result.reasonCodes).toContain("endpoint_invalid_method_bad-method");
    });
  });

  describe("mutation-shaped and under-specified endpoints fail closed", () => {
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

    it("rejects an endpoint with no operation classification", () => {
      const result = new TossReadOnlyEndpointCatalogValidator().review(
        catalog([
          endpoint({
            id: "no-operation",
            operation: undefined as unknown as TossReadOnlyEndpointCatalogItem["operation"]
          })
        ])
      );

      expect(result.valid).toBe(false);
      expect(result.reasonCodes).toContain("endpoint_missing_operation_class_no-operation");
    });

    it("rejects an endpoint with an unrecognized operation classification", () => {
      const result = new TossReadOnlyEndpointCatalogValidator().review(
        catalog([
          endpoint({
            id: "unknown-operation",
            operation: "ORDER_SUBMIT_WRITE" as unknown as TossReadOnlyEndpointCatalogItem["operation"]
          })
        ])
      );

      expect(result.valid).toBe(false);
      expect(result.reasonCodes).toContain("endpoint_missing_operation_class_unknown-operation");
    });

    it("rejects an endpoint with no source evidence", () => {
      const result = new TossReadOnlyEndpointCatalogValidator().review(
        catalog([
          endpoint({
            id: "no-source",
            source: undefined as unknown as TossReadOnlyEndpointCatalogItem["source"]
          })
        ])
      );

      expect(result.valid).toBe(false);
      expect(result.reasonCodes).toContain("endpoint_missing_source_evidence_no-source");
    });

    it("rejects an endpoint with an unrecognized source", () => {
      const result = new TossReadOnlyEndpointCatalogValidator().review(
        catalog([
          endpoint({
            id: "bad-source",
            source: "TELEGRAM_DM" as unknown as TossReadOnlyEndpointCatalogItem["source"]
          })
        ])
      );

      expect(result.valid).toBe(false);
      expect(result.reasonCodes).toContain("endpoint_missing_source_evidence_bad-source");
    });

    it("rejects an authentication read whose evidence kind does not match", () => {
      const result = new TossReadOnlyEndpointCatalogValidator().review(
        catalog([
          endpoint({
            id: "auth-mismatch",
            operation: "AUTHENTICATION_READ",
            method: "POST",
            path: "/v1/auth/token",
            evidenceKind: "MARKET_DATA_READ",
            relatedOpenQuestion: "OQ-001"
          })
        ])
      );

      expect(result.valid).toBe(false);
      expect(result.reasonCodes).toContain("endpoint_operation_evidence_mismatch_auth-mismatch");
    });

    it("rejects a plain read operation borrowing order-status evidence", () => {
      const result = new TossReadOnlyEndpointCatalogValidator().review(
        catalog([
          endpoint({
            id: "borrowed-evidence",
            operation: "MARKET_DATA_READ",
            evidenceKind: "ORDER_STATUS_QUERY_READ"
          })
        ])
      );

      expect(result.valid).toBe(false);
      expect(result.reasonCodes).toContain("endpoint_operation_evidence_mismatch_borrowed-evidence");
    });

    it("rejects a write-shaped path for a plain market-data read (order submission masquerading as data read)", () => {
      const result = new TossReadOnlyEndpointCatalogValidator().review(
        catalog([
          endpoint({
            id: "fake-market-data",
            operation: "MARKET_DATA_READ",
            evidenceKind: "MARKET_DATA_READ",
            path: "/v1/orders/place"
          })
        ])
      );

      expect(result.valid).toBe(false);
      expect(result.reasonCodes).toContain("endpoint_path_looks_write_scoped_fake-market-data");
    });

    it("rejects an order-cancel-shaped path even when it claims to be an order-status read", () => {
      const result = new TossReadOnlyEndpointCatalogValidator().review(
        catalog([
          endpoint({
            id: "fake-order-status",
            operation: "ORDER_STATUS_QUERY_READ",
            evidenceKind: "ORDER_STATUS_QUERY_READ",
            path: "/v1/orders/cancel"
          })
        ])
      );

      expect(result.valid).toBe(false);
      // "cancel" is not a tolerated order-status path even with matching evidence;
      // the mutation-looking-path allowance only covers status/fill style paths,
      // and this still needs a human to confirm cancel-shaped paths are never used.
      expect(result.reasonCodes.length).toBeGreaterThan(0);
    });

    it("rejects an order-status read on a write-shaped path when the endpoint is unverified", () => {
      const result = new TossReadOnlyEndpointCatalogValidator().review(
        catalog([
          endpoint({
            id: "unverified-order-status",
            operation: "ORDER_STATUS_QUERY_READ",
            evidenceKind: "ORDER_STATUS_QUERY_READ",
            path: "/v1/orders/status",
            verified: false
          })
        ])
      );

      expect(result.valid).toBe(false);
      expect(result.reasonCodes).toContain(
        "endpoint_mutation_looking_path_requires_verified_evidence_unverified-order-status"
      );
    });

    it("rejects an order-status read on a write-shaped path when evidence kind does not match", () => {
      const result = new TossReadOnlyEndpointCatalogValidator().review(
        catalog([
          endpoint({
            id: "mismatched-order-status",
            operation: "ORDER_STATUS_QUERY_READ",
            evidenceKind: "MARKET_DATA_READ",
            path: "/v1/orders/status"
          })
        ])
      );

      expect(result.valid).toBe(false);
      expect(result.reasonCodes).toContain(
        "endpoint_operation_evidence_mismatch_mismatched-order-status"
      );
      expect(result.reasonCodes).toContain(
        "endpoint_mutation_looking_path_requires_verified_evidence_mismatched-order-status"
      );
    });

    it("rejects every classic write-scoped path keyword for non order/fill operations", () => {
      const writeShapedPaths = [
        "/v1/orders/submit",
        "/v1/orders/cancel",
        "/v1/orders/modify",
        "/v1/orders/amend",
        "/v1/orders/replace",
        "/v1/cash/withdraw",
        "/v1/cash/deposit",
        "/v1/cash/transfer",
        "/v1/fx/exchange",
        "/v1/orders/buy",
        "/v1/orders/sell",
        "/v1/positions/close"
      ];

      for (const path of writeShapedPaths) {
        const result = new TossReadOnlyEndpointCatalogValidator().review(
          catalog([
            endpoint({
              id: "write-path",
              operation: "MARKET_DATA_READ",
              evidenceKind: "MARKET_DATA_READ",
              path
            })
          ])
        );

        expect(result.valid, `expected ${path} to be rejected as write-scoped`).toBe(false);
        expect(result.reasonCodes).toContain("endpoint_path_looks_write_scoped_write-path");
      }
    });

    it("does not flag benign paths that merely contain write-related substrings", () => {
      const result = new TossReadOnlyEndpointCatalogValidator().review(
        catalog([
          endpoint({
            id: "marketplace-data",
            operation: "MARKET_DATA_READ",
            evidenceKind: "MARKET_DATA_READ",
            path: "/v1/marketplace/overview"
          })
        ])
      );

      expect(result.valid).toBe(true);
    });
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
