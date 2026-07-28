# Task ID

P5-015

## Goal

Integrate P5-012 through P5-014, run the full Phase 5 safety review, and produce the final operator handoff for the first real read-only verification attempt.

## Assigned Engineer

Engineer 4

## Module

Integration review, safety regression, documentation, and orchestrator handoff.

## Files To Modify Or Create

Primary files:

- `docs/reviews/Codex_Phase5_First_Read_Only_Verification_Review.md`
- `docs/tasks/phase5_claude_worktree_tasks/README.md`

Allowed supporting files:

- `docs/phase5/README.md`
- `docs/phase5/local-toss-read-only-runbook.md`
- `docs/phase5/phase5-toss-completion-checklist.md`
- `tests/scripts/phase5-toss-network-safety-static.test.ts`
- `tests/scripts/phase5-toss-preflight-script.test.ts`
- `tests/scripts/phase5-toss-completion-script.test.ts`

Do not edit P5-012/P5-013/P5-014 primary files until those branches are merge-ready or already merged locally.

## Input

- P5-012, P5-013, P5-014 branch results.
- Local `.env` may be ready on the operator machine, but it must not be read, printed, copied, or committed.

## Output

A final review document that records:

- branches merged
- files changed by each engineer
- commands run
- mock-test coverage
- real-network-capable scripts and their approval gates
- `liveBrokerWriteAllowed:false` status
- whether raw payload storage remains blocked
- exact remaining manual operator steps
- whether it is safe to attempt exactly one human-approved real read-only verification call

## Forbidden

- Do not push to GitHub.
- Do not perform the real read-only verification call unless the orchestrator explicitly instructs you after all merges.
- Do not read or print `.env`.
- Do not include secrets, account numbers, tokens, raw headers, or raw Toss payloads.
- Do not mark live trading ready.
- Do not make preflight/completion pass by removing safety blockers.

## Test Criteria

After merging P5-012 through P5-014 locally, run:

```bash
npm run check
npm run phase5:toss:readiness
npm run phase5:toss:endpoints -- tmp/phase5/toss-read-only-endpoints.local.json
npm run phase5:toss:doctor -- tmp/phase5/toss-read-only-endpoints.local.json tmp/phase5/evidence-manifest.local.json tmp/phase5/evidence-intake.local.json
npm run phase5:toss:preflight -- tmp/phase5/toss-read-only-endpoints.local.json tmp/phase5/evidence-manifest.local.json tmp/phase5/evidence-intake.local.json
npm run phase5:toss:completion -- tmp/phase5/toss-read-only-endpoints.local.json tmp/phase5/evidence-manifest.local.json tmp/phase5/evidence-intake.local.json
```

Fail-closed results are acceptable only when the report keeps:

```text
liveBrokerWriteAllowed:false
networkCallsPerformed:false
```

For the new verification runner, mock tests must pass before any real call is attempted.

## Completion Conditions

- Review document exists.
- README task index is updated.
- Full check passes.
- Remaining manual steps are explicit.
- GitHub push is not performed.

## Recommended Branch

`phase5/p5-015-read-only-integration-review`

