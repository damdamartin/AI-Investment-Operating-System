/**
 * Phase 10 round 2 (P10-008): live-safety review evidence packet for
 * `LCB-007` (kill-switch and rollback evidence, live context) and
 * `LCB-008` (real broker write adapter review evidence).
 *
 * This module is a PURE validator/checklist. It has no network code, no
 * filesystem access, no broker client, and no side effects of any kind. It
 * never constructs, submits, cancels, or replaces a broker order, and it
 * never enables live trading.
 *
 * It exists to give a human "engineering safety reviewer" and an
 * independent "senior engineer / independent code reviewer"
 * (`docs/phase7/live-capable-blocker-register.md`, LCB-007 and LCB-008
 * "Human Owner / Reviewer Role" fields) a machine-checkable, sanitized
 * evidence packet shape: a human can hand this module a candidate evidence
 * record for each blocker and get back whether the record is shaped safely
 * (no secrets, no account-identifier-like content, no raw payloads, every
 * required field present) and what decision value it currently reflects.
 *
 * What this module deliberately cannot do, by construction:
 *
 * - It cannot mark `LCB-007` or `LCB-008` `RESOLVED`. `RESOLVED` is a status
 *   value that belongs exclusively to
 *   `docs/phase7/live-capable-blocker-register.md`, and the literal string
 *   `"RESOLVED"` is not a member of `LiveSafetyReviewDecision` (see
 *   `docs/phase10/human-blocker-evidence-workbook.md`, "Suggested
 *   Decisions" — this module uses exactly that five-value vocabulary and no
 *   other). Every free-text field this module accepts is additionally
 *   scanned for the literal word "resolved" as defense in depth, so a
 *   reviewer cannot smuggle a resolution claim through prose either.
 * - It cannot accept a claim that a real `TossSecuritiesAdapter` write
 *   implementation already exists. `LCB-008` remains structurally `BLOCKED`
 *   in the canonical register until a later, separately scoped
 *   implementation phase produces a reviewable adapter
 *   (`docs/phase7/live-capable-blocker-register.md`, LCB-008). This module
 *   requires `adapterExistsYet === false` and fails closed otherwise.
 * - It cannot approve future write-adapter code on a human's behalf. It only
 *   checks that the record a human filled in states the *prerequisites* for
 *   an independent review (acceptance-criteria reference, reviewer
 *   independence from the implementer) — it never performs that review
 *   itself.
 * - It cannot be satisfied by secret-like, account-number-like, or raw
 *   broker-payload-like content. Every free-text field on a record is
 *   scanned; any match is a blocking `reasonCode`, never a warning.
 * - It fails closed: a missing required field, an unknown/invalid decision
 *   value, or a missing blocker record is always treated as not-ready,
 *   never as "assume fine."
 */

// ---------------------------------------------------------------------------
// Blocker catalog
// ---------------------------------------------------------------------------

/**
 * The two live-capable blockers this packet covers, in the same order and
 * with the same identifiers as
 * `docs/phase7/live-capable-blocker-register.md` and
 * `docs/phase10/human-blocker-evidence-workbook.md`'s "Live-safety/review
 * packet" row.
 */
export const LIVE_SAFETY_REVIEW_PACKET_BLOCKER_IDS = Object.freeze(["LCB-007", "LCB-008"] as const);
export type LiveSafetyReviewPacketBlockerId = (typeof LIVE_SAFETY_REVIEW_PACKET_BLOCKER_IDS)[number];

// ---------------------------------------------------------------------------
// Decision vocabulary (workbook-defined, do not extend)
// ---------------------------------------------------------------------------

/**
 * The only decision values this module (or any Phase 10 round 2 evidence
 * packet) may use, per
 * `docs/phase10/human-blocker-evidence-workbook.md`, "Suggested Decisions".
 * `"RESOLVED"` is intentionally excluded — it belongs only to
 * `docs/phase7/live-capable-blocker-register.md`, edited directly by a
 * human, never derived by this module.
 */
