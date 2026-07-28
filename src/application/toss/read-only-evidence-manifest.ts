import type { TossReadOnlyEvidenceItem } from "./read-only-evidence-plan.js";
import { openQuestionForEvidenceKind } from "./read-only-evidence-intake.js";

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

/**
 * Matches long digit runs that look like account numbers or other sensitive
 * identifiers rather than ordinary prose.
 */
const accountIdentifierLikePattern = /\b\d{6,}\b/;

/**
 * Matches text shaped like a raw JSON API response body or a raw HTTP
 * response (status line, HTML document). Manifest summaries must be
 * sanitized human summaries, never pasted raw payloads, even if an item's
 * `sanitized` flag was (incorrectly) set to `true` by hand.
 */
const rawResponseLikePattern =
  /(\{\s*"[a-zA-Z0-9_]+"\s*:)|(\[\s*\{\s*")|(<html[\s>])|(<!doctype\s+html)|(HTTP\/1\.[01]\s+\d{3})/i;

/**
 * Matches text shaped like a raw HTTP request/response header line (a
 * vendor `X-...` header or a cookie header). ("Authorization:" is already
 * covered by `blockedSecretPattern` below, so it is intentionally not
 * repeated here.)
 */
const requestHeaderLikePattern = /\b(x-[a-z0-9-]{2,}|cookie|set-cookie)\s*:\s*\S+/i;

const blockedSecretPattern =
  /(access[_-]?token|refresh[_-]?token|client[_-]?secret|app[_-]?secret|authorization|bearer\s+[a-z0-9._-]+|계좌번호|account[_-]?number)/i;

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

      // Defense in depth: scan the actual summary text even when the
      // self-declared `sanitized` / `containsCredential` flags claim the
      // item is already safe. A manifest can be hand-authored or loaded
      // from JSON outside the intake pipeline, so the boolean flags alone
      // must never be trusted as the only safety check.
      if (blockedSecretPattern.test(item.summary)) {
        reasonCodes.push(`manifest_evidence_may_contain_secret_${item.id}`);
      }
      if (accountIdentifierLikePattern.test(item.summary)) {
        reasonCodes.push(`manifest_evidence_may_contain_account_identifier_${item.id}`);
      }
      if (rawResponseLikePattern.test(item.summary)) {
        reasonCodes.push(`manifest_evidence_looks_like_raw_response_${item.id}`);
      }
      if (requestHeaderLikePattern.test(item.summary)) {
        reasonCodes.push(`manifest_evidence_may_contain_request_header_${item.id}`);
      }

      const canonicalOpenQuestion = openQuestionForEvidenceKind(item.kind);
      if (
        canonicalOpenQuestion &&
        item.relatedOpenQuestion.startsWith("OQ-") &&
        item.relatedOpenQuestion !== canonicalOpenQuestion
      ) {
        reasonCodes.push(`manifest_evidence_open_question_mismatch_${item.id}`);
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
