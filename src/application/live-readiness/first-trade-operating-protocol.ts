import { Money } from "../../domain/value-objects/index.js";

/**
 * Phase 10 (P10-002): first-trade operating protocol.
 *
 * This module is a PURE evaluator. It has no network code, no filesystem
 * access, no broker client, and no side effects of any kind. It never
 * constructs, submits, cancels, or replaces a broker order, and it never
 * enables live trading. It only reads caller-supplied, sanitized
 * attestations and corroborating safety signals (kill-switch readiness,
 * rollback/reconciliation rehearsal) and returns a report describing
 * whether the human-executed first-trade operating protocol currently
 * reads as complete and consistent.
 *
 * `readyForHumanReview: true` / `status: "READY_FOR_HUMAN_REVIEW"` from
 * this evaluator is NOT authorization to place a trade, and it does not
 * cause any trade to be placed. It means the operator's own recorded
 * checklist is currently complete and internally consistent, and a human
 * may now proceed to actually, personally, manually execute the protocol
 * described in `docs/phase10/first-trade-operating-protocol.md` — including
 * the future first trade itself, through whatever manually-operated broker
 * channel the operator already uses outside of this codebase. This
 * evaluator never becomes, and can never become, the thing that places
 * that trade.
 *
 * Required reading behind this module's design:
 * `docs/07_Trading_System.md` (sections 22 kill switch, 25 order type
 * policy, 30 small-capital live rules), `docs/08_Testing_Validation.md`
 * (sections 12 small-capital live validation, 22 manual test gates),
 * `docs/phase7/small-capital-readiness-gates.md` (numeric limits, rollback
 * procedure design), `docs/phase8/rollback-drill-runbook.md` (the seven
 * rehearsal steps this module's rehearsal signal summarizes),
 * `docs/phase9/small-capital-go-no-go-checklist.md` (the "report reading OK
 * is not the same as a human having reviewed it" discipline this module
 * repeats), and `docs/11_AI_RULES.md` (Rule 22 fail closed, Rule 23 kill
 * switch must not be bypassed).
 *
 * Deliberate design choices that keep this evaluator from ever being able
 * to authorize, or shortcut, a real trade:
 *
 * - There is no order-shaped input or output anywhere in this module. No
 *   type here combines a symbol/asset identifier, a quantity, a side
 *   (buy/sell), and a price — the specific shape that could be mistaken
 *   for, or repurposed as, an executable broker order. `strategyIds` is a
 *   list of strategy identifiers only; `maxOrderAmount` /
 *   `maxTotalCapitalExposure` are policy ceilings (a `Money`, per
 *   `docs/11_AI_RULES.md` Rule 20 — never a naked number), not order
 *   details.
 * - `liveBrokerWriteAllowed` and `automaticFirstTradeAllowed` are literal
 *   `false` on every report, never derived from any input, mirroring
 *   `ReconciliationWorkflowResult.liveBrokerWriteAllowed`,
 *   `SmallCapitalReadinessReport.liveBrokerWriteAllowed`, and
 *   `SmallCapitalEnablementGateReport.readyForLiveBrokerWrites` elsewhere
 *   in this codebase.
 * - Every attestation is checked against a fixed, exported, per-topic
 *   verbatim string (`REQUIRED_FIRST_TRADE_ATTESTATIONS`). A boolean flag
 *   alone is trivial to set without meaningfully attesting to anything;
 *   requiring the operator to have actually recorded the exact statement
 *   text keeps this closer to a genuine sign-off, mirroring
 *   `REQUIRED_MANUAL_APPROVAL_ATTESTATION` and
 *   `REQUIRED_LIVE_BLOCKER_EVIDENCE_REVIEWER_ATTESTATION` in this same
 *   `live-readiness` module family.
 * - Two topics — kill-switch readiness and rollback/reconciliation
 *   rehearsal — additionally require a corroborating, structurally
 *   real signal (`FirstTradeKillSwitchReadinessSignal`, structurally
 *   compatible with `KillSwitchTradingGate` from
 *   `src/application/kill-switch/kill-switch-control-service.ts`; and
 *   `FirstTradeRollbackReconciliationRehearsalSignal`, structurally
 *   compatible with the relevant fields of `ReconciliationWorkflowResult`
 *   from `src/application/reconciliation/reconciliation-workflow-service.ts`).
 *   A confirmed attestation alone is never sufficient for these two topics
 *   — the underlying safety mechanism must itself currently read as ready.
 *   This is what the P10-002 completion criteria means by "missing stop
 *   criteria, kill-switch readiness, or reconciliation commitment fails
 *   closed": both the attestation and the real signal must independently
 *   pass.
 * - `stop_criteria_after_first_trade` similarly requires a structured
 *   `stopCriteria.stopsAfterFirstTrade === true` (a plain confirmed
 *   attestation string is not enough) plus a non-empty, sanitized
 *   description of the operator's own review process — this module cannot
 *   compute or infer that description on the operator's behalf.
 * - Every free-text field is scanned for secret-like, account-identifier-
 *   like, raw-payload-like, and non-human-attester-identity content,
 *   mirroring the discipline already established in
 *   `live-blocker-evidence-intake.ts`. Any match is a blocking reason code,
 *   never a warning.
 * - Every check fails closed: a missing input, an unconfirmed attestation,
 *   a mismatched statement, or a not-ready corroborating signal is always
 *   treated as blocking, never as "assume the operator meant to say yes."
 */

