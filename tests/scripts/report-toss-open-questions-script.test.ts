import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, "..", "..");
const scriptPath = join(repoRoot, "scripts", "report-toss-open-questions.mjs");

describe("report-toss-open-questions script", () => {
  it("reports missing Toss open question evidence from the example manifest", () => {
    let output = "";

    try {
      output = runScript("docs/phase5/evidence-manifest.example.json");
    } catch (error) {
      output = String((error as { stdout?: Buffer }).stdout);
    }

    const report = JSON.parse(output);

    expect(report.readyForOpenQuestionReview).toBe(false);
    expect(report.missingOpenQuestions).toContain("OQ-002");
    expect(report.liveBrokerWriteAllowed).toBe(false);
  });

  it("passes when every Toss open question has valid evidence", () => {
    const output = runScript(tempManifest(["OQ-001", "OQ-002", "OQ-003", "OQ-004"]));
    const report = JSON.parse(output);

    expect(report.readyForOpenQuestionReview).toBe(true);
    expect(report.missingOpenQuestions).toEqual([]);
  });

  it("ignores unsafe evidence when calculating readiness", () => {
    let output = "";

    try {
      output = runScript(tempManifest(["OQ-001"], {
        containsCredential: true
      }));
    } catch (error) {
      output = String((error as { stdout?: Buffer }).stdout);
    }

    const report = JSON.parse(output);

    expect(report.readyForOpenQuestionReview).toBe(false);
    expect(report.reasonCodes).toContain("missing_valid_evidence_oq-001");
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

function tempManifest(openQuestions: string[], overrides: Record<string, unknown> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "toss-oq-"));
  const path = join(dir, "manifest.json");
  writeFileSync(path, JSON.stringify({
    manifestVersion: "1",
    evidence: openQuestions.map((openQuestionId) => ({
      id: `evidence-${openQuestionId}`,
      relatedOpenQuestion: openQuestionId,
      sanitized: true,
      containsCredential: false,
      liveWriteOperation: false,
      ...overrides
    }))
  }), "utf8");
  return path;
}
