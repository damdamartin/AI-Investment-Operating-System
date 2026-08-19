from __future__ import annotations

import logging
import pytz
from datetime import datetime

from .config import TossOnlyConfig
from .market_data import TossMarketDataProvider
from .models import AccountSnapshot, Instrument, Quote, Signal, TradingCycleResult
from .news_catalyst import CatalystProvider, KoreanThemeNewsCatalystProvider
from .order_gateway import TossOnlyOrderGateway
from .risk import TossOnlyRiskManager
from .technical import TechnicalSetupAnalyzer
from .theme_detector import ThemeDetector

logger = logging.getLogger(__name__)


class TossOnlyTradingEngine:
    """Toss-only KR/US stock engine.

    Pipeline:
    account -> quotes -> market regime -> theme candidates -> technical setups
    -> risk-sized trade plans -> single order gateway.
    """

    def __init__(
        self,
        market_data: TossMarketDataProvider,
        config: TossOnlyConfig | None = None,
        order_gateway: TossOnlyOrderGateway | None = None,
        catalyst_provider: CatalystProvider | None = None,
    ):
        self.config = config or TossOnlyConfig()
        self.market_data = market_data
        self.theme_detector = ThemeDetector(self.config)
        self.technical_analyzer = TechnicalSetupAnalyzer()
        self.risk_manager = TossOnlyRiskManager(self.config)
        self.order_gateway = order_gateway or TossOnlyOrderGateway(self.config)
        self.catalyst_provider = catalyst_provider or KoreanThemeNewsCatalystProvider(self.config)

    def is_market_open(self, market: str) -> bool:
        """Check if market is currently open for trading."""
        now = datetime.now(pytz.timezone('Asia/Seoul'))
        weekday = now.weekday()  # 0=Monday, 6=Sunday
        hour = now.hour
        minute = now.minute

        if market == "KR":
            # 한국 증권시장: 월-금 09:00-15:30 KST
            if weekday >= 5:  # 토요일 이상 (토일)
                return False
            return 9 <= hour < 15 or (hour == 15 and minute < 30)

        elif market == "US":
            # 미국 증권시장: 월-금 16:30-05:00 KST (다음날)
            if weekday >= 5:  # 토요일 이상
                return False
            # 16:30 ~ 23:59
            if hour >= 16 and minute >= 30:
                return True
            # 00:00 ~ 05:00
            if 0 <= hour < 5:
                return True
            return False

        return False

    async def run_cycle(
        self,
        catalyst_scores: dict[str, float] | None = None,
        submit_orders: bool = True,
    ) -> TradingCycleResult:
        account = await self.market_data.get_account()

        # 🔧 Step 1: 계좌 상태 분석
        tradeable_markets = self._analyze_tradeable_markets(account)
        logger.info(f"📊 거래 가능 시장: KR={tradeable_markets['KR']}, US={tradeable_markets['US']}")

        # 🔧 Step 2: 거래 가능한 시장만 필터링
        instruments = self.theme_detector.all_instruments()
        instruments = [i for i in instruments if tradeable_markets.get(i.market, False)]

        instruments_by_symbol = {instrument.symbol: instrument for instrument in instruments}
        quotes = await self.market_data.get_quotes(instruments)
        affordable_instruments = self._filter_affordable_instruments(account, instruments, quotes)
        affordable_symbols = {instrument.symbol for instrument in affordable_instruments}
        affordable_quotes = {
            symbol: quote for symbol, quote in quotes.items()
            if symbol in affordable_symbols
        }

        if not affordable_quotes:
            regime = self.theme_detector.detect_regime({})
            return TradingCycleResult(
                mode=self.config.execution_mode,
                account=account,
                regime=regime,
                candidates=[],
                setups=[],
                plans=[],
                risk_decisions=[],
                orders=[],
            )

        provider_catalysts = await self.catalyst_provider.score(affordable_instruments)
        merged_catalyst_scores = {
            symbol: signal.score for symbol, signal in provider_catalysts.items()
        }
        if catalyst_scores:
            merged_catalyst_scores.update(catalyst_scores)
        catalyst_summaries = {
            symbol: signal.summary for symbol, signal in provider_catalysts.items()
        }

        regime = self.theme_detector.detect_regime(affordable_quotes, catalyst_scores=merged_catalyst_scores)
        candidates = self.theme_detector.build_candidates(
            regime,
            affordable_quotes,
            catalyst_scores=merged_catalyst_scores,
            catalyst_summaries=catalyst_summaries,
        )

        setups = []
        plans = []
        decisions = []
        orders = []

        # 🔧 병렬 처리: 시장이 열려있는 candidates의 candles를 동시 조회
        # Step 1: 시장 시간 체크 + 유효한 후보 필터링
        valid_candidates_with_data = []
        for candidate in candidates:
            quote = quotes.get(candidate.symbol)
            instrument = instruments_by_symbol.get(candidate.symbol)
            if quote is None or instrument is None:
                continue

            if not self.is_market_open(instrument.market):
                logger.warning(
                    f"⏰ Market closed for {candidate.symbol} ({instrument.market}), skipping"
                )
                continue

            valid_candidates_with_data.append((candidate, quote, instrument))

        if not valid_candidates_with_data:
            # 유효한 후보가 없으면 종료
            regime = self.theme_detector.detect_regime(affordable_quotes, catalyst_scores=merged_catalyst_scores)
            return TradingCycleResult(
                mode=self.config.execution_mode,
                account=account,
                regime=regime,
                candidates=candidates,
                setups=[],
                plans=[],
                risk_decisions=[],
                orders=[],
            )

        # Step 2: 모든 candles를 병렬로 조회
        import asyncio
        candles_tasks = [
            self.market_data.get_candles(instrument)
            for _, _, instrument in valid_candidates_with_data
        ]
        candles_list = await asyncio.gather(*candles_tasks)

        # Step 3: 분석 및 거래 결정 (순차, 하지만 candles는 이미 준비됨)
        for (candidate, quote, instrument), candles in zip(valid_candidates_with_data, candles_list):
            setup = self.technical_analyzer.analyze(quote, candles)
            setups.append(setup)

            if setup.signal != Signal.BUY or setup.confidence < self.config.min_setup_confidence:
                continue

            plan = self.risk_manager.build_plan(account, setup)
            if plan is None:
                continue
            plans.append(plan)

            decision = self.risk_manager.validate(account, plan)
            decisions.append(decision)
            if not decision.approved or not decision.adjusted_plan:
                continue

            if submit_orders:
                result = await self.order_gateway.submit(decision.adjusted_plan)
                orders.append(result)

                # 🔧 주문 결과 로깅 (성공/실패 구분)
                if result.submitted:
                    logger.info(
                        f"✅ Order submitted: {result.symbol} (ID={result.order_id}, "
                        f"mode={result.mode})"
                    )
                else:
                    logger.warning(
                        f"⚠️  Order rejected: {result.symbol} - {result.message} "
                        f"(mode={result.mode})"
                    )

        logger.info(
            "Toss-only cycle complete: candidates=%s setups=%s plans=%s orders=%s mode=%s",
            len(candidates),
            len(setups),
            len(plans),
            len(orders),
            self.config.execution_mode.value,
        )
        return TradingCycleResult(
            mode=self.config.execution_mode,
            account=account,
            regime=regime,
            candidates=candidates,
            setups=setups,
            plans=plans,
            risk_decisions=decisions,
            orders=orders,
        )

    def _analyze_tradeable_markets(self, account: AccountSnapshot) -> dict[str, bool]:
        """🔧 Step 1: 계좌 기반 거래 가능 시장 판단

        Returns:
            {'KR': True/False, 'US': True/False}
        """
        result = {}

        # 한국 시장: 개장 시간 + KRW 현금 충분
        kr_open = self.is_market_open("KR")
        kr_cash_available = account.cash.krw > self.config.min_krw_cash_after_order
        result['KR'] = kr_open and kr_cash_available
        logger.info(
            f"🇰🇷 한국시장: open={kr_open}, cash_available={kr_cash_available} (₩{account.cash.krw:,.0f})"
        )

        # 미국 시장: 개장 시간 + USD 현금 충분
        us_open = self.is_market_open("US")
        us_cash_available = account.cash.usd > self.config.min_usd_cash_after_order
        result['US'] = us_open and us_cash_available
        logger.info(
            f"🇺🇸 미국시장: open={us_open}, cash_available={us_cash_available} (${account.cash.usd:,.2f})"
        )

        return result

    def _filter_affordable_instruments(
        self,
        account: AccountSnapshot,
        instruments: list[Instrument],
        quotes: dict[str, Quote],
    ) -> list[Instrument]:
        affordable: list[Instrument] = []
        for instrument in instruments:
            quote = quotes.get(instrument.symbol)
            if quote is None or quote.price <= 0:
                continue

            if instrument.currency == "KRW":
                available = account.cash.krw - self.config.min_krw_cash_after_order
                if quote.price <= available:
                    affordable.append(instrument)
                continue

            available = account.cash.usd - self.config.min_usd_cash_after_order
            if self.config.fractional_trading_enabled:
                if available >= self.config.min_order_notional_usd:
                    affordable.append(instrument)
            elif quote.price <= available:
                affordable.append(instrument)
        return affordable
