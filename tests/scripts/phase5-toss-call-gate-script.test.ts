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
    // Explicit approval must never flip the live-write or network-call
    // guarantees, even once preflight becomes ready in the future.
    expect(report.liveBrokerWriteAllowed).toBe(false);
    expect(report.networkCallsPerformed).toBe(false);
  });

  it(
    "does not accept loosely-typed approval values (only the exact string 'true')",
    () => {
      // Each invocation chains several "npm run" subprocesses (preflight ->
      // readiness/endpoints/evidence/intake/open-questions/doctor), so this
      // is deliberately kept to a small representative set of near-miss
      // values rather than an exhaustive one, and given a longer timeout.
      for (const looseValue of ["TRUE", "1", "yes"]) {
        const output = runScript({ PHASE5_TOSS_READ_ONLY_CALL_APPROVED: looseValue }, false);
        const report = JSON.parse(output);

        expect(report.humanApprovalPresent, `value "${looseValue}" must not count as approval`).toBe(false);
        expect(report.reasonCodes).toContain("human_read_only_call_approval_missing");
        expect(report.liveBrokerWriteAllowed).toBe(false);
        expect(report.networkCallsPerformed).toBe(false);
      }
    },
    60000
  );

  it("always reports the PHASE5_TOSS_READ_ONLY_CALL_GATE_LOCAL_REPORT safety type", () => {
    const output = runScript({}, false);
    const report = JSON.parse(output);

    expect(report.safetyType).toBe("PHASE5_TOSS_READ_ONLY_CALL_GATE_LOCAL_REPORT");
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
