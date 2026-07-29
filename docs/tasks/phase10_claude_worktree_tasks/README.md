# Phase 10 Claude Worktree Tasks

Version: 0.3.0
Status: Round 1 Complete, Round 2 Complete
Last Updated: 2026-07-29
Related Phase: `docs/phase10/README.md`
Round 1 Review: `docs/reviews/Codex_Phase10_Live_Operation_Readiness_Review.md`
Round 2 Review: `docs/reviews/Codex_Phase10_Round2_Human_Blocker_Evidence_Review.md`

## Phase 10 Round 1 Boundary

Phase 10 round 1 is small-capital live operation readiness. It is still
no-write. It creates the final approval packet, operating protocol,
runtime lock checks, and integration review that humans need before a
later implementation phase can even be considered.

No task in this folder may implement a callable Toss broker-write adapter,
submit orders, cancel orders, replace orders, move money, read local
secrets, or mark human-only blockers as resolved.

## Task Index

| Task | Title | Recommended Branch | Status |
| --- | --- | --- | --- |
| [P10-001](P10-001_live_operation_approval_packet.md) | Live Operation Approval Packet | `phase10/p10-001-live-operation-approval-packet` | Merged (`b65e939`) |
| [P10-002](P10-002_first_trade_operating_protocol.md) | First-Trade Operating Protocol | `phase10/p10-002-first-trade-operating-protocol` | Merged (`8f11842`) |
| [P10-003](P10-003_runtime_lock_and_audit_gate.md) | Runtime Lock And Audit Gate | `phase10/p10-003-runtime-lock-and-audit-gate` | Merged (`b3d2cc2`) |
| [P10-004](P10-004_phase10_integration_review.md) | Phase 10 Integration Review | `phase10/p10-004-integration-review` | Complete |
| [P10-005](P10-005_toss_compliance_evidence_packet.md) | Toss And Compliance Evidence Packet | `phase10/p10-005-toss-compliance-evidence-packet` | Merged (`c53f095`) |
| [P10-006](P10-006_account_provisioning_evidence_packet.md) | Account And Provisioning Evidence Packet | `phase10/p10-006-account-provisioning-evidence-packet` | Merged (`1d5042f`) |
| [P10-007](P10-007_owner_risk_evidence_packet.md) | Owner And Risk Evidence Packet | `phase10/p10-007-owner-risk-evidence-packet` | Merged (`e9c35de`) |
| [P10-008](P10-008_live_safety_review_packet.md) | Live Safety Review Packet And Integration Review | `phase10/p10-008-live-safety-review-packet` | Complete |

## Round 1 Outcome

All four branches merged locally into `main` (final tip after this
review's own merge). `npm run check` passes (93 test files, 1017-1018
tests, 0 failures — see the review for the small environment-dependent
count note). Post-merge source scans show no callable broker-write path,
no real network call, no real secret, and no `liveBrokerWriteAllowed:
true` runtime value. `docs/phase7/live-capable-blocker-register.md` was
not touched — `LCB-001` through `LCB-008` remain human-only and
unresolved. See `docs/reviews/Codex_Phase10_Live_Operation_Readiness_Review.md`
for the full review. GitHub push was not performed.

Use `PHASE10_FOUR_ENGINEER_ORCHESTRATOR_PROMPT.md` to start the four
parallel Claude Code engineers.

Use `ROUND2_FOUR_ENGINEER_ORCHESTRATOR_PROMPT.md` for the human blocker
evidence packet round.

## Round 2 Outcome

All four round 2 branches (P10-005, P10-006, P10-007, P10-008) merged
locally into `main`. `npm run check` passes (96 test files, 1131 tests,
0 failures, verified in the P10-008 engineer's worktree after merging
`main`; 95 files / 1103 tests on `main` alone before that merge — see the
round 2 review for the reconciled counts). Post-merge source scans show
no callable broker-write path, no real network call, no real secret, and
no `liveBrokerWriteAllowed: true` / `blockerRegisterResolutionAllowed:
true` runtime value — every new match traces to one of the four new
evidence-packet files and is prohibition prose, a doc-comment safety
guarantee, or a test assertion of absence/rejection.
`docs/phase7/live-capable-blocker-register.md` was not touched —
`LCB-001` through `LCB-008` remain human-only and unresolved. All four
evidence packets (`LCB-001`/`LCB-005` via P10-005, `LCB-002`/`LCB-003`
via P10-006, `LCB-004`/`LCB-006` via P10-007, `LCB-007`/`LCB-008` via
P10-008) are sanitized, evidence-only, and use only the workbook's five
allowed decision values. See
`docs/reviews/Codex_Phase10_Round2_Human_Blocker_Evidence_Review.md` for
the full review, including the consolidated list of what a human
operator must still do for each blocker. GitHub push was not performed.

## Required Final Verification

After all branches are merged locally:

```bash
npm run check
```

Suggested no-write scans:

```bash
rg -n "submitOrder|cancelOrder|replaceOrder|placeOrder|TossSecuritiesAdapter|liveBrokerWriteAllowed: true|fetch\\(|axios|undici" src tests docs/phase10
rg -n "\\.env|tmp/phase5|client_secret|access_token|account_number" src tests docs/phase10
```

Matches are acceptable only when they are prohibitions, redaction tests,
or safety assertions.
