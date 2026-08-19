from __future__ import annotations

import asyncio
import json
from datetime import datetime
from typing import Protocol
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import aiohttp

from .models import AccountSnapshot, Candle, CashBalance, Instrument, Position, Quote


class TossMarketDataProvider(Protocol):
    async def get_account(self) -> AccountSnapshot:
        ...

    async def get_quotes(self, instruments: list[Instrument]) -> dict[str, Quote]:
        ...

    async def get_candles(self, instrument: Instrument, lookback: int = 80) -> list[Candle]:
        ...


class TossClientMarketDataProvider:
    """Adapter around the existing Toss client.

    The adapter is deliberately narrow: it exposes only Toss account, quote, and
    candle data to the Toss-only pipeline.
    """

    def __init__(self, toss_client):
        self.toss_client = toss_client

    async def get_account(self) -> AccountSnapshot:
        balance = await self.toss_client.get_account_balance()
        cash = CashBalance(
            usd=float(balance.get("cash_usd", 0) or 0),
            krw=float(balance.get("cash", 0) or 0),
        )
        positions: list[Position] = []
        for item in balance.get("us_holdings", []):
            symbol = item.get("symbol") or item.get("stockCode")
            if not symbol:
                continue
            quantity = float(item.get("quantity", item.get("qty", 0)) or 0)
            market_value = _extract_amount(item.get("marketValue"), default=0.0)
            average_price = _extract_amount(item.get("purchasePrice"), default=0.0)
            positions.append(
                Position(
                    symbol=symbol,
                    market="US",
                    quantity=quantity,
                    average_price=average_price,
                    market_value=market_value,
                    currency="USD",
                )
            )
        for item in balance.get("kr_holdings", []):
            symbol = item.get("symbol") or item.get("stockCode")
            if not symbol:
                continue
            quantity = float(item.get("quantity", item.get("qty", 0)) or 0)
            market_value = _extract_amount(item.get("marketValue"), default=0.0, currency="krw")
            average_price = _extract_amount(item.get("purchasePrice"), default=0.0, currency="krw")
            positions.append(
                Position(
                    symbol=symbol,
                    market="KR",
                    quantity=quantity,
                    average_price=average_price,
                    market_value=market_value,
                    currency="KRW",
                )
            )
        return AccountSnapshot(cash=cash, positions=positions)

    async def get_quotes(self, instruments: list[Instrument]) -> dict[str, Quote]:
        quotes: dict[str, Quote] = {}
        for instrument in instruments:
            # 🔧 Toss API는 한국주식 + 미국주식 모두 지원 (/api/v1/prices)
            # (이전 주석 제거됨 - 한국주식도 이제 처리함)

            price = None
            if hasattr(self.toss_client, "get_stock_price"):
                price = await self.toss_client.get_stock_price(instrument.symbol)
            if price is None or float(price) <= 0:
                continue

            # 🔧 기술 분석에 필요한 change_pct와 volume 추가 (candles에서 계산)
            change_pct = None
            volume = None
            try:
                candles = await self.get_candles(instrument, lookback=5)
                if len(candles) >= 2:
                    prev_close = candles[-2].close
                    curr_close = candles[-1].close
                    change_pct = ((curr_close - prev_close) / prev_close) * 100 if prev_close > 0 else 0
                    volume = candles[-1].volume
            except Exception as e:
                # 캔들 조회 실패해도 현재가라도 반환
                pass

            quotes[instrument.symbol] = Quote(
                symbol=instrument.symbol,
                market=instrument.market,
                price=float(price),
                currency=instrument.currency,
                change_pct=change_pct,
                volume=volume,
                source="toss",
                timestamp=datetime.utcnow(),
            )
        return quotes

    async def get_candles(self, instrument: Instrument, lookback: int = 80) -> list[Candle]:
        if hasattr(self.toss_client, "get_candles"):
            raw = await self.toss_client.get_candles(instrument.symbol, lookback=lookback)
        elif hasattr(self.toss_client, "get_price_history"):
            raw = await self.toss_client.get_price_history(instrument.symbol, lookback=lookback)
        else:
            return []
        return [_parse_candle(row) for row in raw or [] if _parse_candle(row) is not None]


