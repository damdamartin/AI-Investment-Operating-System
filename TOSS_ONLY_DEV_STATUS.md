# Toss-Only Trading System Development Status

## Purpose

Build a new automated trading system that uses only Toss Securities account,
cash, market data, and order submission paths.

The old mixed-broker engine is not the active development target.

## Source Locations

Core package:

```text
src/pyqqq/toss_only/
├─ __init__.py
├─ config.py
├─ engine.py
├─ live_preflight.py
├─ market_data.py
├─ models.py
├─ news_catalyst.py
├─ order_gateway.py
├─ risk.py
├─ technical.py
├─ theme_detector.py
├─ README.md
└─ HANDOFF.md
```

Entry points:

```text
run_toss_only_trading.py       # one cycle
run_toss_only_daemon.py        # continuous loop
start_toss_only_system.sh      # shell wrapper
check_toss_only_live_preflight.py
```

Tests:

```text
tests/test_toss_only_engine.py
```

## Current Development State

- Toss account read works.
- KRW and USD cash are separated.
- Korean and US stocks share the same six-step expert process.
- Candidates are filtered by Toss cash before technical analysis.
- Korean stocks require whole-share affordability.
- US stocks can use fractional/notional sizing when enabled.
- Quote/OHLCV fallback uses Yahoo chart endpoints for KR and US symbols.
- Korean news catalyst uses Naver News when credentials are configured.
- Trade plans include entry, stop, take-profit, downside, upside, and reward/risk.
- All broker-write requests must pass through `order_gateway.py`.
- `DRY_RUN` mode has been removed.
- `TOSS_ONLY_EXECUTION_MODE` has no default and must be explicitly set.

## Latest Read-Only Account Check

Observed on 2026-08-12:

```text
Toss account lookup: OK
KRW cash: 109,932
USD cash: 151.01
Total value: 306,258.371338 KRW
Korean holdings: 0
US holdings: 2
```

## Latest Live Trading Check

Live trading is not currently approved.

Blockers:

```text
operation worker mode is MONITORING_ONLY
liveBrokerWriteAllowed is not true
tossOrderSubmissionAllowed is not true
```

Public status endpoints:

```text
https://ai-investment-operating-system-worker.junkim-life360.workers.dev/operation-status
https://ai-investment-operating-system-worker.junkim-life360.workers.dev/health
```

## Required Environment

No execution mode default exists. Set it explicitly:

```bash
TOSS_ONLY_EXECUTION_MODE=READ_ONLY
TOSS_READ_ONLY_MODE=true
```

For live readiness checks only:

```bash
TOSS_ONLY_EXECUTION_MODE=LIVE
TOSS_ONLY_ALLOW_LIVE_ORDERS=true
TOSS_READ_ONLY_MODE=false
LIVE_TRADING_ENABLED=true
python3 check_toss_only_live_preflight.py
```

The preflight must approve before order submission can happen.

## Commands

Compile:

```bash
python3 -m compileall -q src/pyqqq/toss_only run_toss_only_trading.py run_toss_only_daemon.py check_toss_only_live_preflight.py
```

One read-only signal cycle:

```bash
TOSS_ONLY_EXECUTION_MODE=READ_ONLY \
TOSS_READ_ONLY_MODE=true \
python3 run_toss_only_trading.py
```

Continuous read-only loop:

```bash
TOSS_ONLY_EXECUTION_MODE=READ_ONLY \
TOSS_READ_ONLY_MODE=true \
bash start_toss_only_system.sh
```

## Handoff Notes

- Continue development only inside `src/pyqqq/toss_only/` unless changing entry-point scripts or tests.
- Keep the old mixed-broker engine separate.
- Do not add broker-write calls outside `order_gateway.py`.
- Do not reintroduce fake prices, simulated fills, or paper-trading state.
- If market data is missing, return `NO_DATA` or skip the symbol.
- Next useful work: add official Toss OHLCV endpoints and protective order/monitoring support.
