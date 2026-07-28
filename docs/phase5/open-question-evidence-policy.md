# Phase 5 Open Question Evidence Policy

Version: 0.1.0
Status: Active
Last Updated: 2026-07-28
Applies To: OQ-001, OQ-002, OQ-003, OQ-004 in `docs/open_questions.md`

## Purpose

Phase 5 collects sanitized read-only evidence about Toss Securities behavior.
That evidence is useful. It is also easy to misread as authorization.

This document exists because of Finding H3 in
`docs/reviews/Codex_Phase5_Architecture_Review.md`: Phase 5 requires evidence
for OQ-001 through OQ-004, but `docs/open_questions.md` previously tracked
only a single `Status` field and did not say how evidence changes that
status, or what evidence does and does not authorize.

The rule in one sentence:

> Evidence supports review. Evidence is not a decision. A decision is not a
> live-trading authorization.

## The Seven States

Phase 5 evidence and question status move through a defined sequence. Read it
top to bottom — each state requires the one before it.

| # | State | Set by | Meaning |
|---|-------|--------|---------|
| 1 | `NO_EVIDENCE` | default | No evidence item exists for this open question. |
| 2 | `EVIDENCE_COLLECTED` | code (`TossOpenQuestionEvidenceTracker`) | At least one evidence item exists for this open question, but it has not passed sanitization: it may be unmarked as sanitized, may contain a credential, or may contain a live-write operation shape. |
| 3 | `EVIDENCE_SANITIZED` | code (`TossOpenQuestionEvidenceTracker`) | At least one evidence item exists, is marked `sanitized: true`, has `containsCredential: false`, and has `liveWriteOperation: false`. This is the highest state the tracker can compute. It means evidence is **ready for a human to read**, nothing more. |
| 4 | `EVIDENCE_REVIEWED` | human only | A named reviewer has actually read the sanitized evidence and recorded a reviewed date in `docs/open_questions.md`. No code can certify this — reading and judgment are human acts. |
| 5 | `QUESTION_IN_REVIEW` | human only | A human has changed the question's `Status` field in `docs/open_questions.md` from `OPEN` to `IN_REVIEW`, after evidence review, because the evidence is substantive enough to actively work the question toward a decision. |
| 6 | `QUESTION_RESOLVED` | human only | A human has recorded an explicit decision, rationale, and reviewed date, and changed `Status` to `RESOLVED`. This must only happen when the question is actually answered with confidence (for example: official Toss documentation, developer console evidence, or written support confirmation) — never solely because sanitized evidence exists. |
| — | `LIVE_TRADING_STILL_BLOCKED` | permanent, parallel | Not a step in the sequence above. This condition is true in every one of states 1 through 6, for every open question, throughout Phase 5. Reaching `QUESTION_RESOLVED` on OQ-001 through OQ-004 does not clear this condition; it is cleared only by separate compliance, risk, money, and broker-write implementation gates outside Phase 5 evidence work. |

States 1 through 3 are what `src/application/toss/open-question-evidence-tracker.ts`
computes from evidence item fields alone
(`TossOpenQuestionEvidenceStatus.evidenceStatus`). States 4 through 6 are
declared only by a human editing `docs/open_questions.md` directly — the
tracker exports `humanDeclaredOpenQuestionEvidenceStates` purely as a shared
vocabulary, and never emits those values itself.

## Non-Negotiable: What Evidence Does Not Authorize

For OQ-001, OQ-002, OQ-003, and OQ-004, at every state above — including
`QUESTION_RESOLVED` — Phase 5 evidence and question resolution do **not**, by
themselves, authorize any of the following:

- Toss order creation
- Toss order cancellation
- Toss order replacement
- live capital use
- production reconciliation based on unverified identifiers

Live broker write authorization is a separate decision governed by
`docs/11_AI_RULES.md` (Rules 1, 4, 14, 17), the risk engine, the money
management engine, the order approval engine, and explicit compliance
sign-off. Resolving an open question can remove a documentation blocker; it
cannot substitute for any of those gates.

## Per-Question Notes

### OQ-001: Toss Securities Automated Trading Permission

Evidence for OQ-001 (API terms review, developer console screenshots
described in text, written Toss confirmation) can move this question toward
`RESOLVED`. Even a fully resolved OQ-001 does not itself flip on live
automated order submission — it removes one documented blocker. Order
submission still requires the full `Signal -> OrderIntent -> RiskCheck ->
MoneyCheck -> OrderApproval -> TossSecuritiesAdapter` path from
`docs/11_AI_RULES.md` Rule 1.

### OQ-002: Toss Account and Permission Model

Evidence here (account/permission field shapes from read-only account
snapshot calls) supports mapping design for `BrokerAccount` and `Portfolio`.
It does not authorize production reconciliation until the identifiers it
describes have themselves been verified as stable (see OQ-003) and the
mapping has been implemented and tested.

### OQ-003: Toss Order and Fill Identifiers

Evidence here supports idempotency and reconciliation design. Evidence
alone — even sanitized order/fill identifier samples — does not authorize
production reconciliation. Rule 16 in `docs/11_AI_RULES.md` still applies:
unknown broker state must be represented as
`UNKNOWN_REQUIRES_RECONCILIATION` and blocks dependent trading until
resolved through the real reconciliation process, not through open-question
evidence.

### OQ-004: Toss ETF, Fractional, and Extended-Hours Support

Evidence here (documentation of supported instrument types and trading
windows) supports scoping which order types are even worth building. It does
not authorize ETF, fractional, or extended-hours order submission. Those
remain blocked by the same order-approval path as any other live order.

## How This Interacts With the Evidence Tracker

`TossOpenQuestionEvidenceTracker.review()` in
`src/application/toss/open-question-evidence-tracker.ts` reports, per open
question:

- `evidenceCount` — how many evidence items reference this open question.
- `validEvidenceCount` — how many of those are sanitized, credential-free, and free of live-write shapes.
- `evidenceStatus` — `NO_EVIDENCE`, `EVIDENCE_COLLECTED`, or `EVIDENCE_SANITIZED` (see table above).
- `readyForReview` — true once `evidenceStatus` reaches `EVIDENCE_SANITIZED`.

The review result also always carries `liveBrokerWriteAllowed: false` and
`liveTradingAuthorized: false`, regardless of how many open questions are
ready for review. Those two fields exist specifically so that no caller can
mistake "all four open questions are ready for review" for "live trading is
authorized."

This tracker performs no network calls. It only evaluates evidence items
passed to it in memory (typically loaded from a sanitized local evidence
manifest). It does not read or write `docs/open_questions.md`; keeping that
document in sync with reviewed evidence is a human editorial step.

## How To Use This When Updating `docs/open_questions.md`

When you have sanitized, reviewed evidence for an open question:

1. Confirm `npm run phase5:toss:open-questions` reports `EVIDENCE_SANITIZED` (or equivalent `readyForReview: true`) for that question, using only locally recorded sanitized evidence.
2. Have a human read the evidence and record: reviewer, reviewed date, decision, and any remaining blockers, directly in the open question's entry in `docs/open_questions.md`.
3. Only after that human review is recorded may the question's `Status` field move from `OPEN` to `IN_REVIEW`.
4. Only move `Status` to `RESOLVED` when the question is genuinely answered, with the decision and rationale recorded — never automatically, and never solely because evidence exists.
5. At every step, leave the "Blocks" list and any live-trading blocker language in `docs/open_questions.md` and `docs/11_AI_RULES.md` untouched. Resolving an open question narrows a documentation blocker; it does not authorize a live broker write anywhere.
