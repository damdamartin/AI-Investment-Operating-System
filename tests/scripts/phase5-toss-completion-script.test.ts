import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const scriptPath = join(repoRoot, "scripts", "phase5-toss-completion.mjs");

describe("phase5-toss-completion script", () => {
  it("fails closed until the read-only call gate is ready", () => {
    const output = runScript(false);
    const report = JSON.parse(output);

    expect(report.phase5TossPreparationComplete).toBe(false);
    expect(report.readyForFirstRealReadOnlyCall).toBe(false);
    expect(report.reasonCodes).toContain("read_only_call_gate_not_ready");
    expect(report.liveBrokerWriteAllowed).toBe(false);
    expect(report.networkCallsPerformed).toBe(false);
  });
});

function runScript(expectSuccess = true): string {
  try {
    return execFileSync("node", [scriptPath], {
      cwd: repoRoot,
      encoding: "utf8",
      env: { PATH: process.env.PATH },
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch (error) {
    if (expectSuccess) throw error;
    return String((error as { stdout?: Buffer }).stdout ?? "");
  }
}
