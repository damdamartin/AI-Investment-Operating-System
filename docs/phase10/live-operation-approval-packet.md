# Phase 10 Live Operation Approval Packet (P10-001)

Version: 0.1.0
Status: Draft
Last Updated: 2026-07-29
Related Task: `docs/tasks/phase10_claude_worktree_tasks/P10-001_live_operation_approval_packet.md`
Related Code: `src/application/live-readiness/live-operation-approval-packet.ts`,
`tests/application/live-operation-approval-packet.test.ts`
Related Docs: `docs/phase10/README.md`,
`docs/phase9/small-capital-go-no-go-checklist.md`,
`docs/phase9/small-capital-enablement-gate.md`,
`docs/phase7/live-capable-blocker-register.md`,
`docs/phase8/README.md`, `docs/13_Compliance_and_Legal_Review.md`,
`docs/11_AI_RULES.md`

## Purpose

This document describes the Phase 10 live operation approval packet: a
pure evaluator that gathers already-computed Phase 7, Phase 8, and Phase 9
readiness/evidence outputs into a single sanitized, human-readable
go/no-go packet for a human operator to read before deciding whether to
begin a future, separately reviewed live-implementation phase.

Per `docs/phase10/README.md`, Phase 10 round 1:

- is still no-write
- does not authorize live trading
- does not implement a real Toss broker-write adapter
- does not place, cancel, replace, transfer, withdraw, or convert anything
- does not mark any `LCB-*` blocker resolved
- must never set `liveBrokerWriteAllowed: true` in any runtime path

This packet is the final human-facing composition point for that boundary,
one level above `evaluateSmallCapitalEnablementGate`
(`docs/phase9/small-capital-enablement-gate.md`). Its single most important
property, exactly like every gate below it in this codebase, is:

> **This packet may report that all preparation evidence is present and
> fresh. It must never, under any input, flip live write authorization on.**

## Two Concepts That Must Never Be Conflated

Restating the same distinction already drawn by
`docs/phase9/small-capital-enablement-gate.md`,
`docs/phase8/deployment-readiness-gate.md`, and
`src/application/live-readiness/small-capital-readiness.ts`:

1. **Evidence completeness** (`allEvidenceComplete`) — whether the
   evidence this packet can see (the Phase 9 P9-001 blocker register
   review, the Phase 9 P9-003 enablement gate report, and this packet's own
   stricter human-evidence freshness check) is currently clean, complete,
   and fresh.
2. **Live-trading authorization** (`readyForLiveOperation` /
   `liveBrokerWriteAllowed`) — an entirely separate concept that this
   module cannot compute, grant, or imply under any circumstance. Both
   fields are literal `false` return values, never derived from (1), never
   derived from any upstream report, and never derived from any input
   combination whatsoever.

A clean `allEvidenceComplete: true` reading is never, under any input, a
live-trading authorization. It is not even a human-approval record: it
only says the evidence this codebase can machine-check is currently
present and not obviously stale. The only things that can authorize live
trading are the human processes already described in
`docs/phase7/manual-live-approval-record.md` and the human-reviewer
sign-offs recorded directly in
`docs/phase7/live-capable-blocker-register.md`.

## What The Evaluator Is

`evaluateLiveOperationApprovalPacket` (in
`src/application/live-readiness/live-operation-approval-packet.ts`) is a
pure function. It has no network code, no filesystem access, no broker
client, and no side effects of any kind. Given an already-computed input
object, it returns a `LiveOperationApprovalPacket` describing:

- `blockerSummary` — all eight `LCB-001`..`LCB-008` blockers, in fixed
  order, with each blocker's title and human-owner role (from
  `LIVE_BLOCKER_CATALOG`), its status as read from the caller-supplied
  Phase 9 P9-001 `LiveBlockerEvidenceRegisterReview`, and whether this
  packet's own stricter freshness check also passes.
- `humanReviewSummary` — a completeness rollup across those eight
  blockers: how many are both `HUMAN_REVIEWED` and fresh, which are
  missing, which have evidence but no completed human review yet, and
  which have gone stale.
