# P10-004 Phase 10 Integration Review

## Task ID

P10-004

## Goal

Review P10-001, P10-002, and P10-003 together and confirm that Phase 10
round 1 remains a no-write readiness package, not a live-trading
implementation.

## Assigned Engineer

Engineer 4

## Responsible Module

Integration review, safety scan, regression coverage.

## Files To Modify Or Create

- `docs/reviews/Codex_Phase10_Live_Operation_Readiness_Review.md`
- `tests/safety/safety-regression.test.ts` only if additional regression
  coverage is required
- `docs/phase10/README.md` only for status updates after review
- `docs/tasks/phase10_claude_worktree_tasks/README.md` only for status
  updates after review

Avoid editing P10-001/P10-002/P10-003 source files unless a blocking
integration issue requires a focused fix.

## Inputs

- P10-001 branch result
- P10-002 branch result
- P10-003 branch result
- `docs/phase10/README.md`
- `docs/phase7/live-capable-blocker-register.md`
- `docs/phase9/small-capital-go-no-go-checklist.md`
- `docs/11_AI_RULES.md`

## Output

A review report that answers:

- Are all new reports evidence-only and sanitized?
- Can any path produce `liveBrokerWriteAllowed: true`?
- Did any task introduce a callable broker-write adapter?
- Did any task read `.env`, `tmp/phase5`, local receipts, secrets, account
  identifiers, or raw broker payloads?
- Are `LCB-001` through `LCB-008` still human-only?
- Does the final Phase 10 package clearly avoid live-trading
  authorization?

## Forbidden

- Do not push to GitHub.
- Do not run real Toss API calls.
- Do not implement or suggest code that places/cancels/replaces orders.
- Do not mark human-only blockers as resolved.
- Do not print secrets, account ids, local receipts, or raw broker data.

## Test Criteria

Run:

```bash
npm run check
rg -n "submitOrder|cancelOrder|replaceOrder|placeOrder|TossSecuritiesAdapter|liveBrokerWriteAllowed: true|fetch\\(|axios|undici" src tests docs/phase10
rg -n "\\.env|tmp/phase5|client_secret|access_token|account_number" src tests docs/phase10
```

Any matches must be classified as prohibition text, safety tests,
existing read-only clients outside Phase 10, or a finding.

## Completion Criteria

- Review report exists and states go/no-go for Phase 10 round 1.
- `npm run check` passes.
- Any blocking finding is either fixed or explicitly recorded.
- Final report confirms GitHub push was not performed.

## Recommended Branch

`phase10/p10-004-integration-review`
