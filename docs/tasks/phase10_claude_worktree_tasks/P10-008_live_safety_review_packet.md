# P10-008 Live Safety Review Packet And Integration Review

## Task ID

P10-008

## Goal

Create the sanitized evidence packet structure for `LCB-007` and
`LCB-008`, then review P10-005 through P10-007 together for safety,
sanitization, and live-trading ambiguity.

## Assigned Engineer

Engineer 4

## Responsible Module

Live safety evidence, future write-adapter review prerequisites,
integration review.

## Files To Modify Or Create

- `docs/phase10/live-safety-review-evidence-packet.md`
- `docs/reviews/Codex_Phase10_Round2_Human_Blocker_Evidence_Review.md`
- optionally `src/application/live-readiness/live-safety-review-evidence-packet.ts`
- optionally `tests/application/live-safety-review-evidence-packet.test.ts`
- `docs/phase10/README.md` only for status updates after review
- `docs/tasks/phase10_claude_worktree_tasks/README.md` only for status
  updates after review

Avoid editing `docs/phase7/live-capable-blocker-register.md` except to
verify it was not changed.

## Inputs

- P10-005 branch result
- P10-006 branch result
- P10-007 branch result
- `docs/phase10/human-blocker-evidence-workbook.md`
- `docs/phase7/live-capable-blocker-register.md`
- `docs/phase10/runtime-live-lock-gate.md`
- `docs/phase8/rollback-drill-runbook.md`
- `docs/phase9/toss-write-preflight-contract-guard.md`
- `docs/11_AI_RULES.md`

## Output

A sanitized packet/checklist for:

- live-context kill-switch and rollback rehearsal evidence
- unresolved broker-state stop criteria
- independent future write-adapter review requirements
- source scan and no-write verification after P10-005 through P10-007

The integration review must answer:

- Did any task resolve an `LCB-*` blocker?
- Did any task expose secrets/account identifiers/raw payloads?
- Did any task introduce broker writes or network calls?
- Are all packets clearly human-review inputs only?
- What remains for the human operator to do manually?

## Forbidden

- Do not implement a callable write adapter.
- Do not call Toss APIs or cloud deployment commands.
- Do not read `.env`, `tmp/phase5`, local receipts, secrets, account
  identifiers, or raw broker payloads.
- Do not mark `LCB-007` or `LCB-008` as `RESOLVED`.
- Do not approve future write-adapter code on behalf of a human reviewer.

## Test Criteria

Run:

```bash
npm run check
rg -n "submitOrder|cancelOrder|replaceOrder|placeOrder|TossSecuritiesAdapter|liveBrokerWriteAllowed: true|fetch\\(|axios|undici" src tests docs/phase10
rg -n "\\.env|tmp/phase5|client_secret|access_token|account_number" src tests docs/phase10
git diff -- docs/phase7/live-capable-blocker-register.md
```

If code is added, include the relevant targeted test before `npm run
check`.

## Completion Criteria

- Review confirms blocker register was not changed by AI.
- Every new packet is evidence-only and sanitized.
- No callable broker-write path exists.
- `npm run check` passes.
- GitHub push is not performed.

## Recommended Branch

`phase10/p10-008-live-safety-review-packet`