- `phase8Summary` — the Phase 8 operations/deployment/backup-restore
  readiness views, reused directly from the caller-supplied Phase 9 P9-003
  `SmallCapitalEnablementGateReport` (which already folds this evidence in
  correctly; this packet does not re-derive it).
- `phase9Summary` — the Phase 9 preparation-gate result itself
  (`readyForSmallCapitalPreparation`), plus the Phase 7 small-capital
  design-time readiness view it already folds in, plus a cross-reference
  copy of the gate's own (independently caller-supplied) live-blocker view.
- `allEvidenceComplete` — `true` only when every one of the above is
  clean. Evidence completeness only; never authorization.
- `blockingReasonCodes` / `warnings` — the union of every blocking and
  non-blocking finding across all of the above.
- `readyForLiveOperation: false` and `liveBrokerWriteAllowed: false` —
  hardcoded literals, explained below.
- `approvalStatement` — the verbatim not-authorization statement, restated
  as data so a caller reading only the JSON output (a dashboard, a log
  line) still sees it.

## Inputs

`LiveOperationApprovalPacketInput`:

- `now: Date` — evaluation time; required for report timestamping and
  every staleness check.
- `blockerRegisterReview?: LiveBlockerEvidenceRegisterReview` — the Phase 9
  P9-001 register-level review across all eight blockers
  (`src/application/live-readiness/live-blocker-evidence-intake.ts`,
  `LiveBlockerEvidenceRegisterReviewer.review(...)`). Missing entirely, or
  missing an individual blocker's entry, fails closed.
- `enablementGate?: SmallCapitalEnablementGateReport` — the Phase 9 P9-003
  small-capital enablement gate report
  (`src/application/live-readiness/small-capital-enablement-gate.ts`,
  `evaluateSmallCapitalEnablementGate(...)`), which already composes Phase
  7 small-capital design-time readiness and Phase 8
  operations/deployment/backup-restore readiness. Missing entirely fails
  closed.
- `humanEvidenceFreshness?: LiveOperationHumanEvidenceFreshnessEntry[]` —
  this packet's own sanitized `{ blockerId, reviewedAt }` dates, one per
  blocker the caller believes is `HUMAN_REVIEWED`. Nothing else about the
  underlying evidence record (reviewer name, evidence source references,
  attestation text) is accepted here; those already live in, and are
  already scanned for prohibited content by,
  `LiveBlockerEvidenceRecord` one layer down.

This module intentionally accepts only already-computed, already-sanitized
plain data. It never fetches, imports, or invokes broker/network behavior
of any kind, and it never reads `.env` or `tmp/phase5`.

## Why This Packet Has Its Own Staleness Gate

`live-blocker-evidence-intake.ts` already warns (non-blocking) when a
single evidence record's `reviewDate` is more than 180 days old. That
threshold is appropriate for evidence intake during ongoing preparation
work: a warning is enough to prompt a human to consider re-review, but it
should not block the intake tool itself.

This packet is meant to be read as the **final** pre-live checkpoint, one
step closer to a human actually deciding whether to start a future
live-implementation phase. A blocker whose most recent human review is old
enough to plausibly be based on stale broker terms, stale account
permissions, or a stale compliance posture should not silently count as
"reviewed" at this final step. So this packet applies its own, stricter,
**blocking** window:

```text
MAX_HUMAN_EVIDENCE_AGE_DAYS_BEFORE_STALE = 120
```

For every blocker whose register status is `HUMAN_REVIEWED`, this packet
requires a matching `humanEvidenceFreshness` entry with a valid,
non-future `reviewedAt` no older than 120 days. Any of the following fails
closed (the blocker's `evidenceStale` is `true`, `humanReviewComplete` is
`false`, and `allEvidenceComplete` becomes `false`):

- no `humanEvidenceFreshness` entry supplied for that blocker at all
- an invalid date
- a date in the future
- a date more than 120 days before `now`

This is deliberately independent of, and in addition to, the underlying
evidence-intake module's own 180-day warning. Passing the looser upstream
check never substitutes for passing this packet's stricter one.

