# Handoff Notes for Further Development

## Non-Negotiables

- This system must remain Toss-only.
- Do not import old mixed-broker modules.
- Do not add broker writes outside `order_gateway.py`.
- Do not use placeholder prices for live or read-only decisions.
- If market data is missing, return `NO_DATA` or skip the candidate.

## Current State

- KR and US stocks run through the same six-step engine.
- Toss account cash is split into KRW and USD.
- KR candidates are filtered by whole-share affordability.
- US candidates are filtered by fractional/notional affordability when enabled.
- Yahoo chart data is used as quote/OHLCV fallback for US and Korean symbols.
- Korean catalysts use Naver News when `NAVER_CLIENT_ID` and `NAVER_CLIENT_SECRET` exist.
- Default risk per trade is 3%, matching the requested 2-3% expert-process range.

## Next Development Tasks

1. Add official Toss OHLCV endpoints if available.
2. Add intraday intervals: 1d, 4h, 1h, and 15m.
3. Add sector ETF or index proxies for Korean themes.
4. Add explicit protective-order or monitoring execution support.
5. Persist all decisions to JSONL or DB for audit and replay.
6. Add tests for live gate behavior and whole-share Korean sizing.

## Suggested Validation Commands

```bash
python3 -m compileall -q src/pyqqq/toss_only run_toss_only_trading.py run_toss_only_daemon.py
python3 run_toss_only_trading.py
```
