import { describe, expect, it } from "vitest";
import {
  LIVE_SAFETY_REVIEW_DECISIONS,
  LIVE_SAFETY_REVIEW_PACKET_BLOCKER_IDS,
  REQUIRED_NOT_LIVE_TRADING_AUTHORIZATION_STATEMENT,
  reviewLiveSafetyReviewEvidencePacket,
  reviewLiveSafetyReviewLcb007Record,
  reviewLiveSafetyReviewLcb008Record,
  type LiveSafetyReviewEvidencePacketInput,
  type LiveSafetyReviewLcb007Record,
  type LiveSafetyReviewLcb008Record
} from "../../src/index.js";

const NOW = new Date("2026-07-29T01:00:00Z");

function cleanLcb007Record(overrides: Partial<LiveSafetyReviewLcb007Record> = {}): LiveSafetyReviewLcb007Record {
  return {
    blockerId: "LCB-007",
    evidenceSourceReferences: [
      "tests/safety/safety-regression.test.ts",
      "docs/phase6/phase6-operator-runbook.md",
      "docs/phase8/rollback-drill-runbook.md"
    ],
    decision: "READY_FOR_HUMAN_REVIEW",
    limitations:
      "Simulation-layer kill-switch evidence is complete. Live-context rollback rehearsal covers a mocked broker snapshot only; no real TossSecuritiesAdapter exists yet, so real-broker rollback behavior remains unverified.",
    humanReviewerName: "Jun Kim",
    humanReviewerRole: "Engineering safety reviewer",
    reviewDate: new Date("2026-07-20T00:00:00Z"),
    expirationOrNextReviewDate: new Date("2027-01-20T00:00:00Z"),
    rollbackRehearsalStepsCompleted: 7,
    unresolvedBrokerStateStopCriteria:
      "If broker-reported cash or positions cannot be reconciled to internal records, dependent trading pauses immediately and stays paused until a human confirms match or accepts a documented known-mismatch policy exception.",
    ...overrides
  };
}

function cleanLcb008Record(overrides: Partial<LiveSafetyReviewLcb008Record> = {}): LiveSafetyReviewLcb008Record {
  return {
    blockerId: "LCB-008",
    evidenceSourceReferences: [
      "docs/phase7/toss-write-contract-design.md",
      "docs/08_Testing_Validation.md#20.1"
    ],
    decision: "READY_FOR_HUMAN_REVIEW",
    limitations:
      "No real write adapter exists yet in this repository, so no code review has occurred. This record only states the prerequisites the future review must satisfy.",
    humanReviewerName: "Soo-jin Park",
    humanReviewerRole: "Senior engineer / independent code reviewer",
    reviewDate: new Date("2026-07-20T00:00:00Z"),
    expirationOrNextReviewDate: new Date("2027-01-20T00:00:00Z"),
    adapterExistsYet: false,
    acceptanceCriteriaReferenceConfirmed: true,
    independentOfImplementer: true,
    ...overrides
  };
}

function cleanPacketInput(
  overrides: Partial<LiveSafetyReviewEvidencePacketInput> = {}
): LiveSafetyReviewEvidencePacketInput {
  return {
    packetId: "P10-008-LCB-007-008",
    now: NOW,
    lcb007: cleanLcb007Record(),
    lcb008: cleanLcb008Record(),
    prohibitedContentConfirmed: true,
    notLiveTradingAuthorizationStatement: REQUIRED_NOT_LIVE_TRADING_AUTHORIZATION_STATEMENT,
    ...overrides
  };
}

describe("LIVE_SAFETY_REVIEW_DECISIONS", () => {
  it("is exactly the five workbook-defined values and never includes RESOLVED", () => {
    expect(LIVE_SAFETY_REVIEW_DECISIONS).toEqual([
      "READY_FOR_HUMAN_REVIEW",
      "HUMAN_REVIEWED_APPROVED_WITH_LIMITATIONS",
      "HUMAN_REVIEWED_REJECTED",
      "HUMAN_REVIEWED_UNVERIFIED",
      "NEEDS_MORE_EVIDENCE"
    ]);
    for (const value of LIVE_SAFETY_REVIEW_DECISIONS) {
      expect(value).not.toBe("RESOLVED");
      expect(value.toUpperCase()).not.toContain("RESOLVED");
    }
  });
});

