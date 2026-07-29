# P7-004 Phase 7 Integration Review

## Task ID

P7-004

## Goal

Review P7-001 through P7-003 together and determine whether Phase 7 has
produced a coherent, still-no-write live-capable design readiness package.

## Assigned Engineer

Engineer 4

## Responsible Module

Integration review, safety regression, documentation consistency.

## Files To Modify Or Create

- `docs/reviews/Codex_Phase7_Live_Capable_Design_Readiness_Review.md`
- `tests/safety/safety-regression.test.ts` if new regression coverage is
  needed
- `docs/phase7/README.md` only for status/link updates
- `docs/tasks/phase7_claude_worktree_tasks/README.md` only for merge
  status updates

## Inputs

- Outputs from P7-001, P7-002, P7-003
- `docs/phase7/README.md`
- `docs/11_AI_RULES.md`
- `docs/reviews/Codex_Phase6_Round2_Operational_Readiness_Review.md`
- `tests/safety/safety-regression.test.ts`

## Output

An integration review that answers:

- whether any task accidentally introduced a callable broker write path
- whether human approval is still required
- whether `.env` and local Phase 5 receipts remain untouched
- whether small-capital readiness is specified but not enabled
- whether future implementation blockers are clear
- whether Phase 7 is complete, blocked, or needs another round

## Forbidden

- Do not implement live broker writes.
- Do not weaken existing safety tests.
- Do not mark Phase 7 as live-trading approved.
- Do not read or print secrets/local receipts.

## Test Criteria

Run:

```bash
npm run check
```

Also run a source scan and summarize results:

```bash
rg -n "submitOrder|cancelOrder|replaceOrder|placeOrder|TossSecuritiesAdapter|liveBrokerWriteAllowed: true|fetch\\(|axios|undici" src tests docs/phase7
```

Matches in docs/tests are acceptable only when they are prohibitions,
placeholders, or safety assertions.

## Completion Criteria

- Review has a clear go/no-go result for Phase 7 completion.
- No real write path exists.
- New blockers are listed if found.
- `npm run check` passes.

## Recommended Branch

`phase7/p7-004-integration-review`
