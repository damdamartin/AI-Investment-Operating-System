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
      tempJson({ intakeVersion: "1", items: [intakeItem()] }),
      completeEnv()
    );
    const report = JSON.parse(output);

    expect(report.readyForReadOnlyVerification).toBe(true);
    expect(report.preparedRequestCount).toBe(1);
    expect(report.intake.readyForEvidenceManifest).toBe(true);
    expect(report.liveBrokerWriteAllowed).toBe(false);
    expect(report.networkCallsPerformed).toBe(false);
    expect(output).not.toContain("client-secret-value");
  });

  it("shows blockers when credentials are missing", () => {
    const output = runDoctor(
      "docs/phase5/toss-read-only-endpoints.example.json",
      "docs/phase5/evidence-manifest.example.json",
      "docs/phase5/evidence-intake.example.json",
      missingCredentialEnv()
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
      tempJson({ intakeVersion: "1", items: [intakeItem()] }),
      completeEnv()
    );
    const report = JSON.parse(output);

    expect(report.evidence.valid).toBe(false);
    expect(report.blockingReasonCodes).toContain("manifest_evidence_contains_credential_unsafe");
    expect(report.blockingReasonCodes).toContain("manifest_evidence_contains_live_write_unsafe");
  });

  it("flags intake text that looks like a secret without printing the secret value", () => {
    const secretValue = "super-sensitive-token-value";
    const output = runDoctor(
      tempJson({ catalogVersion: "1", items: [] }),
      tempJson({ manifestVersion: "1", evidence: [] }),
      tempJson({
        intakeVersion: "1",
        items: [
          {
            ...intakeItem(),
            id: "leaky",
            sanitizedSummary: `Reviewed evidence, access_token=${secretValue} was visible in the screenshot.`
          }
        ]
      }),
      completeEnv()
    );
    const report = JSON.parse(output);

    expect(report.intake.readyForEvidenceManifest).toBe(false);
    expect(report.intake.reasonCodes).toContain("intake_may_contain_secret_leaky");
    expect(report.blockingReasonCodes).toContain("intake_may_contain_secret_leaky");
    expect(output).not.toContain(secretValue);
  });

  it("flags a bearer-token-shaped source reference the same way", () => {
    const output = runDoctor(
      tempJson({ catalogVersion: "1", items: [] }),
      tempJson({ manifestVersion: "1", evidence: [] }),
      tempJson({
        intakeVersion: "1",
        items: [
          {
            ...intakeItem(),
            id: "bearer-leak",
            sourceReference: "Authorization: Bearer abcdef123456"
          }
        ]
      }),
      completeEnv()
    );
    const report = JSON.parse(output);

    expect(report.intake.reasonCodes).toContain("intake_may_contain_secret_bearer-leak");
    expect(output).not.toContain("abcdef123456");
  });

  it("never prints TOSS_CLIENT_ID or TOSS_ACCOUNT_REF values even in a ready report", () => {
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
      tempJson({ intakeVersion: "1", items: [intakeItem()] }),
      completeEnv()
    );

    expect(output).not.toContain("client-id-value");
    expect(output).not.toContain("account-ref-value");
  });

  it("keeps liveBrokerWriteAllowed and networkCallsPerformed false regardless of readiness state", () => {
    const readyOutput = runDoctor(
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
      tempJson({ intakeVersion: "1", items: [intakeItem()] }),
      completeEnv()
    );
    const blockedOutput = runDoctor(
      "docs/phase5/toss-read-only-endpoints.example.json",
      "docs/phase5/evidence-manifest.example.json",
      "docs/phase5/evidence-intake.example.json",
      missingCredentialEnv()
    );

    for (const output of [readyOutput, blockedOutput]) {
      const report = JSON.parse(output);
      expect(report.liveBrokerWriteAllowed).toBe(false);
      expect(report.networkCallsPerformed).toBe(false);
      expect(report.safetyType).toBe("PHASE5_TOSS_DOCTOR_LOCAL_REPORT");
    }
  });
});

function runDoctor(endpointPath: string, evidencePath: string, intakePath: string, env: NodeJS.ProcessEnv): string {
  return execFileSync(process.execPath, [scriptPath, endpointPath, evidencePath, intakePath], {
    cwd: repoRoot,
    env: {
      PATH: process.env.PATH,
      ...env
    }
  }).toString();
}

function intakeItem(): Record<string, unknown> {
  return {
    id: "terms",
    kind: "API_TERMS_REVIEW",
    relatedOpenQuestion: "OQ-001",
    source: "TOSS_OFFICIAL_DOCS",
    sourceReference: "Official Toss terms page.",
    sanitizedSummary: "Sanitized evidence summary for official Toss API terms review.",
    reviewedByHuman: true,
    rawPayloadIncluded: false,
    screenshotContainsSecrets: false,
    liveWriteOperation: false
  };
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

function missingCredentialEnv(): NodeJS.ProcessEnv {
  return {
    LIVE_TRADING_ENABLED: "false",
    TOSS_READ_ONLY_MODE: "true",
    TOSS_API_BASE_URL: "replace-with-local-secret",
    TOSS_CLIENT_ID: "replace-with-local-secret",
    TOSS_CLIENT_SECRET: "replace-with-local-secret",
    TOSS_ACCOUNT_REF: "replace-with-local-secret"
  };
}
