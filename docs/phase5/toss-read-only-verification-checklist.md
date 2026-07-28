# Toss Read-Only Verification Checklist

Version: 0.7.0
Status: Active
Last Updated: 2026-07-29

## Purpose

This checklist prepares local read-only Toss Securities API verification.

It does not authorize live trading, order creation, order cancellation, order modification, or production capital use.

It mirrors the step order in `docs/phase5/local-toss-read-only-runbook.md`. Use the runbook for full explanations; use this page as the operator's quick pass/fail checklist.

## 1. Local-Only Setup

- [ ] `.env` created locally from `.env.example` (`cp .env.example .env`)
- [ ] `.env` confirmed ignored by Git (`git check-ignore -v .env`)
- [ ] `LIVE_TRADING_ENABLED=false`
- [ ] `TOSS_READ_ONLY_MODE=true`
- [ ] `TOSS_API_BASE_URL`, `TOSS_CLIENT_ID`, `TOSS_CLIENT_SECRET`, `TOSS_ACCOUNT_REF` set to real local values (not placeholders)

```bash
npm run phase5:toss:readiness
```

Expected before real read-only verification: `ready: true`, `safeToAttemptReadOnlyCalls: true`, `liveBrokerWriteAllowed: false`.

On a fresh checkout this command is expected to fail closed (`ready: false`) until the values above are filled in. That is normal.

## 2. Secret Handling Boundaries

- [ ] No API key, client secret, access token, refresh token, or account number has been pasted into chat with an AI assistant
- [ ] No such value has been pasted into a GitHub issue, pull request, commit, or CI log
- [ ] No screenshot of a real API response has been taken or saved
- [ ] No AI assistant has been asked to read, print, or transform `.env`
- [ ] Logs and stored payloads redact headers, tokens, account numbers, and secrets

## 3. Endpoint Catalog Validation

- [ ] Endpoint entries are backed by official Toss documentation, Toss developer console evidence, or local read-only verification (never guessed)

```bash
npm run phase5:toss:endpoints
```

## 4. Approval Artifact Preparation

- [ ] A local, git-ignored approval record has been prepared from `docs/phase5/read-only-call-approval.example.json` (the template itself is not edited or committed with real values)
- [ ] `approvedOperation` is a single read-only operation from the allow-list
- [ ] `operatorNote` and `endpointCatalogReference` contain no secret-like or account-identifier-like text
- [ ] `singleUseAcknowledged: true` and `liveBrokerWritesRemainBlocked: true` are set

Full rules: `docs/phase5/toss-read-only-call-gate.md`.

## 5. Dry-Run Plan

```bash
npm run phase5:toss:plan
```

This command performs no network calls. `preparedRequestCount` is expected to be `0` until credentials are real and at least one endpoint is verified.

## 6. Doctor

```bash
npm run phase5:toss:doctor
```

The doctor command performs no network calls and should be run before any real read-only verification attempt. `readyForReadOnlyVerification: false` on a fresh checkout is expected.

## 7. Preflight

```bash
npm run phase5:toss:preflight
```

Preflight is expected to fail closed in the default local state, before real credentials and human-reviewed evidence exist. Acceptable as long as `liveBrokerWriteAllowed: false` and `networkCallsPerformed: false` remain present.

## 8. Call Gate

```bash
npm run phase5:toss:call-gate
```

By default this fails closed. It requires preflight to pass and an explicit approval flag:

```bash
PHASE5_TOSS_READ_ONLY_CALL_APPROVED=true npm run phase5:toss:call-gate
```

Then confirm overall completion:

```bash
npm run phase5:toss:completion
```

## 9. Exactly One Future Read-Only Call

`scripts/phase5-toss-read-only-verify.mjs` performs this step. It supports only `accounts` and `holdings`, fails closed with no network call by default, and re-checks preflight and the call gate itself before ever calling the network.

```bash
PHASE5_TOSS_READ_ONLY_CALL_APPROVED=true npm run phase5:toss:verify-read-only -- accounts
```

```bash
PHASE5_TOSS_READ_ONLY_CALL_APPROVED=true npm run phase5:toss:verify-read-only -- holdings
```

- [ ] Steps 1-8 above all pass first
- [ ] The command above is run with exactly one target, scoped to the Step 4 approval artifact
- [ ] The printed report shows `liveBrokerWriteAllowed: false` and `rawPayloadStored: false`
- [ ] The sanitized evidence file it wrote under `tmp/phase5/` has been opened and manually reviewed before use in Step 10

Full details: `docs/phase5/local-toss-read-only-runbook.md` (Step 9).

Other documented read-only call shapes remain future work, not yet implemented by this script: position read beyond `holdings`, market data read, and order status read (query only, never create/modify/cancel).

Blocked, always:

- create order
- cancel order
- modify order
- transfer
- withdraw
- currency conversion that moves money
- any operation that changes broker account state
- blind retry of an uncertain call (see `docs/11_AI_RULES.md` Rule 15)

## 10. Sanitized Evidence Intake

- [ ] Intake worksheet started from `docs/phase5/evidence-intake.example.json`
- [ ] Every item is manually reviewed (`reviewedByHuman: true`) before it counts as ready
- [ ] No raw API responses, account numbers, tokens, request headers, client secrets, or secret-bearing screenshots are present

```bash
npm run phase5:toss:intake
```

The example worksheet intentionally fails until each item is manually reviewed and sanitized. That is normal.

## 11. Manifest Promotion

```bash
npm run phase5:toss:promote-intake -- path/to/evidence-intake.json path/to/evidence-manifest.json
```

```bash
npm run phase5:toss:evidence
```

Fails closed if the intake worksheet is unsafe or unreviewed.

## 12. Open Question Review

```bash
npm run phase5:toss:open-questions
```

Confirms whether OQ-001 through OQ-004 each have at least one valid, sanitized evidence item. Does not resolve open questions automatically; a human updates `docs/open_questions.md` separately.

## Evidence Content Rules (Applies To Steps 10-12)

Evidence must include:

- evidence ID
- evidence kind
- related open question
- sanitized summary
- collection time
- credential-free preview
- evidence intake review status

Evidence must not include:

- API key
- client secret
- access token
- account number
- raw request headers
- raw Toss response payload

## Exit Criteria

This checklist is complete when local configuration is ready and the system can safely attempt read-only calls without exposing secrets or enabling broker writes.
