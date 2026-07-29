# Toss Write Preflight Contract Guard

Version: 0.1.0
Status: Draft
Last Updated: 2026-07-29
Task: `docs/tasks/phase9_claude_worktree_tasks/P9-002_toss_write_preflight_contract_guard.md`
Related Docs: `docs/phase7/toss-write-contract-design.md`,
`docs/phase7/live-capable-blocker-register.md`, `docs/11_AI_RULES.md`,
`docs/08_Testing_Validation.md`, `docs/phase9/README.md`
Related Code: `src/adapters/toss-write-preflight.ts` (added by this task),
`src/adapters/toss-write-contract.ts` (read-only input, not modified),
`src/application/broker-write-guard/broker-write-command-guard.ts`
(read-only input, not modified)

## 1. Purpose and Boundary

This document describes `evaluateTossWritePreflight`
(`src/adapters/toss-write-preflight.ts`), a pure, no-write preflight
evaluator added in Phase 9 round 1. It checks whether the prerequisites
described in `docs/phase7/toss-write-contract-design.md` would be satisfied
before a **future, separately reviewed** `TossSecuritiesAdapter` write
implementation could legitimately become callable.

This evaluator does **not** implement a write adapter, does **not** call
Toss, and does **not** authorize live trading. Per `docs/phase9/README.md`,
Phase 9 round 1 remains no-write: it creates evidence intake, preflight, and
enablement gates only. A `ready: true` result from this evaluator is a
statement that the caller-supplied evidence looks complete for every gate
this evaluator knows how to check — it is never, and structurally cannot
become, a live-broker-write authorization. `liveBrokerWriteAllowed` in the
returned result is a hardcoded literal `false` in every code path, matching
the existing convention in `TossReadOnlyHttpClient`,
`BrokerWriteCommandGuardResult`'s sibling contracts, `ReconciliationReport`,
and `TOSS_FUTURE_WRITE_CONTRACT_SAFETY_REPORT`.

## 2. Data-In / Report-Out Shape

`evaluateTossWritePreflight` is a pure, synchronous function:

```text
TossWritePreflightInput -> evaluateTossWritePreflight() -> TossWritePreflightResult
```

Every fact it checks is supplied by the caller as plain data:

- live-blocker evidence summaries (one per `LCB-*` id)
- a `BrokerWriteCommandGuardResult` (produced elsewhere, by
  `BrokerWriteCommandGuard.evaluate`, never re-derived here)
- a fresh kill-switch recheck
- a reconciliation report
- four policy attestations: idempotency/client order id, redaction,
  timeout/error normalization, and raw payload storage

Nothing in this evaluator fetches, computes, queries a database, or infers
any of these facts from a live source. It reads no file, no environment
variable, and makes no network call. If a future caller wires this
evaluator to a live data source, that wiring is out of this evaluator's
scope and out of Phase 9 round 1's scope entirely.

## 3. Checks Performed

### 3.1 Live-Capable Blocker Evidence (`LCB-001`..`LCB-008`)

The evaluator requires an evidence summary for every blocker id listed in
`docs/phase7/live-capable-blocker-register.md`'s summary table
(`TOSS_WRITE_PREFLIGHT_REQUIRED_LIVE_BLOCKER_IDS`, hardcoded, not read from
that file at runtime). For each id, the supplied
`TossWritePreflightLiveBlockerEvidenceSummary` must have:

- `humanReviewed: true`
- a non-empty `reviewerRole` that reads as a human role, not an AI/agent
  identity (rejects tokens like `ai`, `claude`, `bot`, `assistant`, `gpt`,
  `chatgpt`, `llm`, `codex`), matching the register's requirement that the
  Human Owner / Reviewer Role is "Always a human role, never 'AI' or
  'Claude'"
- a valid, non-future `reviewedAt`

This check only verifies that a human-reviewed evidence *summary* was
supplied for each id — it does not, and must not, claim any `LCB-*` blocker
is `RESOLVED`. Marking a blocker `RESOLVED` remains the sole responsibility
of a human reviewer editing
`docs/phase7/live-capable-blocker-register.md` directly, per that
document's rules.

### 3.2 `BrokerWriteCommandGuard` Compatibility

The evaluator requires a supplied `BrokerWriteCommandGuardResult` with:

- `safetyType === "BROKER_WRITE_COMMAND_GUARD_DECISION"`
- `commandType` matching the preflight's own `commandType`
- `allowed === true`
- an empty `reasonCodes` array (defensive: an `allowed: true` result should
  never carry leftover reason codes; if it does, this evaluator treats that
  as untrustworthy input and fails closed rather than trusting `allowed`
  alone)

