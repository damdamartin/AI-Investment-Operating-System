# Phase 8 Claude Worktree Tasks

Version: 0.1.0
Status: Draft
Last Updated: 2026-07-29
Related Phase: `docs/phase8/README.md`

## Phase 8 Boundary

Phase 8 is operations, dashboard, monitoring, and deployment readiness.
It remains no-write and no-deploy by default.

No task in this folder may implement real Toss order calls, enable live
broker writes, read local secrets, deploy to production, or treat
dashboard/readiness status as authorization.

## Task Index

| Task | Title | Recommended Branch | Status |
| --- | --- | --- | --- |
| [P8-001](P8-001_operations_status_api.md) | Operations Status API Read Model | `phase8/p8-001-operations-status-api` | Merged (`8cf1af1`) |
| [P8-002](P8-002_deployment_readiness_gate.md) | Deployment Readiness Gate | `phase8/p8-002-deployment-readiness-gate` | Merged (`9ae7056`) |
| [P8-003](P8-003_backup_restore_and_rollback_drills.md) | Backup, Restore, and Rollback Drills | `phase8/p8-003-backup-restore-rollback-drills` | Merged (`26d3e45`) |
| [P8-004](P8-004_phase8_integration_review.md) | Phase 8 Integration Review | `phase8/p8-004-integration-review` | Complete — see `docs/reviews/Codex_Phase8_Operations_Readiness_Review.md` |

Use `PHASE8_FOUR_ENGINEER_ORCHESTRATOR_PROMPT.md` to start the four
parallel Claude Code engineers.

P8-001, P8-002, and P8-003 are merged into local `main` (tip `26d3e45`, not
pushed to GitHub). P8-004's integration review
(`docs/reviews/Codex_Phase8_Operations_Readiness_Review.md`) reviewed all
three together and found Phase 8 complete as an operations-readiness
package: no real broker write path, real network call, real cloud
deployment command, or `liveBrokerWriteAllowed: true` runtime value exists
anywhere in the merged code; `.env`/`tmp/phase5` remain untouched; and
`npm run check` passes (87 test files, 818 tests). This completion is
operational readiness evidence only — it is not approval for live trading
or for a real deployment. See the review's "Whether Phase 8 Is Complete,
Blocked, or Needs Another Round" section for full reasoning.

## Required Final Verification

After all branches are merged locally:

```bash
npm run check
```

Suggested no-write scans:

```bash
rg -n "submitOrder|cancelOrder|replaceOrder|placeOrder|TossSecuritiesAdapter|liveBrokerWriteAllowed: true|fetch\\(|axios|undici" src tests docs/phase8
rg -n "\\.env|tmp/phase5|client_secret|access_token|account_number" src tests docs/phase8
```

Matches are acceptable only when they are prohibitions, redaction tests,
or safety assertions.
