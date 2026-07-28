import { describe, expect, it } from "vitest";
import {
  TossReadOnlyEvidenceIntakeValidator,
  type TossReadOnlyEvidenceIntake,
  type TossReadOnlyEvidenceIntakeItem
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
