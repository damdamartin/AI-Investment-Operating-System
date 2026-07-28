import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, "..", "..");
const scriptPath = join(repoRoot, "scripts", "plan-toss-read-only-verification.mjs");

describe("plan-toss-read-only-verification script", () => {
  it("builds sanitized dry-run plans for verified endpoint catalogs", () => {
    const output = runScript(tempCatalog({
      catalogVersion: "1",
      items: [
        {
          id: "account",
          operation: "ACCOUNT_SNAPSHOT_READ",
          method: "GET",
          path: "/v1/account",
          relatedOpenQuestion: "OQ-002",
          verified: true
        }
      ]
    }), completeEnv());

    const report = JSON.parse(output);

    expect(report.ready).toBe(true);
    expect(report.preparedRequestCount).toBe(1);
    expect(report.preparedRequests[0].url).toBe("https://toss.example/v1/account");
    expect(report.preparedRequests[0].headers["X-Toss-Client-Secret"]).toBe("****");
    expect(output).not.toContain("client-secret-value");
    expect(report.networkCallsPerformed).toBe(false);
  });

  it("fails closed when credentials are missing", () => {
    let output = "";

    try {
      output = runScript(tempCatalog({ catalogVersion: "1", items: [] }), {
        LIVE_TRADING_ENABLED: "false",
        TOSS_READ_ONLY_MODE: "true"
      });
    } catch (error) {
      output = String((error as { stdout?: Buffer }).stdout);
    }

    const report = JSON.parse(output);

    expect(report.ready).toBe(false);
    expect(report.reasonCodes).toContain("missing_or_placeholder_toss_client_secret");
  });

  it("skips unverified endpoints as warnings", () => {
    const output = runScript(tempCatalog({
      catalogVersion: "1",
      items: [
        {
          id: "unverified",
          operation: "MARKET_DATA_READ",
          method: "GET",
          path: "/v1/market",
          relatedOpenQuestion: "OQ-004",
          verified: false
        }
      ]
    }), completeEnv());

    const report = JSON.parse(output);

    expect(report.ready).toBe(true);
    expect(report.preparedRequestCount).toBe(0);
    expect(report.warnings).toContain("endpoint_not_verified_unverified");
  });
});

function runScript(path: string, env: NodeJS.ProcessEnv): string {
  return execFileSync(process.execPath, [scriptPath, path], {
    cwd: repoRoot,
    env: {
      PATH: process.env.PATH,
      ...env
    }
  }).toString();
}

function tempCatalog(value: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "toss-plan-"));
  const path = join(dir, "catalog.json");
  writeFileSync(path, JSON.stringify(value), "utf8");
  return path;
}

function completeEnv(): NodeJS.ProcessEnv {
  return {
    LIVE_TRADING_ENABLED: "false",
    TOSS_READ_ONLY_MODE: "true",
    TOSS_API_BASE_URL: "https://toss.example",
    TOSS_CLIENT_ID: "client-id-value",
    TOSS_CLIENT_SECRET: "client-secret-value",
    TOSS_ACCOUNT_REF: "account-ref-value"
  };
}
