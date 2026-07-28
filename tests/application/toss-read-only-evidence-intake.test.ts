import { describe, expect, it } from "vitest";
import {
  TossReadOnlyEvidenceIntakeValidator,
  TossReadOnlyEvidenceManifestPromoter,
  TossReadOnlyCallApprovalValidator,
  TossReadOnlyCallApprovalLedger,
  TossReadOnlyVerificationResultValidator,
  TossReadOnlyEvidenceReceiptValidator,
  TossReadOnlyEvidenceReceiptOperatorSummaryBuilder,
  openQuestionForEvidenceKind,
  type TossReadOnlyEvidenceIntake,
  type TossReadOnlyEvidenceIntakeItem,
  type TossReadOnlyCallApprovalRecord,
  type TossReadOnlyVerificationResultSummary,
  type TossReadOnlyEvidenceReceipt,
  type TossReadOnlyEvidenceReceiptRecord
} from "../../src/index.js";

describe("TossReadOnlyEvidenceIntakeValidator", () => {
  it("accepts human-reviewed sanitized evidence intake without enabling live writes", () => {
    const result = new TossReadOnlyEvidenceIntakeValidator().review(
      intake([item({ id: "terms", kind: "API_TERMS_REVIEW", relatedOpenQuestion: "OQ-001" })])
    );

    expect(result.readyForEvidenceManifest).toBe(true);
    expect(result.itemCount).toBe(1);
    expect(result.reviewedItemCount).toBe(1);
    expect(result.relatedOpenQuestions).toEqual(["OQ-001"]);
    expect(result.liveBrokerWriteAllowed).toBe(false);
  });

  it("rejects unreviewed raw payload or secret-bearing intake", () => {
    const result = new TossReadOnlyEvidenceIntakeValidator().review(
      intake([
        item({
          id: "unsafe",
          reviewedByHuman: false,
          rawPayloadIncluded: true,
          sanitizedSummary: "This summary accidentally mentions client_secret and must be rejected."
        })
      ])
    );

    expect(result.readyForEvidenceManifest).toBe(false);
    expect(result.reasonCodes).toContain("intake_not_human_reviewed_unsafe");
    expect(result.reasonCodes).toContain("intake_contains_raw_payload_unsafe");
    expect(result.reasonCodes).toContain("intake_may_contain_secret_unsafe");
  });

  it("rejects live write operation evidence in Phase 5 intake", () => {
    const result = new TossReadOnlyEvidenceIntakeValidator().review(
      intake([item({ id: "write", liveWriteOperation: true })])
    );

    expect(result.readyForEvidenceManifest).toBe(false);
    expect(result.reasonCodes).toContain("intake_contains_live_write_write");
  });

  it("requires source references and open-question mapping", () => {
    const result = new TossReadOnlyEvidenceIntakeValidator().review(
      intake([item({ id: "unmapped", relatedOpenQuestion: "missing", sourceReference: "" })])
    );

    expect(result.readyForEvidenceManifest).toBe(false);
    expect(result.reasonCodes).toContain("intake_missing_open_question_unmapped");
    expect(result.reasonCodes).toContain("intake_missing_source_reference_unmapped");
  });

  it("warns when summaries are too short for useful evidence review", () => {
    const result = new TossReadOnlyEvidenceIntakeValidator().review(
      intake([item({ id: "short", sanitizedSummary: "Too short." })])
    );

    expect(result.readyForEvidenceManifest).toBe(true);
    expect(result.warnings).toContain("intake_summary_too_short_short");
  });

  it("rejects sanitized summaries that look like a raw API response payload", () => {
    const result = new TossReadOnlyEvidenceIntakeValidator().review(
      intake([
        item({
          id: "raw-response",
          sanitizedSummary:
            'Account read returned {"accountStatus":"ACTIVE","balanceCurrency":"KRW"} and nothing else.'
        })
      ])
    );

    expect(result.readyForEvidenceManifest).toBe(false);
    expect(result.reasonCodes).toContain("intake_looks_like_raw_response_raw-response");
  });

  it("rejects account-number-like digit runs in the sanitized summary", () => {
    const result = new TossReadOnlyEvidenceIntakeValidator().review(
      intake([
        item({
          id: "account-number",
          sanitizedSummary: "Account snapshot referenced account 1234567890 during the read-only check."
        })
      ])
    );

    expect(result.readyForEvidenceManifest).toBe(false);
    expect(result.reasonCodes).toContain("intake_may_contain_account_identifier_account-number");
  });

  it("rejects source references containing a bearer token or a request header line", () => {
    const bearerResult = new TossReadOnlyEvidenceIntakeValidator().review(
      intake([
        item({
          id: "bearer",
          sourceReference: "Captured from request header Authorization: Bearer abcDEF123.token-value"
        })
      ])
    );

    expect(bearerResult.readyForEvidenceManifest).toBe(false);
    expect(bearerResult.reasonCodes).toContain("intake_may_contain_secret_bearer");

    const headerResult = new TossReadOnlyEvidenceIntakeValidator().review(
      intake([
        item({
          id: "header",
          sourceReference: "Request included header X-Toss-Client-Id: abc123-client-id-value"
        })
      ])
    );

    expect(headerResult.readyForEvidenceManifest).toBe(false);
    expect(headerResult.reasonCodes).toContain("intake_may_contain_request_header_header");
  });

  it("rejects an intake item whose kind disagrees with its declared open question", () => {
    const result = new TossReadOnlyEvidenceIntakeValidator().review(
      intake([item({ id: "mismatch", kind: "ACCOUNT_SNAPSHOT_READ", relatedOpenQuestion: "OQ-001" })])
    );

    expect(result.readyForEvidenceManifest).toBe(false);
    expect(result.reasonCodes).toContain("intake_open_question_mismatch_mismatch");
  });
});

