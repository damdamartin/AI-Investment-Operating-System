# P10-006 Account And Provisioning Evidence Packet

## Task ID

P10-006

## Goal

Create the sanitized evidence packet structure for `LCB-002` and
`LCB-003`: Toss account permission/capability evidence and production
credential provisioning evidence.

## Assigned Engineer

Engineer 2

## Responsible Module

Account capability evidence, credential provisioning process evidence.

## Files To Modify Or Create

- `docs/phase10/account-provisioning-evidence-packet.md`
- optionally `src/application/live-readiness/account-provisioning-evidence-packet.ts`
- optionally `tests/application/account-provisioning-evidence-packet.test.ts`
- `docs/tasks/phase10_claude_worktree_tasks/README.md` only for status
  updates after completion

Avoid editing `docs/phase7/live-capable-blocker-register.md`.

## Inputs

- `docs/phase10/human-blocker-evidence-workbook.md`
- `docs/phase7/live-capable-blocker-register.md`
- `docs/07_Trading_System.md`
- `docs/08_Testing_Validation.md`
- `docs/09_Operation_Deployment.md`
- `docs/11_AI_RULES.md`

## Output

A sanitized packet/checklist that tells a human reviewer exactly what to
record for:

- broker account permission/capability evidence
- read-only verification references
- production credential storage process
- access control and rotation process
- audit trail expectations
- reviewer name, role, date, and decision

If code is added, it must validate process descriptions and sanitized
references only. It must not read `.env`, `tmp/phase5`, or secret stores.

## Forbidden

- Do not read or print `.env`, `tmp/phase5`, local receipts, account
  numbers, cash balances, holdings quantities, API keys, tokens, or
  client secrets.
- Do not call Toss APIs.
- Do not create production credentials or cloud secrets.
- Do not mark `LCB-002` or `LCB-003` as `RESOLVED`.
- Do not implement broker writes.

## Test Criteria

If code is added, run:

```bash
npx vitest run tests/application/account-provisioning-evidence-packet.test.ts tests/config/redaction.test.ts
npm run check
```

If only documents are added, run:

```bash
npm run check
```

## Completion Criteria

- Packet describes the provisioning process, not credential values.
- Account evidence remains masked and sanitized.
- Missing reviewer/date/decision remains blocking.
- `npm run check` passes.

## Recommended Branch

`phase10/p10-006-account-provisioning-evidence-packet`
