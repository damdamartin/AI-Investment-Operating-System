import type { TossEvidenceKind } from "./read-only-evidence-plan.js";

export interface TossReadOnlyEvidenceIntakeItem {
  id: string;
  kind: TossEvidenceKind;
  relatedOpenQuestion: string;
  source: "TOSS_OFFICIAL_DOCS" | "TOSS_DEVELOPER_CONSOLE" | "LOCAL_READ_ONLY_CHECK";
  sourceReference: string;
  sanitizedSummary: string;
  reviewedByHuman: boolean;
  rawPayloadIncluded: boolean;
  screenshotContainsSecrets: boolean;
  liveWriteOperation: boolean;
}

export interface TossReadOnlyEvidenceIntake {
  intakeVersion: "1";
  preparedAt: Date;
  preparedBy: string;
  items: TossReadOnlyEvidenceIntakeItem[];
  notes: string[];
}

export interface TossReadOnlyEvidenceIntakeReview {
  readyForEvidenceManifest: boolean;
  itemCount: number;
  reviewedItemCount: number;
  relatedOpenQuestions: string[];
  reasonCodes: string[];
  warnings: string[];
  liveBrokerWriteAllowed: false;
  safetyType: "TOSS_READ_ONLY_EVIDENCE_INTAKE_REVIEW_ONLY";
}

const blockedSecretPattern =
  /(access[_-]?token|refresh[_-]?token|client[_-]?secret|app[_-]?secret|authorization|bearer\s+[a-z0-9._-]+|계좌번호|account[_-]?number)/i;

export class TossReadOnlyEvidenceIntakeValidator {
  review(intake: TossReadOnlyEvidenceIntake): TossReadOnlyEvidenceIntakeReview {
    const reasonCodes: string[] = [];
    const warnings: string[] = [];
    const seenIds = new Set<string>();

    if (intake.intakeVersion !== "1") {
      reasonCodes.push("unsupported_intake_version");
    }

    if (intake.items.length === 0) {
      reasonCodes.push("intake_has_no_items");
    }

    for (const item of intake.items) {
      if (seenIds.has(item.id)) {
        reasonCodes.push(`duplicate_intake_id_${item.id}`);
      }
      seenIds.add(item.id);

      if (!item.relatedOpenQuestion.startsWith("OQ-")) {
        reasonCodes.push(`intake_missing_open_question_${item.id}`);
      }

      if (!item.reviewedByHuman) {
        reasonCodes.push(`intake_not_human_reviewed_${item.id}`);
      }

      if (item.rawPayloadIncluded) {
        reasonCodes.push(`intake_contains_raw_payload_${item.id}`);
      }

      if (item.screenshotContainsSecrets) {
        reasonCodes.push(`intake_screenshot_contains_secrets_${item.id}`);
      }

      if (item.liveWriteOperation) {
        reasonCodes.push(`intake_contains_live_write_${item.id}`);
      }

      if (item.sourceReference.trim().length === 0) {
        reasonCodes.push(`intake_missing_source_reference_${item.id}`);
      }

      if (item.sanitizedSummary.trim().length < 20) {
        warnings.push(`intake_summary_too_short_${item.id}`);
      }

      const searchableText = `${item.sourceReference}\n${item.sanitizedSummary}`;
      if (blockedSecretPattern.test(searchableText)) {
        reasonCodes.push(`intake_may_contain_secret_${item.id}`);
      }
    }

    return {
      readyForEvidenceManifest: reasonCodes.length === 0,
      itemCount: intake.items.length,
      reviewedItemCount: intake.items.filter((item) => item.reviewedByHuman).length,
      relatedOpenQuestions: [...new Set(intake.items.map((item) => item.relatedOpenQuestion))].sort(),
      reasonCodes: [...new Set(reasonCodes)].sort(),
      warnings: [...new Set(warnings)].sort(),
      liveBrokerWriteAllowed: false,
      safetyType: "TOSS_READ_ONLY_EVIDENCE_INTAKE_REVIEW_ONLY"
    };
  }
}