describe("openQuestionForEvidenceKind", () => {
  it("maps ACCOUNT_SNAPSHOT_READ and POSITION_QUERY_READ evidence to OQ-002", () => {
    expect(openQuestionForEvidenceKind("ACCOUNT_SNAPSHOT_READ")).toBe("OQ-002");
    expect(openQuestionForEvidenceKind("POSITION_QUERY_READ")).toBe("OQ-002");
  });

  it("maps MARKET_DATA_READ evidence to OQ-004, matching the endpoint catalog convention", () => {
    expect(openQuestionForEvidenceKind("MARKET_DATA_READ")).toBe("OQ-004");
  });
});

describe("TossReadOnlyEvidenceManifestPromoter", () => {
  it("promotes sanitized, human-reviewed account snapshot evidence into a manifest mapped to OQ-002", () => {
    const promotion = new TossReadOnlyEvidenceManifestPromoter().promote(
      intake([item({ id: "account", kind: "ACCOUNT_SNAPSHOT_READ", relatedOpenQuestion: "OQ-002" })]),
      { generatedAt: new Date("2026-07-28T00:00:00Z"), environment: "local" }
    );

    expect(promotion.promoted).toBe(true);
    expect(promotion.manifest?.evidence).toHaveLength(1);
    expect(promotion.manifest?.evidence[0]?.relatedOpenQuestion).toBe("OQ-002");
    expect(promotion.manifest?.evidence[0]?.kind).toBe("ACCOUNT_SNAPSHOT_READ");
    expect(promotion.manifest?.evidence[0]?.sanitized).toBe(true);
    expect(promotion.liveBrokerWriteAllowed).toBe(false);
  });

  it("refuses to promote intake that is not yet human-reviewed", () => {
    const promotion = new TossReadOnlyEvidenceManifestPromoter().promote(
      intake([item({ id: "account", reviewedByHuman: false })]),
      { generatedAt: new Date("2026-07-28T00:00:00Z"), environment: "local" }
    );

    expect(promotion.promoted).toBe(false);
    expect(promotion.manifest).toBeUndefined();
    expect(promotion.reasonCodes).toContain("intake_not_human_reviewed_account");
  });
});

