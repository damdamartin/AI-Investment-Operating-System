import type { TossEvidenceKind } from "./read-only-evidence-plan.js";
import type { TossReadOnlyEvidenceManifest } from "./read-only-evidence-manifest.js";
import type { TossReadOnlyOperation } from "../../adapters/toss/index.js";

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

export interface TossReadOnlyEvidenceManifestPromotion {
  promoted: boolean;
  manifest?: TossReadOnlyEvidenceManifest;
  reasonCodes: string[];
  warnings: string[];
  liveBrokerWriteAllowed: false;
  safetyType: "TOSS_READ_ONLY_EVIDENCE_MANIFEST_PROMOTION_REVIEW_ONLY";
}

export class TossReadOnlyEvidenceManifestPromoter {
  promote(
    intake: TossReadOnlyEvidenceIntake,
    options: {
      generatedAt: Date;
      environment: TossReadOnlyEvidenceManifest["environment"];
    }
  ): TossReadOnlyEvidenceManifestPromotion {
    const review = new TossReadOnlyEvidenceIntakeValidator().review(intake);

    if (!review.readyForEvidenceManifest) {
      return {
        promoted: false,
        reasonCodes: review.reasonCodes,
        warnings: review.warnings,
        liveBrokerWriteAllowed: false,
        safetyType: "TOSS_READ_ONLY_EVIDENCE_MANIFEST_PROMOTION_REVIEW_ONLY"
      };
    }

    return {
      promoted: true,
      manifest: {
        manifestVersion: "1",
        generatedAt: options.generatedAt,
        environment: options.environment,
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
      },
      reasonCodes: [],
      warnings: review.warnings,
      liveBrokerWriteAllowed: false,
      safetyType: "TOSS_READ_ONLY_EVIDENCE_MANIFEST_PROMOTION_REVIEW_ONLY"
    };
  }
}

/**
 * Sanitized, public-safe approval artifact for exactly one future scoped
 * read-only Toss verification call.
 *
 * This record never authorizes a network call by itself. It is a local,
 * reviewable statement of intent that a human operator has approved a single
 * read-only operation. `TossReadOnlyCallApprovalValidator` rejects records
 * that look like they carry secrets, account identifiers, or write
 * operations. `TossReadOnlyCallApprovalLedger` enforces that an approved
 * record can be consumed at most once.
 */
export interface TossReadOnlyCallApprovalRecord {
  approvalVersion: "1";
  id: string;
  /** The single read-only operation this approval authorizes. */
  approvedOperation: TossReadOnlyOperation;
  approvedAt: Date;
  /** Human-readable rationale. Must never contain secrets or account identifiers. */
  operatorNote: string;
  /** Identifier of the endpoint catalog entry this approval is scoped to. */
  endpointCatalogReference: string;
  /** The evidence kind the resulting recorded evidence must match. */
  expectedEvidenceKind: TossEvidenceKind;
  /** Explicit operator acknowledgement that this approval is single-use. */
  singleUseAcknowledged: true;
  /** Explicit statement that this approval never unlocks live broker writes. */
  liveBrokerWritesRemainBlocked: true;
}

export interface TossReadOnlyCallApprovalReview {
  approved: boolean;
  reasonCodes: string[];
  warnings: string[];
  liveBrokerWriteAllowed: false;
  safetyType: "TOSS_READ_ONLY_CALL_APPROVAL_REVIEW_ONLY";
}

const allowedApprovableOperations: TossReadOnlyOperation[] = [
  "AUTHENTICATION_READ",
  "ACCOUNT_SNAPSHOT_READ",
  "POSITION_QUERY_READ",
  "MARKET_DATA_READ",
  "ORDER_STATUS_QUERY_READ",
  "FILL_QUERY_READ",
  "CAPABILITY_METADATA_READ"
];

const writeOperationPattern =
  /(submit|place|create|cancel|modify|replace)[_-]?order|order[_-]?(submit|place|create|cancel|modify|replace)|withdraw|transfer|exchange[_-]?money/i;