describe("reviewLiveSafetyReviewLcb007Record", () => {
  it("accepts a fully sanitized, complete record with zero reason codes", () => {
    const review = reviewLiveSafetyReviewLcb007Record(cleanLcb007Record(), NOW);
    expect(review.blockerId).toBe("LCB-007");
    expect(review.decision).toBe("READY_FOR_HUMAN_REVIEW");
    expect(review.reasonCodes).toEqual([]);
  });

  it("fails closed on a fully empty-ish record", () => {
    const review = reviewLiveSafetyReviewLcb007Record(
      {
        blockerId: "LCB-007",
        evidenceSourceReferences: [],
        decision: undefined as unknown as LiveSafetyReviewLcb007Record["decision"],
        limitations: "",
        humanReviewerName: "",
        humanReviewerRole: "",
        reviewDate: undefined as unknown as Date,
        expirationOrNextReviewDate: undefined as unknown as Date,
        rollbackRehearsalStepsCompleted: -1,
        unresolvedBrokerStateStopCriteria: ""
      },
      NOW
    );

    expect(review.reasonCodes).toContain("missing_evidence_source_references");
    expect(review.reasonCodes).toContain("missing_or_invalid_decision");
    expect(review.reasonCodes).toContain("missing_limitations");
    expect(review.reasonCodes).toContain("missing_human_reviewer_name");
    expect(review.reasonCodes).toContain("missing_human_reviewer_role");
    expect(review.reasonCodes).toContain("missing_or_invalid_review_date");
    expect(review.reasonCodes).toContain("missing_or_invalid_expiration_or_next_review_date");
    expect(review.reasonCodes).toContain("rollback_rehearsal_steps_completed_out_of_range");
    expect(review.reasonCodes).toContain("missing_unresolved_broker_state_stop_criteria");
  });

  it("rejects placeholder limitations and placeholder stop criteria", () => {
    const review = reviewLiveSafetyReviewLcb007Record(
      cleanLcb007Record({ limitations: "N/A", unresolvedBrokerStateStopCriteria: "TBD" }),
      NOW
    );
    expect(review.reasonCodes).toContain("limitations_is_placeholder_text");
    expect(review.reasonCodes).toContain("unresolved_broker_state_stop_criteria_is_placeholder_text");
  });

  it("requires all 7 rollback rehearsal steps completed before any HUMAN_REVIEWED_* decision", () => {
    const review = reviewLiveSafetyReviewLcb007Record(
      cleanLcb007Record({
        decision: "HUMAN_REVIEWED_APPROVED_WITH_LIMITATIONS",
        rollbackRehearsalStepsCompleted: 6
      }),
      NOW
    );
    expect(review.reasonCodes).toContain("lcb007_rollback_rehearsal_incomplete_for_human_reviewed_decision");
  });

  it("allows a HUMAN_REVIEWED_* decision when all 7 steps are completed", () => {
    const review = reviewLiveSafetyReviewLcb007Record(
      cleanLcb007Record({
        decision: "HUMAN_REVIEWED_APPROVED_WITH_LIMITATIONS",
        rollbackRehearsalStepsCompleted: 7
      }),
      NOW
    );
    expect(review.reasonCodes).not.toContain("lcb007_rollback_rehearsal_incomplete_for_human_reviewed_decision");
  });

  it("flags secret-like, account-identifier-like, and raw-payload-like content in any free-text field", () => {
    const secretReview = reviewLiveSafetyReviewLcb007Record(
      cleanLcb007Record({ limitations: "Confirmed using client_secret abc123 during rehearsal." }),
      NOW
    );
    expect(secretReview.reasonCodes.some((code) => code.startsWith("evidence_may_contain_secret_"))).toBe(true);

    const accountReview = reviewLiveSafetyReviewLcb007Record(
      cleanLcb007Record({ unresolvedBrokerStateStopCriteria: "Cross-checked against account 1234567890 balances." }),
      NOW
    );
    expect(
      accountReview.reasonCodes.some((code) => code.startsWith("evidence_may_contain_account_identifier_"))
    ).toBe(true);

    const payloadReview = reviewLiveSafetyReviewLcb007Record(
      cleanLcb007Record({ evidenceSourceReferences: ['{"orderId": "abc"}'] }),
      NOW
    );
    expect(payloadReview.reasonCodes.some((code) => code.startsWith("evidence_looks_like_raw_payload_"))).toBe(true);
  });

  it("flags a reviewer name or role that looks AI-authored", () => {
    const review = reviewLiveSafetyReviewLcb007Record(
      cleanLcb007Record({ humanReviewerName: "Claude", humanReviewerRole: "AI Assistant" }),
      NOW
    );
    expect(review.reasonCodes).toContain("human_reviewer_name_looks_non_human");
    expect(review.reasonCodes).toContain("human_reviewer_role_looks_non_human");
  });

  it("flags free text that contains the literal word 'resolved'", () => {
    const review = reviewLiveSafetyReviewLcb007Record(
      cleanLcb007Record({ limitations: "This blocker is effectively resolved after the rehearsal." }),
      NOW
    );
    expect(review.reasonCodes.some((code) => code.startsWith("evidence_contains_resolved_claim_"))).toBe(true);
  });

  it("never returns RESOLVED as the echoed decision under any input, including an out-of-union cast", () => {
    const attempts: LiveSafetyReviewLcb007Record[] = [
      cleanLcb007Record({ decision: "READY_FOR_HUMAN_REVIEW" }),
      cleanLcb007Record({ decision: "HUMAN_REVIEWED_UNVERIFIED" }),
      // @ts-expect-error deliberately probing an out-of-union value to prove
      // even a hand-edited/untyped caller cannot smuggle "RESOLVED" through.
      cleanLcb007Record({ decision: "RESOLVED" })
    ];

    for (const record of attempts) {
      const review = reviewLiveSafetyReviewLcb007Record(record, NOW);
      expect(review.decision).not.toBe("RESOLVED");
    }
  });
});