describe("TossReadOnlyVerificationResultValidator", () => {
  it("accepts a sanitized verification result receipt and suggests OQ-002 for ACCOUNT_SNAPSHOT_READ", () => {
    const result = new TossReadOnlyVerificationResultValidator().review(verificationResult());

    expect(result.acceptedForIntakeDraft).toBe(true);
    expect(result.reasonCodes).toEqual([]);
    expect(result.suggestedRelatedOpenQuestion).toBe("OQ-002");
    expect(result.liveBrokerWriteAllowed).toBe(false);
  });

  it("suggests OQ-002 for POSITION_QUERY_READ evidence too", () => {
    const result = new TossReadOnlyVerificationResultValidator().review(
      verificationResult({ operation: "POSITION_QUERY_READ", evidenceKind: "POSITION_QUERY_READ" })
    );

    expect(result.suggestedRelatedOpenQuestion).toBe("OQ-002");
  });

  it("rejects a receipt claiming a raw payload was stored", () => {
    const result = new TossReadOnlyVerificationResultValidator().review(
      verificationResult({ rawPayloadStored: true as unknown as false })
    );

    expect(result.acceptedForIntakeDraft).toBe(false);
    expect(result.reasonCodes).toContain("verification_result_raw_payload_stored_must_be_false");
  });

  it("rejects a receipt claiming live broker writes are allowed", () => {
    const result = new TossReadOnlyVerificationResultValidator().review(
      verificationResult({ liveBrokerWriteAllowed: true as unknown as false })
    );

    expect(result.acceptedForIntakeDraft).toBe(false);
    expect(result.reasonCodes).toContain("verification_result_live_broker_write_allowed_must_be_false");
  });

  it("rejects a receipt for a write-scoped operation", () => {
    const result = new TossReadOnlyVerificationResultValidator().review(
      verificationResult({ operation: "CANCEL_ORDER" as TossReadOnlyVerificationResultSummary["operation"] })
    );

    expect(result.acceptedForIntakeDraft).toBe(false);
    expect(result.reasonCodes).toContain("verification_result_operation_not_read_only");
  });

  it("rejects a sanitized evidence path that looks like it contains a secret or account identifier", () => {
    const secretResult = new TossReadOnlyVerificationResultValidator().review(
      verificationResult({ sanitizedEvidencePath: "tmp/phase5/access_token-dump.json" })
    );
    expect(secretResult.acceptedForIntakeDraft).toBe(false);
    expect(secretResult.reasonCodes).toContain("verification_result_evidence_path_may_contain_secret");

    const accountResult = new TossReadOnlyVerificationResultValidator().review(
      verificationResult({ sanitizedEvidencePath: "tmp/phase5/account-1234567890.json" })
    );
    expect(accountResult.acceptedForIntakeDraft).toBe(false);
    expect(accountResult.reasonCodes).toContain(
      "verification_result_evidence_path_may_contain_account_identifier"
    );
  });

  it("rejects a sanitized evidence path with directory traversal or a remote URL", () => {
    const traversalResult = new TossReadOnlyVerificationResultValidator().review(
      verificationResult({ sanitizedEvidencePath: "tmp/phase5/../../etc/passwd" })
    );
    expect(traversalResult.reasonCodes).toContain("verification_result_evidence_path_traversal_rejected");

    const remoteResult = new TossReadOnlyVerificationResultValidator().review(
      verificationResult({ sanitizedEvidencePath: "https://example.com/evidence.json" })
    );
    expect(remoteResult.reasonCodes).toContain("verification_result_evidence_path_must_be_local");
  });

  it("draftIntakeItem builds an unreviewed, empty-summary intake item that a human must complete", () => {
    const draft = new TossReadOnlyVerificationResultValidator().draftIntakeItem(verificationResult(), {
      id: "account-snapshot-draft"
    });

    expect(draft.reviewedByHuman).toBe(false);
    expect(draft.sanitizedSummary).toBe("");
    expect(draft.relatedOpenQuestion).toBe("OQ-002");
    expect(draft.source).toBe("LOCAL_READ_ONLY_CHECK");
    expect(draft.sourceReference).toBe("tmp/phase5/account-snapshot-result.json");

    // The draft alone is never enough to reach the manifest: it still needs
    // a human-written summary and an explicit reviewedByHuman: true.
    const review = new TossReadOnlyEvidenceIntakeValidator().review(intake([draft]));
    expect(review.readyForEvidenceManifest).toBe(false);
    expect(review.reasonCodes).toContain("intake_not_human_reviewed_account-snapshot-draft");
  });

  it("draftIntakeItem refuses to build a draft from an unsafe verification result", () => {
    const validator = new TossReadOnlyVerificationResultValidator();

    expect(() =>
      validator.draftIntakeItem(verificationResult({ rawPayloadStored: true as unknown as false }), {
        id: "unsafe"
      })
    ).toThrow();
  });
});

