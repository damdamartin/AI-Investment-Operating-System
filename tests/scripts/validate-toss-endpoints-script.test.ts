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
