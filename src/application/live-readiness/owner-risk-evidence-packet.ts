import { Money } from "../../domain/value-objects/index.js";

/**
 * Phase 10 (P10-007): owner and risk evidence packet.
 *
 * This module is a PURE evaluator. It has no network code, no filesystem
 * access, no broker client, and no side effects of any kind. It never
 * constructs, submits, cancels, or replaces a broker order, and it never
 * enables live trading.
 *
 * It exists to tell a human owner/risk reviewer exactly what to record
 * before `LCB-004` (Human Approval Evidence) and `LCB-006` (Small-Capital
 * Operating-Limit Evidence) in
 * `docs/phase7/live-capable-blocker-register.md` can even be considered by
 * that human reviewer -- and to check that what they recorded is
 * structurally complete, sanitized, and internally consistent. It never
 * decides whether the underlying evidence is *sufficient*; that judgment
 * belongs exclusively to the named human reviewer.
 *
 * Required reading behind this module's design:
 * `docs/phase10/human-blocker-evidence-workbook.md` (packet format,
 * sanitization rules, required fields, allowed decision values),
 * `docs/phase7/live-capable-blocker-register.md` (canonical `LCB-004` /
 * `LCB-006` definitions -- read-only, never edited by this module or its
 * callers), `docs/phase7/manual-live-approval-record.md` (why an approval
 * cannot be inferred or auto-populated by AI or code),
 * `docs/phase7/small-capital-readiness-gates.md` (the numeric limit
 * categories and rollback procedure this packet's capital-policy topics
 * summarize), `docs/phase10/first-trade-operating-protocol.md` (the sibling
 * attestation-based evaluator this module's design directly follows), and
 * `docs/11_AI_RULES.md` (Rule 12 "AI may propose, not apply," Rule 20
 * "money is never a naked number," Rule 22 "fail closed").
 *
 * Deliberate design choices that keep this evaluator from ever being able
 * to approve a risk limit, resolve a blocker, or authorize a trade on a
 * human's behalf:
 *
 * - Every numeric capital policy (`maxTotalCapitalPolicy`,
 *   `maxPerOrderPolicy`) is a caller-supplied `Money` value, per
 *   `docs/11_AI_RULES.md` Rule 20. This module never computes, suggests, or
 *   defaults a number for either field -- there is no constant, fallback,
 *   or "recommended starting point" anywhere in this file that could be
 *   mistaken for an approved limit. A missing or non-positive value is
 *   always a blocking condition, never silently substituted.
 * - "Proposed" and "human-approved" are structurally distinct. A declared
 *   capital policy value is always reported back verbatim as
 *   `declaredValue` (never altered), while its `status` field
 *   (`"MISSING"`, `"PROPOSED_PENDING_HUMAN_DECISION"`,
 *   `"HUMAN_APPROVED_WITH_LIMITATIONS"`, `"HUMAN_REJECTED"`, or
 *   `"HUMAN_MARKED_UNVERIFIED"`) is derived *only* from the human
 *   reviewer's own recorded `decision` field plus that reviewer record
 *   passing its own validity checks -- never from the declared number
 *   itself. A packet can never read as "approved" merely because a number
 *   was supplied; a validly attested human reviewer decision is always
 *   required first.
 * - `decision` on the human reviewer record must be exactly one of the five
 *   values `docs/phase10/human-blocker-evidence-workbook.md` allows
 *   (`OWNER_RISK_EVIDENCE_PACKET_DECISIONS`). The literal string
 *   `"RESOLVED"` never appears anywhere in this module's types or output --
 *   there is no reachable code path that produces it. `RESOLVED` belongs
 *   exclusively to a human editing
 *   `docs/phase7/live-capable-blocker-register.md` directly.
 * - Every attestation-bearing topic requires a fixed, exported, per-topic
 *   verbatim string (`REQUIRED_OWNER_RISK_ATTESTATIONS`), mirroring
 *   `REQUIRED_FIRST_TRADE_ATTESTATIONS` in `first-trade-operating-protocol.ts`
 *   and `REQUIRED_MANUAL_APPROVAL_ATTESTATION` in
 *   `small-capital-readiness.ts`. A boolean flag alone is trivial for
 *   anyone, human or AI, to set without meaningfully attesting to anything.
 * - A human reviewer decision of `HUMAN_REVIEWED_APPROVED_WITH_LIMITATIONS`,
 *   `HUMAN_REVIEWED_REJECTED`, or `HUMAN_REVIEWED_UNVERIFIED` additionally
 *   requires `reviewerAttestation` to equal
 *   `REQUIRED_OWNER_RISK_REVIEWER_ATTESTATION` verbatim. Without that exact
 *   string, the reviewer record is never treated as valid, regardless of
 *   what `decision` claims -- so no capital-policy topic can ever read as
 *   `"HUMAN_APPROVED_WITH_LIMITATIONS"`, `"HUMAN_REJECTED"`, or
 *   `"HUMAN_MARKED_UNVERIFIED"` either.
 * - Reviewer name and role, and every attester name/role on every topic, are
 *   scanned for text claiming to be an AI/automated system, mirroring
 *   `live-blocker-evidence-intake.ts` and
 *   `first-trade-operating-protocol.ts`. This never proves a human actually
 *   performed the review, but it structurally blocks the most obvious way
 *   an AI-generated approval could be passed off as a human's own sign-off.
 * - Every free-text field (evidence source references, attester names and
 *   roles, strategy ids, limitations, daily-review and stop-criteria
 *   descriptions) is scanned for secret-like, account-identifier-like,
 *   raw-payload-like, and request-header-like content. Any match is a
 *   blocking reason code, never a warning.
 * - `packetEvidenceComplete` reflects only whether every required field is
 *   present, sanitized, and structurally valid. It is never itself
 *   authorization, it never implies `LCB-004` or `LCB-006` is resolved, and
 *   it can be `true` for a packet whose reviewer decision is
 *   `HUMAN_REVIEWED_REJECTED` -- structural completeness and a favorable
 *   outcome are two different things.
 * - Every check fails closed: a missing input, an unconfirmed attestation, a
 *   mismatched statement, or a missing reviewer field is always treated as
 *   blocking, never as "assume the human meant to say yes."
 * - No type in this module combines a symbol/asset identifier, a quantity, a
 *   side (buy/sell), and a price -- the specific shape that could be
 *   mistaken for, or repurposed as, an executable broker order.
 */

