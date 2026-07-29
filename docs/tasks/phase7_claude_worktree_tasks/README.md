# Phase 7 Claude Worktree Tasks

Version: 0.1.0
Status: Draft
Last Updated: 2026-07-29
Related Phase: `docs/phase7/README.md`

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
| [P7-001](P7-001_live_capable_blocker_audit.md) | Live-Capable Blocker Audit | `phase7/p7-001-live-capable-blocker-audit` | Draft |
| [P7-002](P7-002_toss_write_contract_design.md) | Toss Write Contract Design | `phase7/p7-002-toss-write-contract-design` | Draft |
| [P7-003](P7-003_small_capital_readiness_gates.md) | Small-Capital Readiness Gates | `phase7/p7-003-small-capital-readiness-gates` | Draft |
| [P7-004](P7-004_phase7_integration_review.md) | Phase 7 Integration Review | `phase7/p7-004-integration-review` | Draft |

Use `PHASE7_FOUR_ENGINEER_ORCHESTRATOR_PROMPT.md` to start the four
parallel Claude Code engineers.

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
