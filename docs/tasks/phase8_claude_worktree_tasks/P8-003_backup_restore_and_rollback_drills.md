# P8-003 Backup, Restore, and Rollback Drills

## Task ID

P8-003

## Goal

Turn backup/restore and rollback requirements into testable, no-write
drill evaluators and runbooks.

## Assigned Engineer

Engineer 3

## Responsible Module

Backup/restore, rollback drills, incident readiness.

## Files To Modify Or Create

- `src/application/backup-restore/backup-restore-drill.ts`
- `tests/application/backup-restore-drill.test.ts`
- `docs/phase8/backup-restore-drill.md`
- `docs/phase8/rollback-drill-runbook.md`
- `src/application/backup-restore/index.ts`

Coordinate before changing `restore-safety-gate.ts`.

## Inputs

- `src/application/backup-restore/restore-safety-gate.ts`
- `docs/runbooks/Backup_and_Restore_Runbook.md`
- `docs/runbooks/Incident_Runbooks.md`
- `docs/04_Database_Architecture.md`
- `docs/09_Operation_Deployment.md`
- `docs/phase7/small-capital-readiness-gates.md`

## Output

A pure drill evaluator/checklist that covers:

- backup manifest verification
- schema/config version verification
- audit continuity
- secrets handled separately
- post-restore reconciliation
- data quality
- kill-switch availability
- operator approval before resume
- rollback rehearsal steps
- evidence references for each check

The drill may report readiness to resume paper/simulation operations only.
It must not create corrective trades or infer broker state from the
database alone.

## Forbidden

- No real backup upload/download.
- No database destructive operations.
- No broker state correction trades.
- No reading secrets or local receipts.
- No live trading enablement.

## Test Criteria

Run:

```bash
npx vitest run tests/application/restore-safety-gate.test.ts tests/application/backup-restore-drill.test.ts
npm run check
```

## Completion Criteria

- Drill fails closed on missing evidence references.
- Secrets are documented as separate from normal backups.
- Trading resume stays blocked until all checks pass.
- `npm run check` passes.

## Recommended Branch

`phase8/p8-003-backup-restore-rollback-drills`
