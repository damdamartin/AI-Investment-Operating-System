import type { TossReadOnlyEvidenceItem } from "./read-only-evidence-plan.js";

export interface TossReadOnlyEvidenceManifest {
  manifestVersion: "1";
  generatedAt: Date;
  environment: "local" | "staging" | "production";
  evidence: TossReadOnlyEvidenceItem[];
  notes: string[];
}

export interface TossReadOnlyEvidenceManifestReview {
  valid: boolean;
  reasonCodes: string[];
  evidenceCount: number;
  relatedOpenQuestions: string[];
  liveBrokerWriteAllowed: boolean;
  safetyType: "TOSS_READ_ONLY_EVIDENCE_MANIFEST_REVIEW_ONLY";
}

export class TossReadOnlyEvidenceManifestValidator {
  review(manifest: TossReadOnlyEvidenceManifest): TossReadOnlyEvidenceManifestReview {
    const reasonCodes: string[] = [];

    if (manifest.manifestVersion !== "1") {
      reasonCodes.push("unsupported_manifest_version");
    }

    for (const item of manifest.evidence) {
      if (!item.sanitized) {
        reasonCodes.push(`manifest_evidence_not_sanitized_${item.id}`);
      }
      if (item.containsCredential) {
        reasonCodes.push(`manifest_evidence_contains_credential_${item.id}`);
      }
      if (item.liveWriteOperation) {
        reasonCodes.push(`manifest_evidence_contains_live_write_${item.id}`);
      }
      if (!item.relatedOpenQuestion.startsWith("OQ-")) {
        reasonCodes.push(`manifest_evidence_missing_open_question_${item.id}`);
      }
    }

    return {
      valid: reasonCodes.length === 0,
      reasonCodes: [...new Set(reasonCodes)].sort(),
      evidenceCount: manifest.evidence.length,
      relatedOpenQuestions: [...new Set(manifest.evidence.map((item) => item.relatedOpenQuestion))].sort(),
      liveBrokerWriteAllowed: false,
      safetyType: "TOSS_READ_ONLY_EVIDENCE_MANIFEST_REVIEW_ONLY"
    };
  }
}
