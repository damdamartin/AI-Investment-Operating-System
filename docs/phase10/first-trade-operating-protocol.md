# Phase 10 First-Trade Operating Protocol (P10-002)

Version: 0.1.0
Status: Draft
Last Updated: 2026-07-29
Related Task: `docs/tasks/phase10_claude_worktree_tasks/P10-002_first_trade_operating_protocol.md`
Related Code: `src/application/live-readiness/first-trade-operating-protocol.ts`,
`tests/application/first-trade-operating-protocol.test.ts`
Related Docs: `docs/phase10/README.md`, `docs/07_Trading_System.md`
(sections 22, 25, 30), `docs/08_Testing_Validation.md` (sections 12, 22),
`docs/phase7/small-capital-readiness-gates.md`,
`docs/phase8/rollback-drill-runbook.md`,
`docs/phase9/small-capital-go-no-go-checklist.md`, `docs/11_AI_RULES.md`

## Purpose

This document describes the Phase 10 first-trade operating protocol: a
pure, human-executed checklist evaluator for a **future** small-capital
live pilot's first trade. It is a design document and a design-time
evaluator, not an implementation of live trading and not a broker-write
adapter of any kind.

Per `docs/phase10/README.md`, Phase 10 round 1:

- does not authorize live trading
- does not implement a real Toss broker-write adapter
- does not place, cancel, replace, transfer, withdraw, or convert anything
- must never set `liveBrokerWriteAllowed: true` in any runtime path

This module's single most important property, restated because it is the
entire reason it exists:

> **This evaluator may report that a human's own recorded checklist is
> complete. It must never, under any input, place, approve, size, or
> schedule a trade — and it must never contain anything shaped like an
> executable broker order.**

## What This Protocol Is

`evaluateFirstTradeOperatingProtocol`
(`src/application/live-readiness/first-trade-operating-protocol.ts`) reads
a set of caller-supplied, sanitized attestations plus two corroborating
safety signals, and returns a report describing whether the human-executed
first-trade operating protocol currently reads as complete and internally
consistent.

It exists to give a human operator a single place to record — and a
machine to check the shape of — eight required attestations before that
operator personally, manually places a future small-capital pilot's first
trade through whatever broker channel they already operate outside this
codebase:

1. limited capital mode
2. limit-order-only policy
3. maximum order amount policy
4. single-strategy or narrow strategy set
5. kill-switch readiness
6. rollback/reconciliation rehearsal
7. post-trade manual review commitment
8. stop criteria after first trade

## What This Protocol Is Not

- It is not a substitute for `docs/phase7/manual-live-approval-record.md`
  or the numeric gates in `docs/phase7/small-capital-readiness-gates.md`
  (`evaluateSmallCapitalReadiness`). Those gates evaluate a *specific
  proposed order* against numeric capital limits and the full Phase
  6/7/8/9 safety chain. This protocol evaluates whether the *operator's own
  checklist for the act of placing a first trade at all* is complete. A
  future live-capable phase would need both to pass, not just one.
- It is not a substitute for `docs/phase8/rollback-drill-runbook.md`'s
  seven-step rehearsal evaluator (`evaluateBackupRestoreDrill`). This
  module's `rollbackReconciliationRehearsal` input is a caller-supplied
  summary signal, not a re-implementation of that rehearsal's own scoring.
- It does not decide, size, price, or schedule any trade. No type in
  `first-trade-operating-protocol.ts` combines a symbol/asset identifier, a
  quantity, a side (buy/sell), and a price — the specific shape that could
  be mistaken for, or repurposed as, an executable broker order.
- It cannot cause a trade to be placed automatically, on a schedule, or as
  a side effect of a clean report. Placing the future first trade remains
  an entirely human, manual, out-of-codebase action, every time.
- `readyForHumanReview: true` (`status: "READY_FOR_HUMAN_REVIEW"`) is
  evidence that the checklist is complete. It is not itself a review, and
  it is not itself permission. A human must still actually read the
  checklist, actually decide to proceed, and actually place the trade
  themselves.

## The Eight Checklist Topics

