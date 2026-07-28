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

/**
 * This is a deliberate, minimal duplication of the rule matrix in
 * src/application/toss/read-only-endpoint-catalog.ts (TossReadOnlyEndpointCatalogValidator).
 * No Phase 5 script in this repository imports compiled/stripped TypeScript (there is no
 * dist build and no ts-node/tsx dependency), so importing the validator directly is not
 * practical here without adding new build tooling out of this task's scope. Every set,
 * pattern, and reason code below is kept identical to the TypeScript validator on purpose;
 * tests/scripts/validate-toss-endpoints-script.test.ts pins the same rule matrix as
 * tests/application/toss-read-only-endpoint-catalog.test.ts so the two cannot drift apart
 * silently again.
 */
const validOperations = new Set([
  "AUTHENTICATION_READ",
  "ACCOUNT_SNAPSHOT_READ",
  "POSITION_QUERY_READ",
  "MARKET_DATA_READ",
  "ORDER_STATUS_QUERY_READ",
  "FILL_QUERY_READ",
  "CAPABILITY_METADATA_READ"
]);

const validSources = new Set([
  "TOSS_OFFICIAL_DOCS",
  "TOSS_DEVELOPER_CONSOLE",
  "LOCAL_VERIFICATION"
]);

const validMethods = new Set(["GET", "POST"]);

const validOpenQuestions = new Set(["OQ-001", "OQ-002", "OQ-003", "OQ-004"]);

const elevatedOperationEvidenceKind = {
  AUTHENTICATION_READ: "AUTHENTICATION_READ",
  ORDER_STATUS_QUERY_READ: "ORDER_STATUS_QUERY_READ",
  FILL_QUERY_READ: "FILL_QUERY_READ"
};

const nonElevatedOperations = new Set([
  "ACCOUNT_SNAPSHOT_READ",
  "POSITION_QUERY_READ",
  "MARKET_DATA_READ",
  "CAPABILITY_METADATA_READ"
]);

const nonElevatedEvidenceKinds = new Set([
  "ACCOUNT_SNAPSHOT_READ",
  "POSITION_QUERY_READ",
  "MARKET_DATA_READ",
  "API_TERMS_REVIEW",
  "ETF_SUPPORT_DOCUMENTATION",
  "FRACTIONAL_SUPPORT_DOCUMENTATION",
  "EXTENDED_HOURS_DOCUMENTATION"
]);

const mutationLookingPathAllowedOperations = new Set([
  "ORDER_STATUS_QUERY_READ",
  "FILL_QUERY_READ"
]);

const hardBlockedWritePathPattern =
  /\b(cancel|modify|amend|replace|withdraw|transfer|exchange|deposit|buy|sell|place|submit|settle|close)\b/i;

const softBlockedOrderPathPattern = /\b(orders?|fills?)\b/i;

if (catalog.catalogVersion !== "1") {
  reasonCodes.push("unsupported_endpoint_catalog_version");
}

for (const item of items) {
  const id = typeof item.id === "string" && item.id.length > 0 ? item.id : "unknown";

  if (seenIds.has(id)) {
    reasonCodes.push(`duplicate_endpoint_id_${id}`);
  }
  seenIds.add(id);

  if (typeof item.path !== "string" || !item.path.startsWith("/")) {
    reasonCodes.push(`endpoint_path_must_start_with_slash_${id}`);
  }

  if (!validMethods.has(item.method)) {
    reasonCodes.push(`endpoint_invalid_method_${id}`);
  }

  const hasKnownOperation = item.operation != null && validOperations.has(item.operation);
  if (!hasKnownOperation) {
    reasonCodes.push(`endpoint_missing_operation_class_${id}`);
  }

  const hasKnownSource = item.source != null && validSources.has(item.source);
  if (!hasKnownSource) {
    reasonCodes.push(`endpoint_missing_source_evidence_${id}`);
  }

  if (item.method === "POST" && item.operation !== "AUTHENTICATION_READ") {
    reasonCodes.push(`post_allowed_only_for_authentication_${id}`);
  }

  if (hasKnownOperation) {
    const requiredElevatedKind = elevatedOperationEvidenceKind[item.operation];

    if (requiredElevatedKind) {
      if (item.evidenceKind !== requiredElevatedKind) {
        reasonCodes.push(`endpoint_operation_evidence_mismatch_${id}`);
      }
    } else if (nonElevatedOperations.has(item.operation)) {
      if (!item.evidenceKind || !nonElevatedEvidenceKinds.has(item.evidenceKind)) {
        reasonCodes.push(`endpoint_operation_evidence_mismatch_${id}`);
      }
    }
  }

  const path = typeof item.path === "string" ? item.path : "";
  const hasHardBlockedKeyword = hardBlockedWritePathPattern.test(path);
  const hasAmbiguousOrderKeyword = softBlockedOrderPathPattern.test(path);
  const isSafeOrderOrFillRead =
    hasKnownOperation && mutationLookingPathAllowedOperations.has(item.operation);

  if (hasHardBlockedKeyword) {
    // Unambiguous mutation verbs (cancel, modify, withdraw, ...) are never tolerated,
    // regardless of the declared operation or evidence.
    reasonCodes.push(`endpoint_path_looks_write_scoped_${id}`);
  } else if (hasAmbiguousOrderKeyword) {
    if (!isSafeOrderOrFillRead) {
      reasonCodes.push(`endpoint_path_looks_write_scoped_${id}`);
    } else {
      // A write-shaped path is only tolerated for order-status/fill reads when it is
      // backed by real, matching, verified evidence.
      const hasMatchingEvidence = item.evidenceKind === elevatedOperationEvidenceKind[item.operation];

      if (!item.verified || !hasKnownSource || !hasMatchingEvidence) {
        reasonCodes.push(`endpoint_mutation_looking_path_requires_verified_evidence_${id}`);
      }
    }
  }

  const hasKnownOpenQuestion =
    typeof item.relatedOpenQuestion === "string" && validOpenQuestions.has(item.relatedOpenQuestion);
  if (!hasKnownOpenQuestion) {
    reasonCodes.push(`endpoint_missing_open_question_${id}`);
  }

  if (!item.verified) {
    warnings.push(`endpoint_not_verified_${id}`);
  }
}

printReport({
  itemCount: items.length,
  verifiedEndpointCount: items.filter((item) => item.verified).length
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