// ---------------------------------------------------------------------------
// Covered blockers
// ---------------------------------------------------------------------------

/**
 * The two blockers this packet covers, per
 * `docs/phase10/human-blocker-evidence-workbook.md`'s "Owner/risk packet"
 * row. Fixed; never caller-configurable.
 */
export const OWNER_RISK_EVIDENCE_PACKET_COVERED_BLOCKER_IDS = Object.freeze(["LCB-004", "LCB-006"] as const);
export type OwnerRiskEvidencePacketCoveredBlockerId = (typeof OWNER_RISK_EVIDENCE_PACKET_COVERED_BLOCKER_IDS)[number];

// ---------------------------------------------------------------------------
// Decision vocabulary
// ---------------------------------------------------------------------------

/**
 * The only decision values this packet's human reviewer field may use, per
 * `docs/phase10/human-blocker-evidence-workbook.md` "Suggested Decisions."
 * Deliberately excludes `"RESOLVED"` -- that value belongs exclusively to a
 * human editing `docs/phase7/live-capable-blocker-register.md` directly.
 */
export const OWNER_RISK_EVIDENCE_PACKET_DECISIONS = Object.freeze([
  "READY_FOR_HUMAN_REVIEW",
  "HUMAN_REVIEWED_APPROVED_WITH_LIMITATIONS",
  "HUMAN_REVIEWED_REJECTED",
  "HUMAN_REVIEWED_UNVERIFIED",
  "NEEDS_MORE_EVIDENCE"
] as const);
export type OwnerRiskEvidencePacketDecision = (typeof OWNER_RISK_EVIDENCE_PACKET_DECISIONS)[number];

const decisionsRequiringReviewerAttestation: ReadonlySet<OwnerRiskEvidencePacketDecision> = new Set([
  "HUMAN_REVIEWED_APPROVED_WITH_LIMITATIONS",
  "HUMAN_REVIEWED_REJECTED",
  "HUMAN_REVIEWED_UNVERIFIED"
]);

// ---------------------------------------------------------------------------
// Topic catalog
// ---------------------------------------------------------------------------

/**
 * The nine checklist topics required by P10-007 and
 * `docs/phase10/human-blocker-evidence-workbook.md`'s required-fields list,
 * covering `LCB-004` (human approval intent, residual-risk acknowledgment)
 * and `LCB-006` (the remaining seven topics).
 */
