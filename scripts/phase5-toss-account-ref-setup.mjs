#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env");
const placeholderPrefix = "replace-with-";
const report = {
  envPath,
  accountRefUpdated: false,
  accountCount: 0,
  selectedAccountIndex: null,
  reasonCodes: [],
  warnings: [],
  liveBrokerWriteAllowed: false,
  networkCallsPerformed: false,
  safetyType: "PHASE5_TOSS_ACCOUNT_REF_SETUP_REPORT"
};

const envFile = loadEnvFile(envPath);
const env = { ...process.env, ...envFile.values };

if (env.LIVE_TRADING_ENABLED === "true") {
  report.reasonCodes.push("live_trading_enabled");
}
if (env.TOSS_READ_ONLY_MODE !== "true") {
  report.reasonCodes.push("toss_read_only_mode_not_true");
}
for (const field of ["TOSS_API_BASE_URL", "TOSS_CLIENT_ID", "TOSS_CLIENT_SECRET"]) {
  const value = env[field];
  if (!value || value.startsWith(placeholderPrefix)) {
    report.reasonCodes.push(`missing_or_placeholder_${field.toLowerCase()}`);
  }
}

if (report.reasonCodes.length === 0) {
  await fetchAccountReference(envFile, env);
}

console.log(JSON.stringify(report, null, 2));
process.exit(report.reasonCodes.length === 0 ? 0 : 1);

async function fetchAccountReference(envFileState, envState) {
  const baseUrl = normalizeBaseUrl(envState.TOSS_API_BASE_URL);
  if (!baseUrl) {
    report.reasonCodes.push("invalid_toss_api_base_url");
    return;
  }

  const token = await issueAccessToken(baseUrl, envState);
  if (!token) return;

  const accounts = await fetchAccounts(baseUrl, token);
  if (!accounts) return;

  report.accountCount = accounts.length;

  if (accounts.length === 0) {
    report.reasonCodes.push("account_list_empty");
    return;
  }

  if (accounts.length > 1) {
    report.reasonCodes.push("multiple_accounts_manual_selection_required");
    report.warnings.push("Account identifiers were not printed. Use Toss official account list response locally to choose the intended accountSeq.");
    return;
  }

  const accountSeq = accounts[0]?.accountSeq;
  if (!Number.isInteger(accountSeq)) {
    report.reasonCodes.push("account_seq_missing_or_invalid");
    return;
  }

  writeEnvValue(envFileState, "TOSS_ACCOUNT_REF", String(accountSeq));
  report.accountRefUpdated = true;
  report.selectedAccountIndex = 0;
}

async function issueAccessToken(baseUrl, envState) {
  report.networkCallsPerformed = true;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: envState.TOSS_CLIENT_ID,
    client_secret: envState.TOSS_CLIENT_SECRET
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
    return null;
  }

  if (!response.ok) {
    report.reasonCodes.push(`token_request_failed_status_${response.status}`);
    return null;
  }

  const payload = await safeJson(response);
  const accessToken = payload?.access_token;
  if (typeof accessToken !== "string" || accessToken.length === 0) {
    report.reasonCodes.push("token_response_missing_access_token");
    return null;
  }

  return accessToken;
}

async function fetchAccounts(baseUrl, accessToken) {
  report.networkCallsPerformed = true;
  let response;
  try {
    response = await fetch(new URL("/api/v1/accounts", baseUrl), {
      method: "GET",
      headers: { authorization: `Bearer ${accessToken}` }
    });
  } catch {
    report.reasonCodes.push("accounts_request_network_error");
    return null;
  }

  if (!response.ok) {
    report.reasonCodes.push(`accounts_request_failed_status_${response.status}`);
    return null;
  }

  const payload = await safeJson(response);
  const accounts = Array.isArray(payload?.result) ? payload.result : Array.isArray(payload) ? payload : null;
  if (!accounts) {
    report.reasonCodes.push("accounts_response_missing_result_array");
    return null;
  }

  return accounts;
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

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

function loadEnvFile(path) {
  if (!existsSync(path)) {
    return { path, lines: [], values: {} };
  }

  const content = readFileSync(path, "utf8");
  const lines = content.split(/\r?\n/);
  const values = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    values[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }

  return { path, lines, values };
}

function writeEnvValue(envFileState, key, value) {
  const escaped = escapeEnvValue(value);
  let replaced = false;
  const nextLines = envFileState.lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      replaced = true;
      return `${key}=${escaped}`;
    }

    return line;
  });

  if (!replaced) {
    nextLines.push(`${key}=${escaped}`);
  }

  writeFileSync(envFileState.path, nextLines.join("\n"), { encoding: "utf8", mode: 0o600 });
}

function escapeEnvValue(value) {
  if (/^[A-Za-z0-9._~:/?#[\]@!$&'()*+,;=%-]+$/.test(value)) return value;
  return JSON.stringify(value);
}
