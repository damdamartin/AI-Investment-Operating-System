import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { TossReadOnlyVerificationResultValidator } from "../../src/index.js";

/**
 * Mock-HTTP-only tests for scripts/phase5-toss-read-only-verify.mjs (P5-013).
 *
 * These tests never touch the real Toss API and never read, print, or
 * modify this repository's real .env (there is none in this worktree; every
 * credential used below is a fixture value passed directly as a child
 * process environment variable, matching the pattern already established by
 * tests/scripts/phase5-toss-call-gate-script.test.ts and
 * tests/scripts/phase5-toss-preflight-script.test.ts). The happy-path tests
 * run the real preflight and call-gate scripts as real child processes
 * (same composition pattern those scripts use internally) against a local
 * node:http mock server bound to 127.0.0.1, never the real internet.
 *
 * The runner is always invoked with the async `spawn` (not `execFileSync`):
 * the mock server below lives in this same test process's event loop, and a
 * synchronous exec would block that event loop for the whole child process
 * lifetime, deadlocking against the child's own request to this server.
 * tests/scripts/phase5-toss-account-ref-setup-script.test.ts hit the same
 * constraint and uses the same async pattern for the same reason.
 */

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, "..", "..");
const scriptPath = join(repoRoot, "scripts", "phase5-toss-read-only-verify.mjs");

const servers: Server[] = [];
const evidenceFilesWritten: string[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections();
          server.close(() => resolve());
        })
    )
  );

  for (const path of evidenceFilesWritten.splice(0)) {
    if (existsSync(path)) rmSync(path);
  }
});

