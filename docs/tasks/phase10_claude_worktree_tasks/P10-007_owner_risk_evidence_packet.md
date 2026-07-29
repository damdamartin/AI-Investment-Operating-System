# P10-007 Owner And Risk Evidence Packet

## Task ID

P10-007

## Goal

Create the sanitized evidence packet structure for `LCB-004` and
`LCB-006`: explicit human approval evidence and small-capital operating
limit evidence.

## Assigned Engineer

Engineer 3

## Responsible Module

Manual approval evidence, small-capital risk limit evidence.

## Files To Modify Or Create

- `docs/phase10/owner-risk-evidence-packet.md`
- optionally `src/application/live-readiness/owner-risk-evidence-packet.ts`
- optionally `tests/application/owner-risk-evidence-packet.test.ts`
- `docs/tasks/phase10_claude_worktree_tasks/README.md` only for status
  updates after completion

Avoid editing `docs/phase7/live-capable-blocker-register.md`.

## Inputs

- `docs/phase10/human-blocker-evidence-workbook.md`
- `docs/phase7/live-capable-blocker-register.md`
- `docs/phase7/manual-live-approval-record.md`
- `docs/phase7/small-capital-readiness-gates.md`
- `docs/phase10/first-trade-operating-protocol.md`
- `docs/11_AI_RULES.md`

## Output

A sanitized packet/checklist that tells a human owner/risk reviewer
exactly what to record for:

- explicit human approval intent
- residual-risk acknowledgment
- maximum total capital policy
- maximum per-order policy
- allowed strategy set
- limit-order-only and regular-hours-only restrictions
- daily review and stop criteria
- reviewer name, role, date, and decision

If code is added, it must be a pure evaluator that checks evidence
completeness only. It must not produce an executable order.

## Forbidden

- Do not invent or approve risk limits on behalf of the human operator.
- Do not include real account balances or identifiable account values.
- Do not mark `LCB-004` or `LCB-006` as `RESOLVED`.
- Do not treat AI-generated text as human approval.
- Do not implement broker writes or first-trade execution.

## Test Criteria

If code is added, run:

```bash
npx vitest run tests/application/owner-risk-evidence-packet.test.ts tests/application/first-trade-operating-protocol.test.ts
npm run check
```

If only documents are added, run:

```bash
npm run check
```

## Completion Criteria

- Packet clearly separates proposed limits from human-approved limits.
- Missing owner/risk reviewer fields remain blocking.
- Packet never authorizes live trading by itself.
- `npm run check` passes.

## Recommended Branch

`phase10/p10-007-owner-risk-evidence-packet`
