from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass
from typing import Protocol

from .config import TossOnlyConfig
from .models import Instrument

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class CatalystSignal:
    symbol: str
    score: float
    summary: str


class CatalystProvider(Protocol):
    async def score(self, instruments: list[Instrument]) -> dict[str, CatalystSignal]:
        ...


class KoreanThemeNewsCatalystProvider:
    """Naver-news based catalyst scorer for Korean stocks.

    If Naver credentials are not configured, this safely returns neutral
    catalyst scores so the downstream pipeline still runs from quote/OHLCV.
    """

    POSITIVE_TERMS = ("수주", "증설", "실적", "흑자", "호조", "상승", "신고가", "목표가", "AI", "반도체")
    NEGATIVE_TERMS = ("하락", "적자", "소송", "리콜", "감소", "부진", "유상증자", "급락")

    def __init__(self, config: TossOnlyConfig):
        self.config = config
        self.client_id = os.getenv("NAVER_CLIENT_ID", "")
        self.client_secret = os.getenv("NAVER_CLIENT_SECRET", "")

    async def score(self, instruments: list[Instrument]) -> dict[str, CatalystSignal]:
        kr_instruments = [instrument for instrument in instruments if instrument.market == "KR"]
        if not kr_instruments or not self.client_id or not self.client_secret:
            return {
                instrument.symbol: CatalystSignal(instrument.symbol, 0.50, "neutral: news provider not configured")
                for instrument in kr_instruments
            }

        # 🔧 Import 에러 처리
        try:
            from src.pyqqq.naver_news_client import NaverNewsClient
        except (ImportError, ModuleNotFoundError) as e:
            logger.warning(f"⚠️  NaverNewsClient import failed: {e}, using neutral scores")
            return {
                instrument.symbol: CatalystSignal(instrument.symbol, 0.50, f"neutral: import error")
                for instrument in kr_instruments
            }

        try:
            client = NaverNewsClient(self.client_id, self.client_secret)
        except Exception as e:
            logger.warning(f"⚠️  NaverNewsClient init failed: {e}, using neutral scores")
            return {
                instrument.symbol: CatalystSignal(instrument.symbol, 0.50, f"neutral: client init error")
                for instrument in kr_instruments
            }

        result: dict[str, CatalystSignal] = {}
        for instrument in kr_instruments:
            try:
                news = await client.get_symbol_news(instrument.symbol, instrument.name)
                text = " ".join(f"{item.get('title', '')} {item.get('description', '')}" for item in news)
                positive = sum(len(re.findall(term, text, flags=re.IGNORECASE)) for term in self.POSITIVE_TERMS)
                negative = sum(len(re.findall(term, text, flags=re.IGNORECASE)) for term in self.NEGATIVE_TERMS)
                score = max(0.0, min(1.0, 0.50 + positive * 0.06 - negative * 0.08))
                result[instrument.symbol] = CatalystSignal(
                    symbol=instrument.symbol,
                    score=score,
                    summary=f"naver_news items={len(news)} positive={positive} negative={negative}",
                )
            except Exception as e:
                # 한 종목 실패가 전체를 영향주지 않도록 처리
                logger.warning(f"⚠️  Catalyst fetch failed for {instrument.symbol}: {e}")
                result[instrument.symbol] = CatalystSignal(
                    symbol=instrument.symbol,
                    score=0.50,
                    summary=f"neutral: fetch error"
                )
        return result


class CompositeCatalystProvider:
    def __init__(self, providers: list[CatalystProvider]):
        self.providers = providers

    async def score(self, instruments: list[Instrument]) -> dict[str, CatalystSignal]:
        combined: dict[str, CatalystSignal] = {}
        for provider in self.providers:
            signals = await provider.score(instruments)
            for symbol, signal in signals.items():
                previous = combined.get(symbol)
                if previous is None or signal.score > previous.score:
                    combined[symbol] = signal
        return combined
