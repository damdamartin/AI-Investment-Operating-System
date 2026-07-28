#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const manifestPath = resolve(process.cwd(), process.argv[2] ?? "docs/phase5/evidence-manifest.example.json");
const requiredOpenQuestions = ["OQ-001", "OQ-002", "OQ-003", "OQ-004"];
const reasonCodes = [];

if (!existsSync(manifestPath)) {
  reasonCodes.push("evidence_manifest_file_missing");
  printReport([]);
  process.exit(1);
}

let manifest;

try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch {
  reasonCodes.push("evidence_manifest_json_invalid");
  printReport([]);
  process.exit(1);
}

const evidence = Array.isArray(manifest.evidence) ? manifest.evidence : [];
const statuses = requiredOpenQuestions.map((openQuestionId) => {
  const matchingEvidence = evidence.filter((item) => item.relatedOpenQuestion === openQuestionId);
  const validEvidence = matchingEvidence.filter((item) =>
    item.sanitized === true &&
    item.containsCredential !== true &&
    item.liveWriteOperation !== true
  );

  return {
    openQuestionId,
    evidenceCount: matchingEvidence.length,
    validEvidenceCount: validEvidence.length,
    readyForReview: validEvidence.length > 0
  };
});

for (const status of statuses) {
  if (!status.readyForReview) {
    reasonCodes.push(`missing_valid_evidence_${status.openQuestionId.toLowerCase()}`);
  }
}

printReport(statuses);
process.exit(reasonCodes.length === 0 ? 0 : 1);

function printReport(statuses) {
  console.log(JSON.stringify({
    readyForOpenQuestionReview: reasonCodes.length === 0,
    statuses,
    missingOpenQuestions: statuses.filter((status) => !status.readyForReview).map((status) => status.openQuestionId),
    reasonCodes: [...new Set(reasonCodes)].sort(),
    liveBrokerWriteAllowed: false,
    safetyType: "TOSS_OPEN_QUESTION_EVIDENCE_LOCAL_REPORT"
  }, null, 2));
}