Each topic is defined in `FIRST_TRADE_PROTOCOL_TOPICS` and has a fixed,
exported, verbatim required attestation string in
`REQUIRED_FIRST_TRADE_ATTESTATIONS`. A caller (in practice, an operator
typing into whatever intake form or CLI wraps this evaluator) must supply a
`FirstTradeProtocolAttestation` per topic with:

- `confirmed: true`
- `statement` equal to the topic's required string, verbatim
- `attestedByName` and `attestedByRole` — the operator's own name and
  actual human role, never blank, never referencing an AI/automated system
- `attestedAt` — a valid timestamp not later than the evaluation time

A missing topic, an unconfirmed attestation, a mismatched statement, a
blank or AI-claiming name/role, or a missing/future timestamp is always a
blocking condition (`missing_attestation_<topic>`,
`attestation_not_confirmed_<topic>`,
`attestation_statement_mismatch_<topic>`,
`attestation_missing_attester_name_<topic>`,
`attestation_missing_attester_role_<topic>`,
`protocol_attester_identity_not_human_<field>`,
`attestation_missing_attested_at_<topic>`,
`attestation_attested_at_in_future_<topic>`).

### 1. Limited Capital Mode

Requires the topic attestation plus a positive `maxTotalCapitalExposure`
(`Money`, per `docs/11_AI_RULES.md` Rule 20 — never a naked number).
Blocking: `missing_max_total_capital_exposure`,
`invalid_max_total_capital_exposure`.

### 2. Limit-Order-Only Policy

Attestation only. The evaluator does not itself see or check any specific
order — the operator is attesting to a standing policy they personally
commit to enforcing for every trade in the pilot, per
`docs/07_Trading_System.md` section 25.

### 3. Maximum Order Amount Policy

Requires the topic attestation plus a positive `maxOrderAmount` (`Money`).
Blocking: `missing_max_order_amount`, `invalid_max_order_amount`.

### 4. Single-Strategy Or Narrow Strategy Set

Requires the topic attestation plus a non-empty `strategyIds` list of at
most `FIRST_TRADE_MAX_NARROW_STRATEGY_COUNT` (3) distinct, non-blank
strategy identifiers — never symbols or order details. Blocking:
`missing_strategy_set`, `strategy_set_not_narrow`,
`strategy_set_contains_duplicate_id`, `strategy_set_contains_blank_id`.

### 5. Kill-Switch Readiness

Requires the topic attestation **and** a corroborating
`killSwitchReadiness` signal (`FirstTradeKillSwitchReadinessSignal`,
structurally compatible with `KillSwitchTradingGate` from
`src/application/kill-switch/kill-switch-control-service.ts`). A confirmed
attestation alone is never sufficient: if the signal is missing, reports
`allowed: false`, or reports `blocksNewOrders: true`, the protocol blocks
regardless of what the attestation says
(`missing_kill_switch_readiness_signal`,
`kill_switch_not_ready_for_first_trade`). This is the "kill-switch
readiness ... fails closed" behavior required by the P10-002 completion
criteria.

### 6. Rollback/Reconciliation Rehearsal

Requires the topic attestation **and** a corroborating
`rollbackReconciliationRehearsal` signal
(`FirstTradeRollbackReconciliationRehearsalSignal`). `rehearsed` must be
`true` (the seven-step rehearsal in
`docs/phase8/rollback-drill-runbook.md` was actually walked through, not
merely intended); `liveReadinessBlocked` and `stale` mirror the
corresponding fields of `ReconciliationWorkflowResult` from
`src/application/reconciliation/reconciliation-workflow-service.ts` and
must both be `false`. Blocking:
`missing_rollback_reconciliation_rehearsal_signal`,
`rollback_reconciliation_rehearsal_not_completed`,
`reconciliation_not_fully_resolved`, `reconciliation_stale`.

### 7. Post-Trade Manual Review Commitment

Attestation only: the operator commits to personally reviewing the first
trade's outcome, fills, and reconciliation state before placing any
subsequent order, and to not delegating that review to any automated
process.

### 8. Stop Criteria After First Trade

