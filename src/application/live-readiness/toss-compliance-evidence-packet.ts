/**
 * Phase 10 round 2 (P10-005): Toss and compliance evidence packet.
 *
 * This module is a PURE validator. It has no network code, no filesystem
 * access, no broker client, and no side effects of any kind. It never calls
 * Toss, never fetches an official terms document, and never enables live
 * trading.
 *
 * It exists to give `LCB-001` ("Toss automated trading permission evidence")
 * and `LCB-005` ("Compliance/legal approval evidence") — both described in
 * `docs/phase7/live-capable-blocker-register.md` and grouped together as the
 * "Toss/compliance packet" in `docs/phase10/human-blocker-evidence-workbook.md`
 * — a single, machine-checkable, sanitized evidence packet shape: a human
 * compliance/legal reviewer can hand this module a candidate packet record
 * and get back whether the record is shaped safely (no secrets, no
 * account-identifier-like content, no raw payloads, every required
 * human-reviewer field present) and whether it is currently structurally
 * complete.
 *
 * What this module deliberately cannot do, by construction:
 *
 * - It cannot mark `LCB-001` or `LCB-005` `RESOLVED`. `RESOLVED` is a status
 *   value that belongs exclusively to
 *   `docs/phase7/live-capable-blocker-register.md`, set only by a human
 *   editing that file directly. The literal string `"RESOLVED"` does not
 *   appear anywhere in this module's decision vocabulary
 *   (`TossCompliancePacketDecision`) or in any value this module can return.
 *   This module never writes to, and never even references a writable path
 *   for, that register file.
 * - It cannot accept AI-generated text as a substitute for human review.
 *   `TossCompliancePacketRecord.aiGeneratedSummary` is a distinct, optional
 *   field this module never reads when deciding `structurallyComplete` or
 *   `humanReviewAttested`; only `humanReviewerName`, `humanReviewerRole`,
 *   `reviewDate`, and a verbatim `reviewerAttestation` (mirroring
 *   `REQUIRED_LIVE_BLOCKER_EVIDENCE_REVIEWER_ATTESTATION` in
 *   `live-blocker-evidence-intake.ts`) can satisfy a `HUMAN_REVIEWED_*`
 *   decision.
 * - It cannot be satisfied by secret-like, account-number-like, or raw
 *   broker-payload-like content. Every free-text field on a record is
 *   scanned; any match is a blocking `reasonCode`, never a warning.
 * - It cannot fetch, browse, or call Toss, or any other network endpoint.
 *   The only function this module exports is `TossCompliancePacketValidator`
 *   (a class) plus plain, frozen data; there is no `fetch`, HTTP client, or
 *   broker adapter import anywhere in this file.
 * - It fails closed: a missing required field, an invalid decision value, a
 *   claimed-but-unattested human review, or an incomplete compliance review
 *   scope is always treated as not-structurally-complete, never as "assume
 *   fine."
 */

import { LIVE_BLOCKER_CATALOG, type LiveBlockerId } from "./live-blocker-evidence-intake.js";

// ---------------------------------------------------------------------------
// Fixed scope: this packet always covers exactly LCB-001 and LCB-005.
// ---------------------------------------------------------------------------

export const TOSS_COMPLIANCE_PACKET_COVERED_BLOCKER_IDS = Object.freeze(["LCB-001", "LCB-005"] as const);
export type TossCompliancePacketCoveredBlockerId = (typeof TOSS_COMPLIANCE_PACKET_COVERED_BLOCKER_IDS)[number];

/** Informational metadata only, reused read-only from the Phase 9 blocker catalog. Never mutated. */
export const TOSS_COMPLIANCE_PACKET_BLOCKER_CATALOG = Object.freeze({
  "LCB-001": LIVE_BLOCKER_CATALOG["LCB-001"],
  "LCB-005": LIVE_BLOCKER_CATALOG["LCB-005"]
});

// ---------------------------------------------------------------------------
// Prohibited-content checks (self-contained; mirrors the discipline already
// established by live-blocker-evidence-intake.ts and
// src/application/toss/read-only-evidence-intake.ts, duplicated locally so
// this module has no dependency on another module's private internals).
// ---------------------------------------------------------------------------

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
 * obvious way an AI-generated approval could be passed off as human review.
 */
const disallowedReviewerIdentityPattern =
  /\b(ai|artificial[\s-]?intelligence|claude|chatgpt|gpt-?\d*|codex|anthropic|openai|copilot|assistant|bot|automated|algorithm)\b/i;

