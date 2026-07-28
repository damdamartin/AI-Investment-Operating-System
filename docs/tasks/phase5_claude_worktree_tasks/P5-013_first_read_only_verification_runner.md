# Task ID

P5-013

## Goal

Create the first real read-only verification runner that can perform exactly one human-approved Toss read-only call and write only sanitized local evidence.

## Assigned Engineer

Engineer 2

## Module

Phase 5 Toss verification scripts and one-call gate integration.

## Files To Modify Or Create

Primary files:

- `scripts/phase5-toss-read-only-verify.mjs`
- `tests/scripts/phase5-toss-read-only-verify-script.test.ts`
- `package.json`

Allowed supporting files:

- `src/application/toss/read-only-evidence-recorder.ts`
- `src/application/toss/read-only-evidence-intake.ts`
- `docs/phase5/local-toss-read-only-runbook.md`
- `docs/phase5/toss-read-only-verification-checklist.md`

Coordinate with P5-012 before importing any new HTTP client.

## Input

- Local `.env` contains Phase 5 Toss credentials and `TOSS_ACCOUNT_REF`.
- Local files under `tmp/phase5/` are git-ignored.
- The runner must require explicit human approval, for example:

```bash
PHASE5_TOSS_READ_ONLY_CALL_APPROVED=true npm run phase5:toss:verify-read-only -- accounts
```

## Output

A script that:

- supports only approved read-only targets such as `accounts` and `holdings`
- runs preflight/call-gate checks before any network call
- performs exactly one read-only call when approved
- writes sanitized evidence under `tmp/phase5/`
- never writes raw API response JSON
- prints a sanitized JSON report only

Report fields must include:

```text
operation
evidenceKind
sanitizedEvidencePath
liveBrokerWriteAllowed:false
networkCallsPerformed:true
rawPayloadStored:false
```

## Forbidden

- Do not perform any write operation.
- Do not implement or call order creation/cancel/modify APIs.
- Do not store access tokens, account numbers, raw response payloads, raw headers, or client secrets.
- Do not make approval reusable across arbitrary future calls.
- Do not weaken preflight, call-gate, endpoint, evidence, or intake validators.
- Do not push to GitHub.

## Test Criteria

Run:

```bash
npx vitest run tests/scripts/phase5-toss-read-only-verify-script.test.ts
npm run check
```

Tests must use mock HTTP only and prove:

- no approval means no network call
- wrong operation means no network call
- approved `accounts` call writes sanitized evidence only
- raw account number-like fields are not printed or written
- `liveBrokerWriteAllowed:false` remains true
- unknown targets and write-looking targets fail closed

## Completion Conditions

- Runner exists and is added to `package.json`.
- Mock-only tests pass.
- Operator can run the command locally after P5-012 is merged.
- Docs explain exact manual approval command and stop conditions.

## Recommended Branch

`phase5/p5-013-first-read-only-verification-runner`

