#!/usr/bin/env node

/**
 * Phase 5 first read-only verification runner (P5-013).
 *
 * This script CAN perform exactly one real, human-approved Toss Securities
 * read-only API call (authentication + one of `accounts` / `holdings`). By
 * default - no approval flag, an unknown or write-looking target, or a
 * failed preflight/call-gate check - it performs no network call at all and
 * exits non-zero. See docs/phase5/local-toss-read-only-runbook.md (Step 9)
 * and docs/phase5/toss-read-only-call-gate.md for the full safety model this
 * script sits inside.
 *
 * ARCHITECTURAL NOTE: like scripts/phase5-toss-account-ref-setup.mjs, this
 * plain .mjs script does not import compiled/stripped TypeScript - there is
 * no dist build and no ts-node/tsx dependency in this repository. The Toss
 * HTTP interaction below is a narrow, self-contained mirror of
 * src/adapters/toss/toss-read-only-http-client.ts's safety shape (only
 * `authenticate` + one read call, hardcoded `liveBrokerWriteAllowed: false`,
 * no generic request escape hatch, token/account redaction) rather than an
 * import of that class. tests/scripts/phase5-toss-read-only-verify-script.test.ts
 * additionally imports TossReadOnlyVerificationResultValidator (a real TS
 * module, safe to import from a .ts test file compiled by vitest) to prove
 * the printed report matches the shape that pipeline expects.
 *
 * Usage:
 *   PHASE5_TOSS_READ_ONLY_CALL_APPROVED=true npm run phase5:toss:verify-read-only -- accounts
 *   PHASE5_TOSS_READ_ONLY_CALL_APPROVED=true npm run phase5:toss:verify-read-only -- holdings
 *
 * Optional trailing args (forwarded to preflight/call-gate, same convention
 * as phase5-toss-doctor.mjs / phase5-toss-preflight.mjs / phase5-toss-call-gate.mjs):
 *   ... -- accounts tmp/phase5/toss-read-only-endpoints.local.json tmp/phase5/evidence-manifest.local.json tmp/phase5/evidence-intake.local.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

/**
 * The fixed, hardcoded set of targets this runner can attempt. There is no
 * generic "operation" argument and no way to reach an order, cancel, modify,
 * transfer, or withdrawal path through this script - only these two entries
 * exist, and each maps to exactly one read-only Toss operation and evidence
 * kind.
 */
const ALLOWED_TARGETS = {
  accounts: {
    operation: "ACCOUNT_SNAPSHOT_READ",
    evidenceKind: "ACCOUNT_SNAPSHOT_READ",
    path: "/api/v1/accounts"
  },
  holdings: {
    operation: "POSITION_QUERY_READ",
    evidenceKind: "POSITION_QUERY_READ",
    path: "/api/v1/holdings"
  }
};

const placeholderPrefix = "replace-with-";
const requiredEnvFields = ["TOSS_API_BASE_URL", "TOSS_CLIENT_ID", "TOSS_CLIENT_SECRET", "TOSS_ACCOUNT_REF"];

const [, , rawTarget, ...customPaths] = process.argv;
const forwardedPaths = customPaths.filter(Boolean);
const approvalFlag = process.env.PHASE5_TOSS_READ_ONLY_CALL_APPROVED;
const targetConfig = typeof rawTarget === "string" ? ALLOWED_TARGETS[rawTarget] : undefined;

const report = {
  target: rawTarget ?? null,
  operation: targetConfig ? targetConfig.operation : null,
  evidenceKind: targetConfig ? targetConfig.evidenceKind : null,
  sanitizedEvidencePath: null,
  liveBrokerWriteAllowed: false,
  networkCallsPerformed: false,
  rawPayloadStored: false,
  reasonCodes: [],
  warnings: [],
  preflight: null,
  callGate: null,
  safetyType: "PHASE5_TOSS_READ_ONLY_VERIFY_REPORT"
};

await main();