function scanForProhibitedContent(fieldName: string, text: string, reasonCodes: string[]): void {
  if (secretLikePattern.test(text)) {
    reasonCodes.push(`packet_may_contain_secret_${fieldName}`);
  }
  if (accountIdentifierLikePattern.test(text)) {
    reasonCodes.push(`packet_may_contain_account_identifier_${fieldName}`);
  }
  if (rawPayloadLikePattern.test(text)) {
    reasonCodes.push(`packet_looks_like_raw_payload_${fieldName}`);
  }
  if (requestHeaderLikePattern.test(text)) {
    reasonCodes.push(`packet_may_contain_request_header_${fieldName}`);
  }
}

// ---------------------------------------------------------------------------
// Toss automated trading permission evidence (LCB-001)
// ---------------------------------------------------------------------------

/**
 * Result vocabulary for the Toss automated trading permission evidence,
 * matching `docs/13_Compliance_and_Legal_Review.md` Section 5 ("Result
 * states") and `docs/phase7/live-capable-blocker-register.md` LCB-001.
 */
export const TOSS_AUTOMATED_TRADING_PERMISSION_RESULTS = Object.freeze([
  "APPROVED",
  "APPROVED_WITH_LIMITATIONS",
  "REJECTED",
  "UNVERIFIED"
] as const);
export type TossAutomatedTradingPermissionResult = (typeof TOSS_AUTOMATED_TRADING_PERMISSION_RESULTS)[number];

export const TOSS_MODE_DISTINCTION_VALUES = Object.freeze(["YES", "NO", "UNKNOWN"] as const);
export type TossModeDistinctionValue = (typeof TOSS_MODE_DISTINCTION_VALUES)[number];

/**
 * Sanitized evidence for LCB-001. Never accepts raw contract text containing
 * personal information, API keys, or account numbers — only citations,
 * clause summaries, and a four-value result.
 */
export interface TossAutomatedTradingPermissionEvidence {
  /** Per `docs/13_Compliance_and_Legal_Review.md` Section 5. Default is `UNVERIFIED`, never assumed favorable. */
  result: TossAutomatedTradingPermissionResult;
  /**
   * Sanitized citations: an official Toss API terms-of-use clause reference,
   * a developer console capability description reference, or a written
   * support/account-manager confirmation reference (e.g. a ticket id and
   * date). Never the full contract text itself, never a raw payload. Must
   * be non-empty.
   */
  sourceReferences: string[];
  /**
   * Whether the evidence gathered distinguishes manual API use, algorithmic
   * trading, and fully unattended/cloud-hosted trading, per the LCB-001
   * required-evidence-type question in the blocker register. `"UNKNOWN"` is
   * the honest default when the source material does not make this
   * distinction explicit.
   */
  distinguishesAutomatedTradingModes: TossModeDistinctionValue;
  /** Required, sanitized free-text summary of what the evidence says. Never blank. */
  notes: string;
}

// ---------------------------------------------------------------------------
// Compliance/legal review scope (LCB-005)
// ---------------------------------------------------------------------------

/**
 * The seven review items listed in `docs/13_Compliance_and_Legal_Review.md`
 * Section 9 ("Compliance Gate for Live Trading"). Per that section: "If any
 * item is UNVERIFIED, live broker writes remain blocked."
 */
export const COMPLIANCE_REVIEW_SCOPE_ITEM_IDS = Object.freeze([
  "toss_api_terms_reviewed",
  "broker_account_permissions_reviewed",
  "data_licensing_reviewed",
  "ai_data_handling_reviewed",
  "tax_recording_assumptions_documented",
  "personal_use_boundary_confirmed",
  "operator_accepts_residual_risk"
] as const);
export type ComplianceReviewScopeItemId = (typeof COMPLIANCE_REVIEW_SCOPE_ITEM_IDS)[number];

export interface ComplianceReviewScopeItemRecord {
  itemId: ComplianceReviewScopeItemId;
  /** `true` only if this specific item has actually been reviewed by the human reviewer. */
  reviewed: boolean;
  /** Required, sanitized note describing the review outcome for this item. Never blank. */
  note: string;
}

// ---------------------------------------------------------------------------
// Decision vocabulary
// ---------------------------------------------------------------------------

/**
 * Allowed decision values for this packet, verbatim from
 * `docs/phase10/human-blocker-evidence-workbook.md` ("Suggested Decisions").
 * `RESOLVED` is deliberately excluded — see module doc comment.
 */
