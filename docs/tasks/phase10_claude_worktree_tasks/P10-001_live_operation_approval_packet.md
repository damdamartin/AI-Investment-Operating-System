# P10-001 Live Operation Approval Packet

## Task ID

P10-001

## Goal

Create a sanitized, evidence-only approval packet model that gathers the
Phase 7 blocker register, Phase 8 operations readiness, and Phase 9
small-capital enablement outputs into one human-readable go/no-go packet.

## Assigned Engineer

Engineer 1

## Responsible Module

Live operation readiness packet, sanitized evidence summary.

## Files To Modify Or Create

- `src/application/live-readiness/live-operation-approval-packet.ts`
- `src/application/live-readiness/index.ts`
- `tests/application/live-operation-approval-packet.test.ts`
- `docs/phase10/live-operation-approval-packet.md`

Avoid editing P10-002/P10-003 files unless coordination is required.

## Inputs

- `docs/phase7/live-capable-blocker-register.md`
- `docs/phase9/small-capital-go-no-go-checklist.md`
- `src/application/live-readiness/live-blocker-evidence-intake.ts`
- `src/application/live-readiness/small-capital-enablement-gate.ts`
- `src/application/operations/operations-status-read-model.ts`
- `docs/11_AI_RULES.md`

## Output

A pure evaluator that accepts already-sanitized inputs and returns a
packet with:

- blocker status summary for `LCB-001` through `LCB-008`
- human review completeness summary
- Phase 8 operations/deployment/backup readiness summary
- Phase 9 preparation gate summary
- expiration/staleness warnings for human evidence
- explicit statement that the packet is not live-trading authorization

Every output must include `liveBrokerWriteAllowed: false`.

## Forbidden

- No broker calls, HTTP calls, order submission, order cancellation, order
  replacement, transfer, withdrawal, or FX.
- No `.env` or `tmp/phase5` reads.
- No account numbers, secrets, tokens, raw broker payloads, or local
  receipt contents.
- No `liveBrokerWriteAllowed: true`.
- Do not mark any `LCB-*` blocker as `RESOLVED`.
- Do not treat AI-generated text as human approval.

## Test Criteria

Run:

```bash
npx vitest run tests/application/live-operation-approval-packet.test.ts tests/application/small-capital-enablement-gate.test.ts tests/application/live-blocker-evidence-intake.test.ts
npm run check
```

## Completion Criteria

- Missing or stale human evidence fails closed.
- Sanitized packet never exposes secret-like or account-like content.
- A fully clean packet still reports `liveBrokerWriteAllowed: false`.
- `npm run check` passes.

## Recommended Branch

`phase10/p10-001-live-operation-approval-packet`