The evaluator never re-implements, re-derives, or weakens
`BrokerWriteCommandGuard`'s own logic. It only consumes an already-computed
result as input.

### 3.3 Kill-Switch Re-Check

Per `docs/phase7/toss-write-contract-design.md` Section 6, the evaluator
requires a `TossWriteContractKillSwitchRecheck` (the same type already
defined in `src/adapters/toss-write-contract.ts`, imported type-only) with:

- `checkedImmediatelyBeforeSubmission === true`
- `active === false`
- a `checkedAt` no older than
  `TOSS_WRITE_PREFLIGHT_DEFAULT_MAX_KILL_SWITCH_RECHECK_AGE_MS` (5 seconds
  by default, overridable via `maxKillSwitchRecheckAgeMs`) relative to the
  supplied `now`, and not in the future

### 3.4 Reconciliation Freshness

The evaluator requires a `ReconciliationReport` with:

- `status === "CLEAN"`
- `blocksDependentTrading === false`
- a `checkedAt` no older than
  `TOSS_WRITE_PREFLIGHT_DEFAULT_MAX_RECONCILIATION_AGE_MS` (5 minutes by
  default, overridable via `maxReconciliationAgeMs`) relative to the
  supplied `now`, and not in the future

### 3.5 Idempotency / Client Order ID Policy

Per design doc Section 5, requires a policy attestation confirming the
`clientOrderId` policy is deterministic per approval per operation, is
enforced by a unique constraint, is persisted before any network attempt,
and is never regenerated per network attempt.

### 3.6 Redaction Policy

Per design doc Section 9, requires a policy attestation confirming reuse of
the shared `redactObject` path, account identifier masking to the last four
characters, no inline logging of raw payloads, and currency-tagged money
amounts.

### 3.7 Timeout / Error Normalization Policy

Per design doc Sections 7-8, requires a policy attestation confirming use
of the shared normalized result taxonomy, that ambiguous outcomes map to
`UNKNOWN`, that blind retry is not permitted, and that
`requiresReconciliation` is forced whenever an outcome is ambiguous.

### 3.8 Raw Broker Payload Storage Policy

Per design doc Section 9, requires a policy attestation with
`rawPayloadStorageAllowed` strictly equal to `false` (checked again at
runtime, not just at the type level, so a caller cannot bypass this with an
`as`-cast) and confirmation that any stored reference is redacted before
persistence.

## 4. Fail-Closed Behavior

`evaluateTossWritePreflight` never throws. Every missing, malformed, or
not-yet-satisfied input produces one or more entries in the returned
`blockingReasons` array (deduplicated and sorted) and `ready: false`. There
is no default-allow branch: an empty input produces a fully populated set of
`missing_*` reasons rather than `ready: true`. This is verified directly in
`tests/adapters/toss-write-preflight.test.ts` ("fails closed on a completely
empty input").

## 5. What This Evaluator Does Not Do

- It does not construct, return, or reference a callable
  `TossSecuritiesAdapter` or any write method.
- It does not call Toss, under any flag, environment, or condition.
- It does not read `.env`, `tmp/phase5`, or any secret/credential material.
- It does not read `process.env`.
- It does not weaken, bypass, or re-implement `BrokerWriteCommandGuard`.
- It does not mark any `LCB-*` blocker `RESOLVED` — that remains a
  human-only action in `docs/phase7/live-capable-blocker-register.md`.
- It does not itself decide whether small-capital live trading may begin;
  that separation from live-trading authorization is preserved per
  `docs/phase9/README.md`'s exit criteria.

## 6. Relationship to Other Phase 9 Round 1 Work

- `P9-001` (Engineer 1) defines live-blocker evidence intake schemas and
  validators under `src/application/live-readiness/`. This evaluator's
  `TossWritePreflightLiveBlockerEvidenceSummary` type is a narrow, local
  input shape owned by this file — it is intentionally not coupled to
  `P9-001`'s schema module, so each task can be reviewed and merged
  independently. A future integration task may adapt `P9-001`'s validated
  evidence records into this evaluator's input shape.
- `P9-003` (Engineer 3) defines the small-capital enablement gate, which is
  a separate concern from this write-adapter preflight and is not read or
  modified by this file.
- `P9-004` (Engineer 4) performs the Phase 9 integration review and may
  wire this evaluator into `tests/safety/safety-regression.test.ts`; that
  file is not modified by this task.
