import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const scriptPath = join(repoRoot, "scripts", "phase5-toss-local-setup.mjs");

describe("phase5-toss-local-setup script", () => {
  it("dry-runs local template preparation without printing secrets or writing env", () => {
    const output = execFileSync("node", [scriptPath, "--templates-only", "--dry-run"], {
      cwd: repoRoot,
      encoding: "utf8",
      env: { PATH: process.env.PATH },
      stdio: ["ignore", "pipe", "pipe"]
    });
    const report = JSON.parse(output);

    expect(report.dryRun).toBe(true);
    expect(report.templatesOnly).toBe(true);
    expect(report.envWritten).toBe(false);
    expect(report.filesPrepared).toContain(join(repoRoot, "tmp/phase5/toss-read-only-endpoints.local.json"));
    expect(report.filesPrepared).toContain(join(repoRoot, "tmp/phase5/evidence-intake.local.json"));
    expect(report.filesPrepared).toContain(join(repoRoot, "tmp/phase5/evidence-manifest.local.json"));
    expect(report.filesPrepared).toContain(join(repoRoot, "tmp/phase5/read-only-call-approval.local.json"));
    expect(report.liveBrokerWriteAllowed).toBe(false);
    expect(report.networkCallsPerformed).toBe(false);
    expect(output).not.toContain("client-secret");
  });
});