export const TOSS_COMPLIANCE_PACKET_DECISIONS = Object.freeze([
  "READY_FOR_HUMAN_REVIEW",
  "HUMAN_REVIEWED_APPROVED_WITH_LIMITATIONS",
  "HUMAN_REVIEWED_REJECTED",
  "HUMAN_REVIEWED_UNVERIFIED",
  "NEEDS_MORE_EVIDENCE"
] as const);
export type TossCompliancePacketDecision = (typeof TOSS_COMPLIANCE_PACKET_DECISIONS)[number];

// ---------------------------------------------------------------------------
// Reviewer attestation and not-authorization statement
// ---------------------------------------------------------------------------

/**
 * Required verbatim attestation a human reviewer must type for a
 * `HUMAN_REVIEWED_*` decision to be treated as attested. Mirrors
 * `REQUIRED_LIVE_BLOCKER_EVIDENCE_REVIEWER_ATTESTATION`: a bare decision
 * string is trivial for anyone (human or AI) to set without meaningfully
 * reviewing anything, so a verbatim string is required instead.
 */
export const REQUIRED_TOSS_COMPLIANCE_PACKET_REVIEWER_ATTESTATION =
  "I am the named human reviewer for this Toss/compliance evidence packet covering LCB-001 and " +
  "LCB-005. I personally reviewed the evidence source references above, confirmed they contain no " +
  "secrets, account numbers, or raw broker payloads, and this record summarizes evidence only. It " +
  "does not resolve LCB-001 or LCB-005; only a human editing " +
  "docs/phase7/live-capable-blocker-register.md directly, following that file's own rules, can ever " +
  "record a RESOLVED decision. This packet is not authorization to begin live trading.";

/** Included verbatim on every review this module produces. */
export const TOSS_COMPLIANCE_PACKET_NOT_AUTHORIZATION_STATEMENT =
  "This packet is sanitized evidence only. It does not authorize live trading, does not resolve " +
  "LCB-001 or LCB-005, and does not modify docs/phase7/live-capable-blocker-register.md. Only a " +
  "human reviewer editing that register directly, following its own rules, can ever mark a blocker " +
  "RESOLVED.";

// ---------------------------------------------------------------------------
// Packet record and review
// ---------------------------------------------------------------------------

/**
 * A single caller-supplied, sanitized Toss/compliance evidence packet
 * record. This codebase never constructs an instance of this type on a
 * human's behalf; it only validates the shape of one supplied by the
 * caller.
 */
export interface TossCompliancePacketRecord {
  /** A short, sanitized identifier for this packet (e.g. "toss-compliance-2026-07"). Never a secret or account identifier. */
  packetId: string;
  /** Must be exactly `["LCB-001", "LCB-005"]` (order-independent, no duplicates, no extras). */
  coveredBlockerIds: LiveBlockerId[];
  /** LCB-001 evidence. */
  tossPermission: TossAutomatedTradingPermissionEvidence;
  /** LCB-005 evidence: exactly the seven `COMPLIANCE_REVIEW_SCOPE_ITEM_IDS`, each supplied exactly once. */
  complianceReviewScope: ComplianceReviewScopeItemRecord[];
  /**
   * Sanitized references to the compliance/legal source documents reviewed
   * (per `docs/13_Compliance_and_Legal_Review.md` Section 10, "source
   * documents reviewed"). Never the documents themselves.
   */
  complianceSourceDocumentsReviewed: string[];
  /**
   * Required system restrictions that must hold if this evidence supports a
   * limitations-bearing approval (per Section 10, "required system
   * restrictions"), e.g. "limit orders only", "KR market only". Must be
   * non-empty.
   */
  requiredSystemRestrictions: string[];
  /** Required, explicit statement of what this evidence does and does not cover. Never blank. */
  limitations: string;
  /** The date the human reviewer actually performed this review. Must not be in the future. */
  reviewDate: Date;
  /** Expiration / next review date (Section 10). Must be a valid date strictly after `reviewDate`. */
  nextReviewDate: Date;
  /** The human reviewer's own name, typed by them. Never a broker account identifier or secret. */
  humanReviewerName: string;
  /** The human reviewer's actual role (for example "Compliance/legal reviewer"). Never "AI" or "System". */
  humanReviewerRole: string;
  /** The reviewer's own decision. Must be one of `TOSS_COMPLIANCE_PACKET_DECISIONS`. Never `RESOLVED`. */
  decision: TossCompliancePacketDecision;
  /**
   * Explicit human confirmation that the reviewer personally checked this
   * record for secrets, account identifiers, raw broker payloads, and raw
   * contract text with personal information before submitting it. This is
   * in addition to, not a substitute for, this module's own automatic
   * scanning.
   */
  prohibitedContentConfirmed: boolean;
  /** Must equal `REQUIRED_TOSS_COMPLIANCE_PACKET_REVIEWER_ATTESTATION` verbatim for a `HUMAN_REVIEWED_*` decision to be attested. */
  reviewerAttestation?: string | undefined;
  /**
   * Optional AI-generated research summary attached for context only. Never
   * read by any check that decides `structurallyComplete`,
   * `humanReviewAttested`, or `decision` validity.
   */
  aiGeneratedSummary?: string | undefined;
}

