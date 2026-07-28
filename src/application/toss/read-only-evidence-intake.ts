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

/**
 * Matches long digit runs that look like account numbers, card numbers, or
 * other sensitive identifiers rather than ordinary prose. Shared by every
 * validator in this file so account-number-like text is rejected wherever it
 * appears: intake items, call approval records, and future verification
 * result receipts.
 */
const accountIdentifierLikePattern = /\b\d{6,}\b/;

/**
 * Matches text shaped like a raw JSON API response body (quoted keys
 * followed by a colon, a JSON array of objects) or a raw HTTP response
 * (status line, HTML document). Phase 5 evidence must be a sanitized human
 * summary, never a pasted raw payload.
 */
const rawResponseLikePattern =
  /(\{\s*"[a-zA-Z0-9_]+"\s*:)|(\[\s*\{\s*")|(<html[\s>])|(<!doctype\s+html)|(HTTP\/1\.[01]\s+\d{3})/i;

/**
 * Matches text shaped like a raw HTTP request/response header line (a
 * vendor `X-...` header, a cookie header, or a header name immediately
 * followed by a colon and a value). Sanitized evidence must describe
 * findings in prose, never paste header lines. ("Authorization:" is already
 * covered by `blockedSecretPattern` above, so it is intentionally not
 * repeated here.)
 */
const requestHeaderLikePattern = /\b(x-[a-z0-9-]{2,}|cookie|set-cookie)\s*:\s*\S+/i;

/**
 * Canonical mapping from a Toss evidence kind to the open question it
 * primarily supports, per `docs/phase5/open-question-evidence-policy.md`
 * and the "Required Toss Evidence" list in `docs/phase5/README.md`.
 *
 * `ACCOUNT_SNAPSHOT_READ` and `POSITION_QUERY_READ` evidence both map to
 * `OQ-002` (the Toss account and permission model question) because both
 * come from account-scoped read-only calls that describe the same
 * identifier and permission shapes.
 *
 * `MARKET_DATA_READ` maps to `OQ-004` (Toss ETF, fractional, and
 * extended-hours support), matching the endpoint catalog convention already
 * recorded in `docs/phase5/toss-official-api-source-notes.md` ("Current
 * price lookup | GET | /api/v1/prices | MARKET_DATA_READ, OQ-004"). Mapping
 * it here does not, by itself, mark OQ-004 resolved or trading safe — see
 * `docs/phase5/open-question-evidence-policy.md`. Every kind in
 * `TossEvidenceKind` now has a canonical mapping; this map is total, not
 * partial, as a reminder that a future new evidence kind must be given an
 * explicit mapping decision rather than silently falling through.
 */
const evidenceKindOpenQuestionMap: Record<TossEvidenceKind, string> = {
  API_TERMS_REVIEW: "OQ-001",
  AUTHENTICATION_READ: "OQ-001",
  ACCOUNT_SNAPSHOT_READ: "OQ-002",
  POSITION_QUERY_READ: "OQ-002",
  ORDER_STATUS_QUERY_READ: "OQ-003",
  FILL_QUERY_READ: "OQ-003",
  MARKET_DATA_READ: "OQ-004",
  ETF_SUPPORT_DOCUMENTATION: "OQ-004",
  FRACTIONAL_SUPPORT_DOCUMENTATION: "OQ-004",
  EXTENDED_HOURS_DOCUMENTATION: "OQ-004"
};

/**
 * Returns the canonical open question a Toss evidence kind supports.
 * `TossEvidenceKind` is a closed union and every member is mapped above, so
 * this is only ever `undefined` for a value that does not type-check as
 * `TossEvidenceKind` in the first place (for example raw JSON parsed from a
 * hand-edited file at a boundary where TypeScript cannot verify the shape).
 */
export function openQuestionForEvidenceKind(kind: TossEvidenceKind): string | undefined {
  return evidenceKindOpenQuestionMap[kind];
}

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

      if (accountIdentifierLikePattern.test(searchableText)) {
        reasonCodes.push(`intake_may_contain_account_identifier_${item.id}`);
      }

      if (rawResponseLikePattern.test(searchableText)) {
        reasonCodes.push(`intake_looks_like_raw_response_${item.id}`);
      }

      if (requestHeaderLikePattern.test(searchableText)) {
        reasonCodes.push(`intake_may_contain_request_header_${item.id}`);
      }

      const canonicalOpenQuestion = openQuestionForEvidenceKind(item.kind);
      if (
        canonicalOpenQuestion &&
        item.relatedOpenQuestion.startsWith("OQ-") &&
        item.relatedOpenQuestion !== canonicalOpenQuestion
      ) {
        reasonCodes.push(`intake_open_question_mismatch_${item.id}`);
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

/**
 * Sanitized receipt shape a future read-only verification runner (task
 * P5-013) is expected to produce after performing exactly one approved
 * read-only Toss call. This module does not implement that runner and does
 * not perform any network call itself; it only validates that a receipt
 * claiming to be sanitized actually looks safe, and helps a human turn it
 * into a full evidence intake item.
 *
 * `sanitizedEvidencePath` is a reference to a local, git-ignored file where
 * the runner wrote its sanitized summary. This pipeline never reads that
 * file automatically — a human must open it, confirm it is safe, and copy a
 * sanitized summary into a `TossReadOnlyEvidenceIntakeItem` by hand. That
 * keeps file-content review a human act, consistent with
 * `docs/phase5/open-question-evidence-policy.md`.
 */
export interface TossReadOnlyVerificationResultSummary {
  operation: TossReadOnlyOperation;
  evidenceKind: TossEvidenceKind;
  sanitizedEvidencePath: string;
  liveBrokerWriteAllowed: false;
  networkCallsPerformed: boolean;
  rawPayloadStored: false;
}

export interface TossReadOnlyVerificationResultReview {
  acceptedForIntakeDraft: boolean;
  reasonCodes: string[];
  warnings: string[];
  /** The open question this evidence kind canonically supports, if any. */
  suggestedRelatedOpenQuestion: string | undefined;
  liveBrokerWriteAllowed: false;
  safetyType: "TOSS_READ_ONLY_VERIFICATION_RESULT_REVIEW_ONLY";
}

export class TossReadOnlyVerificationResultValidator {
  /**
   * Reviews a sanitized verification result receipt. This never reads
   * `sanitizedEvidencePath` from disk and never performs a network call; it
   * only inspects the fields and the path string itself for safety.
   */
  review(result: TossReadOnlyVerificationResultSummary): TossReadOnlyVerificationResultReview {
    const reasonCodes: string[] = [];
    const warnings: string[] = [];

    if (!allowedApprovableOperations.includes(result.operation)) {
      reasonCodes.push("verification_result_operation_not_read_only");
    }

    if (writeOperationPattern.test(String(result.operation))) {
      reasonCodes.push("verification_result_operation_looks_write_scoped");
    }

    if (result.liveBrokerWriteAllowed !== false) {
      reasonCodes.push("verification_result_live_broker_write_allowed_must_be_false");
    }

    if (result.rawPayloadStored !== false) {
      reasonCodes.push("verification_result_raw_payload_stored_must_be_false");
    }

    if (typeof result.networkCallsPerformed !== "boolean") {
      reasonCodes.push("verification_result_network_calls_performed_must_be_boolean");
    }

    if (!result.sanitizedEvidencePath || result.sanitizedEvidencePath.trim().length === 0) {
      reasonCodes.push("verification_result_missing_sanitized_evidence_path");
    } else {
      const path = result.sanitizedEvidencePath;

      if (path.includes("..")) {
        reasonCodes.push("verification_result_evidence_path_traversal_rejected");
      }

      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(path)) {
        reasonCodes.push("verification_result_evidence_path_must_be_local");
      }

      if (path.includes(".env")) {
        reasonCodes.push("verification_result_evidence_path_must_not_reference_env_file");
      }

      if (blockedSecretPattern.test(path)) {
        reasonCodes.push("verification_result_evidence_path_may_contain_secret");
      }

      if (accountIdentifierLikePattern.test(path)) {
        reasonCodes.push("verification_result_evidence_path_may_contain_account_identifier");
      }

      if (rawResponseLikePattern.test(path) || requestHeaderLikePattern.test(path)) {
        reasonCodes.push("verification_result_evidence_path_looks_unsafe");
      }
    }

    const suggestedRelatedOpenQuestion = openQuestionForEvidenceKind(result.evidenceKind);
    if (!suggestedRelatedOpenQuestion) {
      warnings.push(
        `verification_result_evidence_kind_has_no_canonical_open_question_${result.evidenceKind.toLowerCase()}`
      );
    }

    return {
      acceptedForIntakeDraft: reasonCodes.length === 0,
      reasonCodes: [...new Set(reasonCodes)].sort(),
      warnings: [...new Set(warnings)].sort(),
      suggestedRelatedOpenQuestion,
      liveBrokerWriteAllowed: false,
      safetyType: "TOSS_READ_ONLY_VERIFICATION_RESULT_REVIEW_ONLY"
    };
  }

  /**
   * Builds an unreviewed intake item draft from an accepted verification
   * result receipt. The draft always carries `reviewedByHuman: false` and an
   * empty `sanitizedSummary` — a human must read the sanitized evidence file
   * at `sourceReference`, write an actual summary, and explicitly mark the
   * item reviewed before `TossReadOnlyEvidenceIntakeValidator` will accept
   * it. This method never promotes evidence on its own.
   */
  draftIntakeItem(
    result: TossReadOnlyVerificationResultSummary,
    options: { id: string }
  ): TossReadOnlyEvidenceIntakeItem {
    const review = this.review(result);

    if (!review.acceptedForIntakeDraft) {
      throw new Error(
        `Refusing to draft an intake item from an unsafe verification result: ${review.reasonCodes.join(", ")}`
      );
    }

    return {
      id: options.id,
      kind: result.evidenceKind,
      relatedOpenQuestion: review.suggestedRelatedOpenQuestion ?? "",
      source: "LOCAL_READ_ONLY_CHECK",
      sourceReference: result.sanitizedEvidencePath,
      sanitizedSummary: "",
      reviewedByHuman: false,
      rawPayloadIncluded: result.rawPayloadStored,
      screenshotContainsSecrets: false,
      liveWriteOperation: false
    };
  }
}

/**
 * All evidence kinds this module knows how to map to an open question.
 * Derived directly from `evidenceKindOpenQuestionMap` so it can never drift
 * out of sync with the canonical mapping above.
 */
const knownEvidenceKinds = new Set<TossEvidenceKind>(
  Object.keys(evidenceKindOpenQuestionMap) as TossEvidenceKind[]
);

/**
 * Sanitized receipt shape actually written to disk by a read-only
 * verification runner (task P5-013's `scripts/phase5-toss-read-only-verify.mjs`,
 * and any future equivalent such as a P5-016 market-prices runner) under
 * `tmp/phase5/`, git-ignored. This is distinct from
 * `TossReadOnlyVerificationResultSummary` above, which validates the
 * runner's *stdout report* (which references the receipt file by path via
 * `sanitizedEvidencePath`). This type validates the receipt file's own
 * content shape instead, so that multiple completed receipts — for example
 * one `ACCOUNT_SNAPSHOT_READ` receipt and one `POSITION_QUERY_READ` receipt,
 * both supporting OQ-002 — can be classified and summarized together without
 * ever reading anything beyond these eight sanitized fields.
 *
 * Deliberately excludes any per-item field (symbols, quantities, account
 * identifiers, raw payload): only a rollup `itemCount` is present, matching
 * what the runner itself extracts from a real response.
 */
export interface TossReadOnlyEvidenceReceipt {
  operation: TossReadOnlyOperation;
  evidenceKind: TossEvidenceKind;
  /** ISO 8601 timestamp string (receipts are read from JSON, not live `Date` objects). */
  collectedAt: string;
  itemCount: number;
  liveBrokerWriteAllowed: false;
  networkCallsPerformed: boolean;
  rawPayloadStored: false;
  safetyType: string;
}

/**
 * A receipt paired with a reference to the local, git-ignored file it came
 * from. The reference is never read from disk by this module — it exists so
 * the same unsafe-content checks already applied to
 * `TossReadOnlyEvidenceIntakeItem.sourceReference` and
 * `TossReadOnlyVerificationResultSummary.sanitizedEvidencePath` can also
 * guard a hand-edited or malicious receipt reference here.
 */
export interface TossReadOnlyEvidenceReceiptRecord {
  receipt: TossReadOnlyEvidenceReceipt;
  sourceReference: string;
}

export interface TossReadOnlyEvidenceReceiptReview {
  accepted: boolean;
  reasonCodes: string[];
  warnings: string[];
  /** The open question this receipt's evidence kind canonically supports, if any. */
  relatedOpenQuestion: string | undefined;
  liveBrokerWriteAllowed: false;
  safetyType: "TOSS_READ_ONLY_EVIDENCE_RECEIPT_REVIEW_ONLY";
}

const maxReceiptAgeDays = 30;

export class TossReadOnlyEvidenceReceiptValidator {
  /**
   * Reviews one sanitized evidence receipt record. Never reads
   * `sourceReference` from disk and never performs a network call; it only
   * inspects the receipt's own fields and the reference string for safety.
   */
  review(record: TossReadOnlyEvidenceReceiptRecord, now: Date = new Date()): TossReadOnlyEvidenceReceiptReview {
    const reasonCodes: string[] = [];
    const warnings: string[] = [];
    const receipt = record.receipt;

    if (!allowedApprovableOperations.includes(receipt.operation)) {
      reasonCodes.push("receipt_operation_not_read_only");
    }

    if (writeOperationPattern.test(String(receipt.operation))) {
      reasonCodes.push("receipt_operation_looks_write_scoped");
    }

    if (!receipt.evidenceKind || !knownEvidenceKinds.has(receipt.evidenceKind)) {
      reasonCodes.push("receipt_unknown_evidence_kind");
    }

    if (receipt.liveBrokerWriteAllowed !== false) {
      reasonCodes.push("receipt_live_broker_write_allowed_must_be_false");
    }

    if (receipt.rawPayloadStored !== false) {
      reasonCodes.push("receipt_raw_payload_stored_must_be_false");
    }

    if (typeof receipt.networkCallsPerformed !== "boolean") {
      reasonCodes.push("receipt_network_calls_performed_must_be_boolean");
    }

    if (
      typeof receipt.itemCount !== "number" ||
      !Number.isInteger(receipt.itemCount) ||
      receipt.itemCount < 0
    ) {
      reasonCodes.push("receipt_item_count_invalid");
    }

    let collectedAtDate: Date | undefined;
    if (!receipt.collectedAt || receipt.collectedAt.trim().length === 0) {
      reasonCodes.push("receipt_missing_collected_at");
    } else {
      const parsed = new Date(receipt.collectedAt);
      if (Number.isNaN(parsed.getTime())) {
        reasonCodes.push("receipt_collected_at_invalid");
      } else {
        collectedAtDate = parsed;
      }
    }

    if (!receipt.safetyType || receipt.safetyType.trim().length === 0) {
      reasonCodes.push("receipt_missing_safety_type");
    }

    // Defense in depth: scan every receipt string field for secret-like,
    // account-identifier-like, raw-response-like, or request-header-like
    // content, even though a genuine receipt from the runner never contains
    // any of these. A hand-edited or maliciously modified receipt file must
    // still be rejected, exactly like the manifest validator's philosophy
    // that self-declared safety flags are never trusted alone.
    const searchableText = [receipt.operation, receipt.evidenceKind, receipt.collectedAt, receipt.safetyType]
      .filter((value): value is string => typeof value === "string")
      .join("\n");

    if (blockedSecretPattern.test(searchableText)) {
      reasonCodes.push("receipt_may_contain_secret");
    }

    if (accountIdentifierLikePattern.test(searchableText)) {
      reasonCodes.push("receipt_may_contain_account_identifier");
    }

    if (rawResponseLikePattern.test(searchableText)) {
      reasonCodes.push("receipt_looks_like_raw_response");
    }

    if (requestHeaderLikePattern.test(searchableText)) {
      reasonCodes.push("receipt_may_contain_request_header");
    }

    if (!record.sourceReference || record.sourceReference.trim().length === 0) {
      reasonCodes.push("receipt_source_reference_missing");
    } else {
      const reference = record.sourceReference;

      if (reference.includes("..")) {
        reasonCodes.push("receipt_source_reference_path_traversal_rejected");
      }

      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(reference)) {
        reasonCodes.push("receipt_source_reference_must_be_local");
      }

      if (reference.includes(".env")) {
        reasonCodes.push("receipt_source_reference_must_not_reference_env_file");
      }

      if (blockedSecretPattern.test(reference)) {
        reasonCodes.push("receipt_source_reference_may_contain_secret");
      }

      if (accountIdentifierLikePattern.test(reference)) {
        reasonCodes.push("receipt_source_reference_may_contain_account_identifier");
      }

      if (rawResponseLikePattern.test(reference) || requestHeaderLikePattern.test(reference)) {
        reasonCodes.push("receipt_source_reference_looks_unsafe");
      }
    }

    if (collectedAtDate && daysBetween(collectedAtDate, now) > maxReceiptAgeDays) {
      warnings.push(`receipt_stale_${record.sourceReference || "unknown"}`);
    }

    const relatedOpenQuestion = knownEvidenceKinds.has(receipt.evidenceKind)
      ? openQuestionForEvidenceKind(receipt.evidenceKind)
      : undefined;

    return {
      accepted: reasonCodes.length === 0,
      reasonCodes: [...new Set(reasonCodes)].sort(),
      warnings: [...new Set(warnings)].sort(),
      relatedOpenQuestion,
      liveBrokerWriteAllowed: false,
      safetyType: "TOSS_READ_ONLY_EVIDENCE_RECEIPT_REVIEW_ONLY"
    };
  }
}

function daysBetween(left: Date, right: Date): number {
  return Math.floor((right.getTime() - left.getTime()) / 86_400_000);
}

const requiredTossOpenQuestionsForReceiptSummary = ["OQ-001", "OQ-002", "OQ-003", "OQ-004"];

export interface TossReadOnlyEvidenceReceiptOpenQuestionSummary {
  openQuestionId: string;
  receiptCount: number;
  validReceiptCount: number;
  /** Sorted, de-duplicated evidence kinds that contributed a valid receipt. */
  evidenceKinds: string[];
  readyForReview: boolean;
}

export interface TossReadOnlyEvidenceReceiptOperatorSummary {
  /** Always exactly OQ-001 through OQ-004, in that order, even when a question has zero receipts. */
  openQuestionSummaries: TossReadOnlyEvidenceReceiptOpenQuestionSummary[];
  totalReceiptCount: number;
  validReceiptCount: number;
  rejectedReceiptCount: number;
  reasonCodes: string[];
  warnings: string[];
  liveBrokerWriteAllowed: false;
  /**
   * Always false. This summary rolls up how many sanitized receipts exist
   * per open question; it never authorizes Toss order creation, order
   * cancellation, order replacement, live capital use, or production
   * reconciliation, no matter how many receipts are valid. See
   * `docs/phase5/open-question-evidence-policy.md`.
   */
  liveTradingAuthorized: false;
  safetyType: "TOSS_READ_ONLY_EVIDENCE_RECEIPT_OPERATOR_SUMMARY_REVIEW_ONLY";
}

/**
 * Builds a deterministic, operator-facing rollup of multiple sanitized
 * read-only evidence receipts (for example one accounts receipt and one
 * holdings receipt, both supporting OQ-002). Given the same input receipts,
 * in any order, this always returns the same summary: open questions are
 * always listed in the fixed OQ-001..OQ-004 order, and every array inside
 * the result is sorted and de-duplicated. This never reads a receipt file
 * from disk and never performs a network call — it only reasons about the
 * receipt objects and reference strings it is given.
 */
export class TossReadOnlyEvidenceReceiptOperatorSummaryBuilder {
  summarize(
    records: TossReadOnlyEvidenceReceiptRecord[],
    now: Date = new Date()
  ): TossReadOnlyEvidenceReceiptOperatorSummary {
    const validator = new TossReadOnlyEvidenceReceiptValidator();
    const reasonCodes: string[] = [];
    const warnings: string[] = [];
    const seenSourceReferences = new Set<string>();

    const reviewed = records.map((record) => {
      const isDuplicate = seenSourceReferences.has(record.sourceReference);
      seenSourceReferences.add(record.sourceReference);

      const review = validator.review(record, now);
      warnings.push(...review.warnings);

      if (isDuplicate) {
        reasonCodes.push(`receipt_duplicate_source_reference_${record.sourceReference}`);
      }

      return {
        record,
        review,
        // A duplicate reference is never counted as an additional valid
        // receipt, even if the receipt content itself passes review, so a
        // caller accidentally passing the same file twice cannot inflate an
        // open question's count.
        countsAsValid: review.accepted && !isDuplicate
      };
    });

    for (const { review } of reviewed) {
      if (!review.accepted) {
        reasonCodes.push(...review.reasonCodes);
      }
    }

    const openQuestionSummaries = requiredTossOpenQuestionsForReceiptSummary.map((openQuestionId) => {
      const matching = reviewed.filter(({ review }) => review.relatedOpenQuestion === openQuestionId);
      const valid = matching.filter(({ countsAsValid }) => countsAsValid);
      const evidenceKinds = [...new Set(valid.map(({ record }) => record.receipt.evidenceKind))].sort();

      return {
        openQuestionId,
        receiptCount: matching.length,
        validReceiptCount: valid.length,
        evidenceKinds,
        readyForReview: valid.length > 0
      };
    });

    const validReceiptCount = reviewed.filter(({ countsAsValid }) => countsAsValid).length;
    const rejectedReceiptCount = reviewed.filter(({ review }) => !review.accepted).length;

    return {
      openQuestionSummaries,
      totalReceiptCount: records.length,
      validReceiptCount,
      rejectedReceiptCount,
      reasonCodes: [...new Set(reasonCodes)].sort(),
      warnings: [...new Set(warnings)].sort(),
      liveBrokerWriteAllowed: false,
      liveTradingAuthorized: false,
      safetyType: "TOSS_READ_ONLY_EVIDENCE_RECEIPT_OPERATOR_SUMMARY_REVIEW_ONLY"
    };
  }
}
