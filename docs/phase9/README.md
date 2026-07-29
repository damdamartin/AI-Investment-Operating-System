# Phase 9 Small-Capital Live Trading Preparation

Version: 0.2.0
Status: Complete
Last Updated: 2026-07-29
Related Roadmap: `docs/99_Development_Roadmap.md`
Related Tasks: `docs/tasks/phase9_claude_worktree_tasks/README.md`
Primary Blocker Register: `docs/phase7/live-capable-blocker-register.md`
Related Review: `docs/reviews/Codex_Phase9_Small_Capital_Preparation_Review.md`

## Purpose

Phase 9 prepares for a later small-capital live trading implementation by
turning the human-only live blockers (`LCB-001` through `LCB-008`) into
auditable evidence intake, preflight, and enablement gates.

Phase 9 round 1 does **not** implement a callable Toss broker-write
adapter and does **not** place, cancel, replace, transfer, withdraw, or
convert anything.

## Boundary

Allowed in Phase 9 round 1:

- live blocker evidence intake schemas and validators
- human-review record formats
- no-write preflight checks for live-capable readiness
- contract/preflight hardening for a future write adapter
- small-capital enablement gate design and pure evaluators
- integration review and safety regression tests

Forbidden in Phase 9 round 1:

- real Toss order submission
- real Toss order cancellation or replacement
- money movement, transfer, withdrawal, or currency conversion
- real Toss order endpoint calls
- a callable `TossSecuritiesAdapter` write implementation
- reading or printing `.env`, `tmp/phase5`, local receipts, secrets, raw
  account identifiers, or raw broker payloads
- marking any `LCB-*` blocker as `RESOLVED` without a human-reviewed
  evidence artifact
- treating AI output as human approval
- setting `liveBrokerWriteAllowed: true` in any runtime path

## Inputs

Phase 9 round 1 starts from:

- `docs/phase7/live-capable-blocker-register.md`
- `docs/phase7/toss-write-contract-design.md`
- `docs/phase7/small-capital-readiness-gates.md`
- `docs/phase7/manual-live-approval-record.md`
- `docs/phase8/README.md`
- `docs/13_Compliance_and_Legal_Review.md`
- `docs/07_Trading_System.md`
- `docs/08_Testing_Validation.md`
- `docs/11_AI_RULES.md`

## Exit Criteria

Phase 9 round 1 can be considered complete only when:

- every `LCB-*` blocker has a machine-checkable evidence-intake shape
- evidence validators fail closed on missing human reviewer fields
- future write-adapter preflight remains no-write and cannot call a broker
- small-capital enablement remains separated from live-trading
  authorization
- no runtime output enables live broker writes
- `npm run check` passes

Phase 9 round 1 completion is not approval for live trading. It only
creates the guardrails and evidence formats that humans will use before a
later, separately reviewed implementation phase.

## Status

Complete. P9-001 (`src/application/live-readiness/live-blocker-evidence-intake.ts`,
`docs/phase9/live-blocker-evidence-intake.md`), P9-002
(`src/adapters/toss-write-preflight.ts`,
`docs/phase9/toss-write-preflight-contract-guard.md`), and P9-003
(`src/application/live-readiness/small-capital-enablement-gate.ts`,
`docs/phase9/small-capital-enablement-gate.md`,
`docs/phase9/small-capital-go-no-go-checklist.md`) are merged into local
`main` (tip `3d977aa`, not pushed to GitHub). P9-004
(`docs/reviews/Codex_Phase9_Small_Capital_Preparation_Review.md`)
reviewed all three together and found every exit criterion above
satisfied: all eight `LCB-*` blockers are represented in a
machine-checkable evidence-intake shape, evidence validators fail closed
on missing human-reviewer fields and reject secret/account/payload-like
content, the future write-adapter preflight remains no-write and cannot
call a broker, small-capital enablement remains structurally separated
from live-trading authorization even under a maximally clean input, no
runtime output enables live broker writes (`liveBrokerWriteAllowed` is a
hardcoded `false` literal everywhere it appears), `.env`/`tmp/phase5`
remain unread, and `npm run check` passes (90 test files, 914 tests).

As stated above, this completion is preparation-evidence readiness only.
It is not approval for live trading. The human-only next steps remain
exactly those already listed in
`docs/phase7/live-capable-blocker-register.md` (`LCB-001` through
`LCB-008`, none `RESOLVED`) — Phase 9 round 1 does not touch that
register and introduces no new blocker of its own kind. The integration
review surfaced a non-blocking P9-001/P9-003 evidence-status vocabulary
gap; a follow-up commit closed it by teaching the enablement gate to
accept P9-001's real register-review statuses. `MISSING`, `REJECTED`, and
`DUPLICATE` now map to explicit blocking preparation states, never to
`HUMAN_REVIEWED`, and `RESOLVED` remains rejected as an invalid runtime
status.
