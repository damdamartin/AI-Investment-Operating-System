import { describe, expect, it } from "vitest";
import {
  COMPLIANCE_REVIEW_SCOPE_ITEM_IDS,
  REQUIRED_TOSS_COMPLIANCE_PACKET_REVIEWER_ATTESTATION,
  TOSS_COMPLIANCE_PACKET_COVERED_BLOCKER_IDS,
  TOSS_COMPLIANCE_PACKET_DECISIONS,
  TOSS_COMPLIANCE_PACKET_NOT_AUTHORIZATION_STATEMENT,
  TossCompliancePacketValidator,
  type ComplianceReviewScopeItemRecord,
  type TossCompliancePacketRecord
} from "../../src/index.js";

const NOW = new Date("2026-07-29T01:00:00Z");

function cleanComplianceReviewScope(overrides: Partial<Record<string, Partial<ComplianceReviewScopeItemRecord>>> = {}): ComplianceReviewScopeItemRecord[] {
  return COMPLIANCE_REVIEW_SCOPE_ITEM_IDS.map((itemId) => ({
    itemId,
    reviewed: true,
    note: `Reviewed: ${itemId} looks clean based on sanitized source review.`,
    ...(overrides[itemId] ?? {})
  }));
}

function cleanRecord(overrides: Partial<TossCompliancePacketRecord> = {}): TossCompliancePacketRecord {
  return {
    packetId: "toss-compliance-2026-07",
    coveredBlockerIds: ["LCB-001", "LCB-005"],
    tossPermission: {
      result: "APPROVED_WITH_LIMITATIONS",
      sourceReferences: ["docs/phase5/toss-official-api-source-notes.md#automated-trading-clause"],
      distinguishesAutomatedTradingModes: "YES",
      notes: "Terms permit API trading with rate limits; unattended cloud execution not explicitly addressed."
    },
    complianceReviewScope: cleanComplianceReviewScope(),
    complianceSourceDocumentsReviewed: ["docs/13_Compliance_and_Legal_Review.md", "docs/phase5/toss-official-api-source-notes.md"],
    requiredSystemRestrictions: ["limit orders only", "KR market only until US review completed"],
    limitations: "Covers KR market documentation only; US market terms not yet reviewed.",
    reviewDate: new Date("2026-07-20T00:00:00Z"),
    nextReviewDate: new Date("2026-10-20T00:00:00Z"),
    humanReviewerName: "Jane Reviewer",
    humanReviewerRole: "Compliance/legal reviewer",
    decision: "HUMAN_REVIEWED_APPROVED_WITH_LIMITATIONS",
    prohibitedContentConfirmed: true,
    reviewerAttestation: REQUIRED_TOSS_COMPLIANCE_PACKET_REVIEWER_ATTESTATION,
    ...overrides
  };
}

describe("TOSS_COMPLIANCE_PACKET_DECISIONS", () => {
  it("only allows the five workbook decision values, and never RESOLVED", () => {
    expect(TOSS_COMPLIANCE_PACKET_DECISIONS).toEqual([
      "READY_FOR_HUMAN_REVIEW",
      "HUMAN_REVIEWED_APPROVED_WITH_LIMITATIONS",
      "HUMAN_REVIEWED_REJECTED",
      "HUMAN_REVIEWED_UNVERIFIED",
      "NEEDS_MORE_EVIDENCE"
    ]);
    expect(TOSS_COMPLIANCE_PACKET_DECISIONS).not.toContain("RESOLVED");
  });
});

describe("TOSS_COMPLIANCE_PACKET_COVERED_BLOCKER_IDS", () => {
  it("covers exactly LCB-001 and LCB-005", () => {
    expect(TOSS_COMPLIANCE_PACKET_COVERED_BLOCKER_IDS).toEqual(["LCB-001", "LCB-005"]);
  });
});