describe("phase5-toss-read-only-verify script", () => {
  it("no approval means no network call and fails closed", async () => {
    const { stdout, status } = await runScript(["accounts"], baseFixtureEnv());
    const report = JSON.parse(stdout);

    expect(status).not.toBe(0);
    expect(report.reasonCodes).toContain("human_read_only_call_approval_missing");
    expect(report.networkCallsPerformed).toBe(false);
    expect(report.liveBrokerWriteAllowed).toBe(false);
    expect(report.rawPayloadStored).toBe(false);
    expect(report.sanitizedEvidencePath).toBeNull();
    // Preflight/call-gate must never even be invoked without approval.
    expect(report.preflight).toBeNull();
    expect(report.callGate).toBeNull();
  });

  it("an unknown target means no network call and fails closed", async () => {
    const { stdout, status } = await runScript(["portfolio-summary"], {
      ...baseFixtureEnv(),
      PHASE5_TOSS_READ_ONLY_CALL_APPROVED: "true"
    });
    const report = JSON.parse(stdout);

    expect(status).not.toBe(0);
    expect(report.reasonCodes).toContain("unsupported_target_portfolio-summary");
    expect(report.networkCallsPerformed).toBe(false);
    expect(report.liveBrokerWriteAllowed).toBe(false);
    expect(report.operation).toBeNull();
    expect(report.preflight).toBeNull();
  });

  it("missing target means no network call and fails closed", async () => {
    const { stdout, status } = await runScript([], {
      ...baseFixtureEnv(),
      PHASE5_TOSS_READ_ONLY_CALL_APPROVED: "true"
    });
    const report = JSON.parse(stdout);

    expect(status).not.toBe(0);
    expect(report.reasonCodes).toContain("missing_target");
    expect(report.networkCallsPerformed).toBe(false);
    expect(report.liveBrokerWriteAllowed).toBe(false);
  });

  it.each(["createOrder", "cancelOrder", "modifyOrder", "orders/cancel", "withdraw", "transfer"])(
    "write-looking target %s fails closed with no network call",
    async (writeLookingTarget) => {
      const { stdout, status } = await runScript([writeLookingTarget], {
        ...baseFixtureEnv(),
        PHASE5_TOSS_READ_ONLY_CALL_APPROVED: "true"
      });
      const report = JSON.parse(stdout);

      expect(status).not.toBe(0);
      expect(report.reasonCodes).toContain(`unsupported_target_${writeLookingTarget}`);
      expect(report.networkCallsPerformed).toBe(false);
      expect(report.liveBrokerWriteAllowed).toBe(false);
      expect(report.rawPayloadStored).toBe(false);
    }
  );

  it("does not accept loosely-typed approval values (only the exact string 'true')", async () => {
    for (const looseValue of ["TRUE", "1", "yes"]) {
      const { stdout, status } = await runScript(["accounts"], {
        ...baseFixtureEnv(),
        PHASE5_TOSS_READ_ONLY_CALL_APPROVED: looseValue
      });
      const report = JSON.parse(stdout);

      expect(status).not.toBe(0);
      expect(report.reasonCodes).toContain("human_read_only_call_approval_missing");
      expect(report.networkCallsPerformed).toBe(false);
      expect(report.liveBrokerWriteAllowed).toBe(false);
    }
  });

  it(
    "fails closed with no network call when preflight/call-gate are not ready even with approval set",
    async () => {
      // Approval is present, but no verified endpoint catalog / evidence intake
      // is supplied, so preflight (and therefore the call gate) cannot pass.
      const { stdout, status } = await runScript(["accounts"], {
        ...baseFixtureEnv(),
        PHASE5_TOSS_READ_ONLY_CALL_APPROVED: "true"
      });
      const report = JSON.parse(stdout);

      expect(status).not.toBe(0);
      expect(report.networkCallsPerformed).toBe(false);
      expect(report.liveBrokerWriteAllowed).toBe(false);
      expect(report.preflight?.readyForReadOnlyCall).toBe(false);
      expect(report.reasonCodes).toContain("preflight_not_ready");
    },
    30000
  );

  it(
    "an approved accounts call against a local mock server writes sanitized evidence only",
    async () => {
      const server = await startMockTossServer({
        accountsBody: { result: [{ accountSeq: 7, accountNo: "123-456-SECRET-9012" }] }
      });
      const [endpointPath, manifestPath, intakePath] = readyLocalPaths("ACCOUNT_SNAPSHOT_READ");

      const { stdout, status } = await runScript(["accounts", endpointPath, manifestPath, intakePath], {
        ...baseFixtureEnv(server.url),
        PHASE5_TOSS_READ_ONLY_CALL_APPROVED: "true"
      });
      const report = JSON.parse(stdout);

      expect(status).toBe(0);
      expect(report.operation).toBe("ACCOUNT_SNAPSHOT_READ");
      expect(report.evidenceKind).toBe("ACCOUNT_SNAPSHOT_READ");
      expect(report.liveBrokerWriteAllowed).toBe(false);
      expect(report.networkCallsPerformed).toBe(true);
      expect(report.rawPayloadStored).toBe(false);
      expect(report.reasonCodes).toEqual([]);
      expect(typeof report.sanitizedEvidencePath).toBe("string");
      expect(report.sanitizedEvidencePath).toMatch(/^tmp\/phase5\//);
      expect(report.preflight.readyForReadOnlyCall).toBe(true);
      expect(report.callGate.readyToAttemptRealReadOnlyCall).toBe(true);

      // Raw secrets and account-number-like content must never appear on stdout.
      expect(stdout).not.toContain("mock-access-token");
      expect(stdout).not.toContain("123-456-SECRET-9012");
      expect(stdout).not.toContain("fixture-client-secret");

      const absoluteEvidencePath = join(repoRoot, report.sanitizedEvidencePath);
      evidenceFilesWritten.push(absoluteEvidencePath);
      expect(existsSync(absoluteEvidencePath)).toBe(true);

      const evidenceContent = readFileSync(absoluteEvidencePath, "utf8");
      expect(evidenceContent).not.toContain("mock-access-token");
      expect(evidenceContent).not.toContain("123-456-SECRET-9012");
      expect(evidenceContent).not.toContain("accountSeq");
      expect(evidenceContent).not.toContain("accountNo");

      const evidence = JSON.parse(evidenceContent);
      expect(evidence.rawPayloadStored).toBe(false);
      expect(evidence.liveBrokerWriteAllowed).toBe(false);
      expect(evidence.itemCount).toBe(1);

      // Cross-check against Engineer 3's real, merged validator: the printed
      // report is exactly the shape docs/phase5/toss-read-only-call-gate.md
      // and read-only-evidence-intake.ts describe for a P5-013 receipt.
      const review = new TossReadOnlyVerificationResultValidator().review({
        operation: report.operation,
        evidenceKind: report.evidenceKind,
        sanitizedEvidencePath: report.sanitizedEvidencePath,
        liveBrokerWriteAllowed: report.liveBrokerWriteAllowed,
        networkCallsPerformed: report.networkCallsPerformed,
        rawPayloadStored: report.rawPayloadStored
      });
      expect(review.acceptedForIntakeDraft, JSON.stringify(review.reasonCodes)).toBe(true);
      expect(review.suggestedRelatedOpenQuestion).toBe("OQ-002");
    },
    30000
  );

  it(
    "an approved holdings call against a local mock server writes sanitized evidence only",
    async () => {
      const server = await startMockTossServer({
        holdingsBody: { result: { items: [{ symbol: "AAPL", quantity: "3" }, { symbol: "MSFT", quantity: "1" }] } },
        requireHoldingsAccountHeader: true
      });
      const [endpointPath, manifestPath, intakePath] = readyLocalPaths("POSITION_QUERY_READ");

      const { stdout, status } = await runScript(["holdings", endpointPath, manifestPath, intakePath], {
        ...baseFixtureEnv(server.url),
        PHASE5_TOSS_READ_ONLY_CALL_APPROVED: "true"
      });
      const report = JSON.parse(stdout);

      expect(status).toBe(0);
      expect(report.operation).toBe("POSITION_QUERY_READ");
      expect(report.evidenceKind).toBe("POSITION_QUERY_READ");
      expect(report.liveBrokerWriteAllowed).toBe(false);
      expect(report.networkCallsPerformed).toBe(true);
      expect(report.rawPayloadStored).toBe(false);

      const absoluteEvidencePath = join(repoRoot, report.sanitizedEvidencePath);
      evidenceFilesWritten.push(absoluteEvidencePath);
      const evidenceContent = readFileSync(absoluteEvidencePath, "utf8");
      expect(evidenceContent).not.toContain("AAPL");
      expect(evidenceContent).not.toContain("MSFT");

      const evidence = JSON.parse(evidenceContent);
      expect(evidence.itemCount).toBe(2);
    },
    30000
  );
});

function baseFixtureEnv(tossBaseUrl = "https://toss.example"): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH,
    LIVE_TRADING_ENABLED: "false",
    TOSS_READ_ONLY_MODE: "true",
    TOSS_API_BASE_URL: tossBaseUrl,
    TOSS_CLIENT_ID: "fixture-client-id",
    TOSS_CLIENT_SECRET: "fixture-client-secret",
    TOSS_ACCOUNT_REF: "fixture-account-ref"
  };
}

