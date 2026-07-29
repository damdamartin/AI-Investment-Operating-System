# Task ID

P6-003

## Goal

Strengthen the combined risk, kill-switch, order-approval, and broker-write-guard boundary for Phase 6 simulation workflows.

## Assigned Engineer

Engineer 3

## Module

Risk controls, kill switch, approval gate, and broker write command guard.

## Files To Modify Or Create

Primary files:

- `src/application/risk-engine/risk-engine.ts`
- `tests/application/risk-engine.test.ts`
- `src/application/kill-switch/kill-switch-control-service.ts`
- `tests/application/kill-switch-control-service.test.ts`
- `src/application/order-approval/order-approval-engine.ts`
- `tests/application/order-approval-engine.test.ts`
- `src/application/broker-write-guard/broker-write-command-guard.ts`
- `tests/application/broker-write-command-guard.test.ts`

Allowed supporting files:

- `tests/safety/safety-regression.test.ts`
- `docs/phase6/risk-kill-switch-approval-guard.md`

Avoid editing paper intent and reconciliation files owned by P6-001/P6-002 unless coordination is required.

## Input

- Phase 5 confirms read-only broker access only.
- Phase 6 must not allow real broker writes.
- Existing modules already cover risk, kill switch, approval, and broker write guard baselines.

## Output

Strengthen the control chain so Phase 6 simulation workflows must pass:

- risk decision
- kill-switch state
- approval status
- broker-write guard classification

The output may authorize paper/simulated actions only. It must not authorize live broker commands.

## Forbidden

- Do not implement real broker writes.
- Do not add Toss write endpoint paths.
- Do not add an escape hatch around `BrokerWriteCommandGuard`.
- Do not weaken kill-switch behavior.
- Do not allow AI output alone to approve execution.
- Do not read `.env` or local real receipts.
- Do not push to GitHub.

## Test Criteria

Run:

```bash
npx vitest run tests/application/risk-engine.test.ts tests/application/kill-switch-control-service.test.ts tests/application/order-approval-engine.test.ts tests/application/broker-write-command-guard.test.ts tests/safety/safety-regression.test.ts
npm run check
```

Tests must prove:

- kill switch blocks simulated execution promotion paths
- unapproved or stale approval blocks action
- risk veto blocks action
- broker-write guard rejects live/write-looking commands
- approved paths remain paper-only
- reason codes are deterministic and audit-friendly

## Completion Conditions

- Safety boundary is stronger and covered by tests.
- All tests pass.
- Final report lists new/changed reason codes and confirms no live write path exists.

## Recommended Branch

`phase6/p6-003-risk-kill-switch-approval-guard`
