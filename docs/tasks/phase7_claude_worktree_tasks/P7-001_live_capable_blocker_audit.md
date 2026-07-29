# P7-001 Live-Capable Blocker Audit

## Task ID

P7-001

## Goal

Convert the remaining Phase 6 live-capable blockers into a precise Phase
7 blocker register with required evidence, human owner, allowed artifact
type, and go/no-go impact.

## Assigned Engineer

Engineer 1

## Responsible Module

Architecture review, open questions, compliance evidence, Phase 7 blocker
tracking.

## Files To Modify Or Create

- `docs/reviews/Codex_Phase7_Live_Capable_Blocker_Audit.md`
- `docs/phase7/live-capable-blocker-register.md`
- `docs/open_questions.md` only if adding non-secret status references is
  necessary

Avoid editing P7-002/P7-003 owned files unless coordination is required.

## Inputs

- `docs/reviews/Codex_Phase6_Simulation_Safety_Review.md`
- `docs/reviews/Codex_Phase6_Round2_Operational_Readiness_Review.md`
- `docs/phase7/README.md`
- `docs/open_questions.md`
- `docs/13_Compliance_and_Legal_Review.md`
- `docs/11_AI_RULES.md`

## Output

A blocker register that lists, at minimum:

- Toss automated trading permission evidence
- Toss account permission and capability evidence
- production credential/provisioning evidence
- human approval evidence
- compliance/legal approval evidence
- small-capital operating-limit evidence
- kill-switch and rollback evidence
- real broker write adapter review evidence

Each blocker must include:

- blocker ID
- current status
- required evidence type
- human owner or reviewer role
- artifact path where evidence should be summarized
- prohibited artifact contents
- go/no-go impact

## Forbidden

- Do not ask for, print, or commit API keys, secrets, account numbers, or
  raw broker payloads.
- Do not resolve open questions on behalf of a human reviewer.
- Do not implement real Toss write code.
- Do not read `.env` or `tmp/phase5`.

## Test Criteria

Run:

```bash
npm run check
```

If no code changed, this still verifies documentation-linked tests remain
healthy.

## Completion Criteria

- Blocker register is specific enough for humans to decide what evidence
  is still missing.
- No blocker is marked resolved without human-reviewed evidence.
- `npm run check` passes.

## Recommended Branch

`phase7/p7-001-live-capable-blocker-audit`
