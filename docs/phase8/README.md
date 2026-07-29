# Phase 8 Operations, Dashboard, Monitoring, and Deployment Readiness

Version: 0.2.0
Status: Complete
Last Updated: 2026-07-29
Related Roadmap: `docs/99_Development_Roadmap.md`
Related Tasks: `docs/tasks/phase8_claude_worktree_tasks/README.md`
Related Inputs:
`docs/09_Operation_Deployment.md`,
`docs/phase6/README.md`,
`docs/phase7/README.md`,
`docs/reviews/Codex_Phase7_Live_Capable_Design_Readiness_Review.md`
Related Review: `docs/reviews/Codex_Phase8_Operations_Readiness_Review.md`

## Purpose

Phase 8 prepares the system to run continuously with operator visibility,
deployment guardrails, monitoring, backup/restore procedures, and
rollback documentation.

Phase 8 does **not** authorize live trading. It does **not** implement a
real Toss broker-write adapter, submit orders, cancel orders, transfer
money, or enable production capital.

## Boundary

Allowed in Phase 8:

- read-only dashboard/status API models
- operator-facing status summaries
- no-write scheduler and worker readiness checks
- alert and metric aggregation
- deployment readiness gates that keep production disabled by default
- backup/restore drill evaluators and runbooks
- rollback playbook documentation
- integration review and safety regression tests

Forbidden in Phase 8:

- real Toss order submission, cancellation, or replacement
- any money movement, withdrawal, transfer, or currency conversion
- real Toss order endpoint calls
- real deployment to a cloud provider from Claude/Codex
- reading or printing `.env`, `tmp/phase5`, local receipts, secrets, or raw
  broker payloads
- changing defaults so production/live trading is enabled
- treating dashboard/API status as live-trading authorization

## Inputs

Phase 8 work should start from:

- `docs/09_Operation_Deployment.md`
- `docs/11_AI_RULES.md`
- `docs/phase6/README.md`
- `docs/phase7/README.md`
- `docs/phase7/live-capable-blocker-register.md`
- `src/application/dashboard/`
- `src/application/alerting/`
- `src/application/observability/`
- `src/application/scheduler/`
- `src/application/deployment/`
- `src/application/backup-restore/`

## Exit Criteria

Phase 8 can be considered complete only when:

- dashboard/status output can summarize the existing safety chain without
  enabling actions
- deployment readiness fails closed and keeps production/live trading
  disabled by default
- backup/restore and rollback drills have explicit, testable gates
- observability and alert summaries remain sanitized
- all new runtime outputs keep `liveBrokerWriteAllowed: false` where
  relevant
- safety regression tests still prove no callable broker-write path exists
- `npm run check` passes

Phase 8 completion is operational readiness evidence only. It is not
approval for Phase 9 small-capital live preparation.

## Status

Complete. P8-001 (`src/application/operations/operations-status-read-model.ts`,
`docs/phase8/operations-status-api.md`), P8-002
(`src/application/deployment/deployment-readiness-gate.ts`,
`docs/phase8/deployment-readiness-gate.md`), and P8-003
(`src/application/backup-restore/backup-restore-drill.ts`,
`docs/phase8/backup-restore-drill.md`,
`docs/phase8/rollback-drill-runbook.md`) are merged into local `main`
(tip `26d3e45`, not pushed to GitHub). P8-004
(`docs/reviews/Codex_Phase8_Operations_Readiness_Review.md`) reviewed all
three together and found every exit criterion above satisfied: dashboard
status output is read-only and advisory, deployment readiness fails closed
with production/live trading disabled by default, backup/restore/rollback
drills are testable and fail closed, no task introduced a real network
call, real cloud deployment command, or broker-write capability,
`.env`/`tmp/phase5` remain untouched, all new runtime outputs keep
`liveBrokerWriteAllowed: false` as a hardcoded literal, safety regression
tests (`tests/safety/safety-regression.test.ts`, 25 tests) still prove no
callable broker-write path exists, and `npm run check` passes (87 test
files, 818 tests).

As stated above, this completion is operational readiness evidence only.
It is not approval for live trading or for a real deployment. The
human-only next steps remain exactly those already listed in
`docs/phase7/live-capable-blocker-register.md` (`LCB-001` through
`LCB-008`, none `RESOLVED`) — Phase 8 does not touch that register and
introduces no new blocker of its own kind.

The next planned task pack is Phase 9 round 1:
`docs/tasks/phase9_claude_worktree_tasks/README.md`. It turns the
human-only live blockers into evidence intake, preflight, and enablement
gates while still forbidding any callable broker-write implementation.
