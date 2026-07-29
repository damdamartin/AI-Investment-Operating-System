# Runtime Live Lock And Audit Gate

Version: 0.1.0
Status: Draft
Last Updated: 2026-07-29
Task: `docs/tasks/phase10_claude_worktree_tasks/P10-003_runtime_lock_and_audit_gate.md`
Related Docs: `docs/phase7/toss-write-contract-design.md`,
`docs/phase9/toss-write-preflight-contract-guard.md`, `docs/11_AI_RULES.md`,
`docs/phase10/README.md`
Related Code: `src/application/live-readiness/runtime-live-lock-gate.ts`
(added by this task), `src/application/broker-write-guard/broker-write-command-guard.ts`
(read-only input, not modified), `src/adapters/toss-write-contract.ts`
(read-only input, not modified), `src/adapters/toss-write-preflight.ts`
(read-only input, not modified),
`src/application/live-readiness/small-capital-enablement-gate.ts`
(read-only input, not modified)

## 1. Purpose and Boundary

This document describes `evaluateRuntimeLiveLockGate`
(`src/application/live-readiness/runtime-live-lock-gate.ts`), a pure,
no-write runtime lock and audit gate added in Phase 10 round 1. It proves —
and locks in with regression tests — that the application remains
structurally unable to perform live broker writes until a later, separately
approved implementation phase changes that boundary.

This evaluator does **not** implement a write adapter, does **not** call
Toss, and does **not** authorize live trading. Per `docs/phase10/README.md`,
Phase 10 round 1 defines runtime lock and audit checks that keep broker
writes disabled; it does not resolve any `LCB-*` blocker and it is not a
substitute for human review. `runtimeWriteLockEngaged` and
`liveBrokerWriteAllowed` in the returned report are hardcoded literal
values (`true` and `false` respectively) in every code path — matching the
existing convention already established by `TossReadOnlyHttpClient`,
`BrokerWriteCommandGuardResult`'s sibling contracts,
`TOSS_FUTURE_WRITE_CONTRACT_SAFETY_REPORT`, `TossWritePreflightResult`, and
`SmallCapitalEnablementGateReport`.

## 2. Data-In / Report-Out Shape

`evaluateRuntimeLiveLockGate` is a pure, synchronous function:

```text
RuntimeLiveLockGateInput -> evaluateRuntimeLiveLockGate() -> RuntimeLiveLockGateReport
```

Every fact it checks is supplied by the caller as plain data:

- a `BrokerWriteCommandGuardResult`, produced elsewhere by the real
  `BrokerWriteCommandGuard.evaluate(...)` (never re-derived or
  re-implemented here);
- the hardcoded `TossFutureWriteContractSafetyReport` exported by
  `src/adapters/toss-write-contract.ts`
  (`TOSS_FUTURE_WRITE_CONTRACT_SAFETY_REPORT`);
- optionally, a Phase 9 `TossWritePreflightResult`
  (`src/adapters/toss-write-preflight.ts`);
- optionally, a Phase 9 `SmallCapitalEnablementGateReport`
  (`src/application/live-readiness/small-capital-enablement-gate.ts`);
- optionally, zero or more caller-supplied "runtime approval"-shaped
  signals (`RuntimeLiveLockGateApprovalSignal`) — a narrow, locally-defined
  type this module uses to represent any object that claims something about
  live-broker-write authorization, without importing another engineer's
  in-flight Phase 10 module (see Section 6).

Nothing in this evaluator fetches, computes, queries a database, or infers
any of these facts from a live source. It reads no file, no environment
variable, and makes no network call. It exposes no order-endpoint-shaped or
network-capable value of any kind — the only function this module exports
is `evaluateRuntimeLiveLockGate` itself, and every other export is plain,
frozen data.

## 3. Checks Performed

### 3.1 `BrokerWriteCommandGuard` Evidence

The evaluator requires a supplied `BrokerWriteCommandGuardResult`. If
missing, `missing_broker_write_guard_result` is added to
`blockingAnomalyReasonCodes`. If present, it is checked defensively:

- `safetyType === "BROKER_WRITE_COMMAND_GUARD_DECISION"`, otherwise
  `broker_write_guard_result_wrong_safety_type`;
- `allowed` must be a boolean, otherwise
  `broker_write_guard_result_allowed_not_boolean`;
