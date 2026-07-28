# Task ID

P5-003

## Goal

Design a sanitized approval record and evidence harness for exactly one future Toss read-only verification call after the call gate passes.

## Module

Toss Phase 5 call gate and evidence intake.

## Files To Modify Or Create

- `src/application/toss/read-only-evidence-intake.ts`
- `src/application/toss/read-only-evidence-recorder.ts`
- `tests/application/toss-read-only-evidence-intake.test.ts`
- `tests/application/toss-read-only-evidence-recorder.test.ts`
- `docs/phase5/toss-read-only-call-gate.md`
- optionally `docs/phase5/read-only-call-approval.example.json`

## Input

- `docs/reviews/Codex_Phase5_Architecture_Review.md`
- `docs/phase5/toss-read-only-call-gate.md`
- `docs/phase5/evidence-intake.example.json`
- current evidence recorder and intake validators

## Output

A public-safe approval artifact shape that records:

- approved operation
- approval timestamp
- operator note without personal secrets
- endpoint catalog reference
- expected evidence kind
- explicit statement that live broker writes remain blocked

## Forbidden

- Do not implement a network client.
- Do not perform a real Toss API call.
- Do not record API keys, tokens, account numbers, raw headers, or raw payloads.
- Do not let approval unlock more than one scoped read-only call.

## Test Criteria

Run:

```bash
npm run check
npm run phase5:toss:preflight
```

The preflight command must perform no network calls.

## Completion Conditions

- Approval records with secret-like content are rejected.
- Approval records for write operations are rejected.
- Evidence recorder still rejects live write operation shapes.
- `liveBrokerWriteAllowed` remains `false`.

## Recommended Branch

`phase5/p5-003-toss-approval-evidence`