// ---------------------------------------------------------------------------
// Topic catalog
// ---------------------------------------------------------------------------

/**
 * The eight checklist topics required by P10-002, in the same order as
 * `docs/tasks/phase10_claude_worktree_tasks/P10-002_first_trade_operating_protocol.md`.
 */
export const FIRST_TRADE_PROTOCOL_TOPICS = Object.freeze([
  "limited_capital_mode",
  "limit_order_only_policy",
  "maximum_order_amount_policy",
  "single_strategy_or_narrow_strategy_set",
  "kill_switch_readiness",
  "rollback_reconciliation_rehearsal",
  "post_trade_manual_review_commitment",
  "stop_criteria_after_first_trade"
] as const);
export type FirstTradeProtocolTopic = (typeof FIRST_TRADE_PROTOCOL_TOPICS)[number];

/**
 * Required verbatim attestation text per topic. Each string is original to
 * this module (not copied from any other document) and distinct per topic,
 * so a single copy-pasted statement can never satisfy more than one topic.
 */
export const REQUIRED_FIRST_TRADE_ATTESTATIONS: Readonly<Record<FirstTradeProtocolTopic, string>> = Object.freeze({
  limited_capital_mode:
    "I confirm this future first trade will be placed under limited-capital mode: total capital " +
    "exposure for this pilot is capped at the declared maximum, and I will not raise that cap " +
    "without a new, separately recorded approval.",
  limit_order_only_policy:
    "I confirm this future first trade, and every trade in this small-capital pilot, will use limit " +
    "orders only. I will not place a market order under this protocol.",
  maximum_order_amount_policy:
    "I confirm no single order in this pilot will exceed the declared maximum order amount, and I " +
    "will not raise that amount without a new, separately recorded approval.",
  single_strategy_or_narrow_strategy_set:
    "I confirm this pilot runs a single strategy or a narrow, explicitly listed set of strategies, " +
    "and I will not add an unlisted strategy to this pilot without a new, separately recorded " +
    "approval.",
  kill_switch_readiness:
    "I confirm I have personally verified the kill switch can be activated and that activation " +
    "blocks new order approval, and I know how to activate it manually before this future first " +
    "trade is placed.",
  rollback_reconciliation_rehearsal:
    "I confirm I have personally rehearsed the rollback and reconciliation procedure against " +
    "mocked or simulated state, per docs/phase8/rollback-drill-runbook.md, before this future " +
    "first trade is placed.",
  post_trade_manual_review_commitment:
    "I commit to personally, manually reviewing this future first trade's outcome, fills, and " +
    "reconciliation state myself before placing any subsequent order, and I will not rely on any " +
    "automated process to perform this review on my behalf.",
  stop_criteria_after_first_trade:
    "I confirm that after this future first trade, trading stops for human review, and I will not " +
    "place a second trade until I have completed that review and recorded a new decision to " +
    "proceed."
});

/**
 * "Narrow" strategy set ceiling. Deliberately small and fixed by policy, not
 * caller-configurable, per `docs/07_Trading_System.md` section 30's
 * "limited number of strategies."
 */
export const FIRST_TRADE_MAX_NARROW_STRATEGY_COUNT = 3;

// ---------------------------------------------------------------------------
// Prohibited-content checks
// ---------------------------------------------------------------------------

