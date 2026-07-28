# Phase 5 Toss Completion Checklist

Version: 0.7.0
Status: Active
Last Updated: 2026-07-29

## Purpose

This checklist defines when Toss Securities Phase 5 preparation is complete.

Completion means the project is ready for one scoped real read-only Toss API verification call in a separate task (step 9 of `docs/phase5/local-toss-read-only-runbook.md`).

Completion does not mean live trading is allowed.

## Current Status

- `accounts` and `holdings` read-only verification calls have each been completed at least once by the human operator.
- `market-prices` read-only verification is implemented and mock-tested (the `market-prices` target and its supporting `TossReadOnlyHttpClient.getMarketPrices()` method are merged) but has not yet been attempted for real by the human operator. This checklist and `npm run phase5:toss:completion` apply to it the same way they applied to `accounts` and `holdings`: local setup, endpoint verification, approval artifact, evidence intake, preflight, and call gate all have to pass for this specific target before it can be attempted — plus one additional, target-specific check: the endpoint catalog must contain an explicitly `verified: true` `MARKET_DATA_READ` entry for `GET /api/v1/prices`, independent of the generic "at least one verified endpoint" check the other targets rely on.
- Completing `accounts` and `holdings` does not, by itself, satisfy `npm run phase5:toss:completion` for a future `market-prices` attempt, and it does not resolve any open question. Full status detail: `docs/phase5/local-toss-read-only-runbook.md`, "Current Verification Status".

## Completion Command

Run:

```bash
npm run phase5:toss:completion
```

The command performs no network calls.

It fails closed until the read-only call gate is ready. On a fresh checkout, before local credentials are entered and before evidence intake is human-reviewed, this command is expected to fail closed (`phase5TossPreparationComplete: false`). That is normal, not a bug — it means steps 1-8 of the runbook are not finished yet, not that the command is broken.

This remains true immediately after `npm run check` passes: a passing build and test suite says nothing about local `.env`, verified endpoints, or reviewed evidence, so `npm run phase5:toss:completion` still fails closed on a fresh checkout right after `npm run check` succeeds. It is a readiness gate you re-run per target — a passing completion result for `accounts` or `holdings` earlier does not carry forward to a future `market-prices` attempt; the call gate and preflight have to pass again for that target specifically.

## Required Before Completion

All of the following must be true. The step numbers refer to `docs/phase5/local-toss-read-only-runbook.md`:

- local `.env` exists and is not committed (step 1)
- `LIVE_TRADING_ENABLED=false` (step 1)
- `TOSS_READ_ONLY_MODE=true` (step 1)
- Toss API base URL is configured locally (step 1)
- Toss client ID and client secret are configured locally, and were never pasted into chat, commits, or screenshots (steps 1-2)
- Toss account reference is configured locally, and was never pasted into chat, commits, or screenshots (steps 1-2)
- endpoint catalog contains only official or locally verified read-only endpoints (step 3)
- a sanitized, single-use approval artifact has been prepared for the exact operation that will be called (step 4)
- evidence intake contains public-safe summaries only and has been manually reviewed (step 10)
- evidence manifest contains sanitized evidence only (step 11)
- open questions OQ-001 through OQ-004 have valid review evidence (step 12)
- preflight passes (step 7)
- call gate passes with explicit operator approval (step 8)

Note: the evidence, intake, and open-question items above can be satisfied by documentation-based evidence (official Toss docs or developer console evidence) collected before any real API call is made. They do not require the step 9 call to have already happened. The `npm run phase5:toss:completion` command itself technically checks only the call-gate and preflight state; the remaining items in this list are operator-level requirements that this checklist adds on top of the script's output, and should be verified by hand (or via `npm run phase5:toss:doctor`, which reports intake and evidence state alongside readiness).

## Completion Output

If complete, the report shows:

```text
phase5TossPreparationComplete: true
readyForFirstRealReadOnlyCall: true
liveBrokerWriteAllowed: false
networkCallsPerformed: false
```

If incomplete, the report shows reason codes for the remaining blockers.

## Allowed Next Step After Completion

After completion, the next task may attempt exactly one real read-only Toss API verification call.

Allowed examples:

- authentication validation
- account snapshot read
- position read
- market data read

## Still Blocked

Even after completion, the following remain blocked:

- order creation
- order cancellation
- order modification
- transfer
- withdrawal
- currency conversion that moves money
- production capital use
- automatic strategy promotion to production

## Final Rule

Phase 5 completion is a readiness checkpoint for read-only verification only.

It is not a live trading approval.