describe("reviewLiveSafetyReviewLcb008Record", () => {
  it("accepts a fully sanitized, complete record with zero reason codes", () => {
    const review = reviewLiveSafetyReviewLcb008Record(cleanLcb008Record(), NOW);
    expect(review.blockerId).toBe("LCB-008");
    expect(review.decision).toBe("READY_FOR_HUMAN_REVIEW");
    expect(review.reasonCodes).toEqual([]);
  });

  it("fails closed when adapterExistsYet is true, regardless of everything else being clean", () => {
    const review = reviewLiveSafetyReviewLcb008Record(cleanLcb008Record({ adapterExistsYet: true }), NOW);
    expect(review.reasonCodes).toContain("lcb008_write_adapter_must_not_exist_yet");
  });

  it("fails closed when adapterExistsYet is a truthy non-boolean via an unsafe cast", () => {
    const review = reviewLiveSafetyReviewLcb008Record(
      cleanLcb008Record({ adapterExistsYet: "yes" as unknown as boolean }),
      NOW
    );
    expect(review.reasonCodes).toContain("lcb008_write_adapter_must_not_exist_yet");
  });

  it("requires acceptanceCriteriaReferenceConfirmed before any HUMAN_REVIEWED_* decision", () => {
    const review = reviewLiveSafetyReviewLcb008Record(
      cleanLcb008Record({
        decision: "HUMAN_REVIEWED_REJECTED",
        acceptanceCriteriaReferenceConfirmed: false
      }),
      NOW
    );
    expect(review.reasonCodes).toContain("lcb008_acceptance_criteria_reference_not_confirmed");
  });

  it("requires a non-empty, sanitized justification when the reviewer is not independent of the implementer", () => {
    const missingJustification = reviewLiveSafetyReviewLcb008Record(
      cleanLcb008Record({ independentOfImplementer: false, independenceExceptionJustification: undefined }),
      NOW
    );
    expect(missingJustification.reasonCodes).toContain("lcb008_missing_independence_exception_justification");

    const withJustification = reviewLiveSafetyReviewLcb008Record(
      cleanLcb008Record({
        independentOfImplementer: false,
        independenceExceptionJustification: "Single-engineer team; documented for the register as a known exception."
      }),
      NOW
    );
    expect(withJustification.reasonCodes).not.toContain("lcb008_missing_independence_exception_justification");
  });

  it("never returns RESOLVED as the echoed decision under any input, including an out-of-union cast", () => {
    const attempts: LiveSafetyReviewLcb008Record[] = [
      cleanLcb008Record({ decision: "NEEDS_MORE_EVIDENCE" }),
      // @ts-expect-error deliberately probing an out-of-union value to prove
      // even a hand-edited/untyped caller cannot smuggle "RESOLVED" through.
      cleanLcb008Record({ decision: "RESOLVED" })
    ];

    for (const record of attempts) {
      const review = reviewLiveSafetyReviewLcb008Record(record, NOW);
      expect(review.decision).not.toBe("RESOLVED");
    }
  });
});

