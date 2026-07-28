import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, "..", "..");
const scriptPath = join(repoRoot, "scripts", "phase5-toss-preflight.mjs");

describe("phase5-toss-preflight script", () => {
  it("fails closed with sanitized blockers in the default example state", () => {
    let output = "";

    try {
      output = execFileSync(process.execPath, [scriptPath], {
        cwd: repoRoot,
        env: { PATH: process.env.PATH }
      }).toString();
    } catch (error) {
      output = String((error as { stdout?: Buffer }).stdout);
    }

    const report = JSON.parse(output);

    expect(report.readyForReadOnlyCall).toBe(false);
    expect(report.liveBrokerWriteAllowed).toBe(false);
    expect(report.networkCallsPerformed).toBe(false);
    expect(report.commandCount).toBe(6);
    expect(report.reasonCodes).toContain("readiness_command_failed");
    expect(report.reasonCodes).toContain("intake_command_failed");
    expect(output).not.toContain("client-secret");
  });

  // Regression gap closed in P5-011 phase 1: the preflight script does not
  // itself consume PHASE5_TOSS_READ_ONLY_CALL_APPROVED (only the downstream
  // call-gate script does), but the safety contract for this report is that
  // liveBrokerWriteAllowed and networkCallsPerformed must stay false under
  // every input, including an operator approval flag being present. Before
  // this test, that specific claim was proven for the call-gate and
  // completion scripts but not for preflight itself.
  it("still fails closed with liveBrokerWriteAllowed=false and networkCallsPerformed=false even when the human read-only call approval flag is set", () => {
    let output = "";

    try {
      output = execFileSync(process.execPath, [scriptPath], {
        cwd: repoRoot,
        env: { PATH: process.env.PATH, PHASE5_TOSS_READ_ONLY_CALL_APPROVED: "true" }
      }).toString();
    } catch (error) {
      output = String((error as { stdout?: Buffer }).stdout);
    }

    const report = JSON.parse(output);

    expect(report.readyForReadOnlyCall).toBe(false);
    expect(report.liveBrokerWriteAllowed).toBe(false);
    expect(report.networkCallsPerformed).toBe(false);
    expect(output).not.toContain("client-secret");
  });

  it("accepts local endpoint, manifest, and intake paths without using the committed examples", () => {
    const endpointPath = tempJson({
      catalogVersion: "1",
      items: [
        {
          id: "account-read",
          operation: "ACCOUNT_SNAPSHOT_READ",
          method: "GET",
          path: "/v1/account",
          evidenceKind: "ACCOUNT_SNAPSHOT_READ",
          relatedOpenQuestion: "OQ-002",
          source: "TOSS_OFFICIAL_DOCS",
          verified: true,
          notes: "Fixture read-only endpoint."
        }
      ]
    });
    const manifestPath = tempJson({
      manifestVersion: "1",
      evidence: ["OQ-001", "OQ-002", "OQ-003", "OQ-004"].map((relatedOpenQuestion) => ({
        id: `evidence-${relatedOpenQuestion.toLowerCase()}`,
        relatedOpenQuestion,
        sanitized: true,
        containsCredential: false,
        liveWriteOperation: false
      }))
    });
    const intakePath = tempJson({
      intakeVersion: "1",
      items: [
        "OQ-001",
        "OQ-002",
        "OQ-003",
        "OQ-004"
      ].map((relatedOpenQuestion) => ({
        id: `intake-${relatedOpenQuestion.toLowerCase()}`,
        kind: relatedOpenQuestion === "OQ-002" ? "ACCOUNT_SNAPSHOT_READ" : "API_TERMS_REVIEW",
        relatedOpenQuestion,
        source: "TOSS_OFFICIAL_DOCS",
        sourceReference: "Official fixture reference.",
        sanitizedSummary: "Sanitized fixture summary with enough detail for review.",
        reviewedByHuman: true,
        rawPayloadIncluded: false,
        screenshotContainsSecrets: false,
        liveWriteOperation: false
      }))
    });

    const output = execFileSync(process.execPath, [scriptPath, endpointPath, manifestPath, intakePath], {
      cwd: repoRoot,
      env: {
        PATH: process.env.PATH,
        LIVE_TRADING_ENABLED: "false",
        TOSS_READ_ONLY_MODE: "true",
        TOSS_API_BASE_URL: "https://toss.example",
        TOSS_CLIENT_ID: "client-id-value",
        TOSS_CLIENT_SECRET: "client-secret-value",
        TOSS_ACCOUNT_REF: "account-ref-value"
      }
    }).toString();
    const report = JSON.parse(output);

    expect(report.readyForReadOnlyCall).toBe(true);
    expect(report.readyForOpenQuestionReview).toBe(true);
    expect(report.liveBrokerWriteAllowed).toBe(false);
    expect(report.networkCallsPerformed).toBe(false);
    expect(output).not.toContain("client-secret-value");
  });
});

function tempJson(value: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "toss-preflight-"));
  const path = join(dir, "input.json");
  writeFileSync(path, JSON.stringify(value), "utf8");
  return path;
}
