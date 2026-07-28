# Task ID

P5-010

## Goal

Update the Phase 5 local operator runbook and checklist so a human can perform the future read-only verification process safely, without exposing secrets or triggering writes.

## Assigned Engineer

Engineer 3

## Module

Phase 5 docs, runbook, and operator checklist.

## Files To Modify Or Create

Primary files:

- `docs/phase5/local-toss-read-only-runbook.md`
- `docs/phase5/toss-read-only-verification-checklist.md`
- `docs/phase5/phase5-toss-completion-checklist.md`
- `docs/phase5/toss-read-only-call-gate.md`

Allowed supporting files:

- `docs/phase5/README.md`
- `docs/phase5/read-only-call-approval.example.json`

Avoid editing application code unless the docs reveal a clear broken command or contradiction.

## Required Reading

- `docs/11_AI_RULES.md`
- `docs/phase5/README.md`
- `docs/phase5/local-toss-read-only-runbook.md`
- `docs/phase5/toss-read-only-verification-checklist.md`
- `docs/phase5/phase5-toss-completion-checklist.md`
- `docs/phase5/toss-read-only-call-gate.md`

## Implementation Requirements

Make the operator flow explicit:

1. local-only setup
2. secret handling boundaries
3. endpoint catalog validation
4. approval artifact preparation
5. dry-run plan
6. doctor
7. preflight
8. call gate
9. exactly one future read-only call
10. sanitized evidence intake
11. manifest promotion
12. open question review

Clarify which commands are expected to fail closed before credentials and human-reviewed evidence exist.

Clarify that GitHub, chat, screenshots, and docs must not contain secrets or raw payloads.

## Forbidden

- Do not add real credentials or examples that resemble real credentials.
- Do not instruct the user to paste secrets into chat.
- Do not authorize live broker writes.
- Do not describe order submit/cancel/replace as allowed.
- Do not add real Toss endpoint paths unless already backed by official or local verified evidence.

## Tests

Run:

```bash
npm run check
npm run phase5:toss:doctor
npm run phase5:toss:preflight
```

`phase5:toss:preflight` may fail closed in default local state. That is acceptable only if `liveBrokerWriteAllowed:false` and `networkCallsPerformed:false` remain present.

## Completion Conditions

- Runbook is usable by a human operator without needing extra interpretation.
- Fail-closed states are documented as expected.
- No secrets or raw payload examples are added.
- `npm run check` passes.

## Recommended Branch

`phase5/p5-010-local-runbook-operator-checklist`

