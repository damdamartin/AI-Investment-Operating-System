import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const scriptPath = join(repoRoot, "scripts", "phase5-toss-account-ref-setup.mjs");
const servers: Server[] = [];

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
});

describe("phase5-toss-account-ref-setup script", () => {
  it("updates TOSS_ACCOUNT_REF from a single sanitized accountSeq without printing secrets", async () => {
    const server = await startMockTossServer({
      tokenStatus: 200,
      accountsStatus: 200,
      accountsBody: { result: [{ accountSeq: 7, accountNo: "123-SECRET-ACCOUNT" }] }
    });
    const dir = tempEnv(server.url);

    const { stdout: output, status } = await runScript(dir);
    expect(status).toBe(0);
    const report = JSON.parse(output);
    const env = readFileSync(join(dir, ".env"), "utf8");

    expect(report.accountRefUpdated).toBe(true);
    expect(report.accountCount).toBe(1);
    expect(report.liveBrokerWriteAllowed).toBe(false);
    expect(report.networkCallsPerformed).toBe(true);
    expect(env).toContain("TOSS_ACCOUNT_REF=7");
    expect(output).not.toContain("client-secret-value");
    expect(output).not.toContain("123-SECRET-ACCOUNT");
    expect(output).not.toContain("mock-access-token");
  });

  it("does not update env when multiple accounts require manual selection", async () => {
    const server = await startMockTossServer({
      tokenStatus: 200,
      accountsStatus: 200,
      accountsBody: { result: [{ accountSeq: 7 }, { accountSeq: 8 }] }
    });
    const dir = tempEnv(server.url);

    const { stdout: output, status } = await runScript(dir);
    expect(status).toBe(1);
    const report = JSON.parse(output);
    const env = readFileSync(join(dir, ".env"), "utf8");

    expect(report.accountRefUpdated).toBe(false);
    expect(report.accountCount).toBe(2);
    expect(report.selectedAccountIndex).toBeNull();
    expect(report.reasonCodes).toContain("multiple_accounts_manual_selection_required");
    expect(env).toContain("TOSS_ACCOUNT_REF=replace-with-local-secret");
    expect(Object.keys(report)).not.toContain("accountSeq");
    expect(Object.keys(report)).not.toContain("accountNo");
  });

  it("fails closed without network calls when required credentials are missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "toss-account-ref-"));
    writeFileSync(
      join(dir, ".env"),
      [
        "LIVE_TRADING_ENABLED=false",
        "TOSS_READ_ONLY_MODE=true",
        "TOSS_API_BASE_URL=https://openapi.tossinvest.com",
        "TOSS_CLIENT_ID=replace-with-local-secret",
        "TOSS_CLIENT_SECRET=replace-with-local-secret",
        "TOSS_ACCOUNT_REF=replace-with-local-secret",
        ""
      ].join("\n"),
      "utf8"
    );

    let output = "";
    try {
      output = execFileSync(process.execPath, [scriptPath], {
        cwd: dir,
        encoding: "utf8",
        env: { PATH: process.env.PATH },
        timeout: 5000
      });
    } catch (error) {
      output = String((error as { stdout?: Buffer }).stdout);
    }
    const report = JSON.parse(output);

    expect(report.reasonCodes).toContain("missing_or_placeholder_toss_client_id");
    expect(report.reasonCodes).toContain("missing_or_placeholder_toss_client_secret");
    expect(report.networkCallsPerformed).toBe(false);
    expect(report.liveBrokerWriteAllowed).toBe(false);
  });
});

function tempEnv(baseUrl: string): string {
  const dir = mkdtempSync(join(tmpdir(), "toss-account-ref-"));
  writeFileSync(
    join(dir, ".env"),
    [
      "LIVE_TRADING_ENABLED=false",
      "TOSS_READ_ONLY_MODE=true",
      `TOSS_API_BASE_URL=${baseUrl}`,
      "TOSS_CLIENT_ID=client-id-value",
      "TOSS_CLIENT_SECRET=client-secret-value",
      "TOSS_ACCOUNT_REF=replace-with-local-secret",
      ""
    ].join("\n"),
    "utf8"
  );
  return dir;
}

function startMockTossServer(config: {
  tokenStatus: number;
  accountsStatus: number;
  accountsBody: unknown;
}): Promise<{ url: string }> {
  return new Promise((resolve) => {
    const server = createServer((request, response) => {
      response.setHeader("connection", "close");

      if (request.method === "POST" && request.url === "/oauth2/token") {
        request.on("data", () => {});
        request.on("end", () => {
          response.writeHead(config.tokenStatus, { "content-type": "application/json" });
          response.end(JSON.stringify({ access_token: "mock-access-token", token_type: "Bearer" }));
        });
        return;
      }

      if (request.method === "GET" && request.url === "/api/v1/accounts") {
        request.on("data", () => {});
        request.on("end", () => {
          response.writeHead(config.accountsStatus, { "content-type": "application/json" });
          response.end(JSON.stringify(config.accountsBody));
        });
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

function runScript(cwd: string): Promise<{ stdout: string; stderr: string; status: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd,
      env: { PATH: process.env.PATH },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("phase5-toss-account-ref-setup timed out"));
    }, 5000);

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
      resolve({ stdout, stderr, status });
    });
  });
}
