#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const endpointCatalogPath = resolve(
  process.cwd(),
  process.argv[2] ?? "docs/phase5/toss-read-only-endpoints.example.json"
);
const evidenceManifestPath = resolve(
  process.cwd(),
  process.argv[3] ?? "docs/phase5/evidence-manifest.example.json"
);
const evidenceIntakePath = resolve(
  process.cwd(),
  process.argv[4] ?? "docs/phase5/evidence-intake.example.json"
);

loadDotEnvIfPresent(resolve(process.cwd(), ".env"));

const readiness = reviewReadiness();
const endpoints = reviewEndpointCatalog(endpointCatalogPath);
const evidence = reviewEvidenceManifest(evidenceManifestPath);
const intake = reviewEvidenceIntake(evidenceIntakePath);
const preparedRequestCount =
  readiness.ready && endpoints.valid
    ? endpoints.items.filter((item) => item.verified === true).length
    : 0;
const blockingReasonCodes = [
  ...readiness.reasonCodes,
  ...endpoints.reasonCodes,
  ...evidence.reasonCodes,
  ...intake.reasonCodes
];
const warnings = [...endpoints.warnings, ...intake.warnings];

const report = {
  readyForReadOnlyVerification:
    readiness.ready && endpoints.valid && preparedRequestCount > 0,
  readiness,
  endpoints: {
    valid: endpoints.valid,
    itemCount: endpoints.items.length,
    verifiedEndpointCount: endpoints.items.filter((item) => item.verified === true).length,
    reasonCodes: endpoints.reasonCodes,
    warnings: endpoints.warnings
  },
  evidence: {
    valid: evidence.valid,
    evidenceCount: evidence.evidenceCount,
    reasonCodes: evidence.reasonCodes
  },
  intake: {
    readyForEvidenceManifest: intake.readyForEvidenceManifest,
    itemCount: intake.items.length,
    reviewedItemCount: intake.items.filter((item) => item.reviewedByHuman === true).length,
    reasonCodes: intake.reasonCodes,
    warnings: intake.warnings
  },
  preparedRequestCount,
  blockingReasonCodes: [...new Set(blockingReasonCodes)].sort(),
  warnings: [...new Set(warnings)].sort(),
  liveBrokerWriteAllowed: false,
  networkCallsPerformed: false,
  safetyType: "PHASE5_TOSS_DOCTOR_LOCAL_REPORT"
};

console.log(JSON.stringify(report, null, 2));

function reviewReadiness() {
  const requiredFields = [
    "TOSS_API_BASE_URL",
    "TOSS_CLIENT_ID",
    "TOSS_CLIENT_SECRET",
    "TOSS_ACCOUNT_REF"
  ];
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
    if (!value || value.startsWith("replace-with-")) {
      missingFields.push(field);
      reasonCodes.push(`missing_or_placeholder_${field.toLowerCase()}`);
    }
  }

  return {
    ready: reasonCodes.length === 0,
    missingFields,
    reasonCodes: [...new Set(reasonCodes)].sort()
  };
}

function reviewEndpointCatalog(path) {
  const reasonCodes = [];
  const warnings = [];
  const catalog = readJson(path, "endpoint_catalog", reasonCodes);
  const items = catalog && Array.isArray(catalog.items) ? catalog.items : [];
  const seenIds = new Set();

  if (catalog && catalog.catalogVersion !== "1") {
    reasonCodes.push("unsupported_endpoint_catalog_version");
  }

  for (const item of items) {
    const id = typeof item.id === "string" ? item.id : "unknown";

    if (seenIds.has(id)) reasonCodes.push(`duplicate_endpoint_id_${id}`);
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

  return {
    valid: reasonCodes.length === 0,
    items,
    reasonCodes: [...new Set(reasonCodes)].sort(),
    warnings: [...new Set(warnings)].sort()
  };
}

function reviewEvidenceIntake(path) {
  const reasonCodes = [];
  const warnings = [];
  const intake = readJson(path, "evidence_intake", reasonCodes);
  const items = intake && Array.isArray(intake.items) ? intake.items : [];
  const seenIds = new Set();

  if (intake && intake.intakeVersion !== "1") {
    reasonCodes.push("unsupported_intake_version");
  }

  if (items.length === 0) {
    reasonCodes.push("intake_has_no_items");
  }

  for (const item of items) {
    const id = typeof item.id === "string" ? item.id : "unknown";

    if (seenIds.has(id)) reasonCodes.push(`duplicate_intake_id_${id}`);
    seenIds.add(id);

    if (typeof item.relatedOpenQuestion !== "string" || !item.relatedOpenQuestion.startsWith("OQ-")) {
      reasonCodes.push(`intake_missing_open_question_${id}`);
    }

    if (item.reviewedByHuman !== true) reasonCodes.push(`intake_not_human_reviewed_${id}`);
    if (item.rawPayloadIncluded === true) reasonCodes.push(`intake_contains_raw_payload_${id}`);
    if (item.screenshotContainsSecrets === true) reasonCodes.push(`intake_screenshot_contains_secrets_${id}`);
    if (item.liveWriteOperation === true) reasonCodes.push(`intake_contains_live_write_${id}`);

    if (typeof item.sourceReference !== "string" || item.sourceReference.trim().length === 0) {
      reasonCodes.push(`intake_missing_source_reference_${id}`);
    }

    if (typeof item.sanitizedSummary !== "string" || item.sanitizedSummary.trim().length < 20) {
      warnings.push(`intake_summary_too_short_${id}`);
    }

    const searchableText = `${item.sourceReference ?? ""}\n${item.sanitizedSummary ?? ""}`;
    if (/(access[_-]?token|refresh[_-]?token|client[_-]?secret|app[_-]?secret|authorization|bearer\s+[a-z0-9._-]+|계좌번호|account[_-]?number)/i.test(searchableText)) {
      reasonCodes.push(`intake_may_contain_secret_${id}`);
    }
  }

  return {
    readyForEvidenceManifest: reasonCodes.length === 0,
    items,
    reasonCodes: [...new Set(reasonCodes)].sort(),
    warnings: [...new Set(warnings)].sort()
  };
}

function reviewEvidenceManifest(path) {
  const reasonCodes = [];
  const manifest = readJson(path, "evidence_manifest", reasonCodes);
  const evidence = manifest && Array.isArray(manifest.evidence) ? manifest.evidence : [];

  if (manifest && manifest.manifestVersion !== "1") {
    reasonCodes.push("unsupported_evidence_manifest_version");
  }

  for (const item of evidence) {
    const id = typeof item.id === "string" ? item.id : "unknown";

    if (item.sanitized !== true) reasonCodes.push(`manifest_evidence_not_sanitized_${id}`);
    if (item.containsCredential === true) reasonCodes.push(`manifest_evidence_contains_credential_${id}`);
    if (item.liveWriteOperation === true) reasonCodes.push(`manifest_evidence_contains_live_write_${id}`);
    if (typeof item.relatedOpenQuestion !== "string" || !item.relatedOpenQuestion.startsWith("OQ-")) {
      reasonCodes.push(`manifest_evidence_missing_open_question_${id}`);
    }
  }

  return {
    valid: reasonCodes.length === 0,
    evidenceCount: evidence.length,
    reasonCodes: [...new Set(reasonCodes)].sort()
  };
}

function readJson(path, label, reasonCodes) {
  if (!existsSync(path)) {
    reasonCodes.push(`${label}_file_missing`);
    return undefined;
  }

  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    reasonCodes.push(`${label}_json_invalid`);
    return undefined;
  }
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
