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
      evidence("terms", "OQ-001"),
      evidence("account", "OQ-002"),
      evidence("orders", "OQ-003"),
      evidence("etf", "OQ-004")
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
      evidence("write", "OQ-003", { liveWriteOperation: true })
    ]);

    const status = result.statuses.find((item) => item.openQuestionId === "OQ-003");

    expect(status?.validEvidenceCount).toBe(0);
    expect(status?.evidenceStatus).toBe("EVIDENCE_COLLECTED");
    expect(result.reasonCodes).toContain("missing_valid_evidence_oq-003");
  });

  it("treats unsanitized evidence as collected-but-not-sanitized", () => {
    const result = new TossOpenQuestionEvidenceTracker().review([
      evidence("draft", "OQ-002", { sanitized: false })
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