function verificationResult(
  overrides: Partial<TossReadOnlyVerificationResultSummary> = {}
): TossReadOnlyVerificationResultSummary {
  return {
    operation: "ACCOUNT_SNAPSHOT_READ",
    evidenceKind: "ACCOUNT_SNAPSHOT_READ",
    sanitizedEvidencePath: "tmp/phase5/account-snapshot-result.json",
    liveBrokerWriteAllowed: false,
    networkCallsPerformed: true,
    rawPayloadStored: false,
    ...overrides
  };
}

describe("TossReadOnlyEvidenceReceiptValidator", () => {
  it("accepts a sanitized account snapshot receipt and maps it to OQ-002", () => {
    const result = new TossReadOnlyEvidenceReceiptValidator().review(receiptRecord());

    expect(result.accepted).toBe(true);
    expect(result.reasonCodes).toEqual([]);
    expect(result.relatedOpenQuestion).toBe("OQ-002");
    expect(result.liveBrokerWriteAllowed).toBe(false);
  });

  it("accepts a sanitized holdings receipt and maps it to OQ-002 as well", () => {
    const result = new TossReadOnlyEvidenceReceiptValidator().review(
      receiptRecord(
        { operation: "POSITION_QUERY_READ", evidenceKind: "POSITION_QUERY_READ" },
        "tmp/phase5/read-only-verify-position-query-read-2026-07-28T00-05-00-000Z.json"
      )
    );

    expect(result.accepted).toBe(true);
    expect(result.relatedOpenQuestion).toBe("OQ-002");
  });

  it("accepts a sanitized market data receipt and maps it to OQ-004", () => {
    const result = new TossReadOnlyEvidenceReceiptValidator().review(
      receiptRecord(
        { operation: "MARKET_DATA_READ", evidenceKind: "MARKET_DATA_READ" },
        "tmp/phase5/read-only-verify-market-data-read-2026-07-28T00-10-00-000Z.json"
      )
    );

    expect(result.accepted).toBe(true);
    expect(result.relatedOpenQuestion).toBe("OQ-004");
  });

  it("rejects a receipt for a write-scoped or unknown operation", () => {
    const writeScoped = new TossReadOnlyEvidenceReceiptValidator().review(
      receiptRecord({ operation: "CANCEL_ORDER" as TossReadOnlyEvidenceReceipt["operation"] })
    );
    expect(writeScoped.accepted).toBe(false);
    expect(writeScoped.reasonCodes).toContain("receipt_operation_not_read_only");
    expect(writeScoped.reasonCodes).toContain("receipt_operation_looks_write_scoped");
  });

  it("rejects a receipt with an unrecognized evidence kind", () => {
    const result = new TossReadOnlyEvidenceReceiptValidator().review(
      receiptRecord({ evidenceKind: "NOT_A_REAL_EVIDENCE_KIND" as TossReadOnlyEvidenceReceipt["evidenceKind"] })
    );

    expect(result.accepted).toBe(false);
    expect(result.reasonCodes).toContain("receipt_unknown_evidence_kind");
    expect(result.relatedOpenQuestion).toBeUndefined();
  });

  it("rejects a receipt claiming live broker writes are allowed or a raw payload was stored", () => {
    const liveWrite = new TossReadOnlyEvidenceReceiptValidator().review(
      receiptRecord({ liveBrokerWriteAllowed: true as unknown as false })
    );
    expect(liveWrite.accepted).toBe(false);
    expect(liveWrite.reasonCodes).toContain("receipt_live_broker_write_allowed_must_be_false");

    const rawPayload = new TossReadOnlyEvidenceReceiptValidator().review(
      receiptRecord({ rawPayloadStored: true as unknown as false })
    );
    expect(rawPayload.accepted).toBe(false);
    expect(rawPayload.reasonCodes).toContain("receipt_raw_payload_stored_must_be_false");
  });

  it("rejects a receipt with a negative, fractional, or non-numeric item count", () => {
    for (const badItemCount of [-1, 1.5, Number.NaN, "3" as unknown as number]) {
      const result = new TossReadOnlyEvidenceReceiptValidator().review(receiptRecord({ itemCount: badItemCount }));
      expect(result.accepted).toBe(false);
      expect(result.reasonCodes).toContain("receipt_item_count_invalid");
    }
  });

  it("rejects a receipt with a missing or unparsable collectedAt timestamp", () => {
    const missing = new TossReadOnlyEvidenceReceiptValidator().review(receiptRecord({ collectedAt: "" }));
    expect(missing.accepted).toBe(false);
    expect(missing.reasonCodes).toContain("receipt_missing_collected_at");

    const invalid = new TossReadOnlyEvidenceReceiptValidator().review(
      receiptRecord({ collectedAt: "not-a-date" })
    );
    expect(invalid.accepted).toBe(false);
    expect(invalid.reasonCodes).toContain("receipt_collected_at_invalid");
  });

  it("warns, without rejecting, when a receipt is older than 30 days", () => {
    const result = new TossReadOnlyEvidenceReceiptValidator().review(
      receiptRecord({ collectedAt: "2026-01-01T00:00:00.000Z" }),
      new Date("2026-07-28T00:00:00.000Z")
    );

    expect(result.accepted).toBe(true);
    expect(result.warnings.some((warning) => warning.startsWith("receipt_stale_"))).toBe(true);
  });

  it("rejects secret-like, account-identifier-like, raw-response-like, or header-like content hidden in receipt fields", () => {
    const secret = new TossReadOnlyEvidenceReceiptValidator().review(
      receiptRecord({ safetyType: "leaked client_secret abc123 during capture" })
    );
    expect(secret.accepted).toBe(false);
    expect(secret.reasonCodes).toContain("receipt_may_contain_secret");

    const accountNumber = new TossReadOnlyEvidenceReceiptValidator().review(
      receiptRecord({ safetyType: "account 9876543210 snapshot receipt" })
    );
    expect(accountNumber.accepted).toBe(false);
    expect(accountNumber.reasonCodes).toContain("receipt_may_contain_account_identifier");

    const rawResponse = new TossReadOnlyEvidenceReceiptValidator().review(
      receiptRecord({ safetyType: '{"accountStatus":"ACTIVE"}' })
    );
    expect(rawResponse.accepted).toBe(false);
    expect(rawResponse.reasonCodes).toContain("receipt_looks_like_raw_response");

    const header = new TossReadOnlyEvidenceReceiptValidator().review(
      receiptRecord({ safetyType: "X-Toss-Client-Id: abc123-client-id-value" })
    );
    expect(header.accepted).toBe(false);
    expect(header.reasonCodes).toContain("receipt_may_contain_request_header");
  });

  it("rejects a source reference with path traversal, a remote URL, or a .env reference", () => {
    const traversal = new TossReadOnlyEvidenceReceiptValidator().review(
      receiptRecord({}, "tmp/phase5/../../etc/passwd")
    );
    expect(traversal.accepted).toBe(false);
    expect(traversal.reasonCodes).toContain("receipt_source_reference_path_traversal_rejected");

    const remote = new TossReadOnlyEvidenceReceiptValidator().review(
      receiptRecord({}, "https://example.com/evidence.json")
    );
    expect(remote.accepted).toBe(false);
    expect(remote.reasonCodes).toContain("receipt_source_reference_must_be_local");

    const envFile = new TossReadOnlyEvidenceReceiptValidator().review(receiptRecord({}, "tmp/phase5/.env.copy.json"));
    expect(envFile.accepted).toBe(false);
    expect(envFile.reasonCodes).toContain("receipt_source_reference_must_not_reference_env_file");
  });

  it("rejects a source reference that looks like it contains a secret or account identifier", () => {
    const secretRef = new TossReadOnlyEvidenceReceiptValidator().review(
      receiptRecord({}, "tmp/phase5/access_token-dump.json")
    );
    expect(secretRef.accepted).toBe(false);
    expect(secretRef.reasonCodes).toContain("receipt_source_reference_may_contain_secret");

    const accountRef = new TossReadOnlyEvidenceReceiptValidator().review(
      receiptRecord({}, "tmp/phase5/account-1234567890.json")
    );
    expect(accountRef.accepted).toBe(false);
    expect(accountRef.reasonCodes).toContain("receipt_source_reference_may_contain_account_identifier");
  });
});