class YahooChartMarketDataProvider:
    """Actual quote and OHLCV provider using Yahoo Finance chart endpoints."""

    def __init__(self, session: aiohttp.ClientSession | None = None, cache_ttl: int = 60):
        self.session = session
        self._owned_session: aiohttp.ClientSession | None = None
        # 🔧 캐싱 메커니즘: 60초 TTL
        self._cache: dict[str, tuple[list[Candle], datetime]] = {}
        self.cache_ttl = cache_ttl

    async def _ensure_session(self) -> aiohttp.ClientSession:
        if self.session:
            return self.session
        if self._owned_session is None or self._owned_session.closed:
            self._owned_session = aiohttp.ClientSession()
        return self._owned_session

    async def close(self) -> None:
        if self._owned_session and not self._owned_session.closed:
            await self._owned_session.close()

    async def get_quotes(self, instruments: list[Instrument]) -> dict[str, Quote]:
        quotes: dict[str, Quote] = {}
        chart_instruments = [instrument for instrument in instruments if instrument.market in {"US", "KR"}]
        for instrument in chart_instruments:
            candles = await self.get_candles(instrument, lookback=25)
            if not candles:
                continue
            last = candles[-1]
            previous = candles[-2] if len(candles) >= 2 else None
            avg_volume = sum(c.volume for c in candles[-21:-1]) / max(1, len(candles[-21:-1]))
            change_pct = None
            if previous and previous.close > 0:
                change_pct = ((last.close - previous.close) / previous.close) * 100
            quotes[instrument.symbol] = Quote(
                symbol=instrument.symbol,
                market=instrument.market,
                price=last.close,
                currency=instrument.currency,
                volume=last.volume,
                relative_volume=last.volume / avg_volume if avg_volume > 0 else None,
                change_pct=change_pct,
                source="yahoo_chart",
                timestamp=last.timestamp,
            )
        return quotes

    async def get_candles(self, instrument: Instrument, lookback: int = 80) -> list[Candle]:
        if instrument.market not in {"US", "KR"}:
            return []

        # 🔧 캐시 확인
        cache_key = f"{instrument.symbol}:{lookback}"
        now = datetime.utcnow()
        if cache_key in self._cache:
            cached_candles, cached_time = self._cache[cache_key]
            if (now - cached_time).total_seconds() < self.cache_ttl:
                return cached_candles

        session = await self._ensure_session()
        chart_symbol = _to_yahoo_symbol(instrument)
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{chart_symbol}"
        params = {"range": "6mo", "interval": "1d", "includePrePost": "false"}
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
            ),
            "Accept": "application/json,text/plain,*/*",
        }
        try:
            async with session.get(url, params=params, headers=headers, timeout=aiohttp.ClientTimeout(total=12)) as resp:
                if resp.status != 200:
                    return await asyncio.to_thread(_fetch_yahoo_candles_urllib, instrument, lookback)
                payload = await resp.json()
        except Exception:
            return await asyncio.to_thread(_fetch_yahoo_candles_urllib, instrument, lookback)

        result = (payload.get("chart", {}).get("result") or [None])[0]
        if not result:
            return []
        timestamps = result.get("timestamp") or []
        quote = ((result.get("indicators", {}).get("quote") or [{}])[0])
        opens = quote.get("open") or []
        highs = quote.get("high") or []
        lows = quote.get("low") or []
        closes = quote.get("close") or []
        volumes = quote.get("volume") or []

        candles: list[Candle] = []
        for index, ts in enumerate(timestamps):
            try:
                open_price = opens[index]
                high = highs[index]
                low = lows[index]
                close = closes[index]
                if any(value is None for value in (open_price, high, low, close)):
                    continue
                candles.append(
                    Candle(
                        timestamp=datetime.utcfromtimestamp(ts),
                        open=float(open_price),
                        high=float(high),
                        low=float(low),
                        close=float(close),
                        volume=int(volumes[index] or 0),
                    )
                )
            except Exception:
                continue

        # 🔧 캐시 저장
        result = candles[-lookback:]
        self._cache[cache_key] = (result, now)
        return result