Requires the topic attestation **and** a structured `stopCriteria` input
(`FirstTradeStopCriteria`) with `stopsAfterFirstTrade === true` (a plain
confirmed attestation string is not enough on its own) and a non-empty,
sanitized `description` of how the operator's own review-before-continuing
decision will actually be made. Blocking: `missing_stop_criteria`,
`stop_criteria_does_not_stop_after_first_trade`,
`stop_criteria_missing_description`.

## Sanitization

Every free-text field this module reads (attester names, attester roles,
strategy ids, the stop-criteria description) is scanned for secret-like,
account-identifier-like, raw-payload-like, and request-header-like content,
mirroring the discipline already established by
`src/application/live-readiness/live-blocker-evidence-intake.ts`. Any match
is a blocking `reasonCode`
(`protocol_input_may_contain_secret_<field>`,
`protocol_input_may_contain_account_identifier_<field>`,
`protocol_input_looks_like_raw_payload_<field>`,
`protocol_input_may_contain_request_header_<field>`), never a warning.

Attester names and roles are additionally scanned for text claiming to be
an AI/automated system (`protocol_attester_identity_not_human_<field>`).
This never proves a human actually performed the attestation, but it
structurally blocks the most obvious way an AI-generated attestation could
be passed off as a human's own sign-off.

## The Report

```text
FirstTradeOperatingProtocolReport {
  status: "NOT_READY_FOR_HUMAN_REVIEW" | "READY_FOR_HUMAN_REVIEW"
  readyForHumanReview: boolean
  blockingReasonCodes: string[]
  warnings: string[]
  liveBrokerWriteAllowed: false      // always literal false
  automaticFirstTradeAllowed: false  // always literal false
  protocolStatement: string          // verbatim FIRST_TRADE_OPERATING_PROTOCOL_STATEMENT
  generatedAt: Date
  safetyType: "FIRST_TRADE_OPERATING_PROTOCOL_REPORT_EVALUATION_ONLY"
}
```

`liveBrokerWriteAllowed` and `automaticFirstTradeAllowed` are hardcoded
literal `false` values in the evaluator's implementation. They are never
computed from `blockingReasonCodes`, never computed from
`readyForHumanReview`, and never computed from any input combination —
including a maximally clean one where every attestation, every signal, and
every structured field passes.

## How A Human Should Use This

1. Personally read `docs/07_Trading_System.md` sections 22, 25, and 30 and
   `docs/phase7/small-capital-readiness-gates.md` before recording any
   attestation.
2. Personally rehearse the rollback/reconciliation procedure per
   `docs/phase8/rollback-drill-runbook.md`, and record the resulting
   `rollbackReconciliationRehearsal` signal from that rehearsal's own
   evidence — never fabricate `rehearsed: true` without having actually
   done it.
3. Personally verify the kill switch can be activated and blocks new
   orders, and record the resulting `killSwitchReadiness` signal from that
   verification.
4. Type each of the eight required attestation strings verbatim, along
   with your own real name, real role, and the actual date you attested.
5. Call `evaluateFirstTradeOperatingProtocol` and read the report.
6. If `status === "READY_FOR_HUMAN_REVIEW"`, that means the checklist
   itself is complete — not that trading is authorized. Decide, on your
   own judgment and outside this codebase, whether and when to actually
   place the future first trade through your own manually-operated broker
   channel, and record the outcome yourself afterward per the post-trade
   review commitment above.
7. If any blocking reason code appears, stop. Do not attempt to work
   around it in code or by weakening an attestation string. Fix the
   underlying gap and re-run the evaluator from a clean state.

## Non-Goals

- It does not implement or enable any real Toss API call.
- It does not create a broker-write command of any kind, including an
  unused or example type.
- It does not create any code path capable of causing a trade to be placed
  automatically, on a schedule, or as a side effect of a clean report.
- It does not modify, weaken, or bypass `KillSwitchControlService` or
  `ReconciliationWorkflowService` — both are consumed read-only, by
  structurally-compatible shape only, never imported directly.
- It does not weaken any existing safety check, guard, or test assertion.
- `readyForHumanReview: true` from this evaluator is evidence that a
  human's own recorded checklist is currently complete. It is not, and can
  never become, live-trading authorization on its own.
