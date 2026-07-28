#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const catalogPath = resolve(process.cwd(), process.argv[2] ?? "docs/phase5/toss-read-only-endpoints.example.json");
const reasonCodes = [];
const warnings = [];

if (!existsSync(catalogPath)) {
  reasonCodes.push("endpoint_catalog_file_missing");
  printReport({ itemCount: 0, verifiedEndpointCount: 0 });
  process.exit(1);
}

let catalog;

try {
  catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
} catch {
  reasonCodes.push("endpoint_catalog_json_invalid");
  printReport({ itemCount: 0, verifiedEndpointCount: 0 });
  process.exit(1);
}

const items = Array.isArray(catalog.items) ? catalog.items : [];
const seenIds = new Set();

if (catalog.catalogVersion !== "1") {
  reasonCodes.push("unsupported_endpoint_catalog_version");
}

for (const item of items) {
  const id = typeof item.id === "string" ? item.id : "unknown";

  if (seenIds.has(id)) {
    reasonCodes.push(`duplicate_endpoint_id_${id}`);
  }
  seenIds.add(id);

  if (typeof item.path !== "string" || !item.path.startsWith("/")) {
    reasonCodes.push(`endpoint_path_must_start_with_slash_${id}`);
  }

  if (item.method === "POST" && item.operation !== "AUTHENTICATION_READ") {
    reasonCodes.push(`post_allowed_only_for_authentication_${id}`);
  }

  if (typeof item.relatedOpenQuestion !== "string" || !item.relatedOpenQuestion.startsWith("OQ-")) {
    reasonCodes.push(`endpoint_missing_open_question_${id}`);
  }

  if (item.verified !== true) {
    warnings.push(`endpoint_not_verified_${id}`);
  }
}

printReport({
  itemCount: items.length,
  verifiedEndpointCount: items.filter((item) => item.verified === true).length
});

process.exit(reasonCodes.length === 0 ? 0 : 1);

function printReport(extra) {
  console.log(JSON.stringify({
    valid: reasonCodes.length === 0,
    ...extra,
    reasonCodes: [...new Set(reasonCodes)].sort(),
    warnings: [...new Set(warnings)].sort(),
    liveBrokerWriteAllowed: false,
    safetyType: "TOSS_READ_ONLY_ENDPOINT_CATALOG_LOCAL_REPORT"
  }, null, 2));
}
