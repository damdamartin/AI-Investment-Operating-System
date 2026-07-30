#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const candidatePath = resolve(
  process.cwd(),
  process.argv[2] ?? "docs/phase10/first-order-candidate.operator.json"
);

const allowedMarkets = new Set(["KR", "US"]);
const allowedSides = new Set(["BUY", "SELL"]);
const allowedCurrencies = new Set(["KRW", "USD"]);

const report = {
  candidatePath,
  readyForHumanOneOrderReview: false,
  orderSubmissionAllowed: false,
  liveBrokerWriteAllowed: false,
  networkCallsPerformed: false,
  rawBrokerPayloadStored: false,
  sanitizedCandidate: null,
  reasonCodes: [],
  warnings: [],
  safetyType: "PHASE10_FIRST_ORDER_CANDIDATE_REVIEW_ONLY"
};

let candidate;
try {
  candidate = JSON.parse(readFileSync(candidatePath, "utf8"));
} catch {
  report.reasonCodes.push("candidate_file_unreadable_or_invalid_json");
  finish();
}

if (candidate) review(candidate);
finish();

function review(candidate) {
  requireExact(candidate.candidateVersion, "1", "unsupported_candidate_version");
  requireNonEmpty(candidate.candidateId, "missing_candidate_id");
  requireNonEmpty(candidate.createdAt, "missing_created_at");
  requireExact(candidate.source, "OPERATOR_DASHBOARD_MINIMUM_CAPITAL_RECORD", "unsupported_candidate_source");

  if (!allowedMarkets.has(candidate.market)) report.reasonCodes.push("unsupported_market");
  if (!allowedSides.has(candidate.side)) report.reasonCodes.push("unsupported_side");
  requireExact(candidate.orderType, "LIMIT", "order_type_must_be_limit");
  if (!allowedCurrencies.has(candidate.currency)) report.reasonCodes.push("unsupported_currency");

  const symbol = normalizeSymbol(candidate.symbol);
  if (!symbol) report.reasonCodes.push("missing_or_invalid_symbol");

  const quantity = parsePositiveNumber(candidate.quantity);
  const limitPrice = parsePositiveNumber(candidate.limitPrice);
  const maxOrderAmount = parsePositiveNumber(candidate.maxOrderAmount);

  if (!quantity) report.reasonCodes.push("quantity_must_be_positive");
  if (!limitPrice) report.reasonCodes.push("limit_price_must_be_positive");
  if (!maxOrderAmount) report.reasonCodes.push("max_order_amount_must_be_positive");

  if (quantity && limitPrice && maxOrderAmount) {
    const notional = quantity * limitPrice;
    if (notional > maxOrderAmount + 0.00000001) {
      report.reasonCodes.push("candidate_notional_exceeds_max_order_amount");
    }
  }

  requireExact(candidate.humanApprovalStatus, "HUMAN_APPROVED", "human_approval_missing");
  requireNonEmpty(candidate.humanApprovalMemo, "missing_human_approval_memo");
  requireNonEmpty(candidate.aiRationale, "missing_ai_rationale");
  requireNonEmpty(candidate.stopCondition, "missing_stop_condition");
  requireExact(candidate.actualOrderTransmission, "BLOCKED", "actual_order_transmission_must_remain_blocked");

  if (String(candidate.humanApprovalMemo ?? "").match(/\b(ai|codex|claude|chatgpt)\b/i)) {
    report.reasonCodes.push("human_approval_memo_must_not_name_ai_as_approver");
  }

  report.sanitizedCandidate = {
    candidateId: String(candidate.candidateId ?? ""),
    market: candidate.market,
    side: candidate.side,
    orderType: candidate.orderType,
    symbol,
    quantity: String(candidate.quantity ?? ""),
    limitPrice: String(candidate.limitPrice ?? ""),
    maxOrderAmount: String(candidate.maxOrderAmount ?? ""),
    currency: candidate.currency,
    humanApprovalStatus: candidate.humanApprovalStatus,
    actualOrderTransmission: candidate.actualOrderTransmission
  };

  report.readyForHumanOneOrderReview = report.reasonCodes.length === 0;
}

function requireExact(actual, expected, reasonCode) {
  if (actual !== expected) report.reasonCodes.push(reasonCode);
}

function requireNonEmpty(value, reasonCode) {
  if (typeof value !== "string" || value.trim().length === 0) report.reasonCodes.push(reasonCode);
}

function normalizeSymbol(value) {
  if (typeof value !== "string") return "";
  const symbol = value.trim().toUpperCase();
  return /^[A-Z0-9.:-]{1,16}$/.test(symbol) ? symbol : "";
}

function parsePositiveNumber(value) {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function finish() {
  report.reasonCodes = [...new Set(report.reasonCodes)].sort();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.reasonCodes.length === 0 ? 0 : 1);
}
