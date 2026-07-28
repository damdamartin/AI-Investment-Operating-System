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
  });

  it("does not count evidence that contains credentials", () => {
    const result = new TossOpenQuestionEvidenceTracker().review([
      evidence("unsafe", "OQ-001", { containsCredential: true })
    ]);

    expect(result.statuses[0]?.evidenceCount).toBe(1);
    expect(result.statuses[0]?.validEvidenceCount).toBe(0);
    expect(result.reasonCodes).toContain("missing_valid_evidence_oq-001");
  });

  it("does not count evidence that contains live write operations", () => {
    const result = new TossOpenQuestionEvidenceTracker().review([
      evidence("write", "OQ-003", { liveWriteOperation: true })
    ]);

    const status = result.statuses.find((item) => item.openQuestionId === "OQ-003");

    expect(status?.validEvidenceCount).toBe(0);
    expect(result.reasonCodes).toContain("missing_valid_evidence_oq-003");
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
