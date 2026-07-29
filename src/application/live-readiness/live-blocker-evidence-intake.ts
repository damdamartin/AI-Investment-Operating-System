/**
 * Phase 9 (P9-001): live blocker evidence intake.
 *
 * This module is a PURE validator. It has no network code, no filesystem
 * access, no broker client, and no side effects of any kind. It never
 * constructs, submits, cancels, or replaces a broker order, and it never
 * enables live trading.
 *
 * It exists to give `LCB-001` through `LCB-008`
 * (`docs/phase7/live-capable-blocker-register.md`) a machine-checkable,
 * sanitized evidence intake shape: a human can hand this module a candidate
 * evidence record for a blocker and get back whether the record is shaped
 * safely (no secrets, no account-identifier-like content, no raw payloads,
 * every required human-reviewer field present) and whether it currently
 * reads as reviewer-drafted (`READY_FOR_HUMAN_REVIEW`) or as a completed,
 * attested human review (`HUMAN_REVIEWED`).
 *
 * What this module deliberately cannot do, by construction:
 *
 * - It cannot mark any blocker `RESOLVED`. `RESOLVED` is a status value that
 *   belongs exclusively to `docs/phase7/live-capable-blocker-register.md`
 *   ("a blocker may only be marked RESOLVED by a human reviewer recording a
 *   reviewer name, reviewed date, and decision directly in this file").
 *   The literal string `"RESOLVED"` does not appear anywhere in this
 *   module's status types (`LiveBlockerEvidenceStatus`,
 *   `LiveBlockerEvidenceRegisterBlockerStatus`) or in any value this module
 *   can return. There is no reachable code path — not a branch, not a
 *   default, not a fallback — that produces that word. This module only
 *   ever reads a caller-supplied evidence record and reports on its shape;
 *   it never writes to, and never even references a file path for,
 *   `docs/phase7/live-capable-blocker-register.md` itself.
 * - It cannot accept AI-generated text as a substitute for human review.
 *   `LiveBlockerEvidenceRecord.aiGeneratedSummary` is a distinct, optional
 *   field that this module's checks never read when deciding
 *   `humanReviewed` status; only `humanReviewerName`, `humanReviewerRole`,
 *   `reviewDate`, and a verbatim `humanReviewerAttestation` (mirroring
 *   `REQUIRED_MANUAL_APPROVAL_ATTESTATION` in
 *   `small-capital-readiness.ts`) can produce `HUMAN_REVIEWED`.
 * - It cannot be satisfied by secret-like, account-number-like, or raw
 *   broker-payload-like content. Every free-text field on a record is
 *   scanned; any match is a blocking `reasonCode`, never a warning.
 * - It fails closed: a missing required field, an unknown blocker id, a
 *   duplicate blocker id, or a completely absent blocker in a register-level
 *   review is always treated as not-ready, never as "assume fine."
 */

// ---------------------------------------------------------------------------
// Blocker catalog
// ---------------------------------------------------------------------------

/**
 * The eight live-capable blockers this module accepts evidence for, in the
 * same order and with the same identifiers as
 * `docs/phase7/live-capable-blocker-register.md`.
 */
export const LIVE_BLOCKER_IDS = Object.freeze([
  "LCB-001",
  "LCB-002",
  "LCB-003",
  "LCB-004",
  "LCB-005",
  "LCB-006",
  "LCB-007",
  "LCB-008"
] as const);
export type LiveBlockerId = (typeof LIVE_BLOCKER_IDS)[number];

export interface LiveBlockerCatalogEntry {
  /** Short, original paraphrase of the blocker title, not a verbatim doc excerpt. */
  title: string;
  /** Always a human role. Never "AI", "Claude", "Codex", or "System". */
  humanOwnerRole: string;
}

/**
 * Static catalog describing what each blocker is about and who owns
 * reviewing it, sourced from the "Summary Table" in
 * `docs/phase7/live-capable-blocker-register.md`. This catalog is
 * read-only, informational metadata used for validation messages and
 * completeness checks. It never changes the register file, and it never
 * assigns a status to a blocker.
 */