## How `readyForLiveOperation` / `liveBrokerWriteAllowed` Are Proven
Unconditional

Exactly like `SmallCapitalEnablementGateReport.readyForLiveBrokerWrites` /
`.liveBrokerWriteAllowed` and
`LiveBlockerEvidenceRegisterReview.liveBrokerWriteAllowed` /
`.blockerRegisterResolutionAllowed` before it:

- `readyForLiveOperation` and `liveBrokerWriteAllowed` are written once, as
  the bare literal `false`, at the evaluator's single return statement.
  There is no branch, ternary, ternary chain, or expression anywhere in
  `live-operation-approval-packet.ts` that can produce `true` for either
  field.
- `tests/application/live-operation-approval-packet.test.ts` includes a
  dedicated "maximally clean input" fixture — every upstream report clean,
  every `LCB-*` blocker `HUMAN_REVIEWED` and within the 120-day freshness
  window — and asserts both fields are still `false`, including a raw
  `JSON.stringify` scan for the literal substrings `"readyForLiveOperation":true`
  and `"liveBrokerWriteAllowed":true`.
- The evaluator never trusts an upstream report's own no-live-write
  literals at face value. It re-checks
  `blockerRegisterReview.liveBrokerWriteAllowed`,
  `blockerRegisterReview.blockerRegisterResolutionAllowed`,
  `enablementGate.liveBrokerWriteAllowed`, and
  `enablementGate.readyForLiveBrokerWrites`, and treats any unexpected
  value on any of them as a blocking, reportable condition. This can never
  flip this packet's own literals to `true` either way — it only adds a
  blocking reason code such as
  `enablement_gate_ready_for_live_broker_writes_not_false`.

## Resolved-Status Exclusion

This packet's blocker status vocabulary
(`LiveOperationApprovalPacketBlockerStatus`) is
`LiveBlockerEvidenceRegisterBlockerStatus | "NOT_PROVIDED"` — that is,
`"REJECTED" | "READY_FOR_HUMAN_REVIEW" | "HUMAN_REVIEWED" | "MISSING" |
"DUPLICATE" | "NOT_PROVIDED"`. The human-only resolved-status literal that
belongs exclusively to
`docs/phase7/live-capable-blocker-register.md` is not, and cannot be, a
member of this union. There is no reachable code path in this module that
produces it, and
`tests/application/live-operation-approval-packet.test.ts` asserts a
`JSON.stringify` of a fully clean packet never contains that literal
string.

Marking any `LCB-*` blocker resolved happens only when a human edits
`docs/phase7/live-capable-blocker-register.md` directly, following that
file's own rules. This packet does not write to that file, does not
reference a writable path for it, and does not treat any combination of
clean evidence as equivalent to that human act.

## What A Fully Passing Packet Actually Means

Even with `allEvidenceComplete: true`:

- No real Toss API call has been made, or is possible from this codebase.
- No `TossSecuritiesAdapter` write implementation exists.
- No `LCB-*` blocker in `docs/phase7/live-capable-blocker-register.md` is
  marked resolved merely because this packet reports evidence-complete —
  that only happens in that register, by a human, per its own rules.
- `report.humanReviewSummary.allBlockersHumanReviewedAndFresh: true` means
  the register review this packet was given claims every blocker was
  human-reviewed within the freshness window. It does not independently
  verify that a real human actually performed that review; it can only
  check the shape and freshness of what it was handed. Per
  `docs/phase9/small-capital-go-no-go-checklist.md`, a human operator must
  still independently confirm the underlying review actually happened.
- The decision to begin a future, separately reviewed live-implementation
  phase remains entirely a human decision, made outside of this codebase,
  informed by — but never automated by — this packet.

## Non-Goals

- This packet is not a substitute for
  `docs/phase7/manual-live-approval-record.md`.
- It is not a substitute for compliance/legal review
  (`docs/13_Compliance_and_Legal_Review.md` Section 9).
- It does not grant, imply, or shortcut any approval.
- It cannot be completed by an AI agent on a human's behalf.