describe("TossReadOnlyEvidenceReceiptOperatorSummaryBuilder", () => {
  it("counts a distinct account-snapshot receipt and a holdings receipt toward OQ-002 without conflict", () => {
    const summary = new TossReadOnlyEvidenceReceiptOperatorSummaryBuilder().summarize(
      [
        receiptRecord(
          { operation: "ACCOUNT_SNAPSHOT_READ", evidenceKind: "ACCOUNT_SNAPSHOT_READ" },
          "tmp/phase5/read-only-verify-account-snapshot-read-2026-07-28T00-00-00-000Z.json"
        ),
        receiptRecord(
          { operation: "POSITION_QUERY_READ", evidenceKind: "POSITION_QUERY_READ" },
          "tmp/phase5/read-only-verify-position-query-read-2026-07-28T00-05-00-000Z.json"
        )
      ],
      new Date("2026-07-28T00:10:00.000Z")
    );

    const oq002 = summary.openQuestionSummaries.find((entry) => entry.openQuestionId === "OQ-002");
    expect(oq002?.receiptCount).toBe(2);
    expect(oq002?.validReceiptCount).toBe(2);
    expect(oq002?.evidenceKinds).toEqual(["ACCOUNT_SNAPSHOT_READ", "POSITION_QUERY_READ"]);
    expect(oq002?.readyForReview).toBe(true);
    expect(summary.totalReceiptCount).toBe(2);
    expect(summary.validReceiptCount).toBe(2);
    expect(summary.rejectedReceiptCount).toBe(0);
    expect(summary.liveBrokerWriteAllowed).toBe(false);
    expect(summary.liveTradingAuthorized).toBe(false);
  });

  it("always lists all four open questions, in order, even with zero receipts", () => {
    const summary = new TossReadOnlyEvidenceReceiptOperatorSummaryBuilder().summarize([]);

    expect(summary.openQuestionSummaries.map((entry) => entry.openQuestionId)).toEqual([
      "OQ-001",
      "OQ-002",
      "OQ-003",
      "OQ-004"
    ]);
    expect(summary.openQuestionSummaries.every((entry) => entry.readyForReview === false)).toBe(true);
  });

  it("produces the same summary regardless of receipt input order", () => {
    const accountReceipt = receiptRecord(
      { operation: "ACCOUNT_SNAPSHOT_READ", evidenceKind: "ACCOUNT_SNAPSHOT_READ" },
      "tmp/phase5/read-only-verify-account-snapshot-read-2026-07-28T00-00-00-000Z.json"
    );
    const holdingsReceipt = receiptRecord(
      { operation: "POSITION_QUERY_READ", evidenceKind: "POSITION_QUERY_READ" },
      "tmp/phase5/read-only-verify-position-query-read-2026-07-28T00-05-00-000Z.json"
    );
    const builder = new TossReadOnlyEvidenceReceiptOperatorSummaryBuilder();
    const now = new Date("2026-07-28T00:10:00.000Z");

    const forward = builder.summarize([accountReceipt, holdingsReceipt], now);
    const reversed = builder.summarize([holdingsReceipt, accountReceipt], now);

    expect(forward).toEqual(reversed);
  });

  it("does not double-count a receipt whose source reference is duplicated in the same batch", () => {
    const duplicateReference = "tmp/phase5/read-only-verify-account-snapshot-read-2026-07-28T00-00-00-000Z.json";
    const summary = new TossReadOnlyEvidenceReceiptOperatorSummaryBuilder().summarize([
      receiptRecord({}, duplicateReference),
      receiptRecord({}, duplicateReference)
    ]);

    const oq002 = summary.openQuestionSummaries.find((entry) => entry.openQuestionId === "OQ-002");
    expect(oq002?.validReceiptCount).toBe(1);
    expect(summary.validReceiptCount).toBe(1);
    expect(summary.reasonCodes.some((code) => code.startsWith("receipt_duplicate_source_reference_"))).toBe(true);
  });

  it("keeps an unsafe receipt out of the valid count without throwing, and never implies live trading authorization", () => {
    const summary = new TossReadOnlyEvidenceReceiptOperatorSummaryBuilder().summarize([
      receiptRecord(
        { operation: "ACCOUNT_SNAPSHOT_READ", evidenceKind: "ACCOUNT_SNAPSHOT_READ" },
        "tmp/phase5/read-only-verify-account-snapshot-read-2026-07-28T00-00-00-000Z.json"
      ),
      receiptRecord(
        { operation: "POSITION_QUERY_READ", evidenceKind: "POSITION_QUERY_READ" },
        "tmp/phase5/read-only-verify-position-query-read-2026-07-28T00-05-00-000Z.json"
      ),
      receiptRecord(
        {
          operation: "MARKET_DATA_READ",
          evidenceKind: "MARKET_DATA_READ",
          rawPayloadStored: true as unknown as false
        },
        "tmp/phase5/read-only-verify-market-data-read-2026-07-28T00-10-00-000Z.json"
      )
    ]);

    expect(summary.totalReceiptCount).toBe(3);
    expect(summary.rejectedReceiptCount).toBe(1);
    expect(summary.reasonCodes).toContain("receipt_raw_payload_stored_must_be_false");

    const oq004 = summary.openQuestionSummaries.find((entry) => entry.openQuestionId === "OQ-004");
    expect(oq004?.receiptCount).toBe(1);
    expect(oq004?.validReceiptCount).toBe(0);
    expect(oq004?.readyForReview).toBe(false);

    // Even though OQ-002 is fully ready for review, the summary never
    // implies live trading is authorized or that any open question has
    // moved past sanitized-evidence-collected. No `reviewedByHuman` concept
    // exists on this receipt-level summary at all.
    const oq002 = summary.openQuestionSummaries.find((entry) => entry.openQuestionId === "OQ-002");
    expect(oq002?.readyForReview).toBe(true);
    expect(summary.liveBrokerWriteAllowed).toBe(false);
    expect(summary.liveTradingAuthorized).toBe(false);
    expect(summary).not.toHaveProperty("reviewedByHuman");
    expect(summary).not.toHaveProperty("resolved");
  });
});

