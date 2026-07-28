import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const scriptPath = join(repoRoot, "scripts", "validate-toss-evidence-intake.mjs");

describe("validate-toss-evidence-intake script", () => {
  it("fails closed for the default example intake worksheet", () => {
    const output = runScript("docs/phase5/evidence-intake.example.json", false);
    const report = JSON.parse(output);

    expect(report.readyForEvidenceManifest).toBe(false);
    expect(report.reasonCodes).toContain("intake_not_human_reviewed_account-permission-example");
    expect(report.liveBrokerWriteAllowed).toBe(false);
    expect(report.networkCallsPerformed).toBe(false);
  });

  it("accepts sanitized human-reviewed intake", () => {
    const output = runScript(tempIntake({ reviewedByHuman: true }));
    const report = JSON.parse(output);

    expect(report.readyForEvidenceManifest).toBe(true);
    expect(report.itemCount).toBe(1);
    expect(report.relatedOpenQuestions).toEqual(["OQ-001"]);
  });

  it("rejects secret-like text without printing the secret value", () => {
    const output = runScript(tempIntake({
      reviewedByHuman: true,
      sanitizedSummary: "This should fail because it includes client_secret=very-sensitive-value."
    }), false);
    const report = JSON.parse(output);

    expect(report.readyForEvidenceManifest).toBe(false);
    expect(report.reasonCodes).toContain("intake_may_contain_secret_terms");
    expect(output).not.toContain("very-sensitive-value");
  });
});

function runScript(path: string, expectSuccess = true): string {
  try {
    return execFileSync("node", [scriptPath, path], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch (error) {
    if (expectSuccess) {
      throw error;
    }
    return String((error as { stdout?: Buffer }).stdout ?? "");
  }
}

function tempIntake(overrides: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), "toss-intake-"));
  const path = join(dir, "intake.json");
  writeFileSync(path, JSON.stringify({
    intakeVersion: "1",
    preparedAt: "2026-07-28T00:00:00.000Z",
    preparedBy: "local-operator",
    items: [
      {
        id: "terms",
        kind: "API_TERMS_REVIEW",
        relatedOpenQuestion: "OQ-001",
        source: "TOSS_OFFICIAL_DOCS",
        sourceReference: "Official Toss terms page.",
        sanitizedSummary: "Sanitized evidence summary for official Toss API terms review.",
        reviewedByHuman: true,
        rawPayloadIncluded: false,
        screenshotContainsSecrets: false,
        liveWriteOperation: false,
        ...overrides
      }
    ],
    notes: ["Sanitized test intake."]
  }));

  process.on("exit", () => rmSync(dir, { recursive: true, force: true }));
  return path;
}
