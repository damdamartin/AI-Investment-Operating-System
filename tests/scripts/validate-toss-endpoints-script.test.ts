import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, "..", "..");
const scriptPath = join(repoRoot, "scripts", "validate-toss-endpoints.mjs");

describe("validate-toss-endpoints script", () => {
  it("validates the example endpoint catalog without enabling broker writes", () => {
    const output = runScript("docs/phase5/toss-read-only-endpoints.example.json");
    const report = JSON.parse(output);

    expect(report.valid).toBe(true);
    expect(report.itemCount).toBe(1);
    expect(report.liveBrokerWriteAllowed).toBe(false);
    expect(report.warnings).toContain("endpoint_not_verified_account-snapshot-example");
  });

  it("fails closed for invalid endpoint catalogs", () => {
    const path = tempCatalog({
      catalogVersion: "1",
      items: [
        {
          id: "bad",
          operation: "POSITION_QUERY_READ",
          method: "POST",
          path: "positions",
          relatedOpenQuestion: "missing",
          verified: true
        }
      ]
    });
    let output = "";

    try {
      output = runScript(path);
    } catch (error) {
      output = String((error as { stdout?: Buffer }).stdout);
    }

    const report = JSON.parse(output);

    expect(report.valid).toBe(false);
    expect(report.reasonCodes).toContain("endpoint_path_must_start_with_slash_bad");
    expect(report.reasonCodes).toContain("post_allowed_only_for_authentication_bad");
    expect(report.reasonCodes).toContain("endpoint_missing_open_question_bad");
  });

  it("reports missing files without throwing secret-like data", () => {
    let output = "";

    try {
      output = runScript("missing-endpoints.json");
    } catch (error) {
      output = String((error as { stdout?: Buffer }).stdout);
    }

    const report = JSON.parse(output);

    expect(report.valid).toBe(false);
    expect(report.reasonCodes).toContain("endpoint_catalog_file_missing");
    expect(report.liveBrokerWriteAllowed).toBe(false);
  });

  // These tests pin the same read-only safety rule matrix enforced by
  // TossReadOnlyEndpointCatalogValidator (tests/application/toss-read-only-endpoint-catalog.test.ts),
  // so this CLI script cannot silently drift behind the TypeScript validator again.
  describe("rule parity with TossReadOnlyEndpointCatalogValidator", () => {
    it("rejects an invalid HTTP method", () => {
      const report = runCatalog([
        endpoint({ id: "bad-method", method: "DELETE" })
      ]);

      expect(report.valid).toBe(false);
      expect(report.reasonCodes).toContain("endpoint_invalid_method_bad-method");
      expect(report.liveBrokerWriteAllowed).toBe(false);
    });

    it("rejects an endpoint with a missing operation class", () => {
      const report = runCatalog([
        endpoint({ id: "no-operation", operation: undefined })
      ]);

      expect(report.valid).toBe(false);
      expect(report.reasonCodes).toContain("endpoint_missing_operation_class_no-operation");
      expect(report.liveBrokerWriteAllowed).toBe(false);
    });

    it("rejects an endpoint with missing source evidence", () => {
      const report = runCatalog([
        endpoint({ id: "no-source", source: undefined })
      ]);

      expect(report.valid).toBe(false);
      expect(report.reasonCodes).toContain("endpoint_missing_source_evidence_no-source");
      expect(report.liveBrokerWriteAllowed).toBe(false);
    });

    it("rejects an endpoint whose operation and evidence kind disagree", () => {
      const report = runCatalog([
        endpoint({
          id: "auth-mismatch",
          operation: "AUTHENTICATION_READ",
          method: "POST",
          path: "/v1/auth/token",
          evidenceKind: "MARKET_DATA_READ",
          relatedOpenQuestion: "OQ-001"
        })
      ]);

      expect(report.valid).toBe(false);
      expect(report.reasonCodes).toContain("endpoint_operation_evidence_mismatch_auth-mismatch");
      expect(report.liveBrokerWriteAllowed).toBe(false);
    });

    it("rejects a hard mutation-verb path regardless of declared operation", () => {
      const report = runCatalog([
        endpoint({
          id: "hard-mutation",
          operation: "MARKET_DATA_READ",
          evidenceKind: "MARKET_DATA_READ",
          path: "/v1/orders/cancel"
        })
      ]);

      expect(report.valid).toBe(false);
      expect(report.reasonCodes).toContain("endpoint_path_looks_write_scoped_hard-mutation");
      expect(report.liveBrokerWriteAllowed).toBe(false);
    });

    it("rejects an unverified order-status path that depends on order-status-read evidence", () => {
      const report = runCatalog([
        endpoint({
          id: "unverified-order-status",
          operation: "ORDER_STATUS_QUERY_READ",
          evidenceKind: "ORDER_STATUS_QUERY_READ",
          path: "/v1/orders/status",
          verified: false
        })
      ]);

      expect(report.valid).toBe(false);
      expect(report.reasonCodes).toContain(
        "endpoint_mutation_looking_path_requires_verified_evidence_unverified-order-status"
      );
      expect(report.liveBrokerWriteAllowed).toBe(false);
    });

    it("rejects an unverified fill-read path that depends on fill-read evidence", () => {
      const report = runCatalog([
        endpoint({
          id: "unverified-fill-read",
          operation: "FILL_QUERY_READ",
          evidenceKind: "FILL_QUERY_READ",
          path: "/v1/orders/fills",
          verified: false
        })
      ]);

      expect(report.valid).toBe(false);
      expect(report.reasonCodes).toContain(
        "endpoint_mutation_looking_path_requires_verified_evidence_unverified-fill-read"
      );
      expect(report.liveBrokerWriteAllowed).toBe(false);
    });

    it("accepts a verified order-status read path backed by matching evidence", () => {
      const report = runCatalog([
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
      ]);

      expect(report.valid).toBe(true);
      expect(report.reasonCodes).toEqual([]);
      expect(report.liveBrokerWriteAllowed).toBe(false);
    });

    it("accepts a verified fill-read path backed by matching evidence", () => {
      const report = runCatalog([
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
      ]);

      expect(report.valid).toBe(true);
      expect(report.reasonCodes).toEqual([]);
      expect(report.liveBrokerWriteAllowed).toBe(false);
    });
  });
});

