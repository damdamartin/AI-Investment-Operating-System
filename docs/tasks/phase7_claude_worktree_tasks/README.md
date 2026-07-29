# Phase 7 Claude Worktree Tasks

Version: 0.2.0
Status: Complete
Last Updated: 2026-07-29
Related Phase: `docs/phase7/README.md`
Related Review: `docs/reviews/Codex_Phase7_Live_Capable_Design_Readiness_Review.md`

## Phase 7 Boundary

Phase 7 is a live-capable design readiness phase. It prepares the system
for a later small-capital live implementation review, but it does not
implement real broker writes.

No task in this folder may add a real Toss order HTTP call, enable a real
broker write path, read local secrets, or treat AI output as live-trading
authorization.

## Task Index

| Task | Title | Recommended Branch | Status |
| --- | --- | --- | --- |
| [P7-001](P7-001_live_capable_blocker_audit.md) | Live-Capable Blocker Audit | `phase7/p7-001-live-capable-blocker-audit` | Merged (`0e596db`) |
| [P7-002](P7-002_toss_write_contract_design.md) | Toss Write Contract Design | `phase7/p7-002-toss-write-contract-design` | Merged (`d9b99c9`) |
| [P7-003](P7-003_small_capital_readiness_gates.md) | Small-Capital Readiness Gates | `phase7/p7-003-small-capital-readiness-gates` | Merged (`6be56eb`) |
| [P7-004](P7-004_phase7_integration_review.md) | Phase 7 Integration Review | `phase7/p7-004-integration-review` | Complete — see `docs/reviews/Codex_Phase7_Live_Capable_Design_Readiness_Review.md` |

Use `PHASE7_FOUR_ENGINEER_ORCHESTRATOR_PROMPT.md` to start the four
parallel Claude Code engineers.

## Round Outcome

All four Phase 7 tasks are merged into local `main` (tip `6be56eb` at the
time P7-004 was completed). `docs/reviews/Codex_Phase7_Live_Capable_Design_Readiness_Review.md`
is the P7-004 integration review: it confirms no task introduced a
callable broker write path, human approval remains structurally required
and cannot be inferred or auto-populated by AI, `.env`/local Phase 5
receipts remain untouched, small-capital readiness is fully specified but
not enabled anywhere, and the blocker register makes the remaining
human-only steps toward a future live implementation phase explicit.
`npm run check` passes cleanly on local `main` after P7-001/P7-002/P7-003
(84 test files, 743 tests) and also passes on the P7-004 review branch
after merging `main` in, with 2 additional regression tests P7-004 added
to `tests/safety/safety-regression.test.ts` (84 test files, 745 tests).
Phase 7 is complete as a design-readiness package once the orchestrator
merges P7-004 into `main` as well; it does not authorize live trading.

## Required Final Verification

After all four branches are merged locally:

```bash
npm run check
```

Optional no-write sanity checks may be run if local state exists:

```bash
npm run phase5:toss:readiness
npm run phase5:toss:doctor
```

These commands must remain no-write. Do not run any real Toss read-only
or write call as part of Phase 7 unless the task explicitly says so and a
human operator initiates it. The current Phase 7 task set does not require
any real Toss call.