describe("TossCompliancePacketValidator", () => {
  it("marks a fully sanitized, correctly attested, internally consistent record structurally complete", () => {
    const review = new TossCompliancePacketValidator().review(cleanRecord(), NOW);

    expect(review.structurallyComplete).toBe(true);
    expect(review.blockingReasonCodes).toEqual([]);
    expect(review.decision).toBe("HUMAN_REVIEWED_APPROVED_WITH_LIMITATIONS");
    expect(review.humanReviewClaimed).toBe(true);
    expect(review.humanReviewAttested).toBe(true);
    expect(review.complianceScopeFullyReviewed).toBe(true);
    expect(review.liveBrokerWriteAllowed).toBe(false);
    expect(review.blockerRegisterResolutionAllowed).toBe(false);
    expect(review.safetyType).toBe("TOSS_COMPLIANCE_EVIDENCE_PACKET_REVIEW_ONLY");
    expect(review.notLiveTradingAuthorizationStatement).toBe(TOSS_COMPLIANCE_PACKET_NOT_AUTHORIZATION_STATEMENT);
  });

  it("never emits RESOLVED as a decision or status value, and never flips the two literal false fields", () => {
    // The not-authorization statement legitimately mentions the word
    // "RESOLVED" in prose (explaining that only a human editing the
    // register can ever record it) — so this asserts no *value* field
    // equals "RESOLVED", rather than banning the substring outright.
    const review = new TossCompliancePacketValidator().review(cleanRecord(), NOW);
    const serialized = JSON.stringify(review);
    expect(review.decision).not.toBe("RESOLVED");
    expect(TOSS_COMPLIANCE_PACKET_DECISIONS as readonly string[]).not.toContain("RESOLVED");
    expect(serialized).not.toMatch(/"decision":"RESOLVED"/);
    expect(serialized).not.toMatch(/"liveBrokerWriteAllowed":true/);
    expect(serialized).not.toMatch(/"blockerRegisterResolutionAllowed":true/);
  });

  it("fails closed on a fully empty input", () => {
    const review = new TossCompliancePacketValidator().review({} as TossCompliancePacketRecord, NOW);

    expect(review.structurallyComplete).toBe(false);
    expect(review.decision).toBe("INVALID");
    expect(review.blockingReasonCodes.length).toBeGreaterThan(0);
    expect(review.blockingReasonCodes).toContain("missing_packet_id");
    expect(review.blockingReasonCodes).toContain("missing_or_invalid_decision");
    expect(review.blockingReasonCodes).toContain("missing_toss_permission_evidence");
    expect(review.blockingReasonCodes).toContain("missing_compliance_review_scope");
    expect(review.blockingReasonCodes).toContain("missing_human_reviewer_name");
    expect(review.blockingReasonCodes).toContain("missing_human_reviewer_role");
    expect(review.blockingReasonCodes).toContain("missing_or_invalid_review_date");
    expect(review.blockingReasonCodes).toContain("missing_or_invalid_next_review_date");
    expect(review.blockingReasonCodes).toContain("missing_prohibited_content_confirmation");
    expect(review.liveBrokerWriteAllowed).toBe(false);
  });

  it("blocks when reviewer name, review date, or decision are missing even if everything else is clean", () => {
    const missingName = new TossCompliancePacketValidator().review(
      cleanRecord({ humanReviewerName: "" }),
      NOW
    );
    expect(missingName.structurallyComplete).toBe(false);
    expect(missingName.blockingReasonCodes).toContain("missing_human_reviewer_name");

    const missingDate = new TossCompliancePacketValidator().review(
      cleanRecord({ reviewDate: undefined as unknown as Date }),
      NOW
    );
    expect(missingDate.structurallyComplete).toBe(false);
    expect(missingDate.blockingReasonCodes).toContain("missing_or_invalid_review_date");

    const missingDecision = new TossCompliancePacketValidator().review(
      cleanRecord({ decision: undefined as unknown as TossCompliancePacketRecord["decision"] }),
      NOW
    );
    expect(missingDecision.structurallyComplete).toBe(false);
    expect(missingDecision.decision).toBe("INVALID");
    expect(missingDecision.blockingReasonCodes).toContain("missing_or_invalid_decision");
  });

  it("rejects an invented decision value not in the allowed vocabulary", () => {
    const review = new TossCompliancePacketValidator().review(
      cleanRecord({ decision: "RESOLVED" as unknown as TossCompliancePacketRecord["decision"] }),
      NOW
    );
    expect(review.structurallyComplete).toBe(false);
    expect(review.decision).toBe("INVALID");
    expect(review.blockingReasonCodes).toContain("missing_or_invalid_decision");
  });

  it("blocks a HUMAN_REVIEWED_* decision that lacks a matching verbatim attestation", () => {
    const review = new TossCompliancePacketValidator().review(
      cleanRecord({ reviewerAttestation: "I reviewed it, trust me." }),
      NOW
    );
    expect(review.structurallyComplete).toBe(false);
    expect(review.humanReviewClaimed).toBe(true);
    expect(review.humanReviewAttested).toBe(false);
    expect(review.blockingReasonCodes).toContain("decision_claims_human_reviewed_but_attestation_missing_or_mismatched");
  });

  it("does not require attestation for a READY_FOR_HUMAN_REVIEW decision", () => {
    const review = new TossCompliancePacketValidator().review(
      cleanRecord({ decision: "READY_FOR_HUMAN_REVIEW", reviewerAttestation: undefined }),
      NOW
    );
    expect(review.humanReviewClaimed).toBe(false);
    expect(review.blockingReasonCodes).not.toContain(
      "decision_claims_human_reviewed_but_attestation_missing_or_mismatched"
    );
  });

  it("blocks an approved-with-limitations decision when the compliance review scope is incomplete", () => {
    const review = new TossCompliancePacketValidator().review(
      cleanRecord({
        complianceReviewScope: cleanComplianceReviewScope({
          tax_recording_assumptions_documented: { reviewed: false }
        })
      }),
      NOW
    );
    expect(review.complianceScopeFullyReviewed).toBe(false);
    expect(review.blockingReasonCodes).toContain("decision_approved_but_compliance_scope_incomplete");
  });

  it("blocks an approved-with-limitations decision when the Toss permission result is UNVERIFIED", () => {
    const review = new TossCompliancePacketValidator().review(
      cleanRecord({
        tossPermission: {
          result: "UNVERIFIED",
          sourceReferences: ["docs/phase5/toss-official-api-source-notes.md"],
          distinguishesAutomatedTradingModes: "UNKNOWN",
          notes: "No written confirmation received yet."
        }
      }),
      NOW
    );
    expect(review.blockingReasonCodes).toContain("decision_approved_but_toss_permission_not_approved");
  });

  it("rejects covered blocker ids that do not match the fixed LCB-001/LCB-005 scope", () => {
    const review = new TossCompliancePacketValidator().review(
      cleanRecord({ coveredBlockerIds: ["LCB-001", "LCB-002"] }),
      NOW
    );
    expect(review.blockingReasonCodes).toContain("covered_blocker_ids_do_not_match_toss_compliance_packet_scope");
  });

  it("requires next review date to be strictly after review date", () => {
    const review = new TossCompliancePacketValidator().review(
      cleanRecord({ nextReviewDate: new Date("2026-07-20T00:00:00Z") }),
      NOW
    );
    expect(review.blockingReasonCodes).toContain("next_review_date_not_after_review_date");
  });

  it.each([
    ["access_token=abc123def456", "secret"],
    ["client_secret: xyz", "secret"],
    ["1234567890", "account identifier"],
    ['{"foo": "bar"}', "raw payload"],
    ["x-request-id: abcdef", "request header"]
  ])("blocks limitations text that looks like a %s", (text) => {
    const review = new TossCompliancePacketValidator().review(cleanRecord({ limitations: text }), NOW);
    expect(review.structurallyComplete).toBe(false);
    expect(review.blockingReasonCodes.some((code) => code.startsWith("packet_"))).toBe(true);
  });

  it("blocks a reviewer name or role that claims to be an AI/automated system", () => {
    const review = new TossCompliancePacketValidator().review(
      cleanRecord({ humanReviewerName: "Claude", humanReviewerRole: "AI Assistant" }),
      NOW
    );
    expect(review.blockingReasonCodes).toContain("human_reviewer_name_looks_non_human");
    expect(review.blockingReasonCodes).toContain("human_reviewer_role_looks_non_human");
  });

  it("requires explicit prohibited-content confirmation from the reviewer", () => {
    const review = new TossCompliancePacketValidator().review(
      cleanRecord({ prohibitedContentConfirmed: false }),
      NOW
    );
    expect(review.blockingReasonCodes).toContain("missing_prohibited_content_confirmation");
  });

  it("never lets an aiGeneratedSummary substitute for required human-reviewer fields", () => {
    const review = new TossCompliancePacketValidator().review(
      cleanRecord({
        humanReviewerName: "",
        humanReviewerRole: "",
        aiGeneratedSummary: "This packet is fully approved and ready for live trading."
      }),
      NOW
    );
    expect(review.structurallyComplete).toBe(false);
    expect(review.blockingReasonCodes).toContain("missing_human_reviewer_name");
    expect(review.blockingReasonCodes).toContain("missing_human_reviewer_role");
  });

  it("flags stale review dates and expired next-review dates as warnings, not silently", () => {
    const review = new TossCompliancePacketValidator().review(
      cleanRecord({
        reviewDate: new Date("2025-01-01T00:00:00Z"),
        nextReviewDate: new Date("2025-06-01T00:00:00Z")
      }),
      NOW
    );
    expect(review.warnings).toContain("review_date_stale_recommend_re_review");
    expect(review.warnings).toContain("next_review_date_has_passed_recommend_re_review");
  });
});