export interface TossCompliancePacketReview {
  packetId: string | undefined;
  coveredBlockerIds: readonly TossCompliancePacketCoveredBlockerId[];
  /** The caller-supplied decision if valid, otherwise the literal `"INVALID"`. Never `"RESOLVED"`. */
  decision: TossCompliancePacketDecision | "INVALID";
  /** `true` only when every required field is present, sanitized, internally consistent, and (if claimed) attested. */
  structurallyComplete: boolean;
  /** `true` when `decision` is one of the `HUMAN_REVIEWED_*` values. */
  humanReviewClaimed: boolean;
  /** `true` only when `reviewerAttestation` matches `REQUIRED_TOSS_COMPLIANCE_PACKET_REVIEWER_ATTESTATION` verbatim. */
  humanReviewAttested: boolean;
  /** `true` only when all seven `COMPLIANCE_REVIEW_SCOPE_ITEM_IDS` are present, valid, and each individually `reviewed: true`. */
  complianceScopeFullyReviewed: boolean;
  blockingReasonCodes: string[];
  warnings: string[];
  /** Always literal `false`. No combination of packet fields, however complete, can make this true. */
  liveBrokerWriteAllowed: false;
  /** Always literal `false`. This review never writes, and never authorizes writing, `RESOLVED` into the canonical register. */
  blockerRegisterResolutionAllowed: false;
  notLiveTradingAuthorizationStatement: string;
  safetyType: "TOSS_COMPLIANCE_EVIDENCE_PACKET_REVIEW_ONLY";
}

const maxReviewAgeDaysBeforeStalenessWarning = 180;

function daysBetween(earlier: Date, later: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / 86_400_000);
}

function isKnownDecision(value: unknown): value is TossCompliancePacketDecision {
  return typeof value === "string" && (TOSS_COMPLIANCE_PACKET_DECISIONS as readonly string[]).includes(value);
}

/**
 * Validates the shape and content of a single `TossCompliancePacketRecord`.
 * Pure: no I/O, no mutation of the input, no network calls, no Toss call of
 * any kind.
 */
