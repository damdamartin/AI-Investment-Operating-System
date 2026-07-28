# Backup and Restore Runbook

Version: 0.4.39
Status: Draft
Last Updated: 2026-07-28
Related Docs: ../04_Database_Architecture.md, ../09_Operation_Deployment.md, ../11_AI_RULES.md

## Purpose

This runbook defines the minimum backup, restore, and post-restore safety procedure for AI Investment Operating System.

The core rule is:

> Trading remains disabled after restore until database state, broker state, configuration state, and audit continuity are verified.

## Backup Scope

Back up normal system data:

- database schema and migrations
- strategy versions
- risk limits
- config versions
- order approvals
- broker order records
- fill records
- positions
- cash balances
- reconciliation reports
- AI analyses used in decisions
- data quality reports
- API usage metrics
- audit records
- outbox and job run records

Do not place secrets in normal data backups:

- Toss Securities credentials
- Naver client secret
- Claude API key
- access tokens
- refresh tokens
- private environment files

Secrets must be managed separately through a secret manager or secure environment-specific rotation process.

## Backup Verification Checklist

- Backup completed successfully.
- Backup is encrypted.
- Backup storage is separate from the primary database host.
- Backup retention policy is documented.
- Latest migration version is recorded.
- Config version table is included.
- Audit records are included.
- Restore test date is recorded.
- Backup failure alert path is working.

## Restore Procedure

1. Activate global kill switch or equivalent trading pause.
2. Stop schedulers that can create trading-dependent jobs.
3. Preserve current logs before overwriting state.
4. Restore database into an isolated recovery environment first.
5. Verify schema and migration version.
6. Verify row counts for critical tables.
7. Verify latest config versions.
8. Verify audit trail continuity.
9. Verify outbox and job runner states.
10. Restore or rotate secrets through the secret manager.
11. Run read-only broker reconciliation.
12. Run data quality checks.
13. Run AI Health Check.
14. Confirm dashboard shows restored state.
15. Keep trading disabled until all safety gates pass.

## Post-Restore Trading Gate

Trading may resume only when all are true:

- restore verification checklist passed
- schema and migration version confirmed
- active config versions confirmed
- audit continuity confirmed
- secrets restored or rotated separately
- reconciliation is clean
- data quality does not block trading
- kill switch is confirmed available
- operator approval is recorded

If any item is unknown, trading remains disabled.

## Recovery Notes

- Never place corrective trades as part of database restore.
- Never infer broker state from restored database alone.
- Broker state must be reconciled from read-only broker APIs.
- If state is uncertain, continue paper/read-only operation until resolved.
- Record a post-restore audit event and incident note.
