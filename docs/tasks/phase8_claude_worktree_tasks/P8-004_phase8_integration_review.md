# P8-004 Phase 8 Integration Review

## Task ID

P8-004

## Goal

Review P8-001 through P8-003 together and determine whether Phase 8
operations readiness is coherent, sanitized, and still no-write.

## Assigned Engineer

Engineer 4

## Responsible Module

Integration review, safety regression, documentation consistency.

## Files To Modify Or Create

- `docs/reviews/Codex_Phase8_Operations_Readiness_Review.md`
- `tests/safety/safety-regression.test.ts` if new regression coverage is
  needed
- `docs/phase8/README.md` only for status/link updates
- `docs/tasks/phase8_claude_worktree_tasks/README.md` only for merge
  status updates

## Inputs

- Outputs from P8-001, P8-002, P8-003
- `docs/phase8/README.md`
- `docs/11_AI_RULES.md`
- `docs/reviews/Codex_Phase7_Live_Capable_Design_Readiness_Review.md`
- `tests/safety/safety-regression.test.ts`

## Output

An integration review that answers:

- whether dashboard/status APIs are read-only and advisory
- whether deployment readiness keeps production/live trading disabled by
  default
- whether backup/restore/rollback drills are testable and fail closed
- whether any task introduced network calls, real deployment, or broker
  write capability
- whether local secrets/receipts remain untouched
- whether Phase 8 is complete, blocked, or needs another round

## Forbidden

- Do not deploy anything.
- Do not implement live broker writes.
- Do not weaken existing safety tests.
- Do not mark Phase 8 as live-trading approved.
- Do not read or print secrets/local receipts.

## Test Criteria

Run:

```bash
npm run check
```

Also run source scans and summarize results:

```bash
rg -n "submitOrder|cancelOrder|replaceOrder|placeOrder|TossSecuritiesAdapter|liveBrokerWriteAllowed: true|fetch\\(|axios|undici" src tests docs/phase8
rg -n "\\.env|tmp/phase5|client_secret|access_token|account_number" src tests docs/phase8
```

Matches are acceptable only when they are prohibitions, redaction tests,
or safety assertions.

## Completion Criteria

- Review has a clear go/no-go result for Phase 8 completion.
- No real write/deploy path exists.
- New blockers are listed if found.
- `npm run check` passes.

## Recommended Branch

`phase8/p8-004-integration-review`
