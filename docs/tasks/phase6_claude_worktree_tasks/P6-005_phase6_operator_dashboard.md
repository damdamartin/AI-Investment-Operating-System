# Task ID

P6-005

## Goal

Build a Phase 6 operator dashboard read model that summarizes paper/simulation readiness without exposing secrets or implying live-trading authorization.

## Assigned Engineer

Engineer 1

## Module

Dashboard and read-only operational status.

## Files To Modify Or Create

Primary files:

- `src/application/dashboard/read-only-dashboard.ts`
- `tests/application/read-only-dashboard.test.ts`
- `docs/phase6/operator-dashboard.md`

Allowed supporting files:

- `src/application/dashboard/index.ts`
- `docs/phase6/README.md`

Avoid editing alerting, scheduler, and integration review files owned by P6-006/P6-007/P6-008 unless coordination is required.

## Input

- Phase 6 round 1 added `PaperOrderIntentPipeline`, stronger reconciliation review, and stricter risk/kill-switch/approval guards.
- Dashboard output must consume only sanitized summaries or in-memory test fixtures.
- Real `.env` and `tmp/phase5` receipts remain off-limits.

## Output

Create or strengthen a dashboard read model that can report:

- paper order intent status
- reconciliation live-readiness block status
- risk veto status
- kill-switch gate status
- approval/guard status
- audit coverage status
- `liveBrokerWriteAllowed:false`
- whether the system is paper/simulation-ready, not live-ready

The dashboard must distinguish:

- `paperSimulationReady`
- `liveReadinessBlocked`
- `liveBrokerWriteAllowed:false`

## Forbidden

- Do not add dashboard controls that can place, cancel, or modify orders.
- Do not add live trading enable toggles.
- Do not read `.env`.
- Do not read or commit real `tmp/phase5` receipts.
- Do not call Toss or any real broker API.
- Do not push to GitHub.

## Test Criteria

Run:

```bash
npx vitest run tests/application/read-only-dashboard.test.ts tests/application/dashboard-sensitive-control-gate.test.ts
npm run check
```

Tests must prove:

- dashboard can show paper/simulation readiness without live readiness
- unresolved reconciliation blocks live readiness
- active kill switch blocks paper execution status
- no dashboard output includes raw secrets, raw broker data, or account identifiers
- `liveBrokerWriteAllowed:false` is always present where relevant

## Completion Conditions

- Dashboard read model covers the Phase 6 round 1 safety chain.
- Documentation explains operator interpretation.
- All tests pass.
- Final report confirms there are no broker write controls.

## Recommended Branch

`phase6/p6-005-operator-dashboard`
