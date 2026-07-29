# P9-003 Small-Capital Enablement Gate

## Task ID

P9-003

## Goal

Create a final, pure small-capital enablement gate that combines Phase 7
readiness, Phase 8 operations readiness, and Phase 9 evidence intake into
a single go/no-go report while still never authorizing live broker writes.

## Assigned Engineer

Engineer 3

## Responsible Module

Small-capital enablement report, operator go/no-go checklist, readiness
composition.

## Files To Modify Or Create

- `src/application/live-readiness/small-capital-enablement-gate.ts`
- `tests/application/small-capital-enablement-gate.test.ts`
- `docs/phase9/small-capital-enablement-gate.md`
- `docs/phase9/small-capital-go-no-go-checklist.md`
- `src/application/live-readiness/index.ts`

Avoid editing P9-001/P9-002 owned files unless coordination is required.

## Inputs

- `src/application/live-readiness/small-capital-readiness.ts`
- `src/application/operations/operations-status-read-model.ts`
- `src/application/deployment/deployment-readiness-gate.ts`
- `src/application/backup-restore/backup-restore-drill.ts`
- P9-001 evidence intake output if available
- `docs/phase7/small-capital-readiness-gates.md`
- `docs/phase8/README.md`

## Output

A pure evaluator that returns a go/no-go report with:

- `readyForSmallCapitalPreparation`
- `readyForLiveBrokerWrites: false`
- `liveBrokerWriteAllowed: false`
- blocker reason codes
- human-review missing reason codes
- operations/deployment/backup readiness reason codes
- explicit statement that this report is evidence, not authorization

The gate may report that all preparation evidence is present, but it must
not flip live write authorization on.

## Forbidden

- No broker write command creation.
- No Toss network calls.
- No automatic human approval.
- No reading `.env` or `tmp/phase5`.
- No setting `readyForLiveBrokerWrites: true` or
  `liveBrokerWriteAllowed: true`.

## Test Criteria

Run:

```bash
npx vitest run tests/application/small-capital-readiness.test.ts tests/application/small-capital-enablement-gate.test.ts tests/application/operations-status-read-model.test.ts tests/application/deployment-readiness-gate.test.ts
npm run check
```

If some referenced Phase 8 tests/files do not exist in the current branch
yet, coordinate with Engineer 1/2/3 merge order and adjust targeted
commands after merge.

## Completion Criteria

- Missing evidence fails closed.
- Clean preparation evidence still does not authorize live writes.
- Report is sanitized and advisory.
- `npm run check` passes.

## Recommended Branch

`phase9/p9-003-small-capital-enablement-gate`
