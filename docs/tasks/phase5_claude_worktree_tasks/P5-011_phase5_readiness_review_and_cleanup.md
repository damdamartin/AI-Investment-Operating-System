# Task ID

P5-011

## Goal

Perform the Phase 5 readiness review after P5-008 through P5-010 are complete, then document remaining blockers before any real Toss read-only API call is attempted.

## Assigned Engineer

Engineer 4

## Module

Integration review, safety regression, and readiness report.

## Files To Modify Or Create

Primary files:

- `docs/reviews/Codex_Phase5_Readiness_Review.md`
- `docs/tasks/phase5_claude_worktree_tasks/README.md`

Allowed supporting files:

- `tests/safety/safety-regression.test.ts`
- `tests/scripts/phase5-toss-preflight-script.test.ts`
- `tests/scripts/phase5-toss-completion-script.test.ts`
- `docs/phase5/README.md`

Avoid editing files owned by P5-008, P5-009, or P5-010 while those branches are still active unless you are doing the final integration pass.

## Required Reading

- `docs/11_AI_RULES.md`
- `docs/reviews/Codex_Phase5_Architecture_Review.md`
- `docs/reviews/Codex_Phase5_Readiness_Review.md` if it already exists
- `docs/phase5/README.md`
- `docs/tasks/phase5_claude_worktree_tasks/P5-008_open_question_evidence_policy.md`
- `docs/tasks/phase5_claude_worktree_tasks/P5-009_read_only_one_call_harness.md`
- `docs/tasks/phase5_claude_worktree_tasks/P5-010_phase5_local_runbook_and_operator_checklist.md`

## Implementation Requirements

Start with a review-only branch and wait for P5-008 through P5-010 to be merge-ready before finalizing the readiness report.

The readiness report must include:

- what changed in P5-008 through P5-010
- commands run
- pass/fail-closed results
- `liveBrokerWriteAllowed` status
- `networkCallsPerformed` status
- remaining blockers
- whether the system is ready for a future human-approved single read-only verification attempt
- explicit statement that live trading is still blocked

If safety regression gaps are found, add narrow tests.

## Forbidden

- Do not perform real Toss API calls.
- Do not add or request secrets.
- Do not mark live trading ready.
- Do not remove fail-closed blockers just to make preflight pass.
- Do not push to GitHub.

## Tests

Run after integration:

```bash
npm run check
npm run phase5:toss:endpoints
npm run phase5:toss:doctor
npm run phase5:toss:preflight
npm run phase5:toss:completion
```

`preflight` and `completion` may fail closed in the default local state. That is acceptable only if:

```text
liveBrokerWriteAllowed: false
networkCallsPerformed: false
```

## Completion Conditions

- Readiness review exists.
- All intended branches are merged locally.
- `npm run check` passes.
- Fail-closed states are documented.
- No live broker write path is introduced.
- Final report clearly tells the user what remains before a real read-only call.

## Recommended Branch

`phase5/p5-011-readiness-review-cleanup`

