import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, "..", "..");
const scriptPath = join(repoRoot, "scripts", "validate-toss-evidence-manifest.mjs");

describe("validate-toss-evidence-manifest script", () => {
  it("validates the example evidence manifest without enabling broker writes", () => {
    const output = runScript("docs/phase5/evidence-manifest.example.json");
    const report = JSON.parse(output);

    expect(report.valid).toBe(true);
    expect(report.evidenceCount).toBe(1);
    expect(report.relatedOpenQuestions).toEqual(["OQ-001"]);
    expect(report.liveBrokerWriteAllowed).toBe(false);
  });

  it("fails closed for unsafe evidence manifest entries", () => {
    const path = tempManifest({
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
    });
    let output = "";

    try {
      output = runScript(path);
    } catch (error) {
      output = String((error as { stdout?: Buffer }).stdout);
    }

    const report = JSON.parse(output);

    expect(report.valid).toBe(false);
    expect(report.reasonCodes).toContain("manifest_evidence_not_sanitized_unsafe");
    expect(report.reasonCodes).toContain("manifest_evidence_contains_credential_unsafe");
    expect(report.reasonCodes).toContain("manifest_evidence_contains_live_write_unsafe");
    expect(report.reasonCodes).toContain("manifest_evidence_missing_open_question_unsafe");
  });

  it("reports missing manifest files safely", () => {
    let output = "";

    try {
      output = runScript("missing-evidence.json");
    } catch (error) {
      output = String((error as { stdout?: Buffer }).stdout);
    }

    const report = JSON.parse(output);

    expect(report.valid).toBe(false);
    expect(report.reasonCodes).toContain("evidence_manifest_file_missing");
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

function tempManifest(value: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "toss-evidence-"));
  const path = join(dir, "manifest.json");
  writeFileSync(path, JSON.stringify(value), "utf8");
  return path;
}