export const LIVE_BLOCKER_CATALOG: Readonly<Record<LiveBlockerId, LiveBlockerCatalogEntry>> = Object.freeze({
  "LCB-001": Object.freeze({
    title: "Toss automated trading permission evidence",
    humanOwnerRole: "Compliance/legal reviewer (human)"
  }),
  "LCB-002": Object.freeze({
    title: "Toss account permission and capability evidence",
    humanOwnerRole: "Operator + compliance/legal reviewer (human)"
  }),
  "LCB-003": Object.freeze({
    title: "Production credential/provisioning process evidence",
    humanOwnerRole: "Infrastructure/DevOps owner + security reviewer (human)"
  }),
  "LCB-004": Object.freeze({
    title: "Human approval evidence",
    humanOwnerRole: "Project owner / operator (human)"
  }),
  "LCB-005": Object.freeze({
    title: "Compliance/legal review evidence",
    humanOwnerRole: "Compliance/legal reviewer (human)"
  }),
  "LCB-006": Object.freeze({
    title: "Small-capital operating-limit sign-off evidence",
    humanOwnerRole: "Risk owner / operator (human)"
  }),
  "LCB-007": Object.freeze({
    title: "Kill-switch/rollback live-context evidence",
    humanOwnerRole: "Engineering safety reviewer + operator (human)"
  }),
  "LCB-008": Object.freeze({
    title: "Future write-adapter review evidence",
    humanOwnerRole: "Senior engineer / independent code reviewer (human)"
  })
});

// ---------------------------------------------------------------------------
// Prohibited-content checks
// ---------------------------------------------------------------------------

/**
 * Matches text that looks like a secret: tokens, client/app secrets, API
 * keys, authorization headers, bearer values, passwords, private keys.
 * Mirrors the discipline already established by
 * `src/application/toss/read-only-evidence-intake.ts`.
 */
const secretLikePattern =
  /(access[_-]?token|refresh[_-]?token|client[_-]?secret|app[_-]?secret|api[_-]?key|authorization|bearer\s+[a-z0-9._-]+|password|private[_-]?key|계좌번호|account[_-]?number)/i;

/** Matches long digit runs that look like account numbers, card numbers, or other sensitive identifiers. */
const accountIdentifierLikePattern = /\b\d{6,}\b/;

