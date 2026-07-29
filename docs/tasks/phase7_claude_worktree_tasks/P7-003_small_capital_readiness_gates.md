# P7-003 Small-Capital Readiness Gates

## Task ID

P7-003

## Goal

Define the small-capital readiness gates that must pass before a later
phase may implement or enable real broker writes.

## Assigned Engineer

Engineer 3

## Responsible Module

Small-capital readiness policy, approval records, operator checklist,
promotion gates.

## Files To Modify Or Create

- `docs/phase7/small-capital-readiness-gates.md`
- `docs/phase7/manual-live-approval-record.md`
- `docs/phase7/small-capital-operator-checklist.md`
- optionally `src/application/live-readiness/small-capital-readiness.ts`
- optionally `tests/application/small-capital-readiness.test.ts`

Avoid editing P7-001/P7-002 owned files unless coordination is required.

## Inputs

- `docs/07_Trading_System.md`
- `docs/08_Testing_Validation.md`
- `docs/09_Operation_Deployment.md`
- `docs/11_AI_RULES.md`
- `docs/13_Compliance_and_Legal_Review.md`
- Phase 6 dashboard/alerting/scheduler docs

## Output

A readiness design that includes:

- maximum order value
- maximum daily notional exposure
- maximum total capital exposure
- allowed market/session window
- allowed asset types
- allowed order types
- required human approval record
- required reconciliation freshness
- required kill-switch state
- required alert/dashboard state
- rollback procedure
- explicit conditions that block live readiness

If adding TypeScript, implement a pure evaluator only. It may produce
`readyForSmallCapitalLive: false` or a blocked report, but it must not
trigger any broker call or enable live writes.

## Forbidden

- No real Toss API calls.
- No broker write command creation.
- No automatic human approval.
- No reading `.env` or `tmp/phase5`.
- No secrets, account numbers, or raw broker payloads in docs/tests.

## Test Criteria

Run:

```bash
npx vitest run tests/application/small-capital-readiness.test.ts tests/safety/safety-regression.test.ts
npm run check
```

If `tests/application/small-capital-readiness.test.ts` is not added, omit
it from the targeted command.

## Completion Criteria

- Readiness gates are explicit and fail closed.
- Human approval remains required and cannot be inferred by AI.
- Any evaluator is pure/no-write.
- `npm run check` passes.

## Recommended Branch

`phase7/p7-003-small-capital-readiness-gates`
