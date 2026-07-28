import { describe, expect, it } from "vitest";
import {
  TossReadOnlyEvidenceIntakeValidator,
  TossReadOnlyEvidenceManifestPromoter,
  TossReadOnlyCallApprovalValidator,
  TossReadOnlyCallApprovalLedger,
  TossReadOnlyVerificationResultValidator,
  openQuestionForEvidenceKind,
  type TossReadOnlyEvidenceIntake,
  type TossReadOnlyEvidenceIntakeItem,
  type TossReadOnlyCallApprovalRecord,
  type TossReadOnlyVerificationResultSummary
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

  it("leaves MARKET_DATA_READ without a fixed open-question mapping", () => {
    expect(openQuestionForEvidenceKind("MARKET_DATA_READ")).toBeUndefined();
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
