# Phase 10 Small-Capital Live Operation Readiness

Version: 0.1.0
Status: Draft
Last Updated: 2026-07-29
Related Roadmap: `docs/99_Development_Roadmap.md`
Related Previous Phase: `docs/phase9/README.md`
Primary Blocker Register: `docs/phase7/live-capable-blocker-register.md`
Related Tasks: `docs/tasks/phase10_claude_worktree_tasks/README.md`

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