async function main() {
  // 1. Only a fixed, known, read-only target is accepted. This alone fails
  // closed for unknown targets and for anything write-looking, since no
  // write-looking string is ever a key of ALLOWED_TARGETS.
  if (!targetConfig) {
    report.reasonCodes.push(rawTarget ? `unsupported_target_${rawTarget}` : "missing_target");
    return finish(1);
  }

  // 2. Explicit human approval is required before this script does anything
  // else, including running preflight/call-gate. Exact string match only -
  // no other value ("1", "TRUE", "yes", ...) is accepted.
  if (approvalFlag !== "true") {
    report.reasonCodes.push("human_read_only_call_approval_missing");
    return finish(1);
  }

  // 3. Run local preflight as a child process (same pattern preflight.mjs
  // and call-gate.mjs use to compose other Phase 5 scripts). No network call
  // has happened yet.
  const preflight = runJsonCommand("npm", ["run", "phase5:toss:preflight", "--silent", ...forwardedPaths]);
  report.preflight = {
    readyForReadOnlyCall: preflight.report.readyForReadOnlyCall === true,
    reasonCodes: preflight.report.reasonCodes ?? []
  };
  if (preflight.report.readyForReadOnlyCall !== true) {
    report.reasonCodes.push("preflight_not_ready");
    return finish(1);
  }

  // 4. Run the final read-only call gate as a child process. This also
  // re-checks the approval flag and re-runs preflight internally; a failure
  // here fails closed even if step 3 above passed.
  const callGate = runJsonCommand("npm", ["run", "phase5:toss:call-gate", "--silent", ...forwardedPaths]);
  report.callGate = {
    readyToAttemptRealReadOnlyCall: callGate.report.readyToAttemptRealReadOnlyCall === true,
    reasonCodes: callGate.report.reasonCodes ?? []
  };
  if (callGate.report.readyToAttemptRealReadOnlyCall !== true) {
    report.reasonCodes.push("call_gate_not_ready");
    return finish(1);
  }

  // 5. Defense in depth: re-validate local safety configuration directly in
  // this process instead of trusting the child-process reports alone (Rule 22,
  // Fail Closed). This deliberately duplicates check-toss-readiness.mjs's
  // rule matrix rather than trusting a single point of failure.
  const env = loadEnv();
  const readinessReasonCodes = reviewLocalReadiness(env);
  if (readinessReasonCodes.length > 0) {
    report.reasonCodes.push(...readinessReasonCodes);
    return finish(1);
  }

  // 6. Perform exactly one approved read-only call: authenticate, then the
  // single requested target read. No loop, no retry, no second target.
  await performApprovedCall(env, targetConfig);
  return finish(report.reasonCodes.length === 0 ? 0 : 1);
}

async function performApprovedCall(env, config) {
  const baseUrl = normalizeBaseUrl(env.TOSS_API_BASE_URL);
  if (!baseUrl) {
    report.reasonCodes.push("invalid_toss_api_base_url");
    return;
  }

  const accessToken = await issueAccessToken(baseUrl, env);
  if (!accessToken) return;

  const itemCount = await fetchTargetItemCount(baseUrl, accessToken, config);
  if (itemCount === undefined) return;

  writeSanitizedEvidence(config, itemCount);
}

async function issueAccessToken(baseUrl, env) {
  report.networkCallsPerformed = true;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: env.TOSS_CLIENT_ID,
    client_secret: env.TOSS_CLIENT_SECRET
  });

  let response;
  try {
    response = await fetch(new URL("/oauth2/token", baseUrl), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body
    });
  } catch {
    report.reasonCodes.push("token_request_network_error");
    return undefined;
  }

  if (!response.ok) {
    report.reasonCodes.push(`token_request_failed_status_${response.status}`);
    return undefined;
  }

  const payload = await safeJson(response);
  const accessToken = payload && typeof payload === "object" ? payload.access_token : undefined;
  if (typeof accessToken !== "string" || accessToken.length === 0) {
    report.reasonCodes.push("token_response_missing_access_token");
    return undefined;
  }

  // The access token lives only in this local variable and is never logged,
  // printed, or written to disk. It is discarded when this function returns.
  return accessToken;
}

