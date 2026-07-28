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

  it("still fails closed with liveBrokerWriteAllowed=false even when human approval is set", () => {
    // P5-006 acceptance: completion may legitimately fail closed while local
    // readiness is incomplete. That failure report must still show
    // liveBrokerWriteAllowed:false and networkCallsPerformed:false even when
    // an operator has already set the read-only call approval flag.
    const output = runScript(false, { PHASE5_TOSS_READ_ONLY_CALL_APPROVED: "true" });
    const report = JSON.parse(output);

    expect(report.phase5TossPreparationComplete).toBe(false);
    expect(report.liveBrokerWriteAllowed).toBe(false);
    expect(report.networkCallsPerformed).toBe(false);
    // The nested call-gate reason must still surface through the completion
    // report's prefixing so the chain of blockers stays auditable.
    expect(report.reasonCodes.some((code: string) => code.startsWith("call_gate_"))).toBe(true);
  });

  it("always reports the PHASE5_TOSS_COMPLETION_LOCAL_REPORT safety type", () => {
    const output = runScript(false);
    const report = JSON.parse(output);

    expect(report.safetyType).toBe("PHASE5_TOSS_COMPLETION_LOCAL_REPORT");
    expect(typeof report.nextAction).toBe("string");
    expect(report.nextAction.length).toBeGreaterThan(0);
  });
});

function runScript(expectSuccess = true, extraEnv: NodeJS.ProcessEnv = {}): string {
  try {
    return execFileSync("node", [scriptPath], {
      cwd: repoRoot,
      encoding: "utf8",
      env: { PATH: process.env.PATH, ...extraEnv },
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch (error) {
    if (expectSuccess) throw error;
    return String((error as { stdout?: Buffer }).stdout ?? "");
  }
}
