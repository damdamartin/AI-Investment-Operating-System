import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const scriptPath = join(repoRoot, "scripts", "promote-toss-evidence-intake.mjs");

describe("promote-toss-evidence-intake script", () => {
  it("fails closed for the default unreviewed example intake", () => {
    const output = runScript(["docs/phase5/evidence-intake.example.json"], false);
    const report = JSON.parse(output);

    expect(report.promoted).toBe(false);
    expect(report.reasonCodes).toContain("intake_not_human_reviewed_api-terms-review-example");
    expect(report.liveBrokerWriteAllowed).toBe(false);
    expect(report.networkCallsPerformed).toBe(false);
  });

  it("writes a sanitized manifest from reviewed intake", () => {
    const dir = mkdtempSync(join(tmpdir(), "toss-promote-"));
    const intakePath = join(dir, "intake.json");
    const manifestPath = join(dir, "manifest.json");
    writeFileSync(intakePath, JSON.stringify(reviewedIntake()), "utf8");

    const output = runScript([intakePath, manifestPath]);
    const report = JSON.parse(output);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

    expect(report.promoted).toBe(true);
    expect(report.evidenceCount).toBe(1);
    expect(report.outputPath).toContain("manifest.json");
    expect(manifest.evidence[0].sanitized).toBe(true);
    expect(manifest.evidence[0].containsCredential).toBe(false);
    expect(output).not.toContain("client-secret");

    rmSync(dir, { recursive: true, force: true });
  });
});

function runScript(args: string[], expectSuccess = true): string {
  try {
    return execFileSync("node", [scriptPath, ...args], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch (error) {
    if (expectSuccess) throw error;
    return String((error as { stdout?: Buffer }).stdout ?? "");
  }
}

function reviewedIntake(): Record<string, unknown> {
  return {
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
        liveWriteOperation: false
      }
    ],
    notes: ["Sanitized test intake."]
  };
}
