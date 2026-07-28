# Toss Read-Only Verification Checklist

Version: 0.5.3
Status: Active
Last Updated: 2026-07-28

## Purpose

This checklist prepares local read-only Toss Securities API verification.

It does not authorize live trading, order creation, order cancellation, or production capital use.

## Local Setup

Create a local `.env` file from `.env.example`.

Do not commit `.env`.

Required local values:

```text
TOSS_READ_ONLY_MODE=true
TOSS_API_BASE_URL=<official Toss API base URL>
TOSS_CLIENT_ID=<local secret>
TOSS_CLIENT_SECRET=<local secret>
TOSS_ACCOUNT_REF=<local account reference or safe alias>
LIVE_TRADING_ENABLED=false
```

Do not paste these values into chat.

## Pre-Call Readiness

Before any real Toss read-only API call:

- confirm `.env` is ignored by Git
- confirm `LIVE_TRADING_ENABLED=false`
- confirm `TOSS_READ_ONLY_MODE=true`
- confirm no request body contains order creation or cancellation fields
- confirm logs redact headers, tokens, account numbers, and secrets
- confirm evidence will be summarized, not committed as raw payload

You can run the local readiness check:

```bash
npm run phase5:toss:readiness
```

The command prints only a readiness report. It must not print API keys, client secrets, account references, tokens, or account numbers.

Validate the read-only endpoint catalog before using endpoint paths:

```bash
npm run phase5:toss:endpoints
```

Generate a dry-run verification plan:

```bash
npm run phase5:toss:plan
```

This command performs no network calls.

Validate sanitized evidence before committing or using it in readiness decisions:

```bash
npm run phase5:toss:evidence
```

Run the combined Phase 5 Toss doctor:

```bash
npm run phase5:toss:doctor
```

The doctor command performs no network calls and should be used before any real read-only verification attempt.

Review open question evidence coverage:

```bash
npm run phase5:toss:open-questions
```

Run preflight:

```bash
npm run phase5:toss:preflight
```

## Allowed Read-Only Calls

Allowed for Phase 5:

- authentication or token validation read
- account snapshot read
- position read
- balance read
- market data read
- capability or metadata read
- order status read only if it does not create, modify, or cancel orders

## Blocked Calls

Blocked for Phase 5:

- create order
- cancel order
- modify order
- transfer
- withdraw
- currency conversion that moves money
- any operation that changes broker account state

## Evidence Recording

Each successful read-only check should produce a sanitized evidence record.

Evidence must include:

- evidence ID
- evidence kind
- related open question
- sanitized summary
- collection time
- credential-free preview

Evidence must not include:

- API key
- client secret
- access token
- account number
- raw request headers
- raw Toss response payload

## Exit Criteria

This checklist is complete when local configuration is ready and the system can safely attempt read-only calls without exposing secrets or enabling broker writes.
