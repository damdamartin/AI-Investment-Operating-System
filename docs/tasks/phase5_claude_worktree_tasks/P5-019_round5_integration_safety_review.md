# Task ID

P5-019

## Goal

Perform Round 5 integration safety review after P5-016, P5-017, and P5-018 are merged locally.

## Assigned Engineer

Engineer 4

## Module

Phase 5 integration review, safety regression checks, and final handoff.

## Files To Modify Or Create

Primary files:

- `docs/reviews/Codex_Phase5_Round5_Read_Only_Expansion_Review.md`
- `tests/scripts/phase5-toss-network-safety-static.test.ts`

Allowed supporting files:

- `docs/tasks/phase5_claude_worktree_tasks/README.md`
- `docs/phase5/local-toss-read-only-runbook.md`
- `docs/phase5/phase5-toss-completion-checklist.md`

Avoid editing P5-016/P5-017 implementation files unless a safety regression is found and explicitly coordinated.

## Input

- Start phase 1 immediately as a scaffold/regression-gap review if P5-016/P5-017/P5-018 are not merged yet.
- Complete phase 2 only after those branches are merged into local `main`.

## Output

A final Round 5 review that records:

- what changed in each engineer's branch
- whether market-prices remains mock-only or is ready for one human-approved real read-only attempt
- whether evidence receipts remain sanitized
- whether docs accurately describe accounts/holdings already verified locally
- whether all Phase 5 commands preserve safety invariants
- any remaining blockers before the next human-only read-only call

Add or update static safety regression tests if gaps are discovered.

## Forbidden

- Do not run real Toss API calls.
- Do not read `.env`.
- Do not inspect, print, or commit local real receipt contents.
- Do not implement or approve broker write functions.
- Do not push to GitHub.

## Test Criteria

Run after final integration:

```bash
npm run check
npm run phase5:toss:readiness
npm run phase5:toss:endpoints -- tmp/phase5/toss-read-only-endpoints.local.json
npm run phase5:toss:doctor -- tmp/phase5/toss-read-only-endpoints.local.json tmp/phase5/evidence-manifest.local.json tmp/phase5/evidence-intake.local.json
npm run phase5:toss:preflight -- tmp/phase5/toss-read-only-endpoints.local.json tmp/phase5/evidence-manifest.local.json tmp/phase5/evidence-intake.local.json
PHASE5_TOSS_READ_ONLY_CALL_APPROVED=true npm run phase5:toss:completion -- tmp/phase5/toss-read-only-endpoints.local.json tmp/phase5/evidence-manifest.local.json tmp/phase5/evidence-intake.local.json
```

Some Phase 5 commands may fail closed depending on the local operator files. If they fail closed, report exact reason codes and confirm:

- `liveBrokerWriteAllowed:false`
- no unexpected write capability
- no raw payload storage
- no unexpected network calls

## Completion Conditions

- Review document is complete and specific.
- Any new static safety gaps are covered by tests.
- `npm run check` passes.
- Final report lists branch/commit, changed files, command results, safety invariants, and remaining human-only steps.

## Recommended Branch

`phase5/p5-019-round5-integration-safety-review`