function runScript(args: string[], env: NodeJS.ProcessEnv): Promise<{ stdout: string; status: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: repoRoot,
      env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`phase5-toss-read-only-verify timed out. stderr so far: ${stderr}`));
    }, 25000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (status) => {
      clearTimeout(timeout);
      resolve({ stdout, status });
    });
  });
}

function readyLocalPaths(
  evidenceKindForAccountsHoldings: "ACCOUNT_SNAPSHOT_READ" | "POSITION_QUERY_READ"
): [string, string, string] {
  const endpointPath = tempJson({
    catalogVersion: "1",
    items: [
      {
        id: "accounts-read",
        path: "/api/v1/accounts",
        method: "GET",
        operation: "ACCOUNT_SNAPSHOT_READ",
        evidenceKind: "ACCOUNT_SNAPSHOT_READ",
        source: "LOCAL_VERIFICATION",
        relatedOpenQuestion: "OQ-002",
        verified: true
      },
      {
        id: "holdings-read",
        path: "/api/v1/holdings",
        method: "GET",
        operation: "POSITION_QUERY_READ",
        evidenceKind: "POSITION_QUERY_READ",
        source: "LOCAL_VERIFICATION",
        relatedOpenQuestion: "OQ-002",
        verified: true
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
      kind: relatedOpenQuestion === "OQ-002" ? evidenceKindForAccountsHoldings : "API_TERMS_REVIEW",
      relatedOpenQuestion,
      source: "TOSS_OFFICIAL_DOCS",
      sourceReference: "Local fixture reference for scripted tests.",
      sanitizedSummary: "Sanitized fixture summary with enough detail to pass intake review.",
      reviewedByHuman: true,
      rawPayloadIncluded: false,
      screenshotContainsSecrets: false,
      liveWriteOperation: false
    }))
  });

  return [endpointPath, manifestPath, intakePath];
}

function tempJson(value: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "toss-read-only-verify-"));
  const path = join(dir, "input.json");
  writeFileSync(path, JSON.stringify(value), "utf8");
  return path;
}

function startMockTossServer(config: {
  accountsBody?: unknown;
  holdingsBody?: unknown;
  requireHoldingsAccountHeader?: boolean;
}): Promise<{ url: string }> {
  return new Promise((resolve) => {
    const server = createServer((request, response) => {
      response.setHeader("connection", "close");

      if (request.method === "POST" && request.url === "/oauth2/token") {
        request.on("data", () => {});
        request.on("end", () => {
          response.writeHead(200, { "content-type": "application/json" });
          response.end(JSON.stringify({ access_token: "mock-access-token", token_type: "Bearer", expires_in: 3600 }));
        });
        return;
      }

      if (request.method === "GET" && request.url === "/api/v1/accounts") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify(config.accountsBody ?? { result: [] }));
        return;
      }

      if (request.method === "GET" && request.url === "/api/v1/holdings") {
        if (config.requireHoldingsAccountHeader && request.headers["x-tossinvest-account"] !== "fixture-account-ref") {
          response.writeHead(400, { "content-type": "application/json" });
          response.end(JSON.stringify({ error: "missing-account-ref" }));
          return;
        }
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify(config.holdingsBody ?? { result: [] }));
        return;
      }

      request.resume();
      request.on("end", () => {
        response.writeHead(404, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: "not-found" }));
      });
    });

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (typeof address === "object" && address) {
        servers.push(server);
        resolve({ url: `http://127.0.0.1:${address.port}` });
      }
    });
  });
}