export const OWNER_RISK_EVIDENCE_PACKET_TOPICS = Object.freeze([
  "human_approval_intent",
  "residual_risk_acknowledgment",
  "max_total_capital_policy",
  "max_per_order_policy",
  "allowed_strategy_set",
  "limit_order_only_restriction",
  "regular_hours_only_restriction",
  "daily_review_commitment",
  "stop_criteria"
] as const);
export type OwnerRiskEvidencePacketTopic = (typeof OWNER_RISK_EVIDENCE_PACKET_TOPICS)[number];

/**
 * Required verbatim attestation text per topic. Each string is original to
 * this module and distinct per topic, so a single copy-pasted statement can
 * never satisfy more than one topic. Mirrors
 * `REQUIRED_FIRST_TRADE_ATTESTATIONS` in `first-trade-operating-protocol.ts`.
 */
export const REQUIRED_OWNER_RISK_ATTESTATIONS: Readonly<Record<OwnerRiskEvidencePacketTopic, string>> = Object.freeze({
  human_approval_intent:
    "I am the project owner or operator. I personally, explicitly intend to approve progression from " +
    "readiness evidence toward a later, separately reviewed live-implementation phase. This intent is " +
    "my own; it was not generated, suggested, or drafted by an AI agent on my behalf.",
  residual_risk_acknowledgment:
    "I acknowledge that a future small-capital live pilot carries residual risk -- including the risk " +
    "of loss of the declared capital -- that no amount of testing, review, or automation can fully " +
    "eliminate, and I personally accept that risk before any future live-capable phase proceeds.",
  max_total_capital_policy:
    "I have personally set the maximum total capital exposure declared below. It is my own number, not " +
    "a default, suggestion, or AI-generated value, and I will not raise it without a new, separately " +
    "recorded decision.",
  max_per_order_policy:
    "I have personally set the maximum per-order amount declared below. It is my own number, not a " +
    "default, suggestion, or AI-generated value, and I will not raise it without a new, separately " +
    "recorded decision.",
  allowed_strategy_set:
    "I have personally selected the limited, explicitly listed strategy set below for this pilot, and " +
    "I will not add an unlisted strategy without a new, separately recorded decision.",
  limit_order_only_restriction:
    "I confirm every order in this pilot will use limit orders only; I will not place a market order " +
    "under this policy.",
  regular_hours_only_restriction:
    "I confirm every order in this pilot will be placed only within the regular trading session for its " +
    "market; I will not place, or allow to be placed, an extended-hours or fractional order under this " +
    "policy.",
  daily_review_commitment:
    "I commit to personally performing a daily reconciliation and risk review of this pilot's activity, " +
    "and I will not delegate that review to any automated process.",
  stop_criteria:
    "I confirm this pilot has explicit stop criteria that halt trading for human review, and I will not " +
    "continue trading past a triggered stop criterion until I have completed that review and recorded a " +
    "new decision to proceed."
});

/**
 * Required verbatim attestation a human reviewer must type for their
 * decision to count as a genuine, completed review rather than a
 * not-yet-reviewed packet. Mirrors
 * `REQUIRED_LIVE_BLOCKER_EVIDENCE_REVIEWER_ATTESTATION` in
 * `live-blocker-evidence-intake.ts`. The text itself states that this
 * packet does not resolve either covered blocker, so a reviewer typing it
 * cannot reasonably believe they are doing more than recording a review.
 */
export const REQUIRED_OWNER_RISK_REVIEWER_ATTESTATION =
  "I am the named human owner/risk reviewer for this packet. I personally reviewed the evidence source " +
  "references and every declared policy above, they do not contain secrets, account numbers, or raw " +
  "broker payloads, and this record summarizes evidence and my own decision only. It does not resolve " +
  "LCB-004 or LCB-006; only a human editing docs/phase7/live-capable-blocker-register.md directly can " +
  "ever record a RESOLVED decision.";

/** "Limited number of strategies" ceiling, fixed by policy, mirroring `FIRST_TRADE_MAX_NARROW_STRATEGY_COUNT`. */
export const OWNER_RISK_MAX_ALLOWED_STRATEGY_COUNT = 3;

// ---------------------------------------------------------------------------
// Prohibited-content checks
// ---------------------------------------------------------------------------