/** Matches text shaped like a raw JSON API response body or a raw HTTP response. */
const rawPayloadLikePattern =
  /(\{\s*"[a-zA-Z0-9_]+"\s*:)|(\[\s*\{\s*")|(<html[\s>])|(<!doctype\s+html)|(HTTP\/1\.[01]\s+\d{3})/i;

/** Matches text shaped like a raw HTTP request/response header line. */
const requestHeaderLikePattern = /\b(x-[a-z0-9-]{2,}|cookie|set-cookie)\s*:\s*\S+/i;

/**
 * Matches identity tokens that indicate a reviewer name or role is claiming
 * to be an AI/automated system rather than a human. This never proves a
 * human actually reviewed anything, but it structurally blocks the most
 * obvious way an AI-generated approval could be passed off as human review
 * ("reviewed by: Claude", "role: AI Assistant", and similar).
 */
const disallowedReviewerIdentityPattern =
  /\b(ai|artificial[\s-]?intelligence|claude|chatgpt|gpt-?\d*|codex|anthropic|openai|copilot|assistant|bot|automated|algorithm)\b/i;

function scanForProhibitedContent(fieldName: string, text: string, reasonCodes: string[]): void {
  if (secretLikePattern.test(text)) {
    reasonCodes.push(`evidence_may_contain_secret_${fieldName}`);
  }
  if (accountIdentifierLikePattern.test(text)) {
    reasonCodes.push(`evidence_may_contain_account_identifier_${fieldName}`);
  }
  if (rawPayloadLikePattern.test(text)) {
    reasonCodes.push(`evidence_looks_like_raw_payload_${fieldName}`);
  }
  if (requestHeaderLikePattern.test(text)) {
    reasonCodes.push(`evidence_may_contain_request_header_${fieldName}`);
  }
}

// ---------------------------------------------------------------------------
// Evidence record
// ---------------------------------------------------------------------------

/**
 * Result vocabulary for a single blocker's evidence, matching the four
 * result states already defined in
 * `docs/13_Compliance_and_Legal_Review.md` Section 5 ("Result states").
 * Note this is the result of the *evidence*, not the register's `Current
 * Status` field (`NOT_STARTED`, `EVIDENCE_PENDING`, `UNVERIFIED`,
 * `IN_REVIEW`, `BLOCKED`, `RESOLVED`) — this module never sets that field.
 */
export type LiveBlockerEvidenceResult = "APPROVED" | "APPROVED_WITH_LIMITATIONS" | "REJECTED" | "UNVERIFIED";

const liveBlockerEvidenceResults: readonly LiveBlockerEvidenceResult[] = Object.freeze([
  "APPROVED",
  "APPROVED_WITH_LIMITATIONS",
  "REJECTED",
  "UNVERIFIED"
]);

/**
 * Required verbatim attestation a human reviewer must type to move a record
 * from `READY_FOR_HUMAN_REVIEW` to `HUMAN_REVIEWED`. Mirrors
 * `REQUIRED_MANUAL_APPROVAL_ATTESTATION` in `small-capital-readiness.ts`: a
 * boolean flag is trivial for anyone (human or AI) to set without
 * meaningfully reviewing anything, so a verbatim string is required
 * instead. The attestation text itself states that this record does not
 * resolve the blocker, so a reviewer typing it cannot reasonably believe
 * they are doing more than summarizing evidence.
 */
export const REQUIRED_LIVE_BLOCKER_EVIDENCE_REVIEWER_ATTESTATION =
  "I am the named human reviewer for this blocker. I personally reviewed the " +
  "evidence source references above, they do not contain secrets, account " +
  "numbers, or raw broker payloads, and this record summarizes evidence only. " +
  "It does not resolve this blocker; only a human editing the canonical " +
  "blocker register can ever record a RESOLVED decision.";

/**
 * A single caller-supplied, sanitized evidence record for one live-capable
 * blocker. This codebase never constructs an instance of this type on a
 * human's behalf; it only validates the shape of one supplied by the
 * caller.
 */
export interface LiveBlockerEvidenceRecord {
  blockerId: LiveBlockerId;
  /**
   * Sanitized references to where the underlying evidence lives: a doc
   * path, a ticket id, an official source citation, a dated note. Never a
   * secret, account number, or raw broker payload. Must be non-empty.
   */
  evidenceSourceReferences: string[];
  /** Result recorded for this blocker's evidence, per `docs/13_Compliance_and_Legal_Review.md` Section 5. */
  result: LiveBlockerEvidenceResult;
  /**
   * Required, explicit statement of what this evidence does and does not
   * cover (for example "Covers KR market only, US market unverified", or
   * "None identified"). Must never be blank or omitted — an evidence record
   * with unstated limitations is exactly the kind of implicit "assume safe"
   * this module must not allow.
   */
  limitations: string;
  /** The human reviewer's own name, typed by them. Never a broker account identifier or secret. */
  humanReviewerName: string;
  /** The human reviewer's actual role (for example "Compliance/legal reviewer"). Never "AI" or "System". */
  humanReviewerRole: string;
  /** The date the human reviewer actually performed this review. */
  reviewDate: Date;
  /**
   * Optional AI-generated research summary attached for context only. This
   * field is never read by any check that decides `humanReviewed` status,
   * and its presence never substitutes for `humanReviewerName`,
   * `humanReviewerRole`, `reviewDate`, or `humanReviewerAttestation`.
   */
  aiGeneratedSummary?: string | undefined;
  /**
   * Explicit statement from whoever prepared this record: has a human
   * reviewer actually completed review and attested to it? `false` (or a
   * missing/mismatched `humanReviewerAttestation`) keeps the record at
   * `READY_FOR_HUMAN_REVIEW` at best, never `HUMAN_REVIEWED`.
   */
  humanReviewed: boolean;
  /** Must equal `REQUIRED_LIVE_BLOCKER_EVIDENCE_REVIEWER_ATTESTATION` verbatim to count as a genuine sign-off. */
  humanReviewerAttestation?: string | undefined;
}

/**
 * Status of a single evidence record. Deliberately does not include
 * `"RESOLVED"` — that value belongs only to
 * `docs/phase7/live-capable-blocker-register.md`, edited directly by a
 * human, never derived by this module.
 */
export type LiveBlockerEvidenceStatus = "REJECTED" | "READY_FOR_HUMAN_REVIEW" | "HUMAN_REVIEWED";

export interface LiveBlockerEvidenceRecordReview {
  blockerId: LiveBlockerId | undefined;
  status: LiveBlockerEvidenceStatus;
  reasonCodes: string[];
  warnings: string[];
  liveBrokerWriteAllowed: false;
  safetyType: "LIVE_BLOCKER_EVIDENCE_RECORD_REVIEW_ONLY";
}

const maxReviewAgeDaysBeforeStalenessWarning = 180;

function daysBetween(earlier: Date, later: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / 86_400_000);
}

/**
 * Validates the shape and content of a single `LiveBlockerEvidenceRecord`.
 * Pure: no I/O, no mutation of the input, no network calls.
 */
export class LiveBlockerEvidenceRecordValidator {
  review(record: LiveBlockerEvidenceRecord, now: Date = new Date()): LiveBlockerEvidenceRecordReview {
    const reasonCodes: string[] = [];
    const warnings: string[] = [];

    const knownBlockerId = (LIVE_BLOCKER_IDS as readonly string[]).includes(record.blockerId);
    if (!knownBlockerId) {
      reasonCodes.push("unknown_blocker_id");
    }

    // Evidence source references: required, non-empty, sanitized.
    if (!Array.isArray(record.evidenceSourceReferences) || record.evidenceSourceReferences.length === 0) {
      reasonCodes.push("missing_evidence_source_references");
    } else {
      record.evidenceSourceReferences.forEach((reference, index) => {
        if (!reference || reference.trim().length === 0) {
          reasonCodes.push(`empty_evidence_source_reference_${index}`);
          return;
        }
        scanForProhibitedContent(`evidence_source_reference_${index}`, reference, reasonCodes);
      });
    }

    // Result: required, must be one of the four allowed values.
    if (!record.result || !liveBlockerEvidenceResults.includes(record.result)) {
      reasonCodes.push("missing_or_invalid_result");
    }

    // Limitations: required, non-empty, sanitized.
    if (!record.limitations || record.limitations.trim().length === 0) {
      reasonCodes.push("missing_limitations");
    } else {
      scanForProhibitedContent("limitations", record.limitations, reasonCodes);
    }

    // Human reviewer name: required, non-empty, must not look AI-authored.
    if (!record.humanReviewerName || record.humanReviewerName.trim().length === 0) {
      reasonCodes.push("missing_human_reviewer_name");
    } else {
      scanForProhibitedContent("human_reviewer_name", record.humanReviewerName, reasonCodes);
      if (disallowedReviewerIdentityPattern.test(record.humanReviewerName)) {
        reasonCodes.push("human_reviewer_name_looks_non_human");
      }
    }

    // Human reviewer role: required, non-empty, must not look AI-authored.
    if (!record.humanReviewerRole || record.humanReviewerRole.trim().length === 0) {
      reasonCodes.push("missing_human_reviewer_role");
    } else {
      scanForProhibitedContent("human_reviewer_role", record.humanReviewerRole, reasonCodes);
      if (disallowedReviewerIdentityPattern.test(record.humanReviewerRole)) {
        reasonCodes.push("human_reviewer_role_looks_non_human");
      }
    }

    // Review date: required, valid, not in the future.
    let reviewDateValid = false;
    if (!record.reviewDate || Number.isNaN(record.reviewDate.getTime())) {
      reasonCodes.push("missing_or_invalid_review_date");
    } else if (record.reviewDate.getTime() > now.getTime()) {
      reasonCodes.push("review_date_in_future");
    } else {
      reviewDateValid = true;
      if (daysBetween(record.reviewDate, now) > maxReviewAgeDaysBeforeStalenessWarning) {
        warnings.push("review_date_stale_recommend_re_review");
      }
    }

    // AI-generated summary, if present, is scanned for prohibited content
    // (defense in depth) but never contributes to `humanReviewed` status.
    if (record.aiGeneratedSummary && record.aiGeneratedSummary.trim().length > 0) {
      scanForProhibitedContent("ai_generated_summary", record.aiGeneratedSummary, reasonCodes);
    }

    const hasBlockingIssues = reasonCodes.length > 0;

    let status: LiveBlockerEvidenceStatus;
    if (hasBlockingIssues) {
      status = "REJECTED";
    } else if (
      record.humanReviewed === true &&
      reviewDateValid &&
      record.humanReviewerAttestation === REQUIRED_LIVE_BLOCKER_EVIDENCE_REVIEWER_ATTESTATION
    ) {
      status = "HUMAN_REVIEWED";
    } else {
      status = "READY_FOR_HUMAN_REVIEW";
      if (record.humanReviewed === true) {
        // Caller claims human review happened but the attestation is
        // missing or does not match verbatim. This is not itself a
        // blocking reasonCode (the underlying evidence may still be
        // perfectly safe to show a reviewer), but it must never be
        // silently upgraded to HUMAN_REVIEWED, per Rule 29 ("do not
        // convert warnings into silent behavior").
        warnings.push("human_reviewed_claimed_but_attestation_missing_or_mismatched");
      }
    }

    return {
      blockerId: knownBlockerId ? record.blockerId : undefined,
      status,
      reasonCodes: [...new Set(reasonCodes)].sort(),
      warnings: [...new Set(warnings)].sort(),
      liveBrokerWriteAllowed: false,
      safetyType: "LIVE_BLOCKER_EVIDENCE_RECORD_REVIEW_ONLY"
    };
  }
}

// ---------------------------------------------------------------------------
// Register-level review (all 8 blockers)
// ---------------------------------------------------------------------------

/**
 * Per-blocker status inside a register-level review. Adds `MISSING` (no
 * evidence record supplied for this blocker) and `DUPLICATE` (more than one
 * record supplied for this blocker) to the single-record status vocabulary.
 * Still deliberately excludes `"RESOLVED"`.
 */
export type LiveBlockerEvidenceRegisterBlockerStatus = LiveBlockerEvidenceStatus | "MISSING" | "DUPLICATE";

export interface LiveBlockerEvidenceRegisterBlockerSummary {
  blockerId: LiveBlockerId;
  status: LiveBlockerEvidenceRegisterBlockerStatus;
  reasonCodes: string[];
  warnings: string[];
}

export interface LiveBlockerEvidenceRegisterInput {
  /** Evaluation time. Required; used for review-date and staleness checks. */
  now: Date;
  /** At most one evidence record per blocker id. */
  records: LiveBlockerEvidenceRecord[];
}

export interface LiveBlockerEvidenceRegisterReview {
  generatedAt: Date;
  /** Always exactly `LIVE_BLOCKER_IDS`, in that fixed order, even for a blocker with zero records. */
  blockers: LiveBlockerEvidenceRegisterBlockerSummary[];
  /** True only when every one of `LIVE_BLOCKER_IDS` has exactly one record supplied. */
  allBlockersRepresented: boolean;
  /** True only when every blocker's status is `HUMAN_REVIEWED`. */
  allBlockersHumanReviewed: boolean;
  reasonCodes: string[];
  warnings: string[];
  /**
   * Always literal `false`. No combination of evidence records, however
   * complete, can make this true. See module doc comment.
   */
  liveBrokerWriteAllowed: false;
  /**
   * Always literal `false`. This report never authorizes writing a
   * `RESOLVED` status into `docs/phase7/live-capable-blocker-register.md`,
   * no matter how many blockers read `HUMAN_REVIEWED` here. That decision
   * remains exclusively a human editing that file directly.
   */
  blockerRegisterResolutionAllowed: false;
  safetyType: "LIVE_BLOCKER_EVIDENCE_REGISTER_REVIEW_ONLY";
}

/**
 * Reviews sanitized evidence records for all eight live-capable blockers at
 * once. Pure: no I/O, no mutation of the input, no network calls, and no
 * write of any kind to `docs/phase7/live-capable-blocker-register.md`.
 */
export class LiveBlockerEvidenceRegisterReviewer {
  review(input: LiveBlockerEvidenceRegisterInput): LiveBlockerEvidenceRegisterReview {
    const recordValidator = new LiveBlockerEvidenceRecordValidator();
    const reasonCodes: string[] = [];
    const warnings: string[] = [];

    const recordsByBlockerId = new Map<LiveBlockerId, LiveBlockerEvidenceRecord[]>();
    for (const record of input.records) {
      if (!(LIVE_BLOCKER_IDS as readonly string[]).includes(record.blockerId)) {
        // Unknown blocker ids are reported once at the top level; the
        // per-blocker loop below only ever iterates the known 8 ids, so an
        // unknown id would otherwise be silently dropped from the summary.
        reasonCodes.push(`unknown_blocker_id_in_register_input_${String(record.blockerId)}`);
        continue;
      }
      const existing = recordsByBlockerId.get(record.blockerId) ?? [];
      existing.push(record);
      recordsByBlockerId.set(record.blockerId, existing);
    }

    const blockers: LiveBlockerEvidenceRegisterBlockerSummary[] = LIVE_BLOCKER_IDS.map((blockerId) => {
      const matching = recordsByBlockerId.get(blockerId) ?? [];

      if (matching.length === 0) {
        const blockerReasonCode = `missing_blocker_evidence_${blockerId}`;
        reasonCodes.push(blockerReasonCode);
        return {
          blockerId,
          status: "MISSING" as const,
          reasonCodes: [blockerReasonCode],
          warnings: []
        };
      }

      if (matching.length > 1) {
        const blockerReasonCode = `duplicate_blocker_evidence_${blockerId}`;
        reasonCodes.push(blockerReasonCode);
        return {
          blockerId,
          status: "DUPLICATE" as const,
          reasonCodes: [blockerReasonCode],
          warnings: []
        };
      }

      const record = matching[0];
      if (!record) {
        // Unreachable given the length check above; satisfies
        // noUncheckedIndexedAccess without weakening the check itself.
        const blockerReasonCode = `missing_blocker_evidence_${blockerId}`;
        reasonCodes.push(blockerReasonCode);
        return {
          blockerId,
          status: "MISSING" as const,
          reasonCodes: [blockerReasonCode],
          warnings: []
        };
      }

      const review = recordValidator.review(record, input.now);
      if (review.status === "REJECTED") {
        reasonCodes.push(...review.reasonCodes.map((code) => `${blockerId}_${code}`));
      }
      warnings.push(...review.warnings.map((code) => `${blockerId}_${code}`));

      return {
        blockerId,
        status: review.status,
        reasonCodes: review.reasonCodes,
        warnings: review.warnings
      };
    });

    const allBlockersRepresented = blockers.every((summary) => summary.status !== "MISSING" && summary.status !== "DUPLICATE");
    const allBlockersHumanReviewed = blockers.every((summary) => summary.status === "HUMAN_REVIEWED");

    return {
      generatedAt: input.now,
      blockers,
      allBlockersRepresented,
      allBlockersHumanReviewed,
      reasonCodes: [...new Set(reasonCodes)].sort(),
      warnings: [...new Set(warnings)].sort(),
      liveBrokerWriteAllowed: false,
      blockerRegisterResolutionAllowed: false,
      safetyType: "LIVE_BLOCKER_EVIDENCE_REGISTER_REVIEW_ONLY"
    };
  }
}
