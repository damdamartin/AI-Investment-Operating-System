#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const intakePath = resolve(process.cwd(), process.argv[2] ?? "docs/phase5/evidence-intake.example.json");
const outputPath = process.argv[3] ? resolve(process.cwd(), process.argv[3]) : undefined;
const reasonCodes = [];

if (!existsSync(intakePath)) {
  reasonCodes.push("evidence_intake_file_missing");
  printReport({ promoted: false, warnings: [] });
  process.exit(1);
}

let intake;

try {
  intake = JSON.parse(readFileSync(intakePath, "utf8"));
} catch {
  reasonCodes.push("evidence_intake_json_invalid");
  printReport({ promoted: false, warnings: [] });
  process.exit(1);
}

const review = reviewIntake(intake);

if (!review.readyForEvidenceManifest) {
  printReport({
    promoted: false,
    reasonCodes: review.reasonCodes,
    warnings: review.warnings
  });
  process.exit(1);
}

const manifest = {
  manifestVersion: "1",
  generatedAt: new Date().toISOString(),
  environment: "local",
  evidence: intake.items.map((item) => ({
    id: item.id,
    kind: item.kind,
    mode: item.source === "LOCAL_READ_ONLY_CHECK" ? "READ_ONLY_API_CALL" : "DOCUMENTATION_REVIEW",
    collectedAt: intake.preparedAt,
    relatedOpenQuestion: item.relatedOpenQuestion,
    summary: item.sanitizedSummary,
    sanitized: true,
    containsCredential: false,
    liveWriteOperation: false
  })),
  notes: [
    "Generated from sanitized Toss read-only evidence intake.",
    ...intake.notes.map((note) => `Intake note: ${note}`)
  ]
};

if (outputPath) {
  writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

printReport({
  promoted: true,
  outputPath: outputPath ? maskPath(outputPath) : undefined,
  evidenceCount: manifest.evidence.length,
  relatedOpenQuestions: [...new Set(manifest.evidence.map((item) => item.relatedOpenQuestion))].sort(),
  reasonCodes: [],
  warnings: review.warnings
});

function reviewIntake(candidate) {
  const localReasonCodes = [];
  const warnings = [];
  const items = Array.isArray(candidate.items) ? candidate.items : [];
  const seenIds = new Set();

  if (candidate.intakeVersion !== "1") localReasonCodes.push("unsupported_intake_version");
  if (items.length === 0) localReasonCodes.push("intake_has_no_items");

  for (const item of items) {
    const id = typeof item.id === "string" && item.id.length > 0 ? item.id : "unknown";

    if (seenIds.has(id)) localReasonCodes.push(`duplicate_intake_id_${id}`);
    seenIds.add(id);

    if (typeof item.relatedOpenQuestion !== "string" || !item.relatedOpenQuestion.startsWith("OQ-")) {
      localReasonCodes.push(`intake_missing_open_question_${id}`);
    }
    if (item.reviewedByHuman !== true) localReasonCodes.push(`intake_not_human_reviewed_${id}`);
    if (item.rawPayloadIncluded === true) localReasonCodes.push(`intake_contains_raw_payload_${id}`);
    if (item.screenshotContainsSecrets === true) localReasonCodes.push(`intake_screenshot_contains_secrets_${id}`);
    if (item.liveWriteOperation === true) localReasonCodes.push(`intake_contains_live_write_${id}`);
    if (typeof item.sourceReference !== "string" || item.sourceReference.trim().length === 0) {
      localReasonCodes.push(`intake_missing_source_reference_${id}`);
    }
    if (typeof item.sanitizedSummary !== "string" || item.sanitizedSummary.trim().length < 20) {
      warnings.push(`intake_summary_too_short_${id}`);
    }

    const searchableText = `${item.sourceReference ?? ""}\n${item.sanitizedSummary ?? ""}`;
    if (/(access[_-]?token|refresh[_-]?token|client[_-]?secret|app[_-]?secret|authorization|bearer\s+[a-z0-9._-]+|계좌번호|account[_-]?number)/i.test(searchableText)) {
      localReasonCodes.push(`intake_may_contain_secret_${id}`);
    }
  }

  return {
    readyForEvidenceManifest: localReasonCodes.length === 0,
    reasonCodes: [...new Set(localReasonCodes)].sort(),
    warnings: [...new Set(warnings)].sort()
  };
}

function printReport(extra) {
  console.log(JSON.stringify({
    promoted: extra.promoted,
    outputPath: extra.outputPath,
    evidenceCount: extra.evidenceCount ?? 0,
    relatedOpenQuestions: extra.relatedOpenQuestions ?? [],
    reasonCodes: [...new Set([...reasonCodes, ...(extra.reasonCodes ?? [])])].sort(),
    warnings: extra.warnings ?? [],
    liveBrokerWriteAllowed: false,
    networkCallsPerformed: false,
    safetyType: "TOSS_READ_ONLY_EVIDENCE_MANIFEST_PROMOTION_LOCAL_REPORT"
  }, null, 2));
}

function maskPath(path) {
  return path.replace(process.cwd(), "<repo>");
}
