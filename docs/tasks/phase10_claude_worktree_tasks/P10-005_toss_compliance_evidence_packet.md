# P10-005 Toss And Compliance Evidence Packet

## Task ID

P10-005

## Goal

Create the sanitized evidence packet structure for `LCB-001` and
`LCB-005`: Toss automated trading permission evidence and compliance/legal
approval evidence.

## Assigned Engineer

Engineer 1

## Responsible Module

Human evidence workbook, Toss permission/compliance evidence shape.

## Files To Modify Or Create

- `docs/phase10/toss-compliance-evidence-packet.md`
- optionally `src/application/live-readiness/toss-compliance-evidence-packet.ts`
- optionally `tests/application/toss-compliance-evidence-packet.test.ts`
- `docs/tasks/phase10_claude_worktree_tasks/README.md` only for status
  updates after completion

Avoid editing `docs/phase7/live-capable-blocker-register.md`.

## Inputs

- `docs/phase10/human-blocker-evidence-workbook.md`
- `docs/phase7/live-capable-blocker-register.md`
- `docs/13_Compliance_and_Legal_Review.md`
- `docs/open_questions.md`
- `docs/11_AI_RULES.md`

## Output

A sanitized packet/checklist that tells a human reviewer exactly what to
record for:

- Toss automated trading permission result
- official source references or support confirmation references
- compliance/legal review scope
- required system restrictions
- limitations and next review date
- reviewer name, role, date, and decision

If code is added, it must be a pure validator only. It must not fetch
external documents or call Toss.

## Forbidden

- Do not browse, fetch, or call Toss APIs from code.
- Do not request, print, or store secrets, account identifiers, raw
  contract text with personal information, raw broker payloads, or local
  receipts.
- Do not mark `LCB-001` or `LCB-005` as `RESOLVED`.
- Do not treat AI legal/compliance analysis as human approval.
- Do not implement broker writes.

## Test Criteria

If code is added, run:

```bash
npx vitest run tests/application/toss-compliance-evidence-packet.test.ts tests/application/live-blocker-evidence-intake.test.ts
npm run check
```

If only documents are added, run:

```bash
npm run check
```

## Completion Criteria

- Human reviewer can complete the packet without exposing secrets.
- Missing reviewer/date/decision remains blocking.
- Packet output never says live trading is authorized.
- `npm run check` passes.

## Recommended Branch

`phase10/p10-005-toss-compliance-evidence-packet`
