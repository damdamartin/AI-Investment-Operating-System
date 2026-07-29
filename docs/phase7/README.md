# Phase 7 Live-Capable Design Readiness

Version: 0.2.0
Status: Complete
Last Updated: 2026-07-29
Related Reviews:
`docs/reviews/Codex_Phase6_Simulation_Safety_Review.md`,
`docs/reviews/Codex_Phase6_Round2_Operational_Readiness_Review.md`,
`docs/reviews/Codex_Phase7_Live_Capable_Blocker_Audit.md`,
`docs/reviews/Codex_Phase7_Live_Capable_Design_Readiness_Review.md`
Related Tasks:
`docs/tasks/phase7_claude_worktree_tasks/README.md`
Related Artifacts:
`docs/phase7/live-capable-blocker-register.md`,
`docs/phase7/toss-write-contract-design.md`,
`docs/phase7/small-capital-readiness-gates.md`,
`docs/phase7/manual-live-approval-record.md`,
`docs/phase7/small-capital-operator-checklist.md`

## Purpose

Phase 7 starts the live-capable design review path. It does **not**
authorize live trading and does **not** implement real broker writes.

The goal is to define the evidence, contracts, approval boundaries, and
small-capital readiness gates that must exist before any later phase can
implement a real Toss broker-write adapter.

## Boundary

Allowed in Phase 7:

- design review documents
- interface and contract shapes for future broker-write capability
- compile-time guards that keep placeholder write paths uncallable
- small-capital readiness checklist design
- manual approval workflow design
- safety regression tests proving no real broker write path exists
- documentation updates that separate paper readiness from live readiness

Forbidden in Phase 7:

- real Toss order submission
- real Toss order cancellation
- real Toss order replacement/modification
- transfer, withdrawal, currency conversion, or money movement
- real HTTP calls to Toss order endpoints
- reading, printing, or committing `.env` or `tmp/phase5` local receipts
- treating AI-generated output as sufficient human approval
- enabling `liveBrokerWriteAllowed: true` in any runtime path

## Inputs

Phase 7 must start from:

- `docs/11_AI_RULES.md`
- `docs/07_Trading_System.md`
- `docs/08_Testing_Validation.md`
- `docs/13_Compliance_and_Legal_Review.md`
- `docs/open_questions.md`
- `docs/phase5/README.md`
- `docs/phase6/README.md`
- `docs/reviews/Codex_Phase5_Final_Closure_Review.md`
- `docs/reviews/Codex_Phase6_Round2_Operational_Readiness_Review.md`

## Exit Criteria

Phase 7 can be considered complete only when:

- every unresolved live-capable blocker is listed with an owner and a
  required evidence type
- `TossSecuritiesAdapter` future contract is specified without creating a
  callable live-write implementation
- small-capital readiness has explicit numeric and procedural limits
- manual approval records are specified as human-owned artifacts
- safety regression tests still prove no real broker write path exists
- `npm run check` passes

Phase 7 completion is not approval for live trading. It is only approval
to move toward a later, separately reviewed implementation phase.

## Status

Complete. P7-001 (`docs/phase7/live-capable-blocker-register.md`),
P7-002 (`docs/phase7/toss-write-contract-design.md`,
`src/adapters/toss-write-contract.ts`), and P7-003
(`docs/phase7/small-capital-readiness-gates.md`,
`docs/phase7/manual-live-approval-record.md`,
`docs/phase7/small-capital-operator-checklist.md`,
`src/application/live-readiness/small-capital-readiness.ts`) are merged
into local `main`. P7-004
(`docs/reviews/Codex_Phase7_Live_Capable_Design_Readiness_Review.md`)
reviewed all three together and found every exit criterion above
satisfied: no task introduced a callable broker write path, human
approval remains structurally required and cannot be inferred or
auto-populated by AI, `.env`/local Phase 5 receipts remain untouched,
small-capital readiness is fully specified but not enabled anywhere, and
future implementation blockers are explicit
(`docs/phase7/live-capable-blocker-register.md`, `LCB-001` through
`LCB-008`, none `RESOLVED`). `npm run check` passes (84 test files, 745
tests on the P7-004 review branch after merging `main`).

As stated above, this completion is not approval for live trading. Every
blocker in the register remains a human-only next step for a later,
separately reviewed implementation phase.