/**
 * Matches text that looks like a secret: tokens, client/app secrets, API
 * keys, authorization headers, bearer values, passwords, private keys.
 * Mirrors the discipline already established by
 * `live-blocker-evidence-intake.ts` and `first-trade-operating-protocol.ts`.
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
 * Matches identity tokens that indicate an attester's or reviewer's name or
 * role is claiming to be an AI/automated system rather than a human. This
 * never proves a human actually performed the attestation or review, but it
 * structurally blocks the most obvious way an AI-generated sign-off could be
 * passed off as a human's own.
 */
const disallowedHumanIdentityPattern =
  /\b(ai|artificial[\s-]?intelligence|claude|chatgpt|gpt-?\d*|codex|anthropic|openai|copilot|assistant|bot|automated|algorithm)\b/i;

function scanForProhibitedContent(fieldName: string, text: string, reasons: Set<string>): void {
  if (secretLikePattern.test(text)) {
    reasons.add(`packet_input_may_contain_secret_${fieldName}`);
  }
  if (accountIdentifierLikePattern.test(text)) {
    reasons.add(`packet_input_may_contain_account_identifier_${fieldName}`);
  }
  if (rawPayloadLikePattern.test(text)) {
    reasons.add(`packet_input_looks_like_raw_payload_${fieldName}`);
  }
  if (requestHeaderLikePattern.test(text)) {
    reasons.add(`packet_input_may_contain_request_header_${fieldName}`);
  }
}

