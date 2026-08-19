# Toss-Only Trading System

This folder is the new Toss-only KR/US stock trading system.

It is intentionally separate from the older mixed engine.  Do not import or call
old mixed-broker account inquiry, orchestration, or trading-system modules from
this package.

## Entry Points

- One cycle: `python3 run_toss_only_trading.py`
- Continuous loop: `bash start_toss_only_system.sh`

Required explicit mode:

```bash
TOSS_ONLY_EXECUTION_MODE=READ_ONLY
TOSS_ONLY_ALLOW_LIVE_ORDERS=false
TOSS_READ_ONLY_MODE=true
LIVE_TRADING_ENABLED=false
```

Default risk per trade is `3%` of market-specific equity/cash.  Korean shares
are whole-share only; US shares can use fractional sizing when enabled.

## Six-Step Trading Process

1. Market issue category analysis
   - Korean news catalyst through Naver when credentials exist.
   - Theme baskets for Korean and US markets.
   - Sector momentum from quote change and relative volume.

2. In-theme candidate selection
   - Candidates are filtered by Toss cash first.
   - Korean stocks use KRW cash and whole-share affordability.
   - US stocks use USD cash and fractional/notional affordability when enabled.
   - Expensive stocks are removed before analysis when the account cannot buy them.

3. Recent trading-flow analysis
   - Daily OHLCV candles.
   - Moving averages, RSI, support/resistance, ATR, and volume expansion.

4. Growth potential analysis
   - Upside to take-profit.
   - Downside to stop-loss.
   - Reward/risk ratio.

5. Entry, stop, target, and position sizing
   - Entry from current ask/price.
   - Stop under support/ATR.
   - Target from resistance or 2R.
   - Quantity sized from account risk budget.

6. Execution and monitoring
   - Every order goes through `TossOnlyOrderGateway`.
   - Live orders require explicit live mode and live-order approval.
   - Protective stop/take-profit levels are generated in the trade plan.

## Source Map

- `models.py`: shared data contracts.
- `config.py`: runtime and strategy settings.
- `market_data.py`: Toss account adapter plus Yahoo chart quote/OHLCV fallback.
- `news_catalyst.py`: Korean news catalyst scoring.
- `theme_detector.py`: issue category and candidate selection.
- `technical.py`: trading-flow, support/resistance, scenario analysis.
- `risk.py`: KRW/USD position sizing and risk checks.
- `order_gateway.py`: the only broker-write gateway.
- `engine.py`: six-step orchestration.
