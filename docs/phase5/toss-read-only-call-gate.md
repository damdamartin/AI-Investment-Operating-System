# Toss Read-Only Call Gate

Version: 0.5.17
Status: Active
Last Updated: 2026-07-28

## Purpose

This document defines the final local gate before any real Toss Securities read-only API call is attempted.

It does not authorize live trading, order creation, order cancellation, money movement, currency conversion, or production capital use.

## Gate Principle

Real API access starts with exactly one documented read-only verification call.

The system must not move from local preparation to real read-only verification unless all of the following are true:

- local secret configuration is present
- live trading remains disabled
- Toss read-only mode is enabled
- endpoint catalog entries are validated
- evidence intake is public-safe
- open questions have enough sanitized evidence for review
- preflight passes
- the operator explicitly approves the read-only verification attempt

## Local Command

Run the final gate:

```bash
npm run phase5:toss:call-gate
```

By default, this command fails closed.

To allow a later task to attempt one real read-only verification call, run it only after preflight passes and set:

```bash
PHASE5_TOSS_READ_ONLY_CALL_APPROVED=true npm run phase5:toss:call-gate
```

This command performs no network calls. It only confirms whether the next task is allowed to attempt a real read-only call.

## Allowed Next Action

If the gate passes, the next task may attempt one documented read-only call such as:

- authentication validation
- account snapshot read
- position read
- market data read

The call must be recorded as sanitized evidence.

## Blocked Actions

The gate never permits:

- order creation
- order cancellation
- order modification
- transfer
- withdrawal
- currency conversion that moves money
- unbounded API exploration
- raw response commits
- secret disclosure

## Stop Conditions

Stop immediately if:

- preflight does not pass
- the call gate does not pass
- any value looks like a token, secret, account number, or raw credential-bearing response
- the endpoint path or body suggests broker state mutation
- an API response cannot be safely summarized

## Final Rule

Passing this gate permits only a single scoped read-only verification attempt in the next task.

It does not unlock live trading.