- if `allowed === true`, `broker_write_guard_currently_allows_writes` is
  added to `blockingAnomalyReasonCodes`. This is not itself proof of a
  defect — `BrokerWriteCommandGuard` is designed to return `allowed: true`
  once every one of its own gates genuinely passes, which is expected
  behavior in a future, separately approved live phase — but during Phase
  10 round 1 it is surfaced as a reportable anomaly so a human reviewer sees
  it, per `docs/11_AI_RULES.md` Rule 22 (fail closed) and Rule 29 (do not
  convert warnings into silent behavior). It never changes this gate's own
  hardcoded `runtimeWriteLockEngaged` / `liveBrokerWriteAllowed` output.

`auditSummary.brokerWriteGuardCurrentlyDenies` records `!allowed` (or
`null` when no usable guard result was supplied) for evidence visibility.

### 3.2 Future Toss Write Contract Non-Callability

The evaluator requires the supplied `TossFutureWriteContractSafetyReport`.
If missing, `missing_toss_future_write_contract_safety_report` is added.
If present:

- `safetyType === "TOSS_FUTURE_WRITE_CONTRACT_REPORT"`, otherwise
  `toss_future_write_contract_report_wrong_safety_type`;
- the runtime value of `liveBrokerWriteAllowed` must be strictly `false`
  (checked again at runtime, not just at the type level, so a caller cannot
  bypass this with an `as`-cast), otherwise
  `toss_future_write_contract_report_live_broker_write_allowed_not_false`;
- none of `allowedOperations` may overlap
  `TOSS_FUTURE_WRITE_CONTRACT_FORBIDDEN_OPERATIONS` (defense in depth,
  cross-checked against the same hardcoded forbidden-operations list
  exported by `src/adapters/toss-write-contract.ts`).

The `command: never` typing itself is a compile-time property, not a
runtime one — this module's own test suite
(`tests/application/runtime-live-lock-gate.test.ts`) duplicates the
`@ts-expect-error` proof pattern already established in
`tests/adapters/toss-write-contract.test.ts`, so a future widening of that
parameter type is caught from two independent test locations, not one.

### 3.3 Phase 9 Preflight And Enablement Evidence (Supplementary, Optional)

If a `TossWritePreflightResult` is supplied, its `safetyType` and
`liveBrokerWriteAllowed` (`=== false`, runtime-checked) are validated the
same way as Section 3.2. If a `SmallCapitalEnablementGateReport` is
supplied, its `safetyType`, `liveBrokerWriteAllowed`, and
`readyForLiveBrokerWrites` (`=== false`, runtime-checked) are validated the
same way. Neither input is required — their absence is not itself an
anomaly, since they are supplementary evidence beyond this gate's two core
checks (Sections 3.1–3.2).

### 3.4 Runtime Approval Signal Tamper Detection

For each caller-supplied `RuntimeLiveLockGateApprovalSignal`, the evaluator
checks `claimedLiveBrokerWriteAllowed` at runtime and requires it to be
strictly `false`. Anything else — `true`, a truthy non-boolean, or a
missing value — is recorded as
`approval_signal_<index>_claims_live_broker_write_allowed_not_false` in
`blockingAnomalyReasonCodes`, and counted in
`auditSummary.tamperedApprovalSignalCount`. A `claimedFullyResolved` claim
is recorded only as an informational `warnings` entry — it is never treated
as authorization and never affects the gate's output either way.

This is the load-bearing property this task exists to prove: **no runtime
approval report — however favorable, however completely it claims
everything is "resolved" — can flip `liveBrokerWriteAllowed`.** It is
detected and reported, not silently trusted.

## 4. The Two Hardcoded Literals

`RuntimeLiveLockGateReport.runtimeWriteLockEngaged` is always the literal
`true`, and `RuntimeLiveLockGateReport.liveBrokerWriteAllowed` is always the
literal `false`. Neither is ever computed from `input`,
`blockingAnomalyReasonCodes`, or any combination of upstream evidence —
there is no branch, ternary, or expression anywhere in
`evaluateRuntimeLiveLockGate` that can produce a different value for
either field. This holds:

- on a fully empty input (`tests/application/runtime-live-lock-gate.test.ts`,
  "fails closed on a fully empty input");
