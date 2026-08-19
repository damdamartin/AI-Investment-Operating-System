# Toss-Only KR/US Stock Trading Roadmap

## Goal

Build a Toss-only Korean and US stock trading system that follows a professional workflow:

1. Detect market regime.
2. Detect hot themes and catalysts.
3. Build a dynamic symbol universe.
4. Validate technical setups with real OHLCV.
5. Price entry, stop loss, and take profit from market structure.
6. Size positions by risk, not by arbitrary cash usage.
7. Route every order through one safety gateway.

## Current Implementation

New package:

```text
src/pyqqq/toss_only/
├─ config.py
├─ engine.py
├─ market_data.py
├─ models.py
├─ order_gateway.py
├─ risk.py
├─ technical.py
└─ theme_detector.py
```

Properties:

- No KIS imports.
- No placeholder entry prices.
- USD cash is kept separate from KRW cash.
- US and Korean stocks share the same pipeline through explicit `market` and `currency` fields.
- US quote/OHLCV has a real Yahoo Finance chart provider with an urllib fallback for environments where aiohttp receives rate limits.
- Default execution mode is `DRY_RUN`.
- Live orders require both `TOSS_ONLY_EXECUTION_MODE=LIVE` and `TOSS_ONLY_ALLOW_LIVE_ORDERS=true`.
- All writes go through `TossOnlyOrderGateway`.

## Phase 2: Real Market Data

Status: partially complete for US daily quote/OHLCV.

- Add a Toss or external quote provider with bid, ask, volume, relative volume, and change percentage.
- Add OHLCV retrieval for daily, 4h, 1h, and intraday candles.
- Fail closed with `NO_DATA` if quote or OHLCV is missing.

Remaining:

- Add Korean OHLCV from a Toss-supported endpoint or a separate licensed Korean market data source.
- Add intraday US intervals after rate-limit behavior is measured.
- Persist quote/candle snapshots for audit and replay.

## Phase 3: Dynamic Theme Detection

- Add news/catalyst ingestion.
- Score themes from news frequency, sentiment, sector ETF strength, and unusual volume.
- Replace static theme baskets with scanner-driven candidates.

## Phase 4: Professional Trade Planning

- Detect support and resistance from swing highs/lows and anchored VWAP.
- Add breakout, pullback, and reversal setup classes.
- Use reward/risk and liquidity filters before risk sizing.

## Phase 5: Paper Trading and Promotion

- Run the engine in `DRY_RUN` for at least 1-2 weeks.
- Store decisions, rejected candidates, simulated fills, and outcome metrics.
- Promote to live only after reviewed evidence shows data quality, risk behavior, and operational safety.

## Phase 6: Live Trading Guardrails

- Keep kill switch and read-only status visible.
- Require single order gateway.
- Add reconciliation between submitted orders, fills, positions, and expected state.
- Alert on any broker-write attempt outside the gateway.