export const LIVE_SAFETY_REVIEW_DECISIONS = Object.freeze([
  "READY_FOR_HUMAN_REVIEW",
  "HUMAN_REVIEWED_APPROVED_WITH_LIMITATIONS",
  "HUMAN_REVIEWED_REJECTED",
  "HUMAN_REVIEWED_UNVERIFIED",
  "NEEDS_MORE_EVIDENCE"
] as const);
export type LiveSafetyReviewDecision = (typeof LIVE_SAFETY_REVIEW_DECISIONS)[number];

/**
 * Decisions that represent a completed human review (as opposed to
 * evidence still being assembled). Used only to decide whether the
 * blocker-specific completeness checks below (full rollback rehearsal for
 * LCB-007, confirmed acceptance-criteria reference for LCB-008) are
 * enforced as blocking.
 */
const humanReviewedDecisions: readonly LiveSafetyReviewDecision[] = Object.freeze([
  "HUMAN_REVIEWED_APPROVED_WITH_LIMITATIONS",
  "HUMAN_REVIEWED_REJECTED",
  "HUMAN_REVIEWED_UNVERIFIED"
]);

// ---------------------------------------------------------------------------
// Prohibited-content checks
// ---------------------------------------------------------------------------

/**
 * Matches text that looks like a secret: tokens, client/app secrets, API
 * keys, authorization headers, bearer values, passwords, private keys.
 * Mirrors the discipline already established by
 * `src/application/live-readiness/live-blocker-evidence-intake.ts`.
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
 * to be an AI/automated system rather than a human.
 */
const disallowedReviewerIdentityPattern =
  /\b(ai|artificial[\s-]?intelligence|claude|chatgpt|gpt-?\d*|codex|anthropic|openai|copilot|assistant|bot|automated|algorithm)\b/i;

/**
 * Matches the literal word "resolved", case-insensitively. This module's
 * own decision vocabulary never contains this word as a substring (see
 * `LIVE_SAFETY_REVIEW_DECISIONS`), but a human reviewer's free-text fields
 * (limitations, stop criteria, evidence references) could still contain it
 * by accident or by attempting to declare the blocker resolved in prose.
 * Any such match is blocking, defense in depth on top of the register
 * file's own rule that only a human editing that file directly may ever
 * record `RESOLVED`.
 */
const resolvedClaimPattern = /\bresolved\b/i;

/** Matches obvious placeholder text that is not a genuine description. */
const placeholderTextPattern = /^(tbd|n\/?a|todo|unknown|none|pending|\.+|-+)$/i;

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
  if (resolvedClaimPattern.test(text)) {
    reasonCodes.push(`evidence_contains_resolved_claim_${fieldName}`);
  }
}

// ---------------------------------------------------------------------------
// Shared per-blocker fields
// ---------------------------------------------------------------------------

interface LiveSafetyReviewBaseRecord {
  /**
   * Sanitized references to where the underlying evidence lives: a doc
   * path, a test file, a rehearsal log entry id, a dated note. Never a
   * secret, account number, or raw broker payload. Must be non-empty.
   */
  evidenceSourceReferences: string[];
  /** Must be one of `LIVE_SAFETY_REVIEW_DECISIONS`. Never `"RESOLVED"`. */
  decision: LiveSafetyReviewDecision;
  /**
   * Required, explicit statement of what this evidence does and does not
   * cover. Must never be blank, and must never be a placeholder like
   * "TBD" or "unknown" — an unstated limitation is exactly the kind of
   * implicit "assume safe" this module must not allow.
   */
  limitations: string;
  /** The human reviewer's own name, typed by them. Never a broker account identifier or secret. */
  humanReviewerName: string;
  /** The human reviewer's actual role. Never "AI" or "System". */
  humanReviewerRole: string;
  /** The date the human reviewer actually performed this review. */
  reviewDate: Date;
  /** Expiration or next-review date. Must be after `reviewDate`. */
  expirationOrNextReviewDate: Date;
}