describe("reviewLiveSafetyReviewEvidencePacket", () => {
  it("accepts a fully sanitized, complete packet with zero reason codes", () => {
    const review = reviewLiveSafetyReviewEvidencePacket(cleanPacketInput());
    expect(review.packetId).toBe("P10-008-LCB-007-008");
    expect(review.coveredBlockerIds).toEqual(LIVE_SAFETY_REVIEW_PACKET_BLOCKER_IDS);
    expect(review.reasonCodes).toEqual([]);
    expect(review.liveBrokerWriteAllowed).toBe(false);
    expect(review.blockerRegisterResolutionAllowed).toBe(false);
    expect(review.safetyType).toBe("LIVE_SAFETY_REVIEW_EVIDENCE_PACKET_REVIEW_ONLY");
  });

  it("fails closed on a missing packetId", () => {
    const review = reviewLiveSafetyReviewEvidencePacket(cleanPacketInput({ packetId: "" }));
    expect(review.packetId).toBeUndefined();
    expect(review.reasonCodes).toContain("missing_packet_id");
  });

  it("fails closed when prohibitedContentConfirmed is not strictly true", () => {
    const review = reviewLiveSafetyReviewEvidencePacket(
      cleanPacketInput({ prohibitedContentConfirmed: false })
    );
    expect(review.reasonCodes).toContain("prohibited_content_confirmation_missing");
  });

  it("fails closed when prohibitedContentConfirmed is a truthy non-boolean via an unsafe cast", () => {
    const review = reviewLiveSafetyReviewEvidencePacket(
      cleanPacketInput({ prohibitedContentConfirmed: "true" as unknown as boolean })
    );
    expect(review.reasonCodes).toContain("prohibited_content_confirmation_missing");
  });

  it("fails closed when the not-live-trading-authorization statement is missing or paraphrased", () => {
    const missing = reviewLiveSafetyReviewEvidencePacket(
      cleanPacketInput({ notLiveTradingAuthorizationStatement: "" })
    );
    expect(missing.reasonCodes).toContain("not_live_trading_authorization_statement_missing_or_mismatched");

    const paraphrased = reviewLiveSafetyReviewEvidencePacket(
      cleanPacketInput({
        notLiveTradingAuthorizationStatement: "This is not live trading authorization."
      })
    );
    expect(paraphrased.reasonCodes).toContain("not_live_trading_authorization_statement_missing_or_mismatched");
  });

  it("propagates LCB-007 record-level failures with a prefixed reason code", () => {
    const review = reviewLiveSafetyReviewEvidencePacket(
      cleanPacketInput({ lcb007: cleanLcb007Record({ humanReviewerName: "" }) })
    );
    expect(review.reasonCodes).toContain("lcb007_record_missing_human_reviewer_name");
  });

  it("propagates LCB-008 record-level failures with a prefixed reason code", () => {
    const review = reviewLiveSafetyReviewEvidencePacket(
      cleanPacketInput({ lcb008: cleanLcb008Record({ adapterExistsYet: true }) })
    );
    expect(review.reasonCodes).toContain("lcb008_record_lcb008_write_adapter_must_not_exist_yet");
  });

  it("always covers exactly LCB-007 and LCB-008, in that order, regardless of input", () => {
    const review = reviewLiveSafetyReviewEvidencePacket(cleanPacketInput());
    expect(review.coveredBlockerIds).toEqual(["LCB-007", "LCB-008"]);
  });

  it("never sets liveBrokerWriteAllowed or blockerRegisterResolutionAllowed to true, even given a maximally favorable, fully clean input", () => {
    const review = reviewLiveSafetyReviewEvidencePacket(
      cleanPacketInput({
        lcb007: cleanLcb007Record({
          decision: "HUMAN_REVIEWED_APPROVED_WITH_LIMITATIONS",
          rollbackRehearsalStepsCompleted: 7
        }),
        lcb008: cleanLcb008Record({ decision: "HUMAN_REVIEWED_UNVERIFIED" })
      })
    );
    expect(review.liveBrokerWriteAllowed).toBe(false);
    expect(review.blockerRegisterResolutionAllowed).toBe(false);

    const serialized = JSON.stringify(review);
    expect(serialized).not.toMatch(/"liveBrokerWriteAllowed":true/);
    expect(serialized).not.toMatch(/"blockerRegisterResolutionAllowed":true/);
  });

  it("never contains the literal word RESOLVED anywhere in a serialized, maximally clean packet", () => {
    const review = reviewLiveSafetyReviewEvidencePacket(cleanPacketInput());
    const serialized = JSON.stringify(review);
    expect(serialized.toUpperCase()).not.toContain("RESOLVED");
  });

  it("never exposes a callable order-shaped or broker-write-shaped key", () => {
    const review = reviewLiveSafetyReviewEvidencePacket(cleanPacketInput());
    expect(review).not.toHaveProperty("submitOrder");
    expect(review).not.toHaveProperty("cancelOrder");
    expect(review).not.toHaveProperty("replaceOrder");
    expect(review).not.toHaveProperty("placeOrder");
    const serialized = JSON.stringify(review);
    expect(serialized).not.toMatch(/submitOrder|cancelOrder|replaceOrder|placeOrder|TossSecuritiesAdapter/i);
  });

  it("the required not-live-trading-authorization statement text itself never claims resolution and states it is not authorization", () => {
    expect(REQUIRED_NOT_LIVE_TRADING_AUTHORIZATION_STATEMENT.toUpperCase()).not.toContain("RESOLVED");
    expect(REQUIRED_NOT_LIVE_TRADING_AUTHORIZATION_STATEMENT).toMatch(/not.*authorization/i);
  });
});