function receiptRecord(
  overrides: Partial<TossReadOnlyEvidenceReceipt> = {},
  sourceReference = "tmp/phase5/read-only-verify-account-snapshot-read-2026-07-28T00-00-00-000Z.json"
): TossReadOnlyEvidenceReceiptRecord {
  return {
    receipt: {
      operation: "ACCOUNT_SNAPSHOT_READ",
      evidenceKind: "ACCOUNT_SNAPSHOT_READ",
      collectedAt: "2026-07-28T00:00:00.000Z",
      itemCount: 2,
      liveBrokerWriteAllowed: false,
      networkCallsPerformed: true,
      rawPayloadStored: false,
      safetyType: "PHASE5_TOSS_READ_ONLY_VERIFY_EVIDENCE",
      ...overrides
    },
    sourceReference
  };
}

describe("TossReadOnlyCallApprovalValidator", () => {
  it("approves a sanitized single-scope read-only approval record", () => {
    const result = new TossReadOnlyCallApprovalValidator().review(approval());

    expect(result.approved).toBe(true);
    expect(result.reasonCodes).toEqual([]);
    expect(result.liveBrokerWriteAllowed).toBe(false);
  });

  it("rejects approval records containing secret-like text in the operator note", () => {
    const result = new TossReadOnlyCallApprovalValidator().review(
      approval({
        operatorNote: "Approved after confirming client_secret abc123 still works."
      })
    );

    expect(result.approved).toBe(false);
    expect(result.reasonCodes).toContain("approval_may_contain_secret");
  });

  it("rejects approval records containing account-identifier-like digit runs", () => {
    const result = new TossReadOnlyCallApprovalValidator().review(
      approval({
        operatorNote: "Approved for account reference 1234567890 read-only check."
      })
    );

    expect(result.approved).toBe(false);
    expect(result.reasonCodes).toContain("approval_may_contain_account_identifier");
  });

  it("rejects approval records for operations that are not in the read-only allow-list", () => {
    const raw = JSON.parse(
      JSON.stringify(approval({ approvedOperation: "ORDER_SUBMIT" as TossReadOnlyCallApprovalRecord["approvedOperation"] }))
    ) as TossReadOnlyCallApprovalRecord;

    const result = new TossReadOnlyCallApprovalValidator().review(raw);

    expect(result.approved).toBe(false);
    expect(result.reasonCodes).toContain("approval_operation_not_read_only");
  });

  it("rejects approval records whose operation string looks write-scoped", () => {
    const raw = JSON.parse(
      JSON.stringify(
        approval({ approvedOperation: "CANCEL_ORDER" as TossReadOnlyCallApprovalRecord["approvedOperation"] })
      )
    ) as TossReadOnlyCallApprovalRecord;

    const result = new TossReadOnlyCallApprovalValidator().review(raw);

    expect(result.approved).toBe(false);
    expect(result.reasonCodes).toContain("approval_operation_looks_write_scoped");
  });

  it("rejects approval records missing the single-use acknowledgement", () => {
    const raw = JSON.parse(
      JSON.stringify(approval({ singleUseAcknowledged: false as unknown as true }))
    ) as TossReadOnlyCallApprovalRecord;

    const result = new TossReadOnlyCallApprovalValidator().review(raw);

    expect(result.approved).toBe(false);
    expect(result.reasonCodes).toContain("approval_single_use_not_acknowledged");
  });

  it("rejects approval records missing the live-write-blocked statement", () => {
    const raw = JSON.parse(
      JSON.stringify(approval({ liveBrokerWritesRemainBlocked: false as unknown as true }))
    ) as TossReadOnlyCallApprovalRecord;

    const result = new TossReadOnlyCallApprovalValidator().review(raw);

    expect(result.approved).toBe(false);
    expect(result.reasonCodes).toContain("approval_missing_live_write_block_statement");
  });

  it("rejects approval records missing an endpoint catalog reference", () => {
    const result = new TossReadOnlyCallApprovalValidator().review(
      approval({ endpointCatalogReference: "" })
    );

    expect(result.approved).toBe(false);
    expect(result.reasonCodes).toContain("approval_missing_endpoint_catalog_reference");
  });
});

