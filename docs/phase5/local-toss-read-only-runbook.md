# Local Toss Read-Only Verification Runbook

Version: 0.5.18
Status: Active
Last Updated: 2026-07-28

## Purpose

This runbook describes the local sequence for preparing Toss Securities read-only verification.

It does not authorize live trading, order creation, order cancellation, money transfer, withdrawal, or production capital use.

## 1. Prepare Local Environment

Create a local `.env` file from the example file.

```bash
cp .env.example .env
```

Edit `.env` locally.

Required values:

```text
LIVE_TRADING_ENABLED=false
TOSS_READ_ONLY_MODE=true
TOSS_API_BASE_URL=<official Toss API base URL>
TOSS_CLIENT_ID=<local secret>
TOSS_CLIENT_SECRET=<local secret>
TOSS_ACCOUNT_REF=<safe local account reference>
```

Never paste these values into chat, documentation, screenshots, commits, or logs.

## 2. Check Local Readiness

Run:

```bash
npm run phase5:toss:readiness
```

Expected result before real read-only verification:

```text
ready: true
safeToAttemptReadOnlyCalls: true
liveBrokerWriteAllowed: false
```

If `ready` is false, fix only the missing local setup item. Do not loosen safety settings.

## 3. Validate Endpoint Catalog

Run:

```bash
npm run phase5:toss:endpoints
```

The example catalog is intentionally unverified.

Only change endpoint entries after confirming them through official Toss documentation, Toss developer console evidence, or local read-only verification.

Do not guess endpoint paths.

## 4. Generate Dry-Run Plan

Run:

```bash
npm run phase5:toss:plan
```

This command performs no network calls.

It should show:

- whether local credentials are present
- whether endpoint catalog entries are valid
- how many verified read-only requests would be prepared
- whether live broker write remains blocked

## 5. Run Doctor

Run:

```bash
npm run phase5:toss:doctor
```

The doctor command summarizes:

- local credential readiness
- endpoint catalog status
- evidence manifest status
- dry-run request count
- blocking reason codes
- warnings

The doctor command performs no network calls.

## 6. Prepare Evidence Intake

Before evidence is added to a manifest, prepare a sanitized intake worksheet.

Start from:

```text
docs/phase5/evidence-intake.example.json
```

Validate the intake worksheet:

```bash
npm run phase5:toss:intake
```

The example worksheet intentionally fails until each item is manually reviewed and marked as sanitized.

The intake worksheet must contain only public-safe summaries. It must not contain raw API responses, account numbers, tokens, request headers, client secrets, or screenshots containing secrets.

## 7. Promote Intake To Evidence Manifest

After the intake worksheet is reviewed and passes validation, promote it to a sanitized evidence manifest:

```bash
npm run phase5:toss:promote-intake -- path/to/evidence-intake.json path/to/evidence-manifest.json
```

The promotion command performs no network calls and fails closed if the intake worksheet is unsafe.

## 8. Record Evidence

After a real read-only verification step is performed in a later task, record only sanitized summaries.

Validate evidence:

```bash
npm run phase5:toss:evidence
```

Review open question coverage:

```bash
npm run phase5:toss:open-questions
```

Run the combined preflight before any real read-only call:

```bash
npm run phase5:toss:preflight
```

The preflight command runs the local safety checks together and performs no network calls.

## 9. Run Final Read-Only Call Gate

Before any real Toss read-only API call, run:

```bash
npm run phase5:toss:call-gate
```

The call gate fails closed unless preflight passes and the operator explicitly approves one scoped read-only verification attempt.

Details:

```text
docs/phase5/toss-read-only-call-gate.md
```

Run the completion check:

```bash
npm run phase5:toss:completion
```

The completion check performs no network calls and confirms whether the next task may attempt one scoped read-only verification call.

Evidence must not contain:

- API keys
- client secrets
- access tokens
- account numbers
- raw request headers
- raw Toss API payloads
- live write command shapes

## 10. Stop Conditions

Stop immediately if any of the following appears:

- `LIVE_TRADING_ENABLED=true`
- `TOSS_READ_ONLY_MODE=false`
- a request path or body suggests order creation
- a request path or body suggests order cancellation
- a response contains account numbers or tokens that are not masked
- evidence validation fails
- doctor reports live broker write as allowed

## Final Rule

Until later gates are explicitly approved, Phase 5 is read-only evidence work.

When in doubt, do not call the API.
