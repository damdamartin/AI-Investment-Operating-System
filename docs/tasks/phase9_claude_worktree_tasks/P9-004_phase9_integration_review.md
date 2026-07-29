# P9-004 Phase 9 Integration Review

## Task ID

P9-004

## Goal

Review P9-001 through P9-003 together and determine whether Phase 9 round
1 safely prepares the evidence and gates for small-capital live trading
without implementing or authorizing live broker writes.

## Assigned Engineer

Engineer 4

## Responsible Module

Integration review, safety regression, documentation consistency.

## Files To Modify Or Create

- `docs/reviews/Codex_Phase9_Small_Capital_Preparation_Review.md`
- `tests/safety/safety-regression.test.ts` if new regression coverage is
  needed
- `docs/phase9/README.md` only for status/link updates
- `docs/tasks/phase9_claude_worktree_tasks/README.md` only for merge
  status updates

## Inputs

- Outputs from P9-001, P9-002, P9-003
- `docs/phase9/README.md`
- `docs/11_AI_RULES.md`
- `docs/phase7/live-capable-blocker-register.md`
- `docs/reviews/Codex_Phase8_Operations_Readiness_Review.md`
- `tests/safety/safety-regression.test.ts`

## Output

An integration review that answers:

- whether all eight `LCB-*` blockers are represented
- whether any task incorrectly marked a human-only blocker resolved
- whether evidence validators reject secrets/raw broker identifiers
- whether future write preflight remains no-write
- whether small-capital enablement remains evidence-only
- whether any task introduced network calls or callable broker-write code
- whether Phase 9 round 1 is complete, blocked, or needs another round

## Forbidden

- Do not implement live broker writes.
- Do not weaken existing safety tests.
- Do not mark Phase 9 as live-trading approved.
- Do not read or print secrets/local receipts.
- Do not deploy or call Toss.

## Test Criteria

Run:

```bash
npm run check
```

Also run source scans and summarize results:

```bash
rg -n "submitOrder|cancelOrder|replaceOrder|placeOrder|TossSecuritiesAdapter|liveBrokerWriteAllowed: true|fetch\\(|axios|undici" src tests docs/phase9
rg -n "\\.env|tmp/phase5|client_secret|access_token|account_number" src tests docs/phase9
```

Matches are acceptable only when they are prohibitions, redaction tests,
or safety assertions.

## Completion Criteria

- Review has a clear go/no-go result for Phase 9 round 1 completion.
- No real write/deploy path exists.
- Human-only blocker status remains honest.
- `npm run check` passes.

## Recommended Branch

`phase9/p9-004-integration-review`
