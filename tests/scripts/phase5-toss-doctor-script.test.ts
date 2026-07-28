import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, "..", "..");
const scriptPath = join(repoRoot, "scripts", "phase5-toss-doctor.mjs");

describe("phase5-toss-doctor script", () => {
  it("reports a ready dry-run state when credentials and verified endpoints exist", () => {
    const output = runDoctor(
      tempJson({
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
      }),
      tempJson({ manifestVersion: "1", evidence: [] }),
      completeEnv()
    );
    const report = JSON.parse(output);

    expect(report.readyForReadOnlyVerification).toBe(true);
    expect(report.preparedRequestCount).toBe(1);
    expect(report.liveBrokerWriteAllowed).toBe(false);
    expect(report.networkCallsPerformed).toBe(false);
    expect(output).not.toContain("client-secret-value");
  });

  it("shows blockers when credentials are missing", () => {
    const output = runDoctor(
      "docs/phase5/toss-read-only-endpoints.example.json",
      "docs/phase5/evidence-manifest.example.json",
      { LIVE_TRADING_ENABLED: "false", TOSS_READ_ONLY_MODE: "true" }
    );
    const report = JSON.parse(output);

    expect(report.readyForReadOnlyVerification).toBe(false);
    expect(report.blockingReasonCodes).toContain("missing_or_placeholder_toss_client_secret");
  });

  it("surfaces unsafe evidence blockers", () => {
    const output = runDoctor(
      tempJson({ catalogVersion: "1", items: [] }),
      tempJson({
        manifestVersion: "1",
        evidence: [
          {
            id: "unsafe",
            relatedOpenQuestion: "missing",
            sanitized: false,
            containsCredential: true,
            liveWriteOperation: true
          }
        ]
      }),
      completeEnv()
    );
    const report = JSON.parse(output);

    expect(report.evidence.valid).toBe(false);
    expect(report.blockingReasonCodes).toContain("manifest_evidence_contains_credential_unsafe");
    expect(report.blockingReasonCodes).toContain("manifest_evidence_contains_live_write_unsafe");
  });
});

function runDoctor(endpointPath: string, evidencePath: string, env: NodeJS.ProcessEnv): string {
  return execFileSync(process.execPath, [scriptPath, endpointPath, evidencePath], {
    cwd: repoRoot,
    env: {
      PATH: process.env.PATH,
      ...env
    }
  }).toString();
}

function tempJson(value: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "toss-doctor-"));
  const path = join(dir, "input.json");
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