/**
 * Matches text that looks like a secret: tokens, client/app secrets, API
 * keys, authorization headers, bearer values, passwords, private keys.
 * Mirrors the discipline already established by
 * `live-blocker-evidence-intake.ts` and
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
 * Matches identity tokens that indicate an attester's name or role is
 * claiming to be an AI/automated system rather than a human. This never
 * proves a human actually performed the attestation, but it structurally
 * blocks the most obvious way an AI-generated attestation could be passed
 * off as a human's own sign-off.
 */
const disallowedAttesterIdentityPattern =
  /\b(ai|artificial[\s-]?intelligence|claude|chatgpt|gpt-?\d*|codex|anthropic|openai|copilot|assistant|bot|automated|algorithm)\b/i;

function scanForProhibitedContent(fieldName: string, text: string, reasonCodes: Set<string>): void {
  if (secretLikePattern.test(text)) {
    reasonCodes.add(`protocol_input_may_contain_secret_${fieldName}`);
  }
  if (accountIdentifierLikePattern.test(text)) {
    reasonCodes.add(`protocol_input_may_contain_account_identifier_${fieldName}`);
  }
  if (rawPayloadLikePattern.test(text)) {
    reasonCodes.add(`protocol_input_looks_like_raw_payload_${fieldName}`);
  }
  if (requestHeaderLikePattern.test(text)) {
    reasonCodes.add(`protocol_input_may_contain_request_header_${fieldName}`);
  }
}

