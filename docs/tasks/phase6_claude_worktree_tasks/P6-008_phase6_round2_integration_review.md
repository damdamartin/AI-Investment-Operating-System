# Task ID

P6-008

## Goal

Perform Phase 6 round 2 integration safety review after P6-005, P6-006, and P6-007 are merged locally.

## Assigned Engineer

Engineer 4

## Module

Integration review, safety regression coverage, and Phase 6 round 2 handoff.

## Files To Modify Or Create

Primary files:

- `docs/reviews/Codex_Phase6_Round2_Operational_Readiness_Review.md`
- `tests/safety/safety-regression.test.ts`

Allowed supporting files:

- `docs/tasks/phase6_claude_worktree_tasks/README.md`
- `docs/phase6/README.md`
- `docs/phase6/phase6-operator-runbook.md`

Avoid editing P6-005/P6-006/P6-007 implementation files unless a safety regression is found and explicitly coordinated.

## Input

- Start phase 1 immediately as a scaffold/regression-gap review if P6-005/P6-006/P6-007 are not merged yet.
- Complete phase 2 only after those branches are merged into local `main`.

## Output

A final Phase 6 round 2 review that records:

- what changed in each engineer's branch
- whether dashboard/status remains read-only
- whether alerts/reports remain non-executing
- whether scheduler jobs remain no-write
- whether runbooks are sufficient for operator go/no-go decisions
- whether paper/simulation readiness is clearly separated from live readiness
- any remaining blockers before Phase 7 live-capable design review

Add or update safety regression tests if gaps are discovered.

## Forbidden

- Do not run real Toss API calls.
- Do not read `.env`.
- Do not read or commit local real receipts.
- Do not implement broker writes.
- Do not push to GitHub.

## Test Criteria

Run after final integration:

```bash
npm run check
npm run phase5:toss:readiness
npm run phase5:toss:doctor -- tmp/phase5/toss-read-only-endpoints.local.json tmp/phase5/evidence-manifest.local.json tmp/phase5/evidence-intake.local.json
npm run phase5:toss:preflight -- tmp/phase5/toss-read-only-endpoints.local.json tmp/phase5/evidence-manifest.local.json tmp/phase5/evidence-intake.local.json
PHASE5_TOSS_READ_ONLY_CALL_APPROVED=true npm run phase5:toss:completion -- tmp/phase5/toss-read-only-endpoints.local.json tmp/phase5/evidence-manifest.local.json tmp/phase5/evidence-intake.local.json
```

Some Phase 5 local commands may fail closed on a fresh checkout. If they fail closed, report exact reason codes and confirm:

- `liveBrokerWriteAllowed:false`
- no unexpected write capability
- no raw payload storage
- no unexpected network calls

## Completion Conditions

- Review document is complete and specific.
- Any new safety gaps are covered by tests.
- `npm run check` passes.
- Final report lists branch/commit, changed files, command results, safety invariants, and remaining human-only steps.

## Recommended Branch

`phase6/p6-008-round2-operational-readiness-review`