/**
 * `LCB-007` (Kill-Switch and Rollback Evidence, Live Context) evidence
 * record. Covers both halves required by
 * `docs/phase7/live-capable-blocker-register.md`: simulation-layer
 * kill-switch test evidence (already largely covered by
 * `tests/safety/safety-regression.test.ts`) and the live-context rollback
 * rehearsal evidence described in
 * `docs/phase8/rollback-drill-runbook.md`.
 */
export interface LiveSafetyReviewLcb007Record extends LiveSafetyReviewBaseRecord {
  blockerId: "LCB-007";
  /**
   * How many of the seven rollback rehearsal steps in
   * `docs/phase8/rollback-drill-runbook.md`
   * (`REQUIRED_ROLLBACK_REHEARSAL_STEPS`) have been rehearsed and
   * evidenced. Integer, `0`-`7` inclusive.
   */
  rollbackRehearsalStepsCompleted: number;
  /**
   * Required, explicit description of the stop criteria that apply when
   * broker state is unresolved/unknown (per `docs/11_AI_RULES.md` Rule 16
   * and Rule 22, and `docs/08_Testing_Validation.md` Section 19). Must
   * never be blank or a placeholder — "unknown broker state" must itself
   * map to a described, human-reviewed stop condition, never to silence.
   */
  unresolvedBrokerStateStopCriteria: string;
}

/**
 * `LCB-008` (Real Broker Write Adapter Review Evidence) evidence record.
 * Records the *prerequisites* for a future independent code review, per
 * `docs/08_Testing_Validation.md` Section 20.1 acceptance criteria — it
 * never performs that review itself, and per
 * `docs/phase7/live-capable-blocker-register.md`, LCB-008 remains
 * structurally `BLOCKED` until a real adapter exists in a later,
 * separately scoped phase.
 */
export interface LiveSafetyReviewLcb008Record extends LiveSafetyReviewBaseRecord {
  blockerId: "LCB-008";
  /**
   * Must be strictly `false`. A real `TossSecuritiesAdapter` write
   * implementation must not exist yet anywhere in this repository per the
   * Phase 7 boundary restated in
   * `docs/phase7/live-capable-blocker-register.md` LCB-008 — checked again
   * here at runtime so a caller cannot bypass this with an `as`-cast.
   */
  adapterExistsYet: boolean;
  /**
   * Confirms the future review will be checked against the full
   * acceptance-criteria list in `docs/08_Testing_Validation.md`
   * Section 20.1 (read contract tests, write contract tests in a mock or
   * verified-safe environment, error normalization tests, timeout tests,
   * redaction tests, capability registry tests).
   */
  acceptanceCriteriaReferenceConfirmed: boolean;
  /**
   * Whether the reviewer is distinct from whoever will implement the
   * adapter, per the register's "distinct from whoever implements the
   * adapter where practical" requirement. If `false`, a non-empty
   * `independenceExceptionJustification` is required.
   */
  independentOfImplementer: boolean;
  independenceExceptionJustification?: string | undefined;
}

export type LiveSafetyReviewBlockerRecord = LiveSafetyReviewLcb007Record | LiveSafetyReviewLcb008Record;

// ---------------------------------------------------------------------------
// Per-blocker review
// ---------------------------------------------------------------------------

export interface LiveSafetyReviewBlockerRecordReview {
  blockerId: LiveSafetyReviewPacketBlockerId | undefined;
  /** Echoes the caller-supplied decision, `undefined` if it was missing/invalid. */
  decision: LiveSafetyReviewDecision | undefined;
  reasonCodes: string[];
  warnings: string[];
}

function daysBetween(earlier: Date, later: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / 86_400_000);
}

