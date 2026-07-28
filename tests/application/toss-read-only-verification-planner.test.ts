import { describe, expect, it } from "vitest";
import {
  loadAppConfig,
  TossReadOnlyVerificationPlanner,
  TossReadOnlyOneCallHarness,
  TossReadOnlyCallApprovalLedger,
  TossReadOnlyEvidenceRecorder,
  type TossReadOnlyEndpointCatalog,
  type TossReadOnlyEndpointCatalogItem,
  type TossReadOnlyCallApprovalRecord
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

describe("TossReadOnlyOneCallHarness", () => {
  it("prepares exactly one sanitized dry-run request scoped to the approved endpoint", () => {
    const result = new TossReadOnlyOneCallHarness().prepare({
      config: readyConfig(),
      catalog: catalog([
        endpoint({
          id: "account-snapshot-read-endpoint",
          operation: "ACCOUNT_SNAPSHOT_READ",
          evidenceKind: "ACCOUNT_SNAPSHOT_READ",
          path: "/v1/account"
        }),
        endpoint({
          id: "market-data-read-endpoint",
          operation: "MARKET_DATA_READ",
          evidenceKind: "MARKET_DATA_READ",
          path: "/v1/market/price"
        })
      ]),
      approval: approval()
    });

    expect(result.ready).toBe(true);
    expect(result.scopedOperation).toBe("ACCOUNT_SNAPSHOT_READ");
    expect(result.expectedEvidenceKind).toBe("ACCOUNT_SNAPSHOT_READ");
    expect(result.preparedRequest).toBeDefined();
    expect(result.preparedRequest?.url).toBe("https://toss.example/v1/account");
    expect(result.approvalConsumed).toBe(true);
    expect(result.liveBrokerWriteAllowed).toBe(false);
    expect(result.networkCallsPerformed).toBe(false);
  });

  it("performs no network calls even when preparation succeeds", () => {
    const globalWithFetch = globalThis as { fetch?: unknown };
    const originalFetch = globalWithFetch.fetch;
    let fetchCalled = false;
    globalWithFetch.fetch = () => {
      fetchCalled = true;
      throw new Error("network calls are forbidden in this harness");
    };

    try {
      const result = new TossReadOnlyOneCallHarness().prepare({
        config: readyConfig(),
        catalog: catalog([accountSnapshotEndpoint()]),
        approval: approval()
      });

      expect(result.ready).toBe(true);
      expect(fetchCalled).toBe(false);
    } finally {
      globalWithFetch.fetch = originalFetch;
    }
  });

  it("rejects a second attempt to consume the same approval, proving it is not unbounded", () => {
    const ledger = new TossReadOnlyCallApprovalLedger();
    const cat = catalog([accountSnapshotEndpoint()]);
    const harness = new TossReadOnlyOneCallHarness();

    const first = harness.prepare({ config: readyConfig(), catalog: cat, approval: approval(), ledger });
    expect(first.ready).toBe(true);
    expect(first.approvalConsumed).toBe(true);

    const second = harness.prepare({ config: readyConfig(), catalog: cat, approval: approval(), ledger });
    expect(second.ready).toBe(false);
    expect(second.approvalConsumed).toBe(false);
    expect(second.reasonCodes).toContain("approval_already_consumed");
    expect(second.preparedRequest).toBeUndefined();
  });

  it("fails closed when the endpoint evidence kind does not match the approval's expected evidence kind", () => {
    const result = new TossReadOnlyOneCallHarness().prepare({
      config: readyConfig(),
      catalog: catalog([
        endpoint({
          id: "account-snapshot-read-endpoint",
          operation: "ACCOUNT_SNAPSHOT_READ",
          evidenceKind: "MARKET_DATA_READ"
        })
      ]),
      approval: approval({ expectedEvidenceKind: "ACCOUNT_SNAPSHOT_READ" })
    });

    expect(result.ready).toBe(false);
    expect(result.reasonCodes).toContain("approval_expected_evidence_kind_does_not_match_endpoint");
    expect(result.preparedRequest).toBeUndefined();
    expect(result.approvalConsumed).toBe(false);
  });

  it("fails closed when the endpoint operation does not match the approved operation", () => {
    const result = new TossReadOnlyOneCallHarness().prepare({
      config: readyConfig(),
      catalog: catalog([
        endpoint({
          id: "account-snapshot-read-endpoint",
          operation: "MARKET_DATA_READ",
          evidenceKind: "ACCOUNT_SNAPSHOT_READ"
        })
      ]),
      approval: approval({ approvedOperation: "ACCOUNT_SNAPSHOT_READ", expectedEvidenceKind: "ACCOUNT_SNAPSHOT_READ" })
    });

    expect(result.ready).toBe(false);
    expect(result.reasonCodes).toContain("approval_operation_does_not_match_endpoint");
  });

  it("fails closed when the approval references an endpoint id that is not in the catalog", () => {
    const result = new TossReadOnlyOneCallHarness().prepare({
      config: readyConfig(),
      catalog: catalog([endpoint({ id: "some-other-endpoint" })]),
      approval: approval({ endpointCatalogReference: "account-snapshot-read-endpoint" })
    });

    expect(result.ready).toBe(false);
    expect(result.reasonCodes).toContain("approval_endpoint_catalog_reference_not_found");
  });

  it("rejects a write-scoped approval operation, keeping live broker writes blocked", () => {
    const raw = JSON.parse(
      JSON.stringify(
        approval({ approvedOperation: "CANCEL_ORDER" as TossReadOnlyCallApprovalRecord["approvedOperation"] })
      )
    ) as TossReadOnlyCallApprovalRecord;

    const result = new TossReadOnlyOneCallHarness().prepare({
      config: readyConfig(),
      catalog: catalog([accountSnapshotEndpoint()]),
      approval: raw
    });

    expect(result.ready).toBe(false);
    expect(result.reasonCodes).toContain("approval_operation_looks_write_scoped");
    expect(result.liveBrokerWriteAllowed).toBe(false);
    expect(result.approvalConsumed).toBe(false);
  });

  it("does not leak secret configuration values into the harness result", () => {
    const result = new TossReadOnlyOneCallHarness().prepare({
      config: readyConfig(),
      catalog: catalog([accountSnapshotEndpoint()]),
      approval: approval()
    });

    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("client-secret-value");
    expect(serialized).not.toContain("account-ref-value");
  });

  it("connects a successfully prepared call to a recorder result that matches the approval scope", () => {
    const result = new TossReadOnlyOneCallHarness().prepare({
      config: readyConfig(),
      catalog: catalog([accountSnapshotEndpoint()]),
      approval: approval()
    });

    expect(result.ready).toBe(true);

    const evidence = new TossReadOnlyEvidenceRecorder().record({
      id: "account-snapshot-evidence",
      kind: result.expectedEvidenceKind!,
      mode: "READ_ONLY_API_CALL",
      relatedOpenQuestion: "OQ-002",
      summary: "Account snapshot read completed for the single approved call.",
      payload: { permissionStatus: "READ_ONLY" },
      approval: approval()
    });

    expect(evidence.approvalScope.matchesApprovedScope).toBe(true);
    expect(evidence.readyForManifest).toBe(true);
    expect(evidence.item.liveWriteOperation).toBe(false);
  });
});

function approval(overrides: Partial<TossReadOnlyCallApprovalRecord> = {}): TossReadOnlyCallApprovalRecord {
  return {
    approvalVersion: "1",
    id: "approval-account-snapshot",
    approvedOperation: "ACCOUNT_SNAPSHOT_READ",
    approvedAt: new Date("2026-07-28T00:00:00Z"),
    operatorNote: "Operator approved one scoped account snapshot read for local verification.",
    endpointCatalogReference: "account-snapshot-read-endpoint",
    expectedEvidenceKind: "ACCOUNT_SNAPSHOT_READ",
    singleUseAcknowledged: true,
    liveBrokerWritesRemainBlocked: true,
    ...overrides
  };
}

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

/**
 * Matches the default `approval()` fixture below: a single verified
 * ACCOUNT_SNAPSHOT_READ endpoint referenced by id `account-snapshot-read-endpoint`.
 */
function accountSnapshotEndpoint(
  overrides: Partial<TossReadOnlyEndpointCatalogItem> = {}
): TossReadOnlyEndpointCatalogItem {
  return endpoint({
    id: "account-snapshot-read-endpoint",
    operation: "ACCOUNT_SNAPSHOT_READ",
    evidenceKind: "ACCOUNT_SNAPSHOT_READ",
    path: "/v1/account",
    relatedOpenQuestion: "OQ-002",
    ...overrides
  });
}