function runScript(path: string): string {
  return execFileSync(process.execPath, [scriptPath, path], {
    cwd: repoRoot,
    env: {
      PATH: process.env.PATH
    }
  }).toString();
}

function tempCatalog(value: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "toss-endpoints-"));
  const path = join(dir, "catalog.json");
  writeFileSync(path, JSON.stringify(value), "utf8");
  return path;
}

interface ScriptEndpointFixture {
  id: string;
  operation?: string | undefined;
  method: string;
  path: string;
  evidenceKind?: string;
  relatedOpenQuestion: string;
  source?: string | undefined;
  verified: boolean;
  notes: string;
}

function endpoint(overrides: Partial<ScriptEndpointFixture> = {}): ScriptEndpointFixture {
  return {
    id: "market-data",
    operation: "MARKET_DATA_READ",
    method: "GET",
    path: "/v1/market/price",
    evidenceKind: "MARKET_DATA_READ",
    relatedOpenQuestion: "OQ-004",
    source: "TOSS_OFFICIAL_DOCS",
    verified: true,
    notes: "Example sanitized endpoint entry for script-level parity tests.",
    ...overrides
  };
}

function runCatalog(items: ScriptEndpointFixture[]): {
  valid: boolean;
  reasonCodes: string[];
  warnings: string[];
  liveBrokerWriteAllowed: boolean;
} {
  const path = tempCatalog({
    catalogVersion: "1",
    updatedAt: "2026-07-28T00:00:00.000Z",
    items
  });
  let output = "";

  try {
    output = runScript(path);
  } catch (error) {
    output = String((error as { stdout?: Buffer }).stdout);
  }

  return JSON.parse(output);
}
