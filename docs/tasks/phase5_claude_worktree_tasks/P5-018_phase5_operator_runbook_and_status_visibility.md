# Task ID

P5-018

## Goal

Update Phase 5 operator documentation and read-only status visibility for the post-accounts/post-holdings verification state.

## Assigned Engineer

Engineer 3

## Module

Phase 5 runbooks, checklists, and local status reporting.

## Files To Modify Or Create

Primary files:

- `docs/phase5/local-toss-read-only-runbook.md`
- `docs/phase5/toss-read-only-verification-checklist.md`
- `docs/phase5/phase5-toss-completion-checklist.md`
- `docs/phase5/README.md`

Allowed supporting files:

- `src/application/read-only-dashboard.ts`
- `tests/application/read-only-dashboard.test.ts`
- `scripts/phase5-toss-completion.mjs`
- `tests/scripts/phase5-toss-completion-script.test.ts`

Avoid editing P5-016 market-prices runner/client files and P5-017 evidence validator files unless coordination is required.

## Input

- Local operator has completed real read-only `accounts` and `holdings` checks.
- The committed repo must not include the real receipt files or local `.env`.
- Phase 5 remains read-only validation only.

## Output

Documentation and optional status-report improvements that make the next operator step unambiguous:

- distinguish completed read-only checks from pending checks
- explain that real local receipts live only under git-ignored `tmp/phase5/`
- show how to run accounts, holdings, and future market-prices checks safely
- document expected fail-closed states after `npm run check`
- keep clear that Phase 5 does not permit trading, order writes, transfers, withdrawals, or FX/money movement

If touching status code, add only read-only summary fields. Do not add operational controls.

## Forbidden

- Do not include real timestamps, item counts, symbols, quantities, account references, tokens, credentials, or raw output from the operator machine.
- Do not instruct the user to commit `.env` or `tmp/phase5`.
- Do not add UI/control language that implies live trading can be enabled.
- Do not push to GitHub.

## Test Criteria

Run:

```bash
npx vitest run tests/application/read-only-dashboard.test.ts tests/scripts/phase5-toss-completion-script.test.ts
npm run check
```

If only docs are changed and no code/tests are touched, still run:

```bash
npm run check
```

## Completion Conditions

- Runbook reflects the current accounts/holdings verified reality without exposing local evidence details.
- Checklist clearly identifies the next pending read-only target.
- All changed text preserves safety boundaries.
- Tests pass.

## Recommended Branch

`phase5/p5-018-operator-runbook-status-visibility`
