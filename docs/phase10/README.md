# Phase 10 Small-Capital Live Operation Readiness

Version: 0.3.0
Status: Round 1 Complete, Round 2 Complete (evidence packets only — not live-trading approval)
Last Updated: 2026-07-29
Round 1 Review: `docs/reviews/Codex_Phase10_Live_Operation_Readiness_Review.md`
Round 2 Review: `docs/reviews/Codex_Phase10_Round2_Human_Blocker_Evidence_Review.md`
Related Roadmap: `docs/99_Development_Roadmap.md`
Related Previous Phase: `docs/phase9/README.md`
Primary Blocker Register: `docs/phase7/live-capable-blocker-register.md`
Related Tasks: `docs/tasks/phase10_claude_worktree_tasks/README.md`
Round 2 Workbook: `docs/phase10/human-blocker-evidence-workbook.md`
Human Templates: `docs/phase10/human-evidence-templates/README.md`
Human Runbook: `docs/phase10/human-evidence-operator-runbook.md`

## Purpose

Phase 10 prepares the final operational control package for a future
small-capital live operation.

This phase does not assume that live trading is already allowed. It starts
from the Phase 9 evidence gates and makes the remaining go/no-go boundary
more explicit: all `LCB-001` through `LCB-008` blockers must be resolved
by humans before any later task may implement a callable broker-write
adapter or send an order.

## Boundary

Allowed in Phase 10 round 1:

- compile a sanitized live-operation approval packet from Phase 7/8/9
  evidence outputs
- define a human-executed first-trade operating protocol
- define runtime lock and audit checks that still keep broker writes
  disabled
- review the above for live-trading ambiguity, secret leakage, and
  fail-open risk

Forbidden in Phase 10 round 1:

- real Toss order submission
- real Toss order cancellation or replacement
- money movement, transfer, withdrawal, or currency conversion
- a callable `TossSecuritiesAdapter` write implementation
- actual Toss order endpoint calls
- reading or printing `.env`, `tmp/phase5`, local receipts, secrets,
  account identifiers, or raw broker payloads
- marking any `LCB-*` blocker as `RESOLVED` by AI
- treating an AI-generated approval packet as human approval
- setting `liveBrokerWriteAllowed: true` in any runtime path

## Exit Criteria

Phase 10 round 1 can be considered complete only when:

- the live-operation approval packet is evidence-only and sanitized
- the first-trade protocol remains human-executed and cannot trigger a
  broker write from code
- runtime locks explicitly prove that the application remains no-write
  until a later human-approved implementation phase
- every report includes a clear statement that it is not live-trading
  authorization
- `npm run check` passes

Phase 10 round 1 completion is not approval for live trading. It is a
final readiness package for human review before any future write-capable
implementation is considered.

## Round 1 Status

Complete. P10-001 (approval packet), P10-002 (first-trade protocol), and
P10-003 (runtime lock and audit gate) are merged into local `main` and
reviewed together in P10-004. `npm run check` passes on the merged tree.
No callable broker-write path was introduced. `docs/phase7/live-capable-blocker-register.md`
was not touched — `LCB-001` through `LCB-008` remain open and human-only.
Full detail: `docs/reviews/Codex_Phase10_Live_Operation_Readiness_Review.md`.

## Round 2 Plan

Round 2 prepares the human blocker evidence packets for `LCB-001` through
`LCB-008`. It remains no-write and does not resolve the blocker register.

The workbook is `docs/phase10/human-blocker-evidence-workbook.md`; the
four-engineer prompt is
`docs/tasks/phase10_claude_worktree_tasks/ROUND2_FOUR_ENGINEER_ORCHESTRATOR_PROMPT.md`.

Human operators can use
`docs/phase10/human-evidence-templates/README.md` and
`docs/phase10/human-evidence-operator-runbook.md` to create sanitized
evidence drafts. Those templates remain blank until a human fills them in
and do not authorize live trading.

## Round 2 Status

Complete. P10-005 (Toss/compliance packet, `LCB-001`/`LCB-005`), P10-006
(account/provisioning packet, `LCB-002`/`LCB-003`), P10-007 (owner/risk
packet, `LCB-004`/`LCB-006`), and P10-008 (live-safety/review packet,
`LCB-007`/`LCB-008`, plus this round's integration review) are merged
into local `main`. `npm run check` passes on the merged tree (96 test
files, 1131 tests, 0 failures, in the P10-008 engineer's worktree after
merging main; 95 files / 1103 tests on `main` alone before that merge).
No callable broker-write path was introduced by any round 2 task.
`docs/phase7/live-capable-blocker-register.md` was not touched —
`LCB-001` through `LCB-008` remain unresolved and human-only. All four
evidence packets are sanitized, evidence-only, use only the workbook's
five allowed decision values, and each states explicitly that it is not
live-trading authorization. Full detail, including the consolidated list
of what a human operator must still do for every `LCB-*` blocker:
`docs/reviews/Codex_Phase10_Round2_Human_Blocker_Evidence_Review.md`.
