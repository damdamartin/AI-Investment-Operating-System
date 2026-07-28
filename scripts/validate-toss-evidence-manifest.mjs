#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const manifestPath = resolve(process.cwd(), process.argv[2] ?? "docs/phase5/evidence-manifest.example.json");
const reasonCodes = [];

if (!existsSync(manifestPath)) {
  reasonCodes.push("evidence_manifest_file_missing");
  printReport({ evidenceCount: 0, relatedOpenQuestions: [] });
  process.exit(1);
}

let manifest;

try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch {
  reasonCodes.push("evidence_manifest_json_invalid");
  printReport({ evidenceCount: 0, relatedOpenQuestions: [] });
  process.exit(1);
}

const evidence = Array.isArray(manifest.evidence) ? manifest.evidence : [];
const relatedOpenQuestions = [];

if (manifest.manifestVersion !== "1") {
  reasonCodes.push("unsupported_evidence_manifest_version");
}

for (const item of evidence) {
  const id = typeof item.id === "string" ? item.id : "unknown";

  if (item.sanitized !== true) {
    reasonCodes.push(`manifest_evidence_not_sanitized_${id}`);
  }

  if (item.containsCredential === true) {
    reasonCodes.push(`manifest_evidence_contains_credential_${id}`);
  }

  if (item.liveWriteOperation === true) {
    reasonCodes.push(`manifest_evidence_contains_live_write_${id}`);
  }

  if (typeof item.relatedOpenQuestion !== "string" || !item.relatedOpenQuestion.startsWith("OQ-")) {
    reasonCodes.push(`manifest_evidence_missing_open_question_${id}`);
  } else {
    relatedOpenQuestions.push(item.relatedOpenQuestion);
  }
}

printReport({
  evidenceCount: evidence.length,
  relatedOpenQuestions: [...new Set(relatedOpenQuestions)].sort()
});

process.exit(reasonCodes.length === 0 ? 0 : 1);

function printReport(extra) {
  console.log(JSON.stringify({
    valid: reasonCodes.length === 0,
    ...extra,
    reasonCodes: [...new Set(reasonCodes)].sort(),
    liveBrokerWriteAllowed: false,
    safetyType: "TOSS_READ_ONLY_EVIDENCE_MANIFEST_LOCAL_REPORT"
  }, null, 2));
}
