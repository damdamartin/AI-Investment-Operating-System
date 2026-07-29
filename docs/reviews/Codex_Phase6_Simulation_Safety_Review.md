# Codex Phase 6 Simulation Safety Review

Version: 0.1.0
Status: Draft — Phase 1 Scaffold Only
Review Date: 2026-07-29
Task: P6-004 Phase 6 Integration Safety Review
Assigned Engineer: Engineer 4

## Purpose

This document will record the Phase 6 integration safety review after
P6-001 (paper order intent pipeline), P6-002 (reconciliation snapshot
review), and P6-003 (risk, kill switch, order approval, and broker write
guard) are merged into local `main`.

This review does not authorize live trading, order creation, order
cancellation, order modification, transfer, withdrawal, currency
conversion, or production capital use. It cannot weaken any existing
fail-closed control.

## Phase Status

- Phase 1 (this document, scaffold and regression-gap check): complete.
- Phase 2 (full integration review content): PENDING — awaiting
  P6-001/P6-002/P6-003 merge.

This document must not be treated as a completed safety review until
Phase 2 is filled in and every placeholder below is replaced with
specific, verified findings.

## Summary

PENDING — awaiting P6-001/P6-002/P6-003 merge.

## What Changed in P6-001 (Paper Order Intent)

PENDING — awaiting P6-001/P6-002/P6-003 merge.

## What Changed in P6-002 (Reconciliation)

PENDING — awaiting P6-001/P6-002/P6-003 merge.

## What Changed in P6-003 (Risk / Kill Switch / Approval / Guard)

PENDING — awaiting P6-001/P6-002/P6-003 merge.

## Commands Run and Results

PENDING — awaiting P6-001/P6-002/P6-003 merge.

## Whether Paper Intent Remains Non-Broker And Simulation-Only

PENDING — awaiting P6-001/P6-002/P6-003 merge.

## Whether Reconciliation Remains Read-Only And Blocks Unresolved Discrepancies

PENDING — awaiting P6-001/P6-002/P6-003 merge.

## Whether Risk/Kill-Switch/Approval/Guard Controls Preserve The Broker-Write Boundary

PENDING — awaiting P6-001/P6-002/P6-003 merge.

## Whether Tests And Docs Prove Live Trading Remains Blocked

PENDING — awaiting P6-001/P6-002/P6-003 merge.

## Remaining Blockers Before Any Future Live-Capable Design Phase

PENDING — awaiting P6-001/P6-002/P6-003 merge.

## Appendix: Phase 1 Regression-Gap Check (Pre-Merge Baseline)

This appendix records the Phase 1 work only: a review of the
pre-P6-001/002/003 state of the risk, kill-switch, order-approval, and
broker-write-guard chain, and of `tests/safety/safety-regression.test.ts`
against that baseline. It is not the Phase 6 integration review itself.

Baseline commit reviewed: `c090a0f` ("Add Phase 6 Claude task plan"),
local `main` tip at the start of Phase 6, before any of P6-001, P6-002,
or P6-003 were merged.

Files read as the safety-critical baseline:

- `src/application/broker-write-guard/broker-write-command-guard.ts`
- `src/application/risk-engine/risk-engine.ts`
- `src/application/kill-switch/kill-switch-control-service.ts`
- `src/application/order-approval/order-approval-engine.ts`

### Gap Check Findings

1. Kill-switch blocks action — confirmed at the unit level
   (`tests/application/kill-switch-control-service.test.ts`,
   `tests/application/risk-engine.test.ts`), but the consolidated
   `tests/safety/safety-regression.test.ts` harness did not previously
   exercise `KillSwitchControlService` or feed a real kill-switch trading
   gate into `BrokerWriteCommandGuard`. Closed in this phase by adding an
   end-to-end regression test that activates a kill switch through
   `KillSwitchControlService`, takes its real `evaluateTradingGate(...)`
   output, and proves `BrokerWriteCommandGuard` rejects the command with
   `kill_switch_active_global` even when every other gate passes.

2. Risk veto blocks action — confirmed at the unit level
   (`tests/application/risk-engine.test.ts`,
   `tests/application/order-approval-engine.test.ts`), but the
   consolidated safety-regression harness never previously instantiated
   `RiskEngine` or `OrderApprovalEngine`; it only tested the `OrderApproval`
   domain constructor's invariant. Closed in this phase by adding an
   end-to-end regression test that runs `RiskEngine.evaluate(...)` to a
   `FAIL` result, feeds that real `RiskCheck` into `OrderApprovalEngine`
   (producing a `REJECTED` approval with `risk_check_not_passing`), and
   then feeds that real rejected `OrderApproval` into
   `BrokerWriteCommandGuard`, proving it is blocked with
   `order_approval_not_approved`.

3. Missing/unapproved approval blocks action — already proven both in
   `tests/application/broker-write-command-guard.test.ts` (missing
   approval) and by the new end-to-end test added in this phase
   (unapproved/rejected approval). No further gap found.

   Note: the current codebase has no staleness/TTL/expiry concept for
   `OrderApproval` at all (no timestamp field on the domain object, no
   staleness check in `BrokerWriteCommandGuard` or
   `OrderApprovalEngine`). "Stale approval" is therefore not a behavior
   that exists to be tested yet — only "missing" and "not approved"
   are enforced today. Adding that behavior would be an implementation
   change to files owned by P6-003
   (`order-approval-engine.ts`, `broker-write-command-guard.ts`), which is
   out of scope for this Phase 1 pass. This is flagged here so Phase 2
   can check whether P6-003 introduced approval freshness/TTL handling,
   and so it can be raised as a candidate remaining blocker if not.

4. AI output alone cannot approve execution — already proven in the
   existing `tests/safety/safety-regression.test.ts` "AI output stays
   advisory-only" test group (forbidden nested broker command rejected;
   clean, high-confidence, review-clean AI analysis alone still fails
   every deterministic gate; invalid Claude output cannot even build an
   analysis record). No gap found.

5. `BrokerWriteCommandGuard` rejects write-looking commands — already
   proven in `tests/safety/safety-regression.test.ts` (nested
   `submitOrder` forbidden-command test) and in
   `tests/application/broker-write-command-guard.test.ts` (default-block
   test, Claude-shaped `brokerCommand` test). No gap found.

### Tests Added In Phase 1

Both added to `tests/safety/safety-regression.test.ts`:

- "lets a RiskEngine veto cascade through OrderApprovalEngine into a
  blocked BrokerWriteCommandGuard decision"
- "blocks the BrokerWriteCommandGuard when the kill switch is active even
  though every other gate passes"

Both tests use the real `RiskEngine`, `OrderApprovalEngine`, and
`KillSwitchControlService` implementations (not hand-rolled stand-ins),
chained into `BrokerWriteCommandGuard`, so they double as an
integration-level regression net across module boundaries. No existing
test was weakened, removed, or loosened to make these pass.

### Phase 1 Commands Run

```bash
npx vitest run tests/safety/safety-regression.test.ts
npm run check
```

Both passed. `npm run check` ran typecheck plus the full test suite
(82 test files, 605 tests, all passing) with no regressions introduced.

### Phase 1 Scope Notes

- No implementation files owned by Engineer 1, Engineer 2, or Engineer 3
  were modified.
- No real Toss API call was made, simulated, or coded.
- `.env` and `tmp/phase5/*` were not read, printed, inspected, or
  committed.
- `docs/tasks/phase6_claude_worktree_tasks/README.md` was not modified.