function reviewBaseFields(record: LiveSafetyReviewBaseRecord, now: Date, reasonCodes: string[], warnings: string[]): void {
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

  if (!record.decision || !(LIVE_SAFETY_REVIEW_DECISIONS as readonly string[]).includes(record.decision)) {
    reasonCodes.push("missing_or_invalid_decision");
  }

  if (!record.limitations || record.limitations.trim().length === 0) {
    reasonCodes.push("missing_limitations");
  } else if (placeholderTextPattern.test(record.limitations.trim())) {
    reasonCodes.push("limitations_is_placeholder_text");
  } else {
    scanForProhibitedContent("limitations", record.limitations, reasonCodes);
  }

  if (!record.humanReviewerName || record.humanReviewerName.trim().length === 0) {
    reasonCodes.push("missing_human_reviewer_name");
  } else {
    scanForProhibitedContent("human_reviewer_name", record.humanReviewerName, reasonCodes);
    if (disallowedReviewerIdentityPattern.test(record.humanReviewerName)) {
      reasonCodes.push("human_reviewer_name_looks_non_human");
    }
  }

  if (!record.humanReviewerRole || record.humanReviewerRole.trim().length === 0) {
    reasonCodes.push("missing_human_reviewer_role");
  } else {
    scanForProhibitedContent("human_reviewer_role", record.humanReviewerRole, reasonCodes);
    if (disallowedReviewerIdentityPattern.test(record.humanReviewerRole)) {
      reasonCodes.push("human_reviewer_role_looks_non_human");
    }
  }

  let reviewDateValid = false;
  if (!record.reviewDate || Number.isNaN(record.reviewDate.getTime())) {
    reasonCodes.push("missing_or_invalid_review_date");
  } else if (record.reviewDate.getTime() > now.getTime()) {
    reasonCodes.push("review_date_in_future");
  } else {
    reviewDateValid = true;
  }

  if (!record.expirationOrNextReviewDate || Number.isNaN(record.expirationOrNextReviewDate.getTime())) {
    reasonCodes.push("missing_or_invalid_expiration_or_next_review_date");
  } else if (reviewDateValid && record.expirationOrNextReviewDate.getTime() <= record.reviewDate.getTime()) {
    reasonCodes.push("expiration_or_next_review_date_not_after_review_date");
  } else if (reviewDateValid && record.expirationOrNextReviewDate.getTime() <= now.getTime()) {
    warnings.push("expiration_or_next_review_date_already_passed");
  } else if (reviewDateValid && daysBetween(now, record.expirationOrNextReviewDate) > 180) {
    warnings.push("expiration_or_next_review_date_unusually_far_out");
  }
}

/** Pure. No I/O, no mutation of the input, no network calls. */
export function reviewLiveSafetyReviewLcb007Record(
  record: LiveSafetyReviewLcb007Record,
  now: Date = new Date()
): LiveSafetyReviewBlockerRecordReview {
  const reasonCodes: string[] = [];
  const warnings: string[] = [];

  const knownBlockerId = record.blockerId === "LCB-007";
  if (!knownBlockerId) {
    reasonCodes.push("unexpected_blocker_id_for_lcb007_record");
  }

  reviewBaseFields(record, now, reasonCodes, warnings);

  if (
    !Number.isInteger(record.rollbackRehearsalStepsCompleted) ||
    record.rollbackRehearsalStepsCompleted < 0 ||
    record.rollbackRehearsalStepsCompleted > 7
  ) {
    reasonCodes.push("rollback_rehearsal_steps_completed_out_of_range");
  }

  if (!record.unresolvedBrokerStateStopCriteria || record.unresolvedBrokerStateStopCriteria.trim().length === 0) {
    reasonCodes.push("missing_unresolved_broker_state_stop_criteria");
  } else if (placeholderTextPattern.test(record.unresolvedBrokerStateStopCriteria.trim())) {
    reasonCodes.push("unresolved_broker_state_stop_criteria_is_placeholder_text");
  } else {
    scanForProhibitedContent("unresolved_broker_state_stop_criteria", record.unresolvedBrokerStateStopCriteria, reasonCodes);
  }

  if (
    record.decision &&
    humanReviewedDecisions.includes(record.decision) &&
    record.rollbackRehearsalStepsCompleted !== 7
  ) {
    reasonCodes.push("lcb007_rollback_rehearsal_incomplete_for_human_reviewed_decision");
  }

  return {
    blockerId: knownBlockerId ? "LCB-007" : undefined,
    decision:
      record.decision && (LIVE_SAFETY_REVIEW_DECISIONS as readonly string[]).includes(record.decision)
        ? record.decision
        : undefined,
    reasonCodes: [...new Set(reasonCodes)].sort(),
    warnings: [...new Set(warnings)].sort()
  };
}