async function fetchTargetItemCount(baseUrl, accessToken, config) {
  let response;
  try {
    response = await fetch(new URL(config.path, baseUrl), {
      method: "GET",
      headers: { authorization: `Bearer ${accessToken}` }
    });
  } catch {
    report.reasonCodes.push(`${config.operation.toLowerCase()}_request_network_error`);
    return undefined;
  }

  if (!response.ok) {
    report.reasonCodes.push(`${config.operation.toLowerCase()}_request_failed_status_${response.status}`);
    return undefined;
  }

  const payload = await safeJson(response);
  const items = extractArray(payload);
  if (!items) {
    report.reasonCodes.push(`${config.operation.toLowerCase()}_response_invalid_shape`);
    return undefined;
  }

  // Only a count is ever derived from the response. Symbols, quantities,
  // account references, and masked account numbers are intentionally not
  // extracted here: this runner never stores or prints any per-item field
  // from a real Toss response, only how many items came back.
  return items.length;
}

function writeSanitizedEvidence(config, itemCount) {
  const evidenceDir = resolve(process.cwd(), "tmp", "phase5");
  mkdirSync(evidenceDir, { recursive: true });

  const collectedAt = new Date();
  const fileSafeTimestamp = collectedAt
    .toISOString()
    .replace(/:/g, "-")
    .replace(/\./g, "-");
  const fileName = `read-only-verify-${config.operation.toLowerCase().replace(/_/g, "-")}-${fileSafeTimestamp}.json`;
  const absolutePath = resolve(evidenceDir, fileName);
  const relativePath = `tmp/phase5/${fileName}`;

  const evidence = {
    evidenceVersion: "1",
    operation: config.operation,
    evidenceKind: config.evidenceKind,
    collectedAt: collectedAt.toISOString(),
    itemCount,
    liveBrokerWriteAllowed: false,
    networkCallsPerformed: true,
    rawPayloadStored: false,
    safetyType: "PHASE5_TOSS_READ_ONLY_VERIFY_EVIDENCE"
  };

  writeFileSync(absolutePath, JSON.stringify(evidence, null, 2), { encoding: "utf8", mode: 0o600 });
  report.sanitizedEvidencePath = relativePath;
}

function reviewLocalReadiness(env) {
  const reasonCodes = [];

  if (env.LIVE_TRADING_ENABLED === "true") {
    reasonCodes.push("live_trading_enabled");
  }
  if (env.TOSS_READ_ONLY_MODE !== "true") {
    reasonCodes.push("toss_read_only_mode_not_true");
  }
  for (const field of requiredEnvFields) {
    const value = env[field];
    if (!value || value.startsWith(placeholderPrefix)) {
      reasonCodes.push(`missing_or_placeholder_${field.toLowerCase()}`);
    }
  }

  return reasonCodes;
}

function finish(exitCode) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(exitCode);
}

function runJsonCommand(command, args) {
  try {
    const output = execFileSync(command, args, {
      cwd: process.cwd(),
      env: process.env
    }).toString();
    return { ok: true, report: JSON.parse(output) };
  } catch (error) {
    const output = String(error.stdout ?? "{}");
    try {
      return { ok: false, report: JSON.parse(output) };
    } catch {
      return { ok: false, report: {} };
    }
  }
}

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env");
  const env = { ...process.env };
  if (!existsSync(envPath)) return env;

  const content = readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");

    // process.env wins over the .env file when a key is already set, same
    // precedence as check-toss-readiness.mjs / phase5-toss-doctor.mjs.
    if (env[key] === undefined) {
      env[key] = value;
    }
  }
  return env;
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

/** Accepts either `{ result: [...] }` or a bare array response envelope. */
function extractArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload !== null && typeof payload === "object" && Array.isArray(payload.result)) {
    return payload.result;
  }
  return undefined;
}

/**
 * Only `https://` base URLs are accepted for real use. `http://127.0.0.1`
 * and `http://localhost` are accepted solely so tests can point this script
 * at a local mock server - this is the only sanctioned way to test the
 * network path below.
 */
function normalizeBaseUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && !isLocalTestUrl(url)) return null;
    return url;
  } catch {
    return null;
  }
}

function isLocalTestUrl(url) {
  return url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname);
}
