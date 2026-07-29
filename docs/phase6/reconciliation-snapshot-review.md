# Phase 6 Reconciliation Snapshot Review (P6-002)

Version: 0.1.0
Status: Draft
Task: `docs/tasks/phase6_claude_worktree_tasks/P6-002_reconciliation_snapshot_review.md`

## Purpose

This document describes the strengthened, read-only reconciliation review
implemented in:

- `src/application/reconciliation/reconciliation-service.ts`
- `src/application/reconciliation/reconciliation-workflow-service.ts`

It compares expected paper/simulation state against sanitized broker
snapshot summaries. It never calls a broker write endpoint, never produces
a correction command, and never mutates the compared inputs. It only
classifies and reports.

## Discrepancy Classification

Every `ReconciliationIssue` carries a deterministic `classification`:

- `INFORMATIONAL` — a non-zero difference was observed but stayed within
  policy tolerance (`POSITION_MINOR_VARIANCE`, `CASH_MINOR_VARIANCE`).
  Recorded for audit visibility only. Never blocks dependent trading and
  never blocks the live-readiness signal by itself.
- `BLOCKING` — a tolerance-exceeding mismatch (`POSITION_MISMATCH`,
  `CASH_MISMATCH`) or an unknown broker state (`BROKER_STATE_UNKNOWN`).
  Blocks dependent trading.
- `REQUIRES_HUMAN_REVIEW` — a structural gap where a position or cash
  balance exists on only one side (`POSITION_MISSING_INTERNAL`,
  `POSITION_MISSING_BROKER`, `CASH_MISSING_INTERNAL`,
  `CASH_MISSING_BROKER`). This system never guesses which side is correct;
  it always requires a human decision. Also blocks dependent trading.

`ReconciliationReport.issueCounts` rolls these up as
`{ informational, blocking, requiresHumanReview }` for quick review at the
report level; `ReconciliationWorkflowResult.issueCounts` mirrors the same
rollup for the workflow-evaluated result.

`ReconciliationReport.status` is `"CLEAN"` only when there are zero
`BLOCKING` or `REQUIRES_HUMAN_REVIEW` issues and no unknown-broker-state
reasons — a report with only informational variance is still `"CLEAN"`.
`status` is `"UNKNOWN"` whenever any part of the broker read path could not
be completed (auth failure, disabled read-only access, positions query
failure), which takes priority over any issue-based classification.

## Sanitization

Reported issues never include:

- a raw (unmasked) broker symbol — `ReconciliationIssue.ref` uses
  `redactSecret` (first 2 / last 2 characters, `****` in between; full mask
  for symbols of length <= 4) combined with non-sensitive classifier
  fields (market, asset type, currency)
- a raw account identifier — cash issues are keyed by currency only, never
  by `brokerAccountId`
- a raw quantity or raw price — issue `reason` values are fixed,
  deterministic reason codes (e.g. `position_quantity_mismatch`,
  `cash_available_and_reserved_mismatch`) describing *what* differed, never
  the literal compared values
- headers or tokens — this module never touches broker credentials at all;
  it only compares already-adapted `TossPositionSnapshot` /
  `BrokerCashSnapshot` values obtained from the existing read-only adapter
  contract (`src/adapters/contracts/toss.ts`), which is out of this task's
  ownership and unchanged.

`ReconciliationReport.liveBrokerWriteAllowed` and
`ReconciliationWorkflowResult.liveBrokerWriteAllowed` are always `false`.
Neither field is derived from reconciliation cleanliness — a perfectly
clean report still reports `false`, matching the pattern already
established by `TossOpenQuestionEvidenceTracker` and
`Phase4ReadinessReview` (see `docs/phase5/README.md`, "Open Question
Evidence Policy").

## Live-Readiness Hard Block

`ReconciliationWorkflowResult.liveReadinessBlocked` is a stricter, separate
gate from `blocksDependentTrading`:

- `blocksDependentTrading` is `true` only for `HIGH`/`CRITICAL`/`UNKNOWN`
  severity or a stale report — this is the immediate "pause trading this
  asset/portfolio now" signal, unchanged in spirit from the original
  implementation.
- `liveReadinessBlocked` is `true` for **any** unresolved reconciliation,
  including `LOW` and `MEDIUM` severity that only trigger a `WATCH` trading
  safety state. Only a fully clean, fresh reconciliation (`severity ===
  "NONE"`) clears this gate. This is intentional: the task requires
  reconciliation to be a hard block on any live-readiness signal, not just
  a warning, so a minor unresolved issue that is merely "watched" for
  day-to-day paper trading purposes must still block any future
  live-capable phase from treating this portfolio as ready.
- Clearing `liveReadinessBlocked` never implies live trading is allowed —
  `liveBrokerWriteAllowed` stays `false` unconditionally. Reconciliation
  cleanliness is a necessary precondition for a future live-capable phase,
  never a sufficient one.

## What This Module Never Does

- It never places, cancels, or modifies a broker order.
- It never produces a "correction command" or broker-write payload of any
  shape. `ReconciliationWorkflowResult.correctiveTradingAllowed` is always
  `false`.
- It never calls the real Toss API or any network endpoint. All Phase 6
  tests use synthetic fixtures (e.g. `SYNT`, `SYN-A`) — never real captured
  broker payloads, which per Phase 6 rules must never be read or committed.
