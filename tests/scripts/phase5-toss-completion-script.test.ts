import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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

  it("can pass with custom local file paths and explicit read-only approval", () => {
    const output = runScript(true, {
      PHASE5_TOSS_READ_ONLY_CALL_APPROVED: "true",
      LIVE_TRADING_ENABLED: "false",
      TOSS_READ_ONLY_MODE: "true",
      TOSS_API_BASE_URL: "https://toss.example",
      TOSS_CLIENT_ID: "client-id-value",
      TOSS_CLIENT_SECRET: "client-secret-value",
      TOSS_ACCOUNT_REF: "account-ref-value"
    }, readyLocalPaths());
    const report = JSON.parse(output);

    expect(report.phase5TossPreparationComplete).toBe(true);
    expect(report.readyForFirstRealReadOnlyCall).toBe(true);
    expect(report.liveBrokerWriteAllowed).toBe(false);
    expect(report.networkCallsPerformed).toBe(false);
    expect(output).not.toContain("client-secret-value");
  });
});

function runScript(expectSuccess = true, extraEnv: NodeJS.ProcessEnv = {}, args: string[] = []): string {
  try {
    return execFileSync("node", [scriptPath, ...args], {
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

function readyLocalPaths(): string[] {
  const endpointPath = tempJson({
    catalogVersion: "1",
    items: [
      {
        id: "account-read",
        operation: "ACCOUNT_SNAPSHOT_READ",
        method: "GET",
        path: "/v1/account",
        evidenceKind: "ACCOUNT_SNAPSHOT_READ",
        relatedOpenQuestion: "OQ-002",
        source: "TOSS_OFFICIAL_DOCS",
        verified: true,
        notes: "Fixture read-only endpoint."
      }
    ]
  });
  const manifestPath = tempJson({
    manifestVersion: "1",
    evidence: ["OQ-001", "OQ-002", "OQ-003", "OQ-004"].map((relatedOpenQuestion) => ({
      id: `evidence-${relatedOpenQuestion.toLowerCase()}`,
      relatedOpenQuestion,
      sanitized: true,
      containsCredential: false,
      liveWriteOperation: false
    }))
  });
  const intakePath = tempJson({
    intakeVersion: "1",
    items: ["OQ-001", "OQ-002", "OQ-003", "OQ-004"].map((relatedOpenQuestion) => ({
      id: `intake-${relatedOpenQuestion.toLowerCase()}`,
      kind: relatedOpenQuestion === "OQ-002" ? "ACCOUNT_SNAPSHOT_READ" : "API_TERMS_REVIEW",
      relatedOpenQuestion,
      source: "TOSS_OFFICIAL_DOCS",
      sourceReference: "Official fixture reference.",
      sanitizedSummary: "Sanitized fixture summary with enough detail for review.",
      reviewedByHuman: true,
      rawPayloadIncluded: false,
      screenshotContainsSecrets: false,
      liveWriteOperation: false
    }))
  });

  return [endpointPath, manifestPath, intakePath];
}

function tempJson(value: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "toss-completion-"));
  const path = join(dir, "input.json");
  writeFileSync(path, JSON.stringify(value), "utf8");
  return path;
}
