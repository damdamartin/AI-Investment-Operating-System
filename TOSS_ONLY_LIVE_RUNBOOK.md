# Toss-Only Live Trading Runbook

## Current Policy

The system can prepare live trading, but live broker writes must remain blocked
until the operation status endpoint explicitly allows them.

Required public status fields:

```text
mode != MONITORING_ONLY
liveBrokerWriteAllowed == true
tossOrderSubmissionAllowed == true
health.status == OK
```

## Readiness Check

Read-only preflight:

```bash
python3 check_toss_only_live_preflight.py
```

If `approved` is `false`, do not run live mode.

## Read-Only Signal Check

```bash
TOSS_ONLY_EXECUTION_MODE=READ_ONLY \
TOSS_ONLY_ALLOW_LIVE_ORDERS=false \
TOSS_READ_ONLY_MODE=true \
LIVE_TRADING_ENABLED=false \
python3 run_toss_only_trading.py
```

## Live Mode Requirements

All of these must be true before any order can be submitted:

```bash
TOSS_ONLY_EXECUTION_MODE=LIVE
TOSS_ONLY_ALLOW_LIVE_ORDERS=true
TOSS_READ_ONLY_MODE=false
LIVE_TRADING_ENABLED=true
```

The order gateway still calls `TossOnlyLivePreflight` immediately before broker
write. If the public operation status remains monitoring-only, live orders are
blocked even with the environment variables above.

## What The System Does

- Uses Toss account cash only.
- Selects affordable KR/US candidates before analysis.
- Runs the six-step expert process.
- Generates entry, stop, target, quantity, and risk.
- Routes every broker-write through `TossOnlyOrderGateway`.

## What It Does Not Do Yet

- It does not submit protective stop/take-profit bracket orders automatically.
- It generates stop/take-profit levels for monitoring and later order support.
- It does not bypass public live approval gates.