/** Pure. No I/O, no mutation of the input, no network calls. */
export function reviewLiveSafetyReviewLcb008Record(
  record: LiveSafetyReviewLcb008Record,
  now: Date = new Date()
): LiveSafetyReviewBlockerRecordReview {
  const reasonCodes: string[] = [];
  const warnings: string[] = [];

  const knownBlockerId = record.blockerId === "LCB-008";
  if (!knownBlockerId) {
    reasonCodes.push("unexpected_blocker_id_for_lcb008_record");
  }

  reviewBaseFields(record, now, reasonCodes, warnings);

  if (record.adapterExistsYet !== false) {
    reasonCodes.push("lcb008_write_adapter_must_not_exist_yet");
  }

  if (
    record.decision &&
    humanReviewedDecisions.includes(record.decision) &&
    record.acceptanceCriteriaReferenceConfirmed !== true
  ) {
    reasonCodes.push("lcb008_acceptance_criteria_reference_not_confirmed");
  }

  if (record.independentOfImplementer !== true) {
    if (
      !record.independenceExceptionJustification ||
      record.independenceExceptionJustification.trim().length === 0
    ) {
      reasonCodes.push("lcb008_missing_independence_exception_justification");
    } else {
      scanForProhibitedContent("independence_exception_justification", record.independenceExceptionJustification, reasonCodes);
    }
  }

  return {
    blockerId: knownBlockerId ? "LCB-008" : undefined,
    decision:
      record.decision && (LIVE_SAFETY_REVIEW_DECISIONS as readonly string[]).includes(record.decision)
        ? record.decision
        : undefined,
    reasonCodes: [...new Set(reasonCodes)].sort(),
    warnings: [...new Set(warnings)].sort()
  };
}

// ---------------------------------------------------------------------------
// Packet-level review
// ---------------------------------------------------------------------------

/**
 * Required, verbatim not-live-trading-authorization statement. A packet
 * whose `notLiveTradingAuthorizationStatement` field does not match this
 * exactly is treated as incomplete — a paraphrase is not acceptable,
 * mirroring the verbatim-attestation discipline already established by
 * `REQUIRED_LIVE_BLOCKER_EVIDENCE_REVIEWER_ATTESTATION` in
 * `live-blocker-evidence-intake.ts` and
 * `REQUIRED_MANUAL_APPROVAL_ATTESTATION` in `small-capital-readiness.ts`.
 */
export const REQUIRED_NOT_LIVE_TRADING_AUTHORIZATION_STATEMENT =
  "This packet is sanitized evidence for a human engineering safety reviewer and an " +
  "independent senior reviewer only. It does not close out LCB-007 or LCB-008, it " +
  "does not approve a future write-adapter implementation on a human's behalf, and " +
  "it is not, and can never become, authorization for live trading, a real broker " +
  "write, or a real Toss order. Only a human editing " +
  "docs/phase7/live-capable-blocker-register.md directly can ever change either " +
  "blocker's status in that register.";