function checkHumanAttesterIdentity(fieldName: string, text: string, reasonCodes: Set<string>): void {
  scanForProhibitedContent(fieldName, text, reasonCodes);
  if (disallowedAttesterIdentityPattern.test(text)) {
    reasonCodes.add(`protocol_attester_identity_not_human_${fieldName}`);
  }
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

/**
 * A single caller-supplied, sanitized attestation record for one checklist
 * topic. This codebase never constructs a `confirmed: true` instance of
 * this type on a human's behalf; it only validates the shape of one
 * supplied by the caller (in practice, typed in by the operator).
 */
export interface FirstTradeProtocolAttestation {
  confirmed: boolean;
  /** Must equal the corresponding entry in `REQUIRED_FIRST_TRADE_ATTESTATIONS` verbatim. */
  statement: string;
  /** The attester's own name, typed by them. Never a broker account identifier or secret. */
  attestedByName: string;
  /** The attester's actual human role (for example "Operator/Owner"). Never "AI" or "System". */
  attestedByRole: string;
  attestedAt: Date;
}

/**
 * Corroborating kill-switch signal, structurally compatible with
 * `KillSwitchTradingGate` from
 * `src/application/kill-switch/kill-switch-control-service.ts`. This module
 * deliberately consumes a small, locally-defined duck-typed shape (not the
 * full kill-switch type, which also carries a `brokerWriteGate`) so it
 * never needs to import from `src/application/kill-switch` and can never
 * accidentally drift out of sync with fields it does not use — the same
 * decoupling rationale already used by `SmallCapitalKillSwitchSignal` in
 * `small-capital-readiness.ts`.
 */
export interface FirstTradeKillSwitchReadinessSignal {
  /** Mirrors `KillSwitchTradingGate.allowed`. */
  allowed: boolean;
  /** Mirrors `KillSwitchTradingGate.blocksNewOrders`. */
  blocksNewOrders: boolean;
  reasonCodes: string[];
}

/**
 * Corroborating rollback/reconciliation rehearsal signal. `rehearsed`
 * reflects whether the seven-step rehearsal in
 * `docs/phase8/rollback-drill-runbook.md` was actually walked through
 * (never assumed true by default); `liveReadinessBlocked` and `stale`
 * mirror the corresponding fields of `ReconciliationWorkflowResult` from
 * `src/application/reconciliation/reconciliation-workflow-service.ts`, kept
 * as a locally-defined shape for the same import-cycle-avoidance reason as
 * `SmallCapitalReconciliationSignal`.
 */
export interface FirstTradeRollbackReconciliationRehearsalSignal {
  /** True only when a human actually walked through the rehearsal steps, not merely attested to intending to. */
  rehearsed: boolean;
  /** Mirrors `ReconciliationWorkflowResult.liveReadinessBlocked`. */
  liveReadinessBlocked: boolean;
  /** Mirrors `ReconciliationWorkflowResult.stale`. */
  stale: boolean;
  reasonCodes: string[];
}

/**
 * Structured stop-criteria commitment. A plain confirmed attestation string
 * is not sufficient for this topic on its own — `stopsAfterFirstTrade` must
 * be explicitly `true`, and `description` must be a non-empty, sanitized,
 * operator-authored explanation of how the review-before-continuing
 * decision will actually be made.
 */
export interface FirstTradeStopCriteria {
  stopsAfterFirstTrade: boolean;
  description: string;
}

export interface FirstTradeOperatingProtocolInput {
  /** Evaluation time. Required; used to reject attestations claiming to occur in the future. */
  now: Date;
  /** One attestation per topic in `FIRST_TRADE_PROTOCOL_TOPICS`. A missing topic is a blocking condition. */
  attestations: Partial<Record<FirstTradeProtocolTopic, FirstTradeProtocolAttestation>>;
  /** Declared capital ceiling for the `limited_capital_mode` topic. Must be a positive `Money`. */
  maxTotalCapitalExposure?: Money | undefined;
  /** Declared per-order ceiling for the `maximum_order_amount_policy` topic. Must be a positive `Money`. */
  maxOrderAmount?: Money | undefined;
  /** Strategy identifiers for the `single_strategy_or_narrow_strategy_set` topic. Never symbols or order details. */
  strategyIds?: string[] | undefined;
  killSwitchReadiness?: FirstTradeKillSwitchReadinessSignal | undefined;
  rollbackReconciliationRehearsal?: FirstTradeRollbackReconciliationRehearsalSignal | undefined;
  stopCriteria?: FirstTradeStopCriteria | undefined;
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

/**
 * Deliberately does not include any status resembling "APPROVED",
 * "EXECUTE", or "PLACED" — this evaluator never approves or executes
 * anything. `READY_FOR_HUMAN_REVIEW` means the checklist itself currently
 * reads as complete; it is not, and can never become, a decision to trade.
 */
export type FirstTradeOperatingProtocolStatus = "NOT_READY_FOR_HUMAN_REVIEW" | "READY_FOR_HUMAN_REVIEW";

export const FIRST_TRADE_OPERATING_PROTOCOL_STATEMENT =
  "This report is a HUMAN-EXECUTED CHECKLIST EVALUATION ONLY. It never creates, approves, sizes, " +
  "or submits any order, and it never causes a first trade to be placed automatically or on any " +
  "schedule. status and readyForHumanReview describe only whether the operator's own recorded " +
  "attestations and corroborating safety signals are currently complete and consistent. A human " +
  "operator must still personally execute every step of this protocol, personally decide whether " +
  "and when to place a future first trade through the existing manually-operated broker channel, " +
  "and personally record the outcome. liveBrokerWriteAllowed and automaticFirstTradeAllowed are " +
  "hardcoded literal false values in this evaluator's implementation; no combination of input can " +
  "change them.";

export interface FirstTradeOperatingProtocolReport {
  status: FirstTradeOperatingProtocolStatus;
  /** True only when every checklist item below currently passes. Never trading authorization on its own. */
  readyForHumanReview: boolean;
  blockingReasonCodes: string[];
  warnings: string[];
  /**
   * Always literal `false`. Mirrors `liveBrokerWriteAllowed` on
   * `ReconciliationWorkflowResult` and `SmallCapitalReadinessReport`.
   */
  liveBrokerWriteAllowed: false;
  /**
   * Always literal `false`. This evaluator cannot cause a first trade to be
   * placed under any combination of inputs — placing it remains a human,
   * manual, out-of-codebase action.
   */
  automaticFirstTradeAllowed: false;
  /** Verbatim copy of `FIRST_TRADE_OPERATING_PROTOCOL_STATEMENT`. */
  protocolStatement: string;
  generatedAt: Date;
  safetyType: "FIRST_TRADE_OPERATING_PROTOCOL_REPORT_EVALUATION_ONLY";
}

// ---------------------------------------------------------------------------
// Evaluator
// ---------------------------------------------------------------------------

export function evaluateFirstTradeOperatingProtocol(
  input: FirstTradeOperatingProtocolInput
): FirstTradeOperatingProtocolReport {
  const blockingReasonCodes = new Set<string>();
  const warnings: string[] = [];

  const validNow = Boolean(input.now) && !Number.isNaN(input.now.getTime());
  if (!validNow) {
    blockingReasonCodes.add("missing_or_invalid_evaluation_time");
  }

  for (const topic of FIRST_TRADE_PROTOCOL_TOPICS) {
    checkAttestation(topic, input.attestations?.[topic], validNow ? input.now : undefined, blockingReasonCodes);
  }

  checkPositiveMoney(input.maxTotalCapitalExposure, "max_total_capital_exposure", blockingReasonCodes);
  checkPositiveMoney(input.maxOrderAmount, "max_order_amount", blockingReasonCodes);
  checkStrategySet(input.strategyIds, blockingReasonCodes);
  checkKillSwitchReadiness(input.killSwitchReadiness, blockingReasonCodes);
  checkRollbackReconciliationRehearsal(input.rollbackReconciliationRehearsal, blockingReasonCodes);
  checkStopCriteria(input.stopCriteria, blockingReasonCodes);

  const sortedBlockingReasonCodes = [...blockingReasonCodes].sort();
  const readyForHumanReview = sortedBlockingReasonCodes.length === 0;

  return {
    status: readyForHumanReview ? "READY_FOR_HUMAN_REVIEW" : "NOT_READY_FOR_HUMAN_REVIEW",
    readyForHumanReview,
    blockingReasonCodes: sortedBlockingReasonCodes,
    warnings,
    liveBrokerWriteAllowed: false,
    automaticFirstTradeAllowed: false,
    protocolStatement: FIRST_TRADE_OPERATING_PROTOCOL_STATEMENT,
    generatedAt: input.now,
    safetyType: "FIRST_TRADE_OPERATING_PROTOCOL_REPORT_EVALUATION_ONLY"
  };
}

function checkAttestation(
  topic: FirstTradeProtocolTopic,
  record: FirstTradeProtocolAttestation | undefined,
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

  if (record.statement !== REQUIRED_FIRST_TRADE_ATTESTATIONS[topic]) {
    reasons.add(`attestation_statement_mismatch_${topic}`);
  }

  if (!record.attestedByName || !record.attestedByName.trim()) {
    reasons.add(`attestation_missing_attester_name_${topic}`);
  } else {
    checkHumanAttesterIdentity(`attester_name_${topic}`, record.attestedByName, reasons);
  }

  if (!record.attestedByRole || !record.attestedByRole.trim()) {
    reasons.add(`attestation_missing_attester_role_${topic}`);
  } else {
    checkHumanAttesterIdentity(`attester_role_${topic}`, record.attestedByRole, reasons);
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
    reasons.add("missing_strategy_set");
    return;
  }

  if (strategyIds.length > FIRST_TRADE_MAX_NARROW_STRATEGY_COUNT) {
    reasons.add("strategy_set_not_narrow");
  }

  const seen = new Set<string>();
  for (const id of strategyIds) {
    if (!id || !id.trim()) {
      reasons.add("strategy_set_contains_blank_id");
      continue;
    }

    if (seen.has(id)) {
      reasons.add("strategy_set_contains_duplicate_id");
    }
    seen.add(id);
    scanForProhibitedContent("strategy_id", id, reasons);
  }
}

function checkKillSwitchReadiness(signal: FirstTradeKillSwitchReadinessSignal | undefined, reasons: Set<string>): void {
  if (!signal) {
    reasons.add("missing_kill_switch_readiness_signal");
    return;
  }

  if (!signal.allowed || signal.blocksNewOrders) {
    reasons.add("kill_switch_not_ready_for_first_trade");
  }
}

function checkRollbackReconciliationRehearsal(
  signal: FirstTradeRollbackReconciliationRehearsalSignal | undefined,
  reasons: Set<string>
): void {
  if (!signal) {
    reasons.add("missing_rollback_reconciliation_rehearsal_signal");
    return;
  }

  if (!signal.rehearsed) {
    reasons.add("rollback_reconciliation_rehearsal_not_completed");
  }

  if (signal.liveReadinessBlocked) {
    reasons.add("reconciliation_not_fully_resolved");
  }

  if (signal.stale) {
    reasons.add("reconciliation_stale");
  }
}

function checkStopCriteria(criteria: FirstTradeStopCriteria | undefined, reasons: Set<string>): void {
  if (!criteria) {
    reasons.add("missing_stop_criteria");
    return;
  }

  if (criteria.stopsAfterFirstTrade !== true) {
    reasons.add("stop_criteria_does_not_stop_after_first_trade");
  }

  if (!criteria.description || !criteria.description.trim()) {
    reasons.add("stop_criteria_missing_description");
  } else {
    scanForProhibitedContent("stop_criteria_description", criteria.description, reasons);
  }
}
