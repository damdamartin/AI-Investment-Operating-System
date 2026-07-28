#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const catalogPath = resolve(process.cwd(), process.argv[2] ?? "docs/phase5/toss-read-only-endpoints.example.json");
loadDotEnvIfPresent(resolve(process.cwd(), ".env"));

const reasonCodes = [];
const warnings = [];
const missingFields = [];
const requiredFields = [
  "TOSS_API_BASE_URL",
  "TOSS_CLIENT_ID",
  "TOSS_CLIENT_SECRET",
  "TOSS_ACCOUNT_REF"
];

if (process.env.LIVE_TRADING_ENABLED === "true") {
  reasonCodes.push("live_trading_enabled");
}

if (process.env.TOSS_READ_ONLY_MODE !== "true") {
  reasonCodes.push("toss_read_only_mode_not_true");
}

for (const field of requiredFields) {
  const value = process.env[field];
  if (!value || value.startsWith("replace-with-")) {
    missingFields.push(field);
    reasonCodes.push(`missing_or_placeholder_${field.toLowerCase()}`);
  }
}

const catalog = readCatalog(catalogPath, reasonCodes);
const preparedRequests = [];

if (catalog) {
  const catalogItems = Array.isArray(catalog.items) ? catalog.items : [];

  for (const item of catalogItems) {
    const id = typeof item.id === "string" ? item.id : "unknown";

    if (typeof item.path !== "string" || !item.path.startsWith("/")) {
      reasonCodes.push(`endpoint_path_must_start_with_slash_${id}`);
      continue;
    }

    if (item.method === "POST" && item.operation !== "AUTHENTICATION_READ") {
      reasonCodes.push(`post_allowed_only_for_authentication_${id}`);
      continue;
    }

    if (typeof item.relatedOpenQuestion !== "string" || !item.relatedOpenQuestion.startsWith("OQ-")) {
      reasonCodes.push(`endpoint_missing_open_question_${id}`);
      continue;
    }

    if (item.verified !== true) {
      warnings.push(`endpoint_not_verified_${id}`);
      continue;
    }

    if (reasonCodes.length === 0) {
      preparedRequests.push({
        id,
        operation: item.operation,
        method: item.method,
        url: buildUrl(process.env.TOSS_API_BASE_URL, item.path),
        headers: {
          "X-Toss-Client-Id": "****",
          "X-Toss-Client-Secret": "****",
          "X-Toss-Account-Ref": "****"
        },
        dryRun: true
      });
    }
  }
}

const ready = reasonCodes.length === 0;

console.log(JSON.stringify({
  ready,
  preparedRequestCount: preparedRequests.length,
  preparedRequests,
  missingFields,
  reasonCodes: [...new Set(reasonCodes)].sort(),
  warnings: [...new Set(warnings)].sort(),
  liveBrokerWriteAllowed: false,
  networkCallsPerformed: false,
  safetyType: "TOSS_READ_ONLY_LOCAL_VERIFICATION_PLAN"
}, null, 2));

process.exit(ready ? 0 : 1);

function readCatalog(path, reasons) {
  if (!existsSync(path)) {
    reasons.push("endpoint_catalog_file_missing");
    return undefined;
  }

  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    reasons.push("endpoint_catalog_json_invalid");
    return undefined;
  }
}

function buildUrl(baseUrl, path) {
  return new URL(path, baseUrl).toString();
}

function loadDotEnvIfPresent(path) {
  if (!existsSync(path)) return;

  const content = readFileSync(path, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}
