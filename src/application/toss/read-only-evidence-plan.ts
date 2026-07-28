export type TossEvidenceKind =
  | "API_TERMS_REVIEW"
  | "AUTHENTICATION_READ"
  | "ACCOUNT_SNAPSHOT_READ"
  | "POSITION_QUERY_READ"
  | "ORDER_STATUS_QUERY_READ"
  | "FILL_QUERY_READ"
  | "MARKET_DATA_READ"
  | "ETF_SUPPORT_DOCUMENTATION"
  | "FRACTIONAL_SUPPORT_DOCUMENTATION"
  | "EXTENDED_HOURS_DOCUMENTATION";

export type TossEvidenceMode =
  | "DOCUMENTATION_REVIEW"
  | "READ_ONLY_API_CALL"
  | "RECORDED_FIXTURE";

export interface TossReadOnlyEvidenceItem {
  id: string;
  kind: TossEvidenceKind;
  mode: TossEvidenceMode;
  collectedAt: Date;
  relatedOpenQuestion: string;
  summary: string;
  sanitized: boolean;
  containsCredential: boolean;
  liveWriteOperation: boolean;
}

export interface TossReadOnlyEvidenceReview {
  readyForReadOnlyIntegration: boolean;
  liveBrokerWriteAllowed: boolean;
  missingEvidenceKinds: TossEvidenceKind[];
  reasonCodes: string[];
  warnings: string[];
  blockedOpenQuestions: string[];
  safetyType: "TOSS_READ_ONLY_EVIDENCE_REVIEW_ONLY";
}

const requiredEvidenceKinds: TossEvidenceKind[] = [
  "API_TERMS_REVIEW",
  "AUTHENTICATION_READ",
  "ACCOUNT_SNAPSHOT_READ",
  "POSITION_QUERY_READ",
  "MARKET_DATA_READ"
];

const writeBlockingOpenQuestions = ["OQ-001", "OQ-002", "OQ-003", "OQ-004"];

export class TossReadOnlyEvidencePlan {
  review(evidence: TossReadOnlyEvidenceItem[], now: Date = new Date()): TossReadOnlyEvidenceReview {
    const reasonCodes: string[] = [];
    const warnings: string[] = [];
    const presentKinds = new Set(evidence.map((item) => item.kind));
    const missingEvidenceKinds = requiredEvidenceKinds.filter((kind) => !presentKinds.has(kind));

    for (const kind of missingEvidenceKinds) {
      reasonCodes.push(`missing_evidence_${kind.toLowerCase()}`);
    }

    for (const item of evidence) {
      if (!item.sanitized) {
        reasonCodes.push(`evidence_not_sanitized_${item.id}`);
      }
      if (item.containsCredential) {
        reasonCodes.push(`evidence_contains_credential_${item.id}`);
      }
      if (item.liveWriteOperation) {
        reasonCodes.push(`evidence_contains_live_write_operation_${item.id}`);
      }
      if (daysBetween(item.collectedAt, now) > 30) {
        warnings.push(`evidence_stale_${item.id}`);
      }
    }

    return {
      readyForReadOnlyIntegration: reasonCodes.length === 0,
      liveBrokerWriteAllowed: false,
      missingEvidenceKinds,
      reasonCodes: [...new Set(reasonCodes)].sort(),
      warnings: [...new Set(warnings)].sort(),
      blockedOpenQuestions: writeBlockingOpenQuestions,
      safetyType: "TOSS_READ_ONLY_EVIDENCE_REVIEW_ONLY"
    };
  }

  requiredEvidenceKinds(): TossEvidenceKind[] {
    return [...requiredEvidenceKinds];
  }
}

function daysBetween(left: Date, right: Date): number {
  return Math.floor((right.getTime() - left.getTime()) / 86_400_000);
}
