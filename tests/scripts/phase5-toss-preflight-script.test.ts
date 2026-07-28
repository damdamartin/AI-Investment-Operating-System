import { execFileSync } from "node:child_process";
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
});