export interface LiveSafetyReviewEvidencePacketInput {
  /** Human- or reviewer-assigned packet identifier, e.g. "P10-008-LCB-007-008". Required, non-empty, sanitized. */
  packetId: string;
  /** Evaluation time. Required; used for review-date and expiration checks. */
  now: Date;
  lcb007: LiveSafetyReviewLcb007Record;
  lcb008: LiveSafetyReviewLcb008Record;
  /**
   * Explicit confirmation that the person assembling this packet checked
   * every field for secrets, account identifiers, and raw broker payloads
   * before handing it to the human reviewer. Must be strictly `true`.
   */
  prohibitedContentConfirmed: boolean;
  /** Must equal `REQUIRED_NOT_LIVE_TRADING_AUTHORIZATION_STATEMENT` verbatim. */
  notLiveTradingAuthorizationStatement: string;
}

export interface LiveSafetyReviewEvidencePacketReview {
  packetId: string | undefined;
  generatedAt: Date;
  /** Always exactly `LIVE_SAFETY_REVIEW_PACKET_BLOCKER_IDS`, in that fixed order. */
  coveredBlockerIds: typeof LIVE_SAFETY_REVIEW_PACKET_BLOCKER_IDS;
  lcb007: LiveSafetyReviewBlockerRecordReview;
  lcb008: LiveSafetyReviewBlockerRecordReview;
  reasonCodes: string[];
  warnings: string[];
  /**
   * Always literal `false`. No combination of evidence records, however
   * complete, can make this true.
   */
  liveBrokerWriteAllowed: false;
  /**
   * Always literal `false`. This report never authorizes writing a
   * `RESOLVED` status into
   * `docs/phase7/live-capable-blocker-register.md` — that decision remains
   * exclusively a human editing that file directly.
   */
  blockerRegisterResolutionAllowed: false;
  safetyType: "LIVE_SAFETY_REVIEW_EVIDENCE_PACKET_REVIEW_ONLY";
}

/**
 * Reviews a sanitized `LCB-007`/`LCB-008` evidence packet. Pure: no I/O, no
 * mutation of the input, no network calls, and no write of any kind to
 * `docs/phase7/live-capable-blocker-register.md`.
 */
export function reviewLiveSafetyReviewEvidencePacket(
  input: LiveSafetyReviewEvidencePacketInput
): LiveSafetyReviewEvidencePacketReview {
  const reasonCodes: string[] = [];
  const warnings: string[] = [];

  if (!input.packetId || input.packetId.trim().length === 0) {
    reasonCodes.push("missing_packet_id");
  } else {
    scanForProhibitedContent("packet_id", input.packetId, reasonCodes);
  }

  if (input.prohibitedContentConfirmed !== true) {
    reasonCodes.push("prohibited_content_confirmation_missing");
  }

  if (input.notLiveTradingAuthorizationStatement !== REQUIRED_NOT_LIVE_TRADING_AUTHORIZATION_STATEMENT) {
    reasonCodes.push("not_live_trading_authorization_statement_missing_or_mismatched");
  }

  const lcb007Review = reviewLiveSafetyReviewLcb007Record(input.lcb007, input.now);
  const lcb008Review = reviewLiveSafetyReviewLcb008Record(input.lcb008, input.now);

  reasonCodes.push(...lcb007Review.reasonCodes.map((code) => `lcb007_record_${code}`));
  reasonCodes.push(...lcb008Review.reasonCodes.map((code) => `lcb008_record_${code}`));
  warnings.push(...lcb007Review.warnings.map((code) => `lcb007_record_${code}`));
  warnings.push(...lcb008Review.warnings.map((code) => `lcb008_record_${code}`));

  return {
    packetId: input.packetId && input.packetId.trim().length > 0 ? input.packetId : undefined,
    generatedAt: input.now,
    coveredBlockerIds: LIVE_SAFETY_REVIEW_PACKET_BLOCKER_IDS,
    lcb007: lcb007Review,
    lcb008: lcb008Review,
    reasonCodes: [...new Set(reasonCodes)].sort(),
    warnings: [...new Set(warnings)].sort(),
    liveBrokerWriteAllowed: false,
    blockerRegisterResolutionAllowed: false,
    safetyType: "LIVE_SAFETY_REVIEW_EVIDENCE_PACKET_REVIEW_ONLY"
  };
}