describe("TossReadOnlyCallApprovalLedger", () => {
  it("consumes a valid approval exactly once", () => {
    const ledger = new TossReadOnlyCallApprovalLedger();
    const record = approval();

    const first = ledger.consume(record);
    expect(first.consumed).toBe(true);
    expect(ledger.isConsumed(record.id)).toBe(true);

    const second = ledger.consume(record);
    expect(second.consumed).toBe(false);
    expect(second.reasonCodes).toContain("approval_already_consumed");
  });

  it("never consumes an invalid approval record", () => {
    const ledger = new TossReadOnlyCallApprovalLedger();
    const record = approval({
      operatorNote: "Contains an access_token by mistake."
    });

    const result = ledger.consume(record);

    expect(result.consumed).toBe(false);
    expect(ledger.isConsumed(record.id)).toBe(false);
  });
});

function approval(overrides: Partial<TossReadOnlyCallApprovalRecord> = {}): TossReadOnlyCallApprovalRecord {
  return {
    approvalVersion: "1",
    id: "approval-account-snapshot",
    approvedOperation: "ACCOUNT_SNAPSHOT_READ",
    approvedAt: new Date("2026-07-28T00:00:00Z"),
    operatorNote: "Operator approved one scoped account snapshot read for local verification.",
    endpointCatalogReference: "account-snapshot-read-endpoint",
    expectedEvidenceKind: "ACCOUNT_SNAPSHOT_READ",
    singleUseAcknowledged: true,
    liveBrokerWritesRemainBlocked: true,
    ...overrides
  };
}

function intake(items: TossReadOnlyEvidenceIntakeItem[]): TossReadOnlyEvidenceIntake {
  return {
    intakeVersion: "1",
    preparedAt: new Date("2026-07-28T00:00:00Z"),
    preparedBy: "local-operator",
    items,
    notes: ["Sanitized local intake."]
  };
}

function item(overrides: Partial<TossReadOnlyEvidenceIntakeItem> = {}): TossReadOnlyEvidenceIntakeItem {
  return {
    id: "account",
    kind: "ACCOUNT_SNAPSHOT_READ",
    relatedOpenQuestion: "OQ-002",
    source: "TOSS_OFFICIAL_DOCS",
    sourceReference: "Official Toss read-only documentation reference.",
    sanitizedSummary: "Sanitized evidence summary that does not include credentials or account identifiers.",
    reviewedByHuman: true,
    rawPayloadIncluded: false,
    screenshotContainsSecrets: false,
    liveWriteOperation: false,
    ...overrides
  };
}