- when every upstream signal is maximally favorable, including a real,
  non-mocked `BrokerWriteCommandGuard` result that itself legitimately
  evaluates to `allowed: true` under a genuinely passing, fully permissive
  fixture (same file, "stay hard no-write even when every upstream
  readiness signal is maximally clean");
- when a caller hands the gate a deliberately tampered
  `liveBrokerWriteAllowed: true`-shaped `TossFutureWriteContractSafetyReport`
  lookalike, or a tampered `RuntimeLiveLockGateApprovalSignal` claiming both
  `liveBrokerWriteAllowed: true` and "everything is resolved" (same file,
  the "(b) detects a tampered ... as blocking, not trusted" tests);
- when the report itself is fed as `aiContext` into a real
  `BrokerWriteCommandGuard.evaluate(...)` call — the cleanest possible
  output this gate can ever produce still cannot satisfy the guard on its
  own (`tests/safety/safety-regression.test.ts`, "P10-003 runtime live lock
  and audit gate" block).

Both the top-level report and its `auditSummary` are `Object.freeze`d
before being returned, mirroring the same tamper-resistance convention
already used by `TOSS_FUTURE_WRITE_CONTRACT_SAFETY_REPORT`.

## 5. Sanitized, Evidence-Only Audit Summary

`RuntimeLiveLockGateReport.auditSummary` carries only booleans and counts
derived from the supplied evidence — never a raw upstream object, never an
account identifier, never a secret, and never a function value:
`brokerWriteGuardChecked`, `brokerWriteGuardCurrentlyDenies`,
`tossFutureWriteContractChecked`, `tossFutureWriteContractNonCallableConfirmed`,
`tossWritePreflightChecked`, `smallCapitalEnablementChecked`,
`approvalSignalCount`, `tamperedApprovalSignalCount`, `blockingAnomalyCount`,
`warningCount`. `RUNTIME_LIVE_LOCK_GATE_EVIDENCE_STATEMENT` is included
verbatim on every report as `evidenceOnlyStatement`, stating plainly that
the report is not, and can never become, live-trading authorization.

## 6. What This Evaluator Does Not Do

- It does not construct, return, or reference a callable
  `TossSecuritiesAdapter` or any write method.
- It does not call Toss, under any flag, environment, or condition. It
  contains no `fetch`, HTTP client, `axios`, `undici`, or order endpoint
  call of any kind.
- It does not read `.env`, `tmp/phase5`, `process.env`, or any
  secret/credential material.
- It does not weaken, bypass, or re-implement `BrokerWriteCommandGuard`,
  the Phase 7 write-contract design (`src/adapters/toss-write-contract.ts`),
  or the Phase 9 preflight evaluator
  (`src/adapters/toss-write-preflight.ts`). All three are read-only inputs.
- It does not mark any `LCB-*` blocker `RESOLVED` — that remains a
  human-only action in `docs/phase7/live-capable-blocker-register.md`.
- It does not import Engineer 1's (P10-001) live-operation approval packet
  module or Engineer 2's (P10-002) first-trade operating protocol module.
  Both are in-flight, concurrently-developed Phase 10 modules; per this
  round's coordination boundary, `runtimeApprovalSignals` is instead a
  narrow, locally-defined, duck-typed shape — any object structurally
  compatible with `RuntimeLiveLockGateApprovalSignal` can be passed in by a
  future integration layer, tampered or not, without this file depending on
  either module's implementation.
- It does not itself decide whether small-capital live trading may begin.
  It is a runtime lock and audit report, not a trading decision, and its
  `evidenceOnlyStatement` says so explicitly.

## 7. Relationship to Other Phase 10 Round 1 Work

- `P10-001` (Engineer 1) compiles a sanitized live-operation approval
  packet from Phase 7/8/9 evidence. This gate does not consume that
  module's output directly (see Section 6); a future integration task may
  adapt a P10-001-shaped object into a `RuntimeLiveLockGateApprovalSignal`.
- `P10-002` (Engineer 2) defines a human-executed first-trade operating
  protocol. This gate does not read or modify that module.
- `P10-004` (Engineer 4) performs the Phase 10 integration review and may
  wire this evaluator's output into a broader operator-facing report;
  `docs/phase10/README.md` and `docs/reviews/*` are not modified by this
  task.

## 8. Not Live-Trading Authorization

This report is a runtime evidence check only. A `runtimeWriteLockEngaged:
true` / `liveBrokerWriteAllowed: false` result — the only result this
evaluator can ever produce — is not, and can never become, authorization
for a real Toss broker write, live order submission, order cancellation or
replacement, or any capital-moving action. A separate, later,
human-reviewed implementation phase is required before any real broker
write becomes possible.
