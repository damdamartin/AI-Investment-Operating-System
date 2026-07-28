import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const scriptPath = join(repoRoot, "scripts", "phase5-toss-call-gate.mjs");

describe("phase5-toss-call-gate script", () => {
  it("fails closed when preflight is not ready and human approval is missing", () => {
    const output = runScript({}, false);
    const report = JSON.parse(output);

    expect(report.readyToAttemptRealReadOnlyCall).toBe(false);
    expect(report.reasonCodes).toContain("preflight_not_ready");
    expect(report.reasonCodes).toContain("human_read_only_call_approval_missing");
    expect(report.liveBrokerWriteAllowed).toBe(false);
    expect(report.networkCallsPerformed).toBe(false);
  });

  it("still blocks when human approval exists but preflight is not ready", () => {
    const output = runScript({ PHASE5_TOSS_READ_ONLY_CALL_APPROVED: "true" }, false);
    const report = JSON.parse(output);

    expect(report.readyToAttemptRealReadOnlyCall).toBe(false);
    expect(report.humanApprovalPresent).toBe(true);
    expect(report.reasonCodes).toContain("preflight_not_ready");
    expect(report.allowedNextAction).toBe("Do not call Toss API yet.");
  });
});

function runScript(extraEnv: NodeJS.ProcessEnv, expectSuccess = true): string {
  try {
    return execFileSync("node", [scriptPath], {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        PATH: process.env.PATH,
        ...extraEnv
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch (error) {
    if (expectSuccess) throw error;
    return String((error as { stdout?: Buffer }).stdout ?? "");
  }
}
