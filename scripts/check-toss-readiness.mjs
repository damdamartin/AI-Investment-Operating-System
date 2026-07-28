#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const placeholderPrefix = "replace-with-";
const requiredFields = [
  "TOSS_API_BASE_URL",
  "TOSS_CLIENT_ID",
  "TOSS_CLIENT_SECRET",
  "TOSS_ACCOUNT_REF"
];

loadDotEnvIfPresent(resolve(process.cwd(), ".env"));

const missingFields = [];
const reasonCodes = [];

if (process.env.LIVE_TRADING_ENABLED === "true") {
  reasonCodes.push("live_trading_enabled");
}

if (process.env.TOSS_READ_ONLY_MODE !== "true") {
  reasonCodes.push("toss_read_only_mode_not_true");
}

for (const field of requiredFields) {
  const value = process.env[field];
  if (!value || value.startsWith(placeholderPrefix)) {
    missingFields.push(field);
    reasonCodes.push(`missing_or_placeholder_${field.toLowerCase()}`);
  }
}

const ready = reasonCodes.length === 0;

const report = {
  ready,
  safeToAttemptReadOnlyCalls: ready,
  liveBrokerWriteAllowed: false,
  missingFields,
  reasonCodes: [...new Set(reasonCodes)].sort(),
  safetyType: "TOSS_READ_ONLY_LOCAL_READINESS_REPORT"
};

console.log(JSON.stringify(report, null, 2));
process.exit(ready ? 0 : 1);

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
