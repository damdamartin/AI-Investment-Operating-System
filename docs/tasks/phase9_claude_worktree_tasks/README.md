# Phase 9 Claude Worktree Tasks

Version: 0.2.0
Status: Complete
Last Updated: 2026-07-29
Related Phase: `docs/phase9/README.md`
Related Review: `docs/reviews/Codex_Phase9_Small_Capital_Preparation_Review.md`

## Phase 9 Round 1 Boundary

Phase 9 round 1 is small-capital live trading preparation. It remains
no-write. It creates evidence intake, preflight, and enablement gates
only.

No task in this folder may implement a callable Toss broker-write adapter,
submit orders, cancel orders, replace orders, move money, read local
secrets, or mark human-only blockers as resolved.

## Task Index

| Task | Title | Recommended Branch | Status |
| --- | --- | --- | --- |
| [P9-001](P9-001_live_blocker_evidence_intake.md) | Live Blocker Evidence Intake | `phase9/p9-001-live-blocker-evidence-intake` | Merged (`254a963`) |
| [P9-002](P9-002_toss_write_preflight_contract_guard.md) | Toss Write Preflight Contract Guard | `phase9/p9-002-toss-write-preflight-contract-guard` | Merged (`abe6d64`) |
| [P9-003](P9-003_small_capital_enablement_gate.md) | Small-Capital Enablement Gate | `phase9/p9-003-small-capital-enablement-gate` | Merged (`3d977aa`) |
| [P9-004](P9-004_phase9_integration_review.md) | Phase 9 Integration Review | `phase9/p9-004-integration-review` | Complete — see `docs/reviews/Codex_Phase9_Small_Capital_Preparation_Review.md` |

Use `PHASE9_FOUR_ENGINEER_ORCHESTRATOR_PROMPT.md` to start the four
parallel Claude Code engineers.

## Required Final Verification

After all branches are merged locally:

```bash
npm run check
```

Suggested no-write scans:

```bash
rg -n "submitOrder|cancelOrder|replaceOrder|placeOrder|TossSecuritiesAdapter|liveBrokerWriteAllowed: true|fetch\\(|axios|undici" src tests docs/phase9
rg -n "\\.env|tmp/phase5|client_secret|access_token|account_number" src tests docs/phase9
```

Matches are acceptable only when they are prohibitions, redaction tests,
or safety assertions.
