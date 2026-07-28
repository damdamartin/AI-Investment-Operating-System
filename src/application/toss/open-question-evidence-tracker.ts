import type { TossReadOnlyEvidenceItem } from "./read-only-evidence-plan.js";
import { openQuestionForEvidenceKind } from "./read-only-evidence-intake.js";

/**
 * Phase 5 open-question evidence status policy.
 *
 * This is the full state sequence used to reason about Toss open questions
 * (see `docs/phase5/open-question-evidence-policy.md`):
 *
 *   NO_EVIDENCE -> EVIDENCE_COLLECTED -> EVIDENCE_SANITIZED -> EVIDENCE_REVIEWED
 *     -> QUESTION_IN_REVIEW -> QUESTION_RESOLVED
 *
 * `LIVE_TRADING_STILL_BLOCKED` is not a step in that sequence. It is a
 * permanent, parallel condition that stays true through every one of the
 * states above during Phase 5.
 *
 * This tracker is code, not a human reviewer. It can only observe evidence
 * item fields (`sanitized`, `containsCredential`, `liveWriteOperation`) that
 * already exist on `TossReadOnlyEvidenceItem`. It can therefore only ever
 * compute one of the first three states below. `EVIDENCE_REVIEWED`,
 * `QUESTION_IN_REVIEW`, and `QUESTION_RESOLVED` require a human reviewer
 * name, a reviewed date, and a recorded decision — none of which exist on an
 * evidence item — so they must be recorded by a human directly in
 * `docs/open_questions.md`. This tracker must never claim to have reached
 * them automatically.
 */
export type TossOpenQuestionComputedEvidenceStatus =
  | "NO_EVIDENCE"
  | "EVIDENCE_COLLECTED"
  | "EVIDENCE_SANITIZED";

/**
 * States that only a human reviewer may declare, by editing
 * `docs/open_questions.md` directly. `TossOpenQuestionEvidenceTracker` never
 * produces these values — they are documented here so code and docs share
 * one vocabulary.
 */
export const humanDeclaredOpenQuestionEvidenceStates = [
  "EVIDENCE_REVIEWED",
  "QUESTION_IN_REVIEW",
  "QUESTION_RESOLVED"
] as const;

export interface TossOpenQuestionEvidenceStatus {
  openQuestionId: string;
  evidenceCount: number;
  validEvidenceCount: number;
  readyForReview: boolean;
  /**
   * Highest state this tracker can compute for this open question from the
   * evidence it was given. Never advances past `EVIDENCE_SANITIZED` — moving
   * further requires a human-recorded decision, not code.
   */
  evidenceStatus: TossOpenQuestionComputedEvidenceStatus;
}

export interface TossOpenQuestionEvidenceReview {
  readyForOpenQuestionReview: boolean;
  statuses: TossOpenQuestionEvidenceStatus[];
  missingOpenQuestions: string[];
  reasonCodes: string[];
  liveBrokerWriteAllowed: boolean;
  /**
   * Always false. Sanitized Phase 5 evidence, even once every open question
   * is `readyForReview`, never authorizes Toss order creation, Toss order
   * cancellation, Toss order replacement, live capital use, or production
   * reconciliation based on unverified identifiers. See
   * `docs/phase5/open-question-evidence-policy.md`.
   */
  liveTradingAuthorized: boolean;
  safetyType: "TOSS_OPEN_QUESTION_EVIDENCE_REVIEW_ONLY";
}

const requiredTossOpenQuestions = ["OQ-001", "OQ-002", "OQ-003", "OQ-004"];

export class TossOpenQuestionEvidenceTracker {
  review(evidence: TossReadOnlyEvidenceItem[]): TossOpenQuestionEvidenceReview {
    // An evidence item only counts toward the open question it declares
    // (`relatedOpenQuestion`) when its `kind` either has no fixed canonical
    // open-question mapping (e.g. `MARKET_DATA_READ`) or agrees with that
    // mapping. This stops mislabeled evidence (for example an
    // `ACCOUNT_SNAPSHOT_READ` item incorrectly tagged `OQ-001`) from
    // silently padding the wrong open question's evidence count. See
    // `openQuestionForEvidenceKind` in `read-only-evidence-intake.ts`,
    // which is also where `ACCOUNT_SNAPSHOT_READ` and `POSITION_QUERY_READ`
    // are canonically mapped to `OQ-002`.
    const mismatchedEvidenceIds = evidence
      .filter((item) => {
        const canonicalOpenQuestion = openQuestionForEvidenceKind(item.kind);
        return canonicalOpenQuestion !== undefined && canonicalOpenQuestion !== item.relatedOpenQuestion;
      })
      .map((item) => item.id);

    const statuses = requiredTossOpenQuestions.map((openQuestionId) => {
      const matchingEvidence = evidence.filter(
        (item) => item.relatedOpenQuestion === openQuestionId && !mismatchedEvidenceIds.includes(item.id)
      );
      const validEvidence = matchingEvidence.filter((item) =>
        item.sanitized && !item.containsCredential && !item.liveWriteOperation
      );
      const readyForReview = validEvidence.length > 0;
      const evidenceStatus: TossOpenQuestionComputedEvidenceStatus = readyForReview
        ? "EVIDENCE_SANITIZED"
        : matchingEvidence.length > 0
          ? "EVIDENCE_COLLECTED"
          : "NO_EVIDENCE";

      return {
        openQuestionId,
        evidenceCount: matchingEvidence.length,
        validEvidenceCount: validEvidence.length,
        readyForReview,
        evidenceStatus
      };
    });
    const missingOpenQuestions = statuses
      .filter((status) => !status.readyForReview)
      .map((status) => status.openQuestionId);
    const reasonCodes = [
      ...missingOpenQuestions.map((openQuestionId) => `missing_valid_evidence_${openQuestionId.toLowerCase()}`),
      ...mismatchedEvidenceIds.map((id) => `evidence_open_question_mismatch_${id}`)
    ];

    return {
      readyForOpenQuestionReview: missingOpenQuestions.length === 0,
      statuses,
      missingOpenQuestions,
      reasonCodes,
      liveBrokerWriteAllowed: false,
      liveTradingAuthorized: false,
      safetyType: "TOSS_OPEN_QUESTION_EVIDENCE_REVIEW_ONLY"
    };
  }

  requiredOpenQuestions(): string[] {
    return [...requiredTossOpenQuestions];
  }
}
