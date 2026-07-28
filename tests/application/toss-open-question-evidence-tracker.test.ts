import { describe, expect, it } from "vitest";
import {
  TossOpenQuestionEvidenceTracker,
  type TossReadOnlyEvidenceItem
} from "../../src/index.js";

describe("TossOpenQuestionEvidenceTracker", () => {
  it("requires valid evidence for OQ-001 through OQ-004", () => {
    const tracker = new TossOpenQuestionEvidenceTracker();
    const result = tracker.review([]);

    expect(result.readyForOpenQuestionReview).toBe(false);
    expect(result.missingOpenQuestions).toEqual(["OQ-001", "OQ-002", "OQ-003", "OQ-004"]);
    expect(result.liveBrokerWriteAllowed).toBe(false);
    expect(result.liveTradingAuthorized).toBe(false);
    expect(result.statuses.every((status) => status.evidenceStatus === "NO_EVIDENCE")).toBe(true);
  });

  it("marks open questions ready when sanitized evidence exists", () => {
    const result = new TossOpenQuestionEvidenceTracker().review([
      evidence("terms", "OQ-001", { kind: "API_TERMS_REVIEW" }),
      evidence("account", "OQ-002", { kind: "ACCOUNT_SNAPSHOT_READ" }),
      evidence("orders", "OQ-003", { kind: "ORDER_STATUS_QUERY_READ" }),
      evidence("etf", "OQ-004", { kind: "ETF_SUPPORT_DOCUMENTATION" })
    ]);

    expect(result.readyForOpenQuestionReview).toBe(true);
    expect(result.missingOpenQuestions).toEqual([]);
    expect(result.statuses.every((status) => status.readyForReview)).toBe(true);
    expect(result.statuses.every((status) => status.evidenceStatus === "EVIDENCE_SANITIZED")).toBe(true);
    // Sanitized evidence never flips the live-trading blockers, even when
    // every open question is ready for human review.
    expect(result.liveBrokerWriteAllowed).toBe(false);
    expect(result.liveTradingAuthorized).toBe(false);
  });

  it("maps ACCOUNT_SNAPSHOT_READ and POSITION_QUERY_READ evidence to OQ-002", () => {
    const result = new TossOpenQuestionEvidenceTracker().review([
      evidence("account-snapshot", "OQ-002", { kind: "ACCOUNT_SNAPSHOT_READ" }),
      evidence("position-query", "OQ-002", { kind: "POSITION_QUERY_READ" })
    ]);

    const status = result.statuses.find((item) => item.openQuestionId === "OQ-002");

    expect(status?.evidenceCount).toBe(2);
    expect(status?.validEvidenceCount).toBe(2);
    expect(status?.readyForReview).toBe(true);
    expect(status?.evidenceStatus).toBe("EVIDENCE_SANITIZED");
  });

  it("does not count evidence whose kind's canonical open question disagrees with the declared one", () => {
    const result = new TossOpenQuestionEvidenceTracker().review([
      // Mislabeled: an ACCOUNT_SNAPSHOT_READ item canonically belongs to
      // OQ-002, not OQ-001. It must not count toward either question.
      evidence("mislabeled-account", "OQ-001", { kind: "ACCOUNT_SNAPSHOT_READ" })
    ]);

    const oq001 = result.statuses.find((item) => item.openQuestionId === "OQ-001");
    const oq002 = result.statuses.find((item) => item.openQuestionId === "OQ-002");

    expect(oq001?.evidenceCount).toBe(0);
    expect(oq001?.readyForReview).toBe(false);
    expect(oq002?.evidenceCount).toBe(0);
    expect(oq002?.readyForReview).toBe(false);
    expect(result.reasonCodes).toContain("evidence_open_question_mismatch_mislabeled-account");
    expect(result.readyForOpenQuestionReview).toBe(false);
  });

  it("does not count evidence that contains credentials", () => {
    const result = new TossOpenQuestionEvidenceTracker().review([
      evidence("unsafe", "OQ-001", { containsCredential: true })
    ]);

    expect(result.statuses[0]?.evidenceCount).toBe(1);
    expect(result.statuses[0]?.validEvidenceCount).toBe(0);
    expect(result.statuses[0]?.evidenceStatus).toBe("EVIDENCE_COLLECTED");
    expect(result.reasonCodes).toContain("missing_valid_evidence_oq-001");
  });

  it("does not count evidence that contains live write operations", () => {
    const result = new TossOpenQuestionEvidenceTracker().review([
      evidence("write", "OQ-003", { kind: "ORDER_STATUS_QUERY_READ", liveWriteOperation: true })
    ]);

    const status = result.statuses.find((item) => item.openQuestionId === "OQ-003");

    expect(status?.validEvidenceCount).toBe(0);
    expect(status?.evidenceStatus).toBe("EVIDENCE_COLLECTED");
    expect(result.reasonCodes).toContain("missing_valid_evidence_oq-003");
  });

  it("treats unsanitized evidence as collected-but-not-sanitized", () => {
    const result = new TossOpenQuestionEvidenceTracker().review([
      evidence("draft", "OQ-002", { kind: "ACCOUNT_SNAPSHOT_READ", sanitized: false })
    ]);

    const status = result.statuses.find((item) => item.openQuestionId === "OQ-002");

    expect(status?.evidenceStatus).toBe("EVIDENCE_COLLECTED");
    expect(status?.readyForReview).toBe(false);
  });

  it("exposes the required Toss open question set", () => {
    expect(new TossOpenQuestionEvidenceTracker().requiredOpenQuestions()).toEqual([
      "OQ-001",
      "OQ-002",
      "OQ-003",
      "OQ-004"
    ]);
  });
});

function evidence(
  id: string,
  relatedOpenQuestion: string,
  overrides: Partial<TossReadOnlyEvidenceItem> = {}
): TossReadOnlyEvidenceItem {
  return {
    id,
    kind: "API_TERMS_REVIEW",
    mode: "DOCUMENTATION_REVIEW",
    collectedAt: new Date("2026-07-28T00:00:00Z"),
    relatedOpenQuestion,
    summary: "Sanitized evidence.",
    sanitized: true,
    containsCredential: false,
    liveWriteOperation: false,
    ...overrides
  };
}
