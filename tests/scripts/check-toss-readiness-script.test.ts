import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, "..", "..");
const scriptPath = join(repoRoot, "scripts", "check-toss-readiness.mjs");

describe("check-toss-readiness script", () => {
  it("reports readiness without printing secret values", () => {
    const output = runScript({
      LIVE_TRADING_ENABLED: "false",
      TOSS_READ_ONLY_MODE: "true",
      TOSS_API_BASE_URL: "https://toss.example",
      TOSS_CLIENT_ID: "client-id-secret",
      TOSS_CLIENT_SECRET: "client-secret-value",
      TOSS_ACCOUNT_REF: "account-ref-secret"
    });

    const report = JSON.parse(output);

    expect(report.ready).toBe(true);
    expect(report.liveBrokerWriteAllowed).toBe(false);
    expect(output).not.toContain("client-secret-value");
    expect(output).not.toContain("account-ref-secret");
  });

  it("fails closed when fields are missing", () => {
    let output = "";

    try {
      output = runScript({
        LIVE_TRADING_ENABLED: "false",
        TOSS_READ_ONLY_MODE: "true",
        TOSS_API_BASE_URL: "replace-with-local-secret",
        TOSS_CLIENT_ID: "replace-with-local-secret",
        TOSS_CLIENT_SECRET: "replace-with-local-secret",
        TOSS_ACCOUNT_REF: "replace-with-local-secret"
      });
    } catch (error) {
      output = String((error as { stdout?: Buffer }).stdout);
    }

    const report = JSON.parse(output);

    expect(report.ready).toBe(false);
    expect(report.missingFields).toContain("TOSS_CLIENT_SECRET");
  });

  it("blocks accidental live trading configuration", () => {
    let output = "";

    try {
      output = runScript({
        LIVE_TRADING_ENABLED: "true",
        TOSS_READ_ONLY_MODE: "true",
        TOSS_API_BASE_URL: "https://toss.example",
        TOSS_CLIENT_ID: "client-id",
        TOSS_CLIENT_SECRET: "client-secret",
        TOSS_ACCOUNT_REF: "account-ref"
      });
    } catch (error) {
      output = String((error as { stdout?: Buffer }).stdout);
    }

    const report = JSON.parse(output);

    expect(report.ready).toBe(false);
    expect(report.reasonCodes).toContain("live_trading_enabled");
    expect(report.liveBrokerWriteAllowed).toBe(false);
  });
});

function runScript(env: NodeJS.ProcessEnv): string {
  return execFileSync(process.execPath, [scriptPath], {
    cwd: repoRoot,
    env: {
      PATH: process.env.PATH,
      ...env
    }
  }).toString();
}