export class TossCompliancePacketValidator {
  review(record: TossCompliancePacketRecord, now: Date = new Date()): TossCompliancePacketReview {
    const reasonCodes: string[] = [];
    const warnings: string[] = [];

    // packetId
    let packetIdValid = false;
    if (!record.packetId || record.packetId.trim().length === 0) {
      reasonCodes.push("missing_packet_id");
    } else {
      packetIdValid = true;
      scanForProhibitedContent("packet_id", record.packetId, reasonCodes);
    }

    // coveredBlockerIds: must be exactly {LCB-001, LCB-005}, no more, no less, no duplicates.
    const expected = [...TOSS_COMPLIANCE_PACKET_COVERED_BLOCKER_IDS].sort();
    const covered = Array.isArray(record.coveredBlockerIds) ? [...new Set(record.coveredBlockerIds)].sort() : [];
    const coveredMatchesScope =
      Array.isArray(record.coveredBlockerIds) &&
      record.coveredBlockerIds.length === new Set(record.coveredBlockerIds).size &&
      covered.length === expected.length &&
      covered.every((id, index) => id === expected[index]);
    if (!coveredMatchesScope) {
      reasonCodes.push("covered_blocker_ids_do_not_match_toss_compliance_packet_scope");
    }

    // tossPermission (LCB-001)
    let tossPermissionApproved = false;
    let tossPermissionRejectedOrUnverified = false;
    if (!record.tossPermission) {
      reasonCodes.push("missing_toss_permission_evidence");
    } else {
      const permission = record.tossPermission;
      if (
        !permission.result ||
        !(TOSS_AUTOMATED_TRADING_PERMISSION_RESULTS as readonly string[]).includes(permission.result)
      ) {
        reasonCodes.push("missing_or_invalid_toss_permission_result");
      } else {
        tossPermissionApproved = permission.result === "APPROVED" || permission.result === "APPROVED_WITH_LIMITATIONS";
        tossPermissionRejectedOrUnverified = permission.result === "REJECTED" || permission.result === "UNVERIFIED";
      }

      if (!Array.isArray(permission.sourceReferences) || permission.sourceReferences.length === 0) {
        reasonCodes.push("missing_toss_permission_source_references");
      } else {
        permission.sourceReferences.forEach((reference, index) => {
          if (!reference || reference.trim().length === 0) {
            reasonCodes.push(`empty_toss_permission_source_reference_${index}`);
            return;
          }
          scanForProhibitedContent(`toss_permission_source_reference_${index}`, reference, reasonCodes);
        });
      }

      if (
        !permission.distinguishesAutomatedTradingModes ||
        !(TOSS_MODE_DISTINCTION_VALUES as readonly string[]).includes(permission.distinguishesAutomatedTradingModes)
      ) {
        reasonCodes.push("missing_or_invalid_toss_permission_mode_distinction");
      }

      if (!permission.notes || permission.notes.trim().length === 0) {
        reasonCodes.push("missing_toss_permission_notes");
      } else {
        scanForProhibitedContent("toss_permission_notes", permission.notes, reasonCodes);
      }
    }

    // complianceReviewScope (LCB-005)
    let complianceScopeFullyReviewed = false;
    if (!Array.isArray(record.complianceReviewScope) || record.complianceReviewScope.length === 0) {
      reasonCodes.push("missing_compliance_review_scope");
    } else {
      const seenItemIds = new Set<string>();
      for (const item of record.complianceReviewScope) {
        const itemId = item?.itemId;
        if (!itemId || !(COMPLIANCE_REVIEW_SCOPE_ITEM_IDS as readonly string[]).includes(itemId)) {
          reasonCodes.push(`unknown_compliance_review_scope_item_${String(itemId)}`);
          continue;
        }
        if (seenItemIds.has(itemId)) {
          reasonCodes.push(`duplicate_compliance_review_scope_item_${itemId}`);
          continue;
        }
        seenItemIds.add(itemId);

        if (typeof item.reviewed !== "boolean") {
          reasonCodes.push(`compliance_review_scope_item_reviewed_not_boolean_${itemId}`);
        }
        if (!item.note || item.note.trim().length === 0) {
          reasonCodes.push(`missing_compliance_review_scope_item_note_${itemId}`);
        } else {
          scanForProhibitedContent(`compliance_review_scope_item_note_${itemId}`, item.note, reasonCodes);
        }
      }
      for (const requiredItemId of COMPLIANCE_REVIEW_SCOPE_ITEM_IDS) {
        if (!seenItemIds.has(requiredItemId)) {
          reasonCodes.push(`missing_compliance_review_scope_item_${requiredItemId}`);
        }
      }
      complianceScopeFullyReviewed =
        seenItemIds.size === COMPLIANCE_REVIEW_SCOPE_ITEM_IDS.length &&
        record.complianceReviewScope.every((item) => item.reviewed === true);
    }

    // complianceSourceDocumentsReviewed
    if (
      !Array.isArray(record.complianceSourceDocumentsReviewed) ||
      record.complianceSourceDocumentsReviewed.length === 0
    ) {
      reasonCodes.push("missing_compliance_source_documents_reviewed");
    } else {
      record.complianceSourceDocumentsReviewed.forEach((reference, index) => {
        if (!reference || reference.trim().length === 0) {
          reasonCodes.push(`empty_compliance_source_document_reference_${index}`);
          return;
        }
        scanForProhibitedContent(`compliance_source_document_reference_${index}`, reference, reasonCodes);
      });
    }

    // requiredSystemRestrictions
    if (!Array.isArray(record.requiredSystemRestrictions) || record.requiredSystemRestrictions.length === 0) {
      reasonCodes.push("missing_required_system_restrictions");
    } else {
      record.requiredSystemRestrictions.forEach((restriction, index) => {
        if (!restriction || restriction.trim().length === 0) {
          reasonCodes.push(`empty_required_system_restriction_${index}`);
          return;
        }
        scanForProhibitedContent(`required_system_restriction_${index}`, restriction, reasonCodes);
      });
    }

    // limitations
    if (!record.limitations || record.limitations.trim().length === 0) {
      reasonCodes.push("missing_limitations");
    } else {
      scanForProhibitedContent("limitations", record.limitations, reasonCodes);
    }

    // reviewDate
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

    // nextReviewDate
    if (!record.nextReviewDate || Number.isNaN(record.nextReviewDate.getTime())) {
      reasonCodes.push("missing_or_invalid_next_review_date");
    } else if (reviewDateValid && record.nextReviewDate.getTime() <= record.reviewDate.getTime()) {
      reasonCodes.push("next_review_date_not_after_review_date");
    } else if (record.nextReviewDate.getTime() <= now.getTime()) {
      warnings.push("next_review_date_has_passed_recommend_re_review");
    }

    // humanReviewerName
    if (!record.humanReviewerName || record.humanReviewerName.trim().length === 0) {
      reasonCodes.push("missing_human_reviewer_name");
    } else {
      scanForProhibitedContent("human_reviewer_name", record.humanReviewerName, reasonCodes);
      if (disallowedReviewerIdentityPattern.test(record.humanReviewerName)) {
        reasonCodes.push("human_reviewer_name_looks_non_human");
      }
    }

    // humanReviewerRole
    if (!record.humanReviewerRole || record.humanReviewerRole.trim().length === 0) {
      reasonCodes.push("missing_human_reviewer_role");
    } else {
      scanForProhibitedContent("human_reviewer_role", record.humanReviewerRole, reasonCodes);
      if (disallowedReviewerIdentityPattern.test(record.humanReviewerRole)) {
        reasonCodes.push("human_reviewer_role_looks_non_human");
      }
    }

    // prohibitedContentConfirmed
    if (record.prohibitedContentConfirmed !== true) {
      reasonCodes.push("missing_prohibited_content_confirmation");
    }

    // decision
    const decisionValid = isKnownDecision(record.decision);
    if (!decisionValid) {
      reasonCodes.push("missing_or_invalid_decision");
    }

    const humanReviewClaimed = decisionValid && record.decision.startsWith("HUMAN_REVIEWED_");
    const humanReviewAttested = record.reviewerAttestation === REQUIRED_TOSS_COMPLIANCE_PACKET_REVIEWER_ATTESTATION;

    if (humanReviewClaimed && !humanReviewAttested) {
      reasonCodes.push("decision_claims_human_reviewed_but_attestation_missing_or_mismatched");
    }

    // Internal consistency: an "approved with limitations" decision requires
    // the underlying LCB-001 and LCB-005 evidence to actually support it.
    // This never upgrades a decision toward approval; it only ever adds a
    // blocking reasonCode when the reviewer's own decision is inconsistent
    // with the evidence they supplied.
    if (decisionValid && record.decision === "HUMAN_REVIEWED_APPROVED_WITH_LIMITATIONS") {
      if (!complianceScopeFullyReviewed) {
        reasonCodes.push("decision_approved_but_compliance_scope_incomplete");
      }
      if (tossPermissionRejectedOrUnverified || !tossPermissionApproved) {
        reasonCodes.push("decision_approved_but_toss_permission_not_approved");
      }
    }

    // aiGeneratedSummary: scanned for defense in depth, never contributes to
    // structural completeness either way.
    if (record.aiGeneratedSummary && record.aiGeneratedSummary.trim().length > 0) {
      scanForProhibitedContent("ai_generated_summary", record.aiGeneratedSummary, reasonCodes);
    }

    const uniqueReasonCodes = [...new Set(reasonCodes)].sort();
    const structurallyComplete = uniqueReasonCodes.length === 0;

    return Object.freeze({
      packetId: packetIdValid ? record.packetId : undefined,
      coveredBlockerIds: TOSS_COMPLIANCE_PACKET_COVERED_BLOCKER_IDS,
      decision: decisionValid ? record.decision : "INVALID",
      structurallyComplete,
      humanReviewClaimed,
      humanReviewAttested,
      complianceScopeFullyReviewed,
      blockingReasonCodes: uniqueReasonCodes,
      warnings: [...new Set(warnings)].sort(),
      liveBrokerWriteAllowed: false,
      blockerRegisterResolutionAllowed: false,
      notLiveTradingAuthorizationStatement: TOSS_COMPLIANCE_PACKET_NOT_AUTHORIZATION_STATEMENT,
      safetyType: "TOSS_COMPLIANCE_EVIDENCE_PACKET_REVIEW_ONLY"
    });
  }
}
