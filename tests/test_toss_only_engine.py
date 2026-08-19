from __future__ import annotations

from datetime import datetime, timedelta

import pytest

from src.pyqqq.toss_only.config import TossOnlyConfig
from src.pyqqq.toss_only.engine import TossOnlyTradingEngine
from src.pyqqq.toss_only.market_data import StaticTossMarketDataProvider
from src.pyqqq.toss_only.models import AccountSnapshot, Candle, CashBalance, ExecutionMode, Quote


def _candles(start: float = 100.0) -> list[Candle]:
    now = datetime.utcnow()
    rows: list[Candle] = []
    price = start
    for index in range(60):
        price += 0.35
        rows.append(
            Candle(
                timestamp=now - timedelta(days=60 - index),
                open=price - 0.4,
                high=price + 0.9,
                low=price - 0.8,
                close=price,
                volume=1_000_000 + index * 15_000,
            )
        )
    rows[-1] = Candle(
        timestamp=now,
        open=price,
        high=price + 2.5,
        low=price - 0.5,
        close=price + 2.0,
        volume=3_000_000,
    )
    return rows


@pytest.mark.asyncio
async def test_toss_only_engine_read_only_never_submits_live_order():
    account = AccountSnapshot(cash=CashBalance(usd=151.0))
    quote = Quote(
        symbol="NVDA",
        market="US",
        price=123.0,
        ask=123.1,
        volume=3_000_000,
        relative_volume=2.2,
        change_pct=3.1,
        source="test",
    )
    provider = StaticTossMarketDataProvider(
        account=account,
        quotes={"NVDA": quote},
        candles={"NVDA": _candles(100.0)},
    )
    config = TossOnlyConfig(
        execution_mode=ExecutionMode.READ_ONLY,
        min_candidate_score=0.40,
        min_setup_confidence=0.50,
        min_order_notional_usd=5.0,
        min_usd_cash_after_order=1.0,
    )

    result = await TossOnlyTradingEngine(provider, config=config).run_cycle(
        catalyst_scores={"NVDA": 0.9}
    )

    assert result.mode == ExecutionMode.READ_ONLY
    assert result.candidates
    assert result.plans
    assert result.orders
    assert result.orders[0].submitted is False


@pytest.mark.asyncio
async def test_toss_only_engine_fails_closed_without_candles():
    account = AccountSnapshot(cash=CashBalance(usd=151.0))
    provider = StaticTossMarketDataProvider(
        account=account,
        quotes={"NVDA": Quote(symbol="NVDA", market="US", price=123.0, relative_volume=2.0, change_pct=3.0)},
        candles={},
    )

    result = await TossOnlyTradingEngine(provider).run_cycle(catalyst_scores={"NVDA": 0.9})

    assert result.setups
    assert result.setups[0].signal.value == "NO_DATA"
    assert not result.plans
    assert not result.orders


@pytest.mark.asyncio
async def test_toss_only_engine_supports_krw_korean_stock_plan():
    account = AccountSnapshot(cash=CashBalance(usd=0.0, krw=110_000.0))
    quote = Quote(
        symbol="005930",
        market="KR",
        currency="KRW",
        price=66_000.0,
        ask=66_100.0,
        volume=3_000_000,
        relative_volume=2.0,
        change_pct=2.1,
        source="test",
    )
    provider = StaticTossMarketDataProvider(
        account=account,
        quotes={"005930": quote},
        candles={"005930": _candles(65_000.0)},
    )
    config = TossOnlyConfig(
        execution_mode=ExecutionMode.READ_ONLY,
        min_candidate_score=0.40,
        min_setup_confidence=0.50,
        min_order_notional_krw=5_000,
        min_krw_cash_after_order=1_000,
        risk_per_trade_pct=0.03,
        max_position_pct=0.90,
    )

    result = await TossOnlyTradingEngine(provider, config=config).run_cycle(
        catalyst_scores={"005930": 0.8}
    )

    assert result.candidates
    assert result.plans
    assert result.plans[0].market == "KR"
    assert result.plans[0].currency == "KRW"
    assert float(result.plans[0].quantity).is_integer()
    assert result.orders[0].submitted is False


@pytest.mark.asyncio
async def test_toss_only_engine_filters_korean_candidates_by_toss_krw_cash():
    account = AccountSnapshot(cash=CashBalance(usd=13.31, krw=21_195.0))
    provider = StaticTossMarketDataProvider(
        account=account,
        quotes={
            "013000": Quote(
                symbol="013000",
                market="KR",
                currency="KRW",
                price=5_000,
                ask=5_050,
                relative_volume=2.0,
                change_pct=2.5,
            ),
            "005930": Quote(
                symbol="005930",
                market="KR",
                currency="KRW",
                price=72_000,
                ask=72_100,
                relative_volume=2.5,
                change_pct=3.0,
            ),
        },
        candles={"013000": _candles(4_500), "005930": _candles(65_000)},
    )
    config = TossOnlyConfig(
        execution_mode=ExecutionMode.READ_ONLY,
        min_candidate_score=0.40,
        min_setup_confidence=0.50,
        min_krw_cash_after_order=1_000,
    )

    result = await TossOnlyTradingEngine(provider, config=config).run_cycle(
        catalyst_scores={"013000": 0.8, "005930": 0.9}
    )

    selected_symbols = [candidate.symbol for candidate in result.candidates]
    order_symbols = [order.symbol for order in result.orders]

    assert "013000" in selected_symbols
    assert "005930" not in selected_symbols
    assert "013000" in order_symbols