function checkHumanIdentity(fieldName: string, text: string, reasons: Set<string>): void {
  scanForProhibitedContent(fieldName, text, reasons);
  if (disallowedHumanIdentityPattern.test(text)) {
    reasons.add(`packet_identity_not_human_${fieldName}`);
  }
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

/**
 * A single caller-supplied, sanitized attestation record for one checklist
 * topic. This codebase never constructs a `confirmed: true` instance of
 * this type on a human's behalf; it only validates the shape of one
 * supplied by the caller (in practice, typed in by the owner/risk reviewer).
 */
export interface OwnerRiskPacketAttestation {
  confirmed: boolean;
  /** Must equal the corresponding entry in `REQUIRED_OWNER_RISK_ATTESTATIONS` verbatim. */
  statement: string;
  /** The attester's own name, typed by them. Never a broker account identifier or secret. */
  attestedByName: string;
  /** The attester's actual human role (for example "Project owner", "Risk owner/operator"). Never "AI" or "System". */
  attestedByRole: string;
  attestedAt: Date;
}

/**
 * Structured daily-review commitment for the `daily_review_commitment`
 * topic. A plain confirmed attestation string is not sufficient on its own
 * -- `commitsToDailyReview` must be explicitly `true`, and `description`
 * must be a non-empty, sanitized, human-authored explanation of how that
 * review will actually happen.
 */
export interface OwnerRiskDailyReviewCommitment {
  commitsToDailyReview: boolean;
  description: string;
}

/**
 * Structured stop-criteria commitment for the `stop_criteria` topic,
 * mirroring `FirstTradeStopCriteria` in `first-trade-operating-protocol.ts`.
 * `stopsForReviewOnBreach` must be explicitly `true`, and `description` must
 * be a non-empty, sanitized explanation of what triggers a stop and how the
 * resume decision will be made.
 */
export interface OwnerRiskStopCriteria {
  stopsForReviewOnBreach: boolean;
  description: string;
}

/**
 * The human owner/risk reviewer's own recorded decision for this packet.
 * `name`, `role`, `reviewDate`, `decision`, `limitations`, and
 * `expirationOrNextReviewDate` are always required, per
 * `docs/phase10/human-blocker-evidence-workbook.md`'s "Required Fields Per
 * Packet" list -- even a not-yet-reviewed packet (`decision:
 * "READY_FOR_HUMAN_REVIEW"`) must identify who compiled it and when it next
 * needs attention. `reviewerAttestation` is additionally required, and must
 * match `REQUIRED_OWNER_RISK_REVIEWER_ATTESTATION` verbatim, for any
 * decision that claims a completed human review
 * (`decisionsRequiringReviewerAttestation`).
 */
export interface OwnerRiskEvidencePacketHumanReviewer {
  name: string;
  role: string;
  reviewDate: Date;
  decision: OwnerRiskEvidencePacketDecision;
  /** Required, non-blank. What this packet's evidence does and does not cover. Never omitted. */
  limitations: string;
  /** Required. When this packet must next be revisited; must be after `reviewDate`. */
  expirationOrNextReviewDate: Date;
  reviewerAttestation?: string | undefined;
}

export interface OwnerRiskEvidencePacketInput {
  /** Evaluation time. Required; used to reject dates claiming to occur in the future. */
  now: Date;
  /** Caller-supplied stable identifier for this packet. Required, non-blank. */
  packetId: string;
  /** Sanitized references to where the underlying evidence lives. Required, non-empty. */
  evidenceSourceReferences: string[];
  /** One attestation per topic in `OWNER_RISK_EVIDENCE_PACKET_TOPICS`. A missing topic is a blocking condition. */
  attestations: Partial<Record<OwnerRiskEvidencePacketTopic, OwnerRiskPacketAttestation>>;
  /**
   * Declared maximum total capital exposure. A `Money`, per
   * `docs/11_AI_RULES.md` Rule 20. Always exactly what the human reviewer
   * typed in -- never computed, suggested, or defaulted by this module.
   */
  maxTotalCapitalPolicy?: Money | undefined;
  /** Declared maximum per-order amount. Same provenance discipline as `maxTotalCapitalPolicy`. */
  maxPerOrderPolicy?: Money | undefined;
  /** Strategy identifiers for the `allowed_strategy_set` topic. Never symbols, quantities, sides, or prices. */
  allowedStrategyIds?: string[] | undefined;
  dailyReviewCommitment?: OwnerRiskDailyReviewCommitment | undefined;
  stopCriteria?: OwnerRiskStopCriteria | undefined;
  humanReviewer?: OwnerRiskEvidencePacketHumanReviewer | undefined;
  /**
   * Explicit confirmation from whoever prepared this packet that they
   * personally checked it for prohibited content before submitting it for
   * review. This is required in addition to, never instead of, this
   * module's own automatic scan below -- a `true` value here never
   * suppresses or overrides an actual detected match.
   */
  prohibitedContentConfirmedByPreparer: boolean;
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

/**
 * Status of a single declared capital policy. `"MISSING"` covers both an
 * absent and an invalid (non-positive) declared value. The three
 * `"HUMAN_..."` statuses are reachable only when the packet's human
 * reviewer record is present, valid, and carries the matching `decision`
 * value -- never derived from the declared number itself.
 */
export type OwnerRiskCapitalPolicyStatus =
  | "MISSING"
  | "PROPOSED_PENDING_HUMAN_DECISION"
  | "HUMAN_APPROVED_WITH_LIMITATIONS"
  | "HUMAN_REJECTED"
  | "HUMAN_MARKED_UNVERIFIED";

export interface OwnerRiskEvidencePacketCapitalPolicySummary {
  status: OwnerRiskCapitalPolicyStatus;
  /**
   * The declared value, exactly as supplied by the caller. Never computed,
   * suggested, or defaulted by this evaluator. `null` when missing or
   * invalid. This is a policy ceiling, never a real account balance or
   * holdings quantity.
   */
  declaredValue: { amountMajor: string; currency: string } | null;
  safetyType: "OWNER_RISK_EVIDENCE_PACKET_CAPITAL_POLICY_SUMMARY";
}

export const OWNER_RISK_EVIDENCE_PACKET_STATEMENT =
  "This packet is a sanitized, evidence-only CHECKLIST for a human owner/risk reviewer preparing " +
  "evidence for LCB-004 (Human Approval Evidence) and LCB-006 (Small-Capital Operating-Limit Evidence) " +
  "in docs/phase7/live-capable-blocker-register.md. It is NOT live-trading authorization, NOT a broker-" +
  "write approval, and NOT a substitute for a human editing that register directly. Every declared " +
  "capital policy value is exactly what a human reviewer typed in -- this evaluator never computes, " +
  "suggests, or defaults a risk-limit number on anyone's behalf. packetEvidenceComplete describes only " +
  "whether the required fields are present, sanitized, and structurally valid; it is not itself a " +
  "decision, and a decision recorded here (including an APPROVED_WITH_LIMITATIONS decision) never " +
  "changes the status of LCB-004 or LCB-006 in the canonical blocker register. Only a human editing " +
  "docs/phase7/live-capable-blocker-register.md directly can ever do that. AI-generated text can never " +
  "satisfy this packet's human_approval_intent, " +
  "residual_risk_acknowledgment, or human reviewer fields -- every identity-bearing field is scanned and " +
  "blocked if it claims to be an AI or automated system.";

export interface OwnerRiskEvidencePacket {
  generatedAt: Date;
  packetId: string;
  /** Always exactly `OWNER_RISK_EVIDENCE_PACKET_COVERED_BLOCKER_IDS`. */
  coveredBlockerIds: OwnerRiskEvidencePacketCoveredBlockerId[];
  evidenceSourceReferences: string[];
  maxTotalCapitalPolicy: OwnerRiskEvidencePacketCapitalPolicySummary;
  maxPerOrderPolicy: OwnerRiskEvidencePacketCapitalPolicySummary;
  /** Reflects `input.humanReviewer.decision` verbatim when the reviewer record is present; `undefined` otherwise. Never computed by this evaluator. */
  decision: OwnerRiskEvidencePacketDecision | undefined;
  /**
   * True only when every required field across every topic, the reviewer
   * record, and the prohibited-content confirmation is present, sanitized,
   * and structurally valid. This is evidence-COMPLETENESS only -- see
   * `packetStatement`. It says nothing about whether the recorded decision
   * is favorable, and it never implies `LCB-004` or `LCB-006` is resolved.
   */
  packetEvidenceComplete: boolean;
  blockingReasonCodes: string[];
  warnings: string[];
  /** Always literal `false`. No combination of input, including a maximally clean one, can change this. */
  liveBrokerWriteAllowed: false;
  /** Verbatim copy of `OWNER_RISK_EVIDENCE_PACKET_STATEMENT`. */
  packetStatement: string;
  safetyType: "OWNER_RISK_EVIDENCE_PACKET_EVIDENCE_ONLY";
}

// ---------------------------------------------------------------------------
// Evaluator
// ---------------------------------------------------------------------------

export function evaluateOwnerRiskEvidencePacket(input: OwnerRiskEvidencePacketInput): OwnerRiskEvidencePacket {
  const blockingReasonCodes = new Set<string>();
  const warnings: string[] = [];

  const validNow = Boolean(input.now) && !Number.isNaN(input.now.getTime());
  if (!validNow) {
    blockingReasonCodes.add("missing_or_invalid_evaluation_time");
  }
  const now = validNow ? input.now : undefined;

  if (!input.packetId || !input.packetId.trim()) {
    blockingReasonCodes.add("missing_packet_id");
  } else {
    scanForProhibitedContent("packet_id", input.packetId, blockingReasonCodes);
  }

  checkEvidenceSourceReferences(input.evidenceSourceReferences, blockingReasonCodes);

  for (const topic of OWNER_RISK_EVIDENCE_PACKET_TOPICS) {
    checkAttestation(topic, input.attestations?.[topic], now, blockingReasonCodes);
  }

  checkStrategySet(input.allowedStrategyIds, blockingReasonCodes);
  checkDailyReviewCommitment(input.dailyReviewCommitment, blockingReasonCodes);
  checkStopCriteria(input.stopCriteria, blockingReasonCodes);

  const reviewerResult = checkHumanReviewer(input.humanReviewer, now, blockingReasonCodes);

  if (input.prohibitedContentConfirmedByPreparer !== true) {
    blockingReasonCodes.add("prohibited_content_confirmation_missing");
  }

  checkPositiveMoney(input.maxTotalCapitalPolicy, "max_total_capital_policy", blockingReasonCodes);
  checkPositiveMoney(input.maxPerOrderPolicy, "max_per_order_policy", blockingReasonCodes);

  const maxTotalCapitalPolicy = buildCapitalPolicySummary(input.maxTotalCapitalPolicy, reviewerResult);
  const maxPerOrderPolicy = buildCapitalPolicySummary(input.maxPerOrderPolicy, reviewerResult);

  const sortedBlockingReasonCodes = [...blockingReasonCodes].sort();
  const packetEvidenceComplete = sortedBlockingReasonCodes.length === 0;

  return {
    generatedAt: input.now,
    packetId: input.packetId,
    coveredBlockerIds: [...OWNER_RISK_EVIDENCE_PACKET_COVERED_BLOCKER_IDS],
    evidenceSourceReferences: [...(input.evidenceSourceReferences ?? [])],
    maxTotalCapitalPolicy,
    maxPerOrderPolicy,
    decision: input.humanReviewer?.decision,
    packetEvidenceComplete,
    blockingReasonCodes: sortedBlockingReasonCodes,
    warnings: [...new Set(warnings)].sort(),
    liveBrokerWriteAllowed: false,
    packetStatement: OWNER_RISK_EVIDENCE_PACKET_STATEMENT,
    safetyType: "OWNER_RISK_EVIDENCE_PACKET_EVIDENCE_ONLY"
  };
}

// ---------------------------------------------------------------------------
// Field-level checks
// ---------------------------------------------------------------------------

function checkEvidenceSourceReferences(references: string[] | undefined, reasons: Set<string>): void {
  if (!references || references.length === 0) {
    reasons.add("missing_evidence_source_references");
    return;
  }

  references.forEach((reference, index) => {
    if (!reference || !reference.trim()) {
      reasons.add(`empty_evidence_source_reference_${index}`);
      return;
    }
    scanForProhibitedContent(`evidence_source_reference_${index}`, reference, reasons);
  });
}

function checkAttestation(
  topic: OwnerRiskEvidencePacketTopic,
  record: OwnerRiskPacketAttestation | undefined,
  now: Date | undefined,
  reasons: Set<string>
): void {
  if (!record) {
    reasons.add(`missing_attestation_${topic}`);
    return;
  }

  if (!record.confirmed) {
    reasons.add(`attestation_not_confirmed_${topic}`);
  }

  if (record.statement !== REQUIRED_OWNER_RISK_ATTESTATIONS[topic]) {
    reasons.add(`attestation_statement_mismatch_${topic}`);
  }

  if (!record.attestedByName || !record.attestedByName.trim()) {
    reasons.add(`attestation_missing_attester_name_${topic}`);
  } else {
    checkHumanIdentity(`attester_name_${topic}`, record.attestedByName, reasons);
  }

  if (!record.attestedByRole || !record.attestedByRole.trim()) {
    reasons.add(`attestation_missing_attester_role_${topic}`);
  } else {
    checkHumanIdentity(`attester_role_${topic}`, record.attestedByRole, reasons);
  }

  if (!record.attestedAt || Number.isNaN(record.attestedAt.getTime())) {
    reasons.add(`attestation_missing_attested_at_${topic}`);
  } else if (now && record.attestedAt.getTime() > now.getTime()) {
    reasons.add(`attestation_attested_at_in_future_${topic}`);
  }
}

function checkPositiveMoney(amount: Money | undefined, fieldName: string, reasons: Set<string>): void {
  if (!amount) {
    reasons.add(`missing_${fieldName}`);
    return;
  }

  if (amount.isNegative() || amount.compare(Money.zero(amount.currency)) === 0) {
    reasons.add(`invalid_${fieldName}`);
  }
}

function checkStrategySet(strategyIds: string[] | undefined, reasons: Set<string>): void {
  if (!strategyIds || strategyIds.length === 0) {
    reasons.add("missing_allowed_strategy_set");
    return;
  }

  if (strategyIds.length > OWNER_RISK_MAX_ALLOWED_STRATEGY_COUNT) {
    reasons.add("allowed_strategy_set_not_narrow");
  }

  const seen = new Set<string>();
  for (const id of strategyIds) {
    if (!id || !id.trim()) {
      reasons.add("allowed_strategy_set_contains_blank_id");
      continue;
    }

    if (seen.has(id)) {
      reasons.add("allowed_strategy_set_contains_duplicate_id");
    }
    seen.add(id);
    scanForProhibitedContent("allowed_strategy_id", id, reasons);
  }
}

function checkDailyReviewCommitment(commitment: OwnerRiskDailyReviewCommitment | undefined, reasons: Set<string>): void {
  if (!commitment) {
    reasons.add("missing_daily_review_commitment");
    return;
  }

  if (commitment.commitsToDailyReview !== true) {
    reasons.add("daily_review_commitment_not_confirmed");
  }

  if (!commitment.description || !commitment.description.trim()) {
    reasons.add("daily_review_commitment_missing_description");
  } else {
    scanForProhibitedContent("daily_review_commitment_description", commitment.description, reasons);
  }
}

function checkStopCriteria(criteria: OwnerRiskStopCriteria | undefined, reasons: Set<string>): void {
  if (!criteria) {
    reasons.add("missing_stop_criteria");
    return;
  }

  if (criteria.stopsForReviewOnBreach !== true) {
    reasons.add("stop_criteria_does_not_stop_for_review");
  }

  if (!criteria.description || !criteria.description.trim()) {
    reasons.add("stop_criteria_missing_description");
  } else {
    scanForProhibitedContent("stop_criteria_description", criteria.description, reasons);
  }
}

interface HumanReviewerCheckResult {
  valid: boolean;
  decision: OwnerRiskEvidencePacketDecision | undefined;
}

function checkHumanReviewer(
  reviewer: OwnerRiskEvidencePacketHumanReviewer | undefined,
  now: Date | undefined,
  reasons: Set<string>
): HumanReviewerCheckResult {
  if (!reviewer) {
    reasons.add("missing_human_reviewer");
    return { valid: false, decision: undefined };
  }

  let valid = true;

  if (!reviewer.name || !reviewer.name.trim()) {
    reasons.add("missing_human_reviewer_name");
    valid = false;
  } else {
    checkHumanIdentity("human_reviewer_name", reviewer.name, reasons);
  }

  if (!reviewer.role || !reviewer.role.trim()) {
    reasons.add("missing_human_reviewer_role");
    valid = false;
  } else {
    checkHumanIdentity("human_reviewer_role", reviewer.role, reasons);
  }

  if (!reviewer.reviewDate || Number.isNaN(reviewer.reviewDate.getTime())) {
    reasons.add("missing_or_invalid_review_date");
    valid = false;
  } else if (now && reviewer.reviewDate.getTime() > now.getTime()) {
    reasons.add("review_date_in_future");
    valid = false;
  }

  const decision = reviewer.decision;
  if (!decision || !(OWNER_RISK_EVIDENCE_PACKET_DECISIONS as readonly string[]).includes(decision)) {
    reasons.add("missing_or_invalid_decision");
    valid = false;
  }

  if (!reviewer.limitations || !reviewer.limitations.trim()) {
    reasons.add("missing_limitations");
    valid = false;
  } else {
    scanForProhibitedContent("limitations", reviewer.limitations, reasons);
  }

  if (!reviewer.expirationOrNextReviewDate || Number.isNaN(reviewer.expirationOrNextReviewDate.getTime())) {
    reasons.add("missing_or_invalid_expiration_or_next_review_date");
    valid = false;
  } else if (
    reviewer.reviewDate &&
    !Number.isNaN(reviewer.reviewDate.getTime()) &&
    reviewer.expirationOrNextReviewDate.getTime() <= reviewer.reviewDate.getTime()
  ) {
    reasons.add("expiration_or_next_review_date_not_after_review_date");
    valid = false;
  }

  if (decision && decisionsRequiringReviewerAttestation.has(decision)) {
    if (reviewer.reviewerAttestation !== REQUIRED_OWNER_RISK_REVIEWER_ATTESTATION) {
      reasons.add("human_reviewer_attestation_mismatch");
      valid = false;
    }
  }

  return { valid, decision };
}

function buildCapitalPolicySummary(
  amount: Money | undefined,
  reviewer: HumanReviewerCheckResult
): OwnerRiskEvidencePacketCapitalPolicySummary {
  if (!amount || amount.isNegative() || amount.compare(Money.zero(amount.currency)) === 0) {
    return {
      status: "MISSING",
      declaredValue: amount ? { amountMajor: amount.toMajorString(), currency: amount.currency.code } : null,
      safetyType: "OWNER_RISK_EVIDENCE_PACKET_CAPITAL_POLICY_SUMMARY"
    };
  }

  const declaredValue = { amountMajor: amount.toMajorString(), currency: amount.currency.code };

  let status: OwnerRiskCapitalPolicyStatus = "PROPOSED_PENDING_HUMAN_DECISION";
  if (reviewer.valid) {
    if (reviewer.decision === "HUMAN_REVIEWED_APPROVED_WITH_LIMITATIONS") {
      status = "HUMAN_APPROVED_WITH_LIMITATIONS";
    } else if (reviewer.decision === "HUMAN_REVIEWED_REJECTED") {
      status = "HUMAN_REJECTED";
    } else if (reviewer.decision === "HUMAN_REVIEWED_UNVERIFIED") {
      status = "HUMAN_MARKED_UNVERIFIED";
    }
  }

  return { status, declaredValue, safetyType: "OWNER_RISK_EVIDENCE_PACKET_CAPITAL_POLICY_SUMMARY" };
}
