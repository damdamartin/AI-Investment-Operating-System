# P8-001 Operations Status API Read Model

## Task ID

P8-001

## Goal

Create an operations status read model that aggregates the existing Phase
6/7 safety, alerting, scheduler, and readiness outputs for dashboard/API
consumption without adding any command surface.

## Assigned Engineer

Engineer 1

## Responsible Module

Dashboard/status API read model, sanitized operator summaries.

## Files To Modify Or Create

- `src/application/operations/operations-status-read-model.ts`
- `src/application/operations/index.ts`
- `tests/application/operations-status-read-model.test.ts`
- `docs/phase8/operations-status-api.md`
- `src/index.ts` only if a new operations module export is required

Avoid editing deployment and backup/restore files owned by P8-002/P8-003
unless coordination is required.

## Inputs

- `src/application/dashboard/read-only-dashboard.ts`
- `src/application/alerting/operational-alerting-service.ts`
- `src/application/observability/observability-metrics.ts`
- `src/application/scheduler/scheduler-job-runner.ts`
- `src/application/live-readiness/small-capital-readiness.ts`
- `docs/phase8/README.md`

## Output

A pure read model that can summarize:

- system health
- paper/simulation readiness
- live readiness blocked/unblocked status
- kill-switch state
- reconciliation state
- AI/API health state
- scheduler job health
- open alert counts
- small-capital readiness evidence status

Every output must be sanitized and advisory-only. It must include
`liveBrokerWriteAllowed: false` where a caller might otherwise confuse
the report with live-trading authorization.

## Forbidden

- No command handlers.
- No dashboard actions that mutate state.
- No real broker calls or network code.
- No `.env` or `tmp/phase5` reads.
- No account numbers, tokens, secrets, or raw broker payloads.
- No `liveBrokerWriteAllowed: true`.

## Test Criteria

Run:

```bash
npx vitest run tests/application/operations-status-read-model.test.ts tests/application/read-only-dashboard.test.ts tests/application/observability-metrics.test.ts
npm run check
```

## Completion Criteria

- Operations status is advisory/read-only.
- Status cannot be shaped like a broker command.
- Secret-like data is redacted or rejected.
- `npm run check` passes.

## Recommended Branch

`phase8/p8-001-operations-status-api`
