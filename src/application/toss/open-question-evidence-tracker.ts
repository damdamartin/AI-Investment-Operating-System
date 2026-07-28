import type { TossReadOnlyEvidenceItem } from "./read-only-evidence-plan.js";

export interface TossOpenQuestionEvidenceStatus {
  openQuestionId: string;
  evidenceCount: number;
  validEvidenceCount: number;
  readyForReview: boolean;
}

export interface TossOpenQuestionEvidenceReview {
  readyForOpenQuestionReview: boolean;
  statuses: TossOpenQuestionEvidenceStatus[];
  missingOpenQuestions: string[];
  reasonCodes: string[];
  liveBrokerWriteAllowed: boolean;
  safetyType: "TOSS_OPEN_QUESTION_EVIDENCE_REVIEW_ONLY";
}

const requiredTossOpenQuestions = ["OQ-001", "OQ-002", "OQ-003", "OQ-004"];

export class TossOpenQuestionEvidenceTracker {
  review(evidence: TossReadOnlyEvidenceItem[]): TossOpenQuestionEvidenceReview {
    const statuses = requiredTossOpenQuestions.map((openQuestionId) => {
      const matchingEvidence = evidence.filter((item) => item.relatedOpenQuestion === openQuestionId);
      const validEvidence = matchingEvidence.filter((item) =>
        item.sanitized && !item.containsCredential && !item.liveWriteOperation
      );

      return {
        openQuestionId,
        evidenceCount: matchingEvidence.length,
        validEvidenceCount: validEvidence.length,
        readyForReview: validEvidence.length > 0
      };
    });
    const missingOpenQuestions = statuses
      .filter((status) => !status.readyForReview)
      .map((status) => status.openQuestionId);
    const reasonCodes = missingOpenQuestions.map((openQuestionId) =>
      `missing_valid_evidence_${openQuestionId.toLowerCase()}`
    );

    return {
      readyForOpenQuestionReview: missingOpenQuestions.length === 0,
      statuses,
      missingOpenQuestions,
      reasonCodes,
      liveBrokerWriteAllowed: false,
      safetyType: "TOSS_OPEN_QUESTION_EVIDENCE_REVIEW_ONLY"
    };
  }

  requiredOpenQuestions(): string[] {
    return [...requiredTossOpenQuestions];
  }
}
