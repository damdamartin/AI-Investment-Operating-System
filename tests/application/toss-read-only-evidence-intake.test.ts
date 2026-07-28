import { describe, expect, it } from "vitest";
import {
  TossReadOnlyEvidenceIntakeValidator,
  TossReadOnlyCallApprovalValidator,
  TossReadOnlyCallApprovalLedger,
  type TossReadOnlyEvidenceIntake,
  type TossReadOnlyEvidenceIntakeItem,
  type TossReadOnlyCallApprovalRecord
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
});

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