const accountIdentifierLikePattern = /\b\d{6,}\b/;

export class TossReadOnlyCallApprovalValidator {
  review(record: TossReadOnlyCallApprovalRecord): TossReadOnlyCallApprovalReview {
    const reasonCodes: string[] = [];
    const warnings: string[] = [];

    if (record.approvalVersion !== "1") {
      reasonCodes.push("unsupported_approval_version");
    }

    if (!record.id || record.id.trim().length === 0) {
      reasonCodes.push("approval_missing_id");
    }

    if (!allowedApprovableOperations.includes(record.approvedOperation)) {
      reasonCodes.push("approval_operation_not_read_only");
    }

    if (writeOperationPattern.test(String(record.approvedOperation))) {
      reasonCodes.push("approval_operation_looks_write_scoped");
    }

    if (!record.endpointCatalogReference || record.endpointCatalogReference.trim().length === 0) {
      reasonCodes.push("approval_missing_endpoint_catalog_reference");
    }

    if (!record.expectedEvidenceKind) {
      reasonCodes.push("approval_missing_expected_evidence_kind");
    }

    if (!record.operatorNote || record.operatorNote.trim().length === 0) {
      reasonCodes.push("approval_missing_operator_note");
    } else if (record.operatorNote.trim().length < 10) {
      warnings.push("approval_operator_note_too_short");
    }

    const searchableText = `${record.operatorNote ?? ""}\n${record.endpointCatalogReference ?? ""}`;

    if (blockedSecretPattern.test(searchableText)) {
      reasonCodes.push("approval_may_contain_secret");
    }

    if (accountIdentifierLikePattern.test(searchableText)) {
      reasonCodes.push("approval_may_contain_account_identifier");
    }

    if (record.singleUseAcknowledged !== true) {
      reasonCodes.push("approval_single_use_not_acknowledged");
    }

    if (record.liveBrokerWritesRemainBlocked !== true) {
      reasonCodes.push("approval_missing_live_write_block_statement");
    }

    return {
      approved: reasonCodes.length === 0,
      reasonCodes: [...new Set(reasonCodes)].sort(),
      warnings: [...new Set(warnings)].sort(),
      liveBrokerWriteAllowed: false,
      safetyType: "TOSS_READ_ONLY_CALL_APPROVAL_REVIEW_ONLY"
    };
  }
}

export interface TossReadOnlyCallApprovalConsumption {
  consumed: boolean;
  reasonCodes: string[];
  liveBrokerWriteAllowed: false;
  safetyType: "TOSS_READ_ONLY_CALL_APPROVAL_CONSUMPTION_REVIEW_ONLY";
}

/**
 * Tracks which approval records have already been consumed so a single
 * approval can never be used to authorize more than one call.
 *
 * This ledger is in-memory only. It performs no persistence and no network
 * calls. It exists to make single-use enforcement an explicit, testable
 * behavior rather than a convention.
 */
export class TossReadOnlyCallApprovalLedger {
  private readonly consumedApprovalIds = new Set<string>();

  consume(record: TossReadOnlyCallApprovalRecord): TossReadOnlyCallApprovalConsumption {
    const review = new TossReadOnlyCallApprovalValidator().review(record);
    const reasonCodes = [...review.reasonCodes];
    const alreadyConsumed = this.consumedApprovalIds.has(record.id);

    if (alreadyConsumed) {
      reasonCodes.push("approval_already_consumed");
    }

    const consumed = review.approved && !alreadyConsumed;

    if (consumed) {
      this.consumedApprovalIds.add(record.id);
    }

    return {
      consumed,
      reasonCodes: [...new Set(reasonCodes)].sort(),
      liveBrokerWriteAllowed: false,
      safetyType: "TOSS_READ_ONLY_CALL_APPROVAL_CONSUMPTION_REVIEW_ONLY"
    };
  }

  isConsumed(id: string): boolean {
    return this.consumedApprovalIds.has(id);
  }
}