class CompositeTossMarketDataProvider:
    """Merges Toss account/quotes with an optional US OHLCV provider."""

    def __init__(
        self,
        toss_provider: TossClientMarketDataProvider,
        chart_provider: YahooChartMarketDataProvider | None = None,
    ):
        self.toss_provider = toss_provider
        self.chart_provider = chart_provider or YahooChartMarketDataProvider()

    async def get_account(self) -> AccountSnapshot:
        return await self.toss_provider.get_account()

    async def get_quotes(self, instruments: list[Instrument]) -> dict[str, Quote]:
        toss_quotes = await self.toss_provider.get_quotes(instruments)
        chart_quotes = await self.chart_provider.get_quotes(instruments)

        # 🔧 데이터 소스 병합: Chart 데이터 + Toss 현재가
        # Chart는 change_pct, volume 제공, Toss는 실시간 현재가 제공
        result = {**chart_quotes}
        for symbol, toss_quote in toss_quotes.items():
            if symbol in result:
                chart_quote = result[symbol]
                # Toss 현재가로 업데이트하되 Chart의 보충 정보는 유지
                result[symbol] = Quote(
                    symbol=chart_quote.symbol,
                    market=chart_quote.market,
                    price=toss_quote.price,  # ✅ Toss 현재가 사용
                    currency=chart_quote.currency,
                    bid=chart_quote.bid,
                    ask=chart_quote.ask,
                    volume=chart_quote.volume,  # ✅ Chart 거래량 유지
                    relative_volume=chart_quote.relative_volume,
                    change_pct=chart_quote.change_pct,  # ✅ Chart 변화율 유지
                    source="composite_toss+chart",
                    timestamp=toss_quote.timestamp,
                )
        return result

    async def get_candles(self, instrument: Instrument, lookback: int = 80) -> list[Candle]:
        toss_candles = await self.toss_provider.get_candles(instrument, lookback=lookback)
        if toss_candles:
            return toss_candles
        return await self.chart_provider.get_candles(instrument, lookback=lookback)

    async def close(self) -> None:
        if hasattr(self.chart_provider, "close"):
            await self.chart_provider.close()


YahooUSMarketDataProvider = YahooChartMarketDataProvider


class StaticTossMarketDataProvider:
    """Test provider for deterministic Toss-only cycles."""

    def __init__(
        self,
        account: AccountSnapshot,
        quotes: dict[str, Quote],
        candles: dict[str, list[Candle]] | None = None,
    ):
        self.account = account
        self.quotes = quotes
        self.candles = candles or {}

    async def get_account(self) -> AccountSnapshot:
        return self.account

    async def get_quotes(self, instruments: list[Instrument]) -> dict[str, Quote]:
        return {
            instrument.symbol: self.quotes[instrument.symbol]
            for instrument in instruments
            if instrument.symbol in self.quotes
        }

    async def get_candles(self, instrument: Instrument, lookback: int = 80) -> list[Candle]:
        return self.candles.get(instrument.symbol, [])[-lookback:]


def _extract_amount(value, default: float = 0.0, currency: str = "usd") -> float:
    if isinstance(value, dict):
        amount = value.get("amount", value.get(currency, default))
        if isinstance(amount, dict):
            amount = amount.get(currency, default)
        return float(amount or default)
    return float(value or default)


def _parse_candle(row) -> Candle | None:
    try:
        ts = row.get("timestamp") or row.get("time") or row.get("date")
        if isinstance(ts, datetime):
            timestamp = ts
        else:
            timestamp = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
        return Candle(
            timestamp=timestamp,
            open=float(row["open"]),
            high=float(row["high"]),
            low=float(row["low"]),
            close=float(row["close"]),
            volume=int(row.get("volume", 0)),
        )
    except Exception:
        return None


def _fetch_yahoo_candles_urllib(instrument: Instrument, lookback: int) -> list[Candle]:
    if instrument.market not in {"US", "KR"}:
        return []
    params = urlencode({"range": "6mo", "interval": "1d", "includePrePost": "false"})
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{_to_yahoo_symbol(instrument)}?{params}"
    request = Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json",
        },
    )
    try:
        with urlopen(request, timeout=12) as response:
            payload = json.load(response)
    except Exception:
        return []
    return _parse_yahoo_chart_payload(payload, lookback)


def _to_yahoo_symbol(instrument: Instrument) -> str:
    if instrument.market == "US":
        return instrument.symbol
    if instrument.market == "KR":
        if instrument.symbol in {"247540"}:
            return f"{instrument.symbol}.KQ"
        return f"{instrument.symbol}.KS"
    return instrument.symbol


def _parse_yahoo_chart_payload(payload: dict, lookback: int) -> list[Candle]:
    result = (payload.get("chart", {}).get("result") or [None])[0]
    if not result:
        return []
    timestamps = result.get("timestamp") or []
    quote = ((result.get("indicators", {}).get("quote") or [{}])[0])
    opens = quote.get("open") or []
    highs = quote.get("high") or []
    lows = quote.get("low") or []
    closes = quote.get("close") or []
    volumes = quote.get("volume") or []

    candles: list[Candle] = []
    for index, ts in enumerate(timestamps):
        try:
            open_price = opens[index]
            high = highs[index]
            low = lows[index]
            close = closes[index]
            if any(value is None for value in (open_price, high, low, close)):
                continue
            candles.append(
                Candle(
                    timestamp=datetime.utcfromtimestamp(ts),
                    open=float(open_price),
                    high=float(high),
                    low=float(low),
                    close=float(close),
                    volume=int(volumes[index] or 0),
                )
            )
        except Exception:
            continue
    return candles[-lookback:]
