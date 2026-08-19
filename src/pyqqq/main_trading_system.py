"""
🚀 AI 자동매매 시스템 - 4팀 에이전트 통합 실행 엔진

팀장 + 리서치팀 + 분석팀 + 매매팀 + 실행팀이 함께 작동하는 완전 자동화 시스템
"""

import asyncio
import logging
from datetime import datetime, time
from typing import Dict, List, Any, Optional
import json

# 에이전트 및 클라이언트 임포트
from .research_agent import ResearchAgent
from .research_team_market_analyzer import ResearchTeamMarketAnalyzer  # 리서치팀: 시장 분석 + 종목 발굴
from .analysis_agent import AnalysisAgent
from .strategy_agent import StrategyAgent
from .risk_agent import RiskAgent
from .orchestrator import AIOrchestrator
# 🔴 KIS DISABLED - No KIS import
# from .kis_client import KISClient  # REMOVED - KIS is completely disabled
from .toss_client import TossSecuritiesClient
from .naver_news_client import NaverNewsClient
from .account_inquiry import RealAccountInquiry  # 실계좌 조회 (메모리/테스트 데이터 금지)
from .process_guard import ProcessGuard  # 중복 실행 방지
from .market_calendar import MarketCalendar  # 시장 시간 판단
from .price_service import PriceService  # 실시간 현재가
from .order_intent import OrderIntent, RiskDecision, OrderIntentBuilder, RiskDecisionBuilder  # 주문 구조
from .config import settings

# 새로운 인프라 임포트
from .market_regime_detector import MarketRegimeDetector
from .performance_review_engine import PerformanceReviewEngine
from .decision_logger import DecisionLogger
from .trade_scenario import TradeScenarioAnalyzer

import os
import json

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)


class MainTradingSystem:
    """
    4팀 에이전트 통합 시스템
    - 팀장: orchestrator
    - 팀원1: 리서치팀 + 분석팀
    - 팀원2: 매매전략팀
    - 팀원3: 주문실행팀 + 모니터링팀
    """

    def __init__(self, toss_only: bool = False):
        self.toss_only = toss_only  # Toss-only 모드 (미국주식 매매용)

        # 🔴 KIS는 완전히 비활성화됨 - KISClient 절대 초기화하지 않음

        self.orchestrator = AIOrchestrator()
        self.research_team = ResearchTeamMarketAnalyzer()  # 리서치팀: 시장 분석 + 종목 발굴 ⭐
        self.research_agent = ResearchAgent()
        self.analysis_agent = AnalysisAgent()
        self.strategy_agent = StrategyAgent()
        self.risk_agent = RiskAgent()  # 리스크팀

        # 🔴 KIS는 사용하지 않음
        self.kis_client = None
        self.toss_client = TossSecuritiesClient()
        self.account_inquiry = RealAccountInquiry()  # Toss만 조회

        # 가격 서비스 초기화
        self.price_service = PriceService(
            kis_client=self.kis_client,
            toss_client=self.toss_client
        )

        # 네이버 뉴스 클라이언트 초기화
        naver_client_id = os.environ.get("NAVER_CLIENT_ID", "")
        naver_client_secret = os.environ.get("NAVER_CLIENT_SECRET", "")
        self.naver_news_client = NaverNewsClient(naver_client_id, naver_client_secret) if naver_client_id else None

        # ✨ 새로운 인프라 모듈 초기화
        self.regime_detector = MarketRegimeDetector()
        self.performance_engine = PerformanceReviewEngine()
        self.decision_logger = DecisionLogger()
        self.trade_scenario_analyzer = TradeScenarioAnalyzer()

        self.running = False
        self.cycle_count = 0
        self.daily_loss_krw = 0.0  # 일일 손실 추적
        self.daily_trades_count = 0  # 일일 거래 건수 추적
        self.last_trade_date = None  # 마지막 거래 날짜 (일일 리셋용)
        self.current_watchlist = []  # 동적 Watchlist

        # 의사결정 로그 저장
        self.decisions_log_file = None

        # 시장 국면 캐시 (모니터링용)
        self.current_market_regime_kr = None
        self.current_market_regime_us = None

        logger.info("🚀 4팀 에이전트 시스템 초기화 완료 (새 인프라 통합)")

    async def initialize(self) -> bool:
        """시스템 초기화"""
        try:
            # 1. 클라이언트 인증
            logger.info("🔐 계좌 인증 중...")

            # Toss-only 모드 또는 KIS 비활성화
            if self.toss_only or self.kis_client is None:
                logger.info("  🇺🇸 Toss-only 모드 (KIS 비활성화)")
                toss_auth = await self.toss_client.authenticate()
                if not toss_auth:
                    logger.error("❌ Toss 인증 실패")
                    return False
            else:
                # 기본 모드 (KIS + Toss) - 거의 사용 안 함
                logger.warning("  ⚠️ KIS 인증은 비활성화되었습니다. Toss만 사용합니다.")
                toss_auth = await self.toss_client.authenticate()
                if not toss_auth:
                    logger.error("❌ Toss 인증 실패")
                    return False

            logger.info("✅ 계좌 인증 완료")

            # 2. orchestrator에 에이전트 연결
            logger.info("🔗 에이전트 통합 중...")
            self.orchestrator.set_agents(
                research_agent=self.research_agent,
                analysis_agent=self.analysis_agent,
                strategy_agent=self.strategy_agent,
                watchlist_manager=None,  # TODO
                order_engine=self,  # self가 order_engine 역할
                monitor=self,  # self가 monitor 역할
                kis_client=self.kis_client,
                toss_client=self.toss_client,
                naver_news_client=self.naver_news_client
            )

            logger.info("✅ 에이전트 통합 완료")
            return True

        except Exception as e:
            logger.error(f"❌ 초기화 오류: {e}")
            return False

    async def run_cycle(self) -> None:
        """한 번의 자동매매 사이클 실행 (실계좌만 사용) - 새로운 인프라 통합"""
        try:
            self.cycle_count += 1
            cycle_time = datetime.now().strftime("%H:%M:%S")

            print(f"\n{'='*70}")
            print(f"📍 거래 사이클 #{self.cycle_count} ({cycle_time})")
            print(f"{'='*70}")

            # 0. 실계좌 상태 조회 (메모리/테스트 데이터 금지)
            logger.info("🔍 실계좌 조회 중... (API만 사용)")
            account_status = await self.account_inquiry.get_real_account_status()

            # 실계좌 데이터 추출
            kis_info = account_status.get("kis", {})
            toss_info = account_status.get("toss", {})

            if kis_info.get("status") != "SUCCESS":
                logger.warning(f"⚠️ KIS 접속 실패: {kis_info.get('error', '알 수 없는 오류')}")
            if toss_info.get("status") != "SUCCESS":
                logger.warning(f"⚠️ Toss 접속 실패: {toss_info.get('error', '알 수 없는 오류')}")

            # 로그: 실계좌 현황
            logger.info(f"✅ 계좌 상태 조회 완료")
            logger.info(f"   🇰🇷 한국: ₩{kis_info.get('total_value', 0):,.0f} | 보유: {len(kis_info.get('holdings', []))}개")
            logger.info(f"   🇺🇸 미국: ₩{toss_info.get('total_value', 0):,.0f} | 보유: {len(toss_info.get('holdings', []))}개")

            # 1. 현재 포트폴리오 상태 조회 (실계좌만)
            logger.info("💰 포트폴리오 상태 조회 (실계좌)...")
            kis_balance = {
                "cash": kis_info.get("cash", 0),
                "total_value": kis_info.get("total_value", 0),
                "holdings": kis_info.get("holdings", [])
            }
            toss_balance = {
                "cash": toss_info.get("cash", 0),
                "cash_usd": toss_info.get("cash_usd", 0),
                "total_value": toss_info.get("total_value", 0),
                "holdings": toss_info.get("holdings", [])
            }

            portfolio_value = kis_info.get("total_value", 0) + toss_info.get("total_value", 0)

            logger.info(f"💼 총 자산: ₩{portfolio_value:,.0f} (실시간 API)")

            # ✨ 1-1️⃣ 시장 국면 감지 (새로운 인프라)
            logger.info("📊 시장 국면 감지 중...")
            try:
                # 한국 시장 국면 감지
                market_regime_kr_result = await self.regime_detector.detect_regime(
                    market="KR",
                    market_analysis=kis_info.get("market_analysis", {})
                )
                self.current_market_regime_kr = market_regime_kr_result
                logger.info(f"   🇰🇷 한국 시장: {market_regime_kr_result.get('regime')} "
                           f"(신뢰도: {market_regime_kr_result.get('confidence'):.2%}) - {market_regime_kr_result.get('reason')}")

                # 미국 시장 국면 감지
                market_regime_us_result = await self.regime_detector.detect_regime(
                    market="US",
                    market_analysis=toss_info.get("market_analysis", {})
                )
                self.current_market_regime_us = market_regime_us_result
                logger.info(f"   🇺🇸 미국 시장: {market_regime_us_result.get('regime')} "
                           f"(신뢰도: {market_regime_us_result.get('confidence'):.2%}) - {market_regime_us_result.get('reason')}")

                # 결정 로그에 기록
                self.decision_logger.log_market_regime(
                    market="KR",
                    regime=market_regime_kr_result.get('regime'),
                    confidence=market_regime_kr_result.get('confidence'),
                    features=market_regime_kr_result.get('features', {}),
                    reason=market_regime_kr_result.get('reason')
                )
                self.decision_logger.log_market_regime(
                    market="US",
                    regime=market_regime_us_result.get('regime'),
                    confidence=market_regime_us_result.get('confidence'),
                    features=market_regime_us_result.get('features', {}),
                    reason=market_regime_us_result.get('reason')
                )

            except Exception as e:
                logger.error(f"⚠️ 시장 국면 감지 오류 (계속 진행): {e}")
                market_regime_kr_result = {"regime": "UNKNOWN", "confidence": 0.0}
                market_regime_us_result = {"regime": "UNKNOWN", "confidence": 0.0}

            # 1️⃣ 리서치팀: 시장 분석 + 유망 종목 발굴 ⭐
            logger.info("🔬 리서치팀: 시장 분석 및 종목 발굴 중...")

            # 🆕 현금 정보 전달 (계좌 잔액 기준 종목 선정)
            kis_cash_krw = kis_balance.get("cash", 0)
            toss_cash_krw = toss_balance.get("cash", 0)  # 🆕 Toss 한국주식 현금 추가!
            toss_cash_usd = toss_balance.get("cash_usd", 0)

            # 한국주식 총 현금 = KIS + Toss
            total_krw_cash = kis_cash_krw + toss_cash_krw

            logger.info(f"💰 리서치팀 전달 현금:")
            logger.info(f"   🇰🇷 한국주식: KIS ₩{kis_cash_krw:,.0f} + Toss ₩{toss_cash_krw:,.0f} = 합계 ₩{total_krw_cash:,.0f}")
            logger.info(f"   🇺🇸 미국주식: USD ${toss_cash_usd:.2f}")

            research_result = await self.research_team.analyze_market_and_select_stocks(
                kis_cash_krw=total_krw_cash,  # 🆕 KIS + Toss 한국주식 현금 합산!
                toss_cash_usd=toss_cash_usd  # 🆕 현금 정보 전달!
            )

            # 2️⃣ 리서치팀이 선정한 종목으로 Watchlist 동적 생성
            watchlist = research_result.get('selected_watchlist', [])
            self.current_watchlist = watchlist

            logger.info(f"✅ 리서치 완료: {len(watchlist)}개 종목 선정")

            # 종목 선정 로그 기록
            watchlist_symbols = [stock.get('code', stock.get('symbol', 'N/A')) for stock in watchlist]
            for stock in watchlist:
                logger.info(f"   📊 {stock['code']} ({stock['name']}): {stock.get('reason', 'N/A')}")

            # 결정 로그에 종목 선정 기록
            try:
                self.decision_logger.log_watchlist(
                    symbols=watchlist_symbols,
                    selection_reason=f"리서치팀 분석 완료",
                    market="MULTI"
                )
            except Exception as e:
                logger.error(f"⚠️ 종목 선정 로그 오류: {e}")

            if not watchlist:
                logger.warning("⚠️ 선정된 종목이 없습니다. 다음 사이클 대기")
                return

            # 3️⃣ 계좌별 현금 분리 (KRW/USD 별도 계산)
            kis_cash = kis_balance.get('cash', 0) if kis_balance else 0
            toss_cash_krw = toss_balance.get('cash', 0) if toss_balance else 0

            logger.info(f"💰 계좌 현금 (분리):")
            logger.info(f"   🇰🇷 KIS(KRW): ₩{kis_cash:,.0f}")
            logger.info(f"   🇺🇸 Toss(KRW): ₩{toss_cash_krw:,.0f}")

            # 3-1. Toss pending 주문 확인 (중복 주문 방지, 실계좌만)
            toss_pending_symbols = set()
            toss_holdings = toss_info.get("holdings", [])  # 실계좌에서 이미 조회됨
            if toss_holdings:
                for h in toss_holdings:
                    symbol = h.get('symbol', '')
                    qty = float(h.get('quantity', 0))
                    if qty > 0:
                        toss_pending_symbols.add(symbol)

            # 3-2. 현금 부족 시 보유종목 자동 매도 로직 (전체 현금 합계 ≤ ₩50,000)
            total_krw_cash_available = kis_cash + toss_cash_krw
            if total_krw_cash_available <= 50000:
                logger.warning(
                    f"💰 현금 부족 (총 ₩{total_krw_cash_available:,.0f} <= ₩50,000) → 보유종목 자동 매도!"
                )

                # 🔴 KIS 한국주식 자동 매도 (현금 부족 시)
                if kis_cash <= 50000 and kis_balance and kis_balance.get('holdings'):
                    for holding in kis_balance['holdings']:
                        symbol = holding.get('PDNO')
                        quantity = int(holding.get('HLDG_QTY', 0))
                        current_price = float(holding.get('PRPR', 0))

                        if quantity > 0 and symbol:
                            try:
                                logger.info(f"⛔ KIS 자동 매도: {symbol} {quantity}주 @ ₩{current_price:,.0f}")
                                await self.kis_client.sell_order(symbol, quantity, current_price)

                                # 의사결정 로그에 기록
                                try:
                                    self.decision_logger.log_event(
                                        "EMERGENCY_LIQUIDATION",
                                        {
                                            "symbol": symbol,
                                            "quantity": quantity,
                                            "price": current_price,
                                            "reason": "현금 부족 자동 매도",
                                            "market": "KR"
                                        }
                                    )
                                except Exception as e:
                                    logger.error(f"⚠️ 자동 매도 로그 오류: {e}")
                            except Exception as e:
                                logger.error(f"⚠️ KIS 자동 매도 오류 ({symbol}): {e}")

                # 🔵 Toss 미국주식 자동 매도 (현금 부족 시)
                if toss_cash_krw <= 50000 and toss_holdings:
                    for holding in toss_holdings:
                        symbol = holding.get('symbol')
                        quantity = float(holding.get('quantity', 0))
                        market_price = float(holding.get('marketPrice', 0))

                        if quantity > 0 and symbol:
                            try:
                                logger.info(f"⛔ Toss 자동 매도: {symbol} {quantity}주 @ ${market_price:,.2f}")
                                await self.toss_client.place_order(symbol, quantity, "SELL", market_price)

                                # 의사결정 로그에 기록
                                try:
                                    self.decision_logger.log_event(
                                        "EMERGENCY_LIQUIDATION",
                                        {
                                            "symbol": symbol,
                                            "quantity": quantity,
                                            "price": market_price,
                                            "reason": "현금 부족 자동 매도",
                                            "market": "US"
                                        }
                                    )
                                except Exception as e:
                                    logger.error(f"⚠️ 자동 매도 로그 오류: {e}")
                            except Exception as e:
                                logger.error(f"⚠️ Toss 자동 매도 오류 ({symbol}): {e}")

                # 자동 매도 후 나머지 사이클은 스킵 (재잔고 조회를 위해 다음 사이클에서 진행)
                logger.info("⏸️  현금 부족 자동 매도 완료. 다음 사이클에서 재거래 검토")
                return

            # 4️⃣ Orchestrator 거래 사이클 실행 (시장 국면 정보 전달)
            # 주의: watchlist에 시장 정보(market: KR/US)가 포함되어 있으므로
            # orchestrator 내부에서 시장별로 올바른 현금 기준을 사용해야 함
            logger.info("🤖 Orchestrator 거래 사이클 시작...")
            logger.info(f"   📋 종목당 현금 기준:")
            logger.info(f"      - 한국(KR): ₩{kis_cash:,.0f}")
            logger.info(f"      - 미국(US): ₩{toss_cash_krw:,.0f}")

            cycle_record = await self.orchestrator.run_trading_cycle(
                watchlist=watchlist,
                portfolio_value=portfolio_value,
                current_positions=kis_balance.get('holdings', []) if kis_balance else [],
                # 분리된 현금 정보 (orchestrator는 종목의 market 필드로 판단)
                kis_available_cash=kis_cash,
                toss_available_cash=toss_cash_krw,
                pending_symbols=toss_pending_symbols,  # pending 종목 전달
                # ✨ 새로운 파라미터: 시장 국면 정보
                market_regime_kr=market_regime_kr_result.get('regime'),
                market_regime_us=market_regime_us_result.get('regime')
            )

            # 4. 거래 기록 저장
            successful_trades = [t for t in cycle_record.executed_trades if t.get('status') == 'SUCCESS']
            logger.info(f"✅ 사이클 완료: {len(successful_trades)}건의 거래 성공")

            # 거래 결과를 로그에 기록
            for trade in successful_trades:
                try:
                    self.decision_logger.log_event(
                        "ORDER_EXECUTED",
                        {
                            "symbol": trade.get('symbol'),
                            "side": trade.get('side'),
                            "quantity": trade.get('quantity'),
                            "price": trade.get('price'),
                            "order_id": trade.get('order_id'),
                            "market_regime_kr": market_regime_kr_result.get('regime'),
                            "market_regime_us": market_regime_us_result.get('regime')
                        }
                    )
                except Exception as e:
                    logger.error(f"⚠️ 거래 로그 기록 오류: {e}")

            print(f"{'='*70}\n")

        except Exception as e:
            logger.error(f"❌ 사이클 실행 오류: {e}", exc_info=True)

    async def start(self, interval_seconds: int = 60) -> None:
        """자동매매 시스템 시작"""
        try:
            # 1️⃣ 중복 실행 방지: 락 파일로 단일 인스턴스 확인
            if not ProcessGuard.acquire_lock():
                logger.error("❌ 이미 다른 MainTradingSystem이 실행 중입니다. 시작 취소.")
                print("❌ 이미 다른 MainTradingSystem이 실행 중입니다. 시작 취소.")
                return

            if not await self.initialize():
                logger.error("❌ 시스템 초기화 실패")
                ProcessGuard.release_lock()  # 정리
                return

            self.running = True
            logger.info(f"🚀 자동매매 시스템 시작 (간격: {interval_seconds}초)")
            print(f"\n{'='*70}")
            print(f"🎯 AI 자동매매 시스템 STARTED")
            print(f"{'='*70}")

            while self.running:
                try:
                    await self.run_cycle()
                    await asyncio.sleep(interval_seconds)
                except KeyboardInterrupt:
                    logger.info("🛑 사용자 중지 신호 받음")
                    break
                except Exception as e:
                    logger.error(f"❌ 사이클 오류: {e}")
                    await asyncio.sleep(interval_seconds)

        except Exception as e:
            logger.error(f"❌ 시스템 오류: {e}", exc_info=True)
        finally:
            await self.stop()

    async def stop(self) -> None:
        """자동매매 시스템 중지"""
        self.running = False
        await self.kis_client.close()
        await self.toss_client.close()

        # 2️⃣ 락 파일 정리
        ProcessGuard.release_lock()

        logger.info("⏹️  자동매매 시스템 중지 완료")

    # ==================== OrderEngine 역할 ====================

    async def place_order(
        self,
        symbol: str,
        quantity: float,
        side: str = "BUY",
        price: float = 0.0
    ) -> Optional[Dict]:
        """주문 실행 (리스크팀 승인 필수)"""
        try:
            # 1️⃣ 현재 포트폴리오 상태 조회 (시장별 분리)
            kis_balance = await self.kis_client.get_balance()
            toss_balance = await self.toss_client.get_account_balance()

            # ✅ 시장별 현금 분리
            kis_cash_krw = kis_balance.get('cash', 0) if kis_balance else 0
            toss_cash_krw = toss_balance.get('cash', 0) if toss_balance else 0
            toss_cash_usd = toss_balance.get('cash_usd', 0) if toss_balance else 0  # ✅ USD 추가

            # ✅ 시장별 포트폴리오 값 (원화 기준)
            kis_total_value = kis_balance.get('total_value', 0) if kis_balance else 0
            toss_total_value = toss_balance.get('total_value', 0) if toss_balance else 0
            portfolio_value_krw = kis_total_value + toss_total_value  # 원화 총액 (분리 목적)

            # 2. 일일 리셋 확인
            today = datetime.now().date()
            if self.last_trade_date and self.last_trade_date != today:
                self.daily_loss_krw = 0.0
                self.daily_trades_count = 0
                logger.info("📅 일일 통계 리셋")
            self.last_trade_date = today

            # 3. 리스크팀 승인 요청 (시장별 현금 분리 전달)
            market = "KR" if symbol.isdigit() else "US"
            toss_read_only = toss_balance.get('read_only', False) if toss_balance else False

            # 현재 포지션 수집
            positions = {}
            if kis_balance and kis_balance.get('holdings'):
                for h in kis_balance['holdings']:
                    positions[h.get('PDNO')] = int(h.get('HLDG_QTY', 0))
            if toss_balance and toss_balance.get('holdings'):
                for h in toss_balance['holdings']:
                    positions[h.get('symbol')] = float(h.get('quantity', 0))

            risk_result = await self.risk_agent.validate_order(
                symbol=symbol,
                quantity=quantity,
                side=side,
                price=price,
                market=market,
                kis_cash_krw=kis_cash_krw,  # ✅ 한국 현금
                toss_cash_krw=toss_cash_krw,  # ✅ 미국 계좌 원화 현금
                toss_cash_usd=toss_cash_usd,  # ✅ 미국 계좌 USD 현금
                portfolio_value_krw=portfolio_value_krw,  # 포트폴리오 총액 (참고용)
                current_positions=positions,
                daily_trades_count=self.daily_trades_count,
                daily_loss_krw=self.daily_loss_krw,
                toss_read_only=toss_read_only
            )

            # 4. 리스크팀 거절 시 주문 중단
            if not risk_result.get("approved"):
                logger.warning(f"⚠️ 리스크팀 거절: {symbol} {side} - {risk_result.get('reason')} (레벨: {risk_result.get('risk_level')})")

                # 의사결정 로그에 거절 기록
                try:
                    self.decision_logger.log_event(
                        "ORDER_REJECTED",
                        {
                            "symbol": symbol,
                            "side": side,
                            "quantity": quantity,
                            "price": price,
                            "reason": risk_result.get("reason"),
                            "risk_level": risk_result.get("risk_level"),
                            "market": market
                        }
                    )
                except Exception as e:
                    logger.error(f"⚠️ 거절 로그 기록 오류: {e}")

                return {
                    "status": "REJECTED",
                    "reason": risk_result.get("reason"),
                    "risk_level": risk_result.get("risk_level"),
                    "symbol": symbol
                }

            # 5. 리스크팀 승인 후 실제 주문 실행
            logger.info(f"✅ 리스크팀 승인: {symbol} {side} {quantity}주 (신뢰도: {risk_result.get('risk_level')})")

            # 의사결정 로그에 승인 기록
            try:
                self.decision_logger.log_event(
                    "ORDER_APPROVED",
                    {
                        "symbol": symbol,
                        "side": side,
                        "quantity": quantity,
                        "price": price,
                        "risk_level": risk_result.get("risk_level"),
                        "market": market
                    }
                )
            except Exception as e:
                logger.error(f"⚠️ 승인 로그 기록 오류: {e}")

            if symbol.isdigit():
                # KIS (한국주식)
                logger.info(f"📍 KIS {side} 주문: {symbol} {quantity}주 @ ₩{price:,.0f}")
                result = await self.kis_client.buy_order(symbol, int(quantity), price) if side == "BUY" \
                    else await self.kis_client.sell_order(symbol, int(quantity), price)
            else:
                # Toss (미국주식)
                logger.info(f"📍 Toss {side} 주문: {symbol} {quantity}주 @ ${price:,.2f}")
                result = await self.toss_client.place_order(symbol, quantity, side, price)

            # 6. 거래 성공 시 일일 통계 업데이트 및 성과 기록
            if result and result.get('status') == 'SUCCESS':
                self.daily_trades_count += 1
                logger.info(f"📊 일일 거래 건수: {self.daily_trades_count}")

                # 성과 엔진에 거래 기록 (시간이 지난 후 exit_price가 결정되면 update 필요)
                try:
                    self.decision_logger.log_event(
                        "TRADE_EXECUTED",
                        {
                            "symbol": symbol,
                            "side": side,
                            "quantity": quantity,
                            "entry_price": price,
                            "order_id": result.get('order_id'),
                            "order_time": datetime.now().isoformat(),
                            "market": market,
                            "market_regime_kr": self.current_market_regime_kr.get('regime') if self.current_market_regime_kr else "UNKNOWN",
                            "market_regime_us": self.current_market_regime_us.get('regime') if self.current_market_regime_us else "UNKNOWN"
                        }
                    )
                except Exception as e:
                    logger.error(f"⚠️ 거래 기록 오류: {e}")

            return result

        except Exception as e:
            logger.error(f"❌ 주문 실행 오류: {e}", exc_info=True)
            return {"status": "ERROR", "error": str(e), "symbol": symbol}

    # ==================== Monitor 역할 ====================

    async def check_stop_loss_take_profit(self) -> None:
        """
        손절/익절 체크 + 손실 시나리오 분류 (새로운 인프라)

        기본 규칙:
        - 익절: 수익 발생 시 자동 실행
        - 손절: TradeScenarioAnalyzer로 상황 분류 후 대응
        """
        try:
            # KIS 손절/익절
            kis_balance = await self.kis_client.get_balance()
            if kis_balance and kis_balance.get('holdings'):
                for holding in kis_balance['holdings']:
                    symbol = holding.get('PDNO')
                    quantity = int(holding.get('HLDG_QTY', 0))
                    purchase_price = float(holding.get('PCHS_AVG_PRIC', 0))
                    current_price = float(holding.get('PRPR', 0))

                    if quantity > 0 and purchase_price > 0:
                        gain_loss_pct = ((current_price - purchase_price) / purchase_price) * 100

                        # ✨ 손실 시나리오 분류 (새로운 인프라)
                        if gain_loss_pct < 0:
                            logger.info(f"📍 {symbol} 손실 포지션 분석 중... ({gain_loss_pct:.2%})")

                            try:
                                scenario = await self.trade_scenario_analyzer.classify_loss_response(
                                    symbol=symbol,
                                    current_price=current_price,
                                    entry_price=purchase_price,
                                    stop_loss_price=purchase_price * 0.98,  # -2% 기본 손절가
                                    invalidation_price=purchase_price * 0.95,  # -5% 무효화 가격
                                    support_price=purchase_price * 0.99,  # -1% 지지선
                                    trendline_price=purchase_price * 0.97,  # -3% 추세선
                                    market_regime=self.current_market_regime_kr.get('regime') if self.current_market_regime_kr else "UNKNOWN"
                                )

                                response_action = scenario.get('action')
                                logger.info(f"   🔍 시나리오 분류: {scenario.get('response')} → {response_action}")
                                logger.info(f"   💡 {scenario.get('reasoning')}")

                                # 의사결정 로그에 기록
                                try:
                                    self.decision_logger.log_event(
                                        "LOSS_SCENARIO_CLASSIFIED",
                                        {
                                            "symbol": symbol,
                                            "current_price": current_price,
                                            "entry_price": purchase_price,
                                            "loss_pct": gain_loss_pct,
                                            "scenario": scenario.get('response'),
                                            "action": response_action,
                                            "reasoning": scenario.get('reasoning'),
                                            "market_regime": self.current_market_regime_kr.get('regime') if self.current_market_regime_kr else "UNKNOWN"
                                        }
                                    )
                                except Exception as e:
                                    logger.error(f"⚠️ 손실 시나리오 로그 오류: {e}")

                                # 시나리오별 대응
                                if response_action == "SELL_ALL":
                                    logger.info(f"⛔ KIS {symbol} 전량손절: {quantity}주 @ ₩{current_price:,.0f}")
                                    await self.kis_client.sell_order(symbol, quantity, current_price)
                                elif response_action == "SELL_PARTIAL":
                                    partial_qty = int(quantity * scenario.get('quantity_pct', 0.5))
                                    logger.info(f"⛔ KIS {symbol} 부분손절: {partial_qty}주 @ ₩{current_price:,.0f}")
                                    await self.kis_client.sell_order(symbol, partial_qty, current_price)
                                elif response_action == "BUY_ADD":
                                    logger.info(f"➕ KIS {symbol} 추가매수 고려: 추천 가격 ₩{scenario.get('recommendation_price', current_price):,.0f}")
                                    # 실제 추가매수는 리스크팀 승인 필요
                                elif response_action == "HOLD":
                                    logger.info(f"⏸️  KIS {symbol} 보유 (다음 사이클에서 재평가)")

                            except Exception as e:
                                logger.error(f"⚠️ 손실 시나리오 분석 오류 (기본 규칙 적용): {e}")
                                # Fallback: 기본 규칙 적용
                                if gain_loss_pct <= -2:
                                    logger.info(f"⛔ KIS {symbol} 손절: {quantity}주 @ ₩{current_price:,.0f}")
                                    await self.kis_client.sell_order(symbol, quantity, current_price)

                        # 익절 (+3%)
                        elif gain_loss_pct >= 3:
                            logger.info(f"🎯 KIS {symbol} 익절: {quantity}주 @ ₩{current_price:,.0f}")
                            await self.kis_client.sell_order(symbol, quantity, current_price)

                            # 익절 이벤트 로그
                            try:
                                self.decision_logger.log_event(
                                    "PROFIT_TAKEN",
                                    {
                                        "symbol": symbol,
                                        "quantity": quantity,
                                        "exit_price": current_price,
                                        "entry_price": purchase_price,
                                        "profit_pct": gain_loss_pct
                                    }
                                )
                            except Exception as e:
                                logger.error(f"⚠️ 익절 로그 오류: {e}")

            # Toss 손절/익절 (미국 주식)
            toss_holdings = await self.toss_client.get_holdings()
            if toss_holdings:
                for holding in toss_holdings:
                    symbol = holding.get('symbol')
                    quantity = float(holding.get('quantity', 0))
                    purchase_price = float(holding.get('purchasePrice', 0))
                    market_price = float(holding.get('marketPrice', 0))

                    if quantity > 0 and purchase_price > 0:
                        gain_loss_pct = ((market_price - purchase_price) / purchase_price) * 100

                        # ✨ 손실 시나리오 분류 (새로운 인프라) - 미국 주식
                        if gain_loss_pct < 0:
                            logger.info(f"📍 {symbol} 손실 포지션 분석 중... ({gain_loss_pct:.2%})")

                            try:
                                scenario = await self.trade_scenario_analyzer.classify_loss_response(
                                    symbol=symbol,
                                    current_price=market_price,
                                    entry_price=purchase_price,
                                    stop_loss_price=purchase_price * 0.95,  # -5% 기본 손절가 (미국주식)
                                    invalidation_price=purchase_price * 0.90,  # -10% 무효화 가격
                                    support_price=purchase_price * 0.97,  # -3% 지지선
                                    trendline_price=purchase_price * 0.93,  # -7% 추세선
                                    market_regime=self.current_market_regime_us.get('regime') if self.current_market_regime_us else "UNKNOWN"
                                )

                                response_action = scenario.get('action')
                                logger.info(f"   🔍 시나리오 분류: {scenario.get('response')} → {response_action}")
                                logger.info(f"   💡 {scenario.get('reasoning')}")

                                # 의사결정 로그에 기록
                                try:
                                    self.decision_logger.log_event(
                                        "LOSS_SCENARIO_CLASSIFIED",
                                        {
                                            "symbol": symbol,
                                            "current_price": market_price,
                                            "entry_price": purchase_price,
                                            "loss_pct": gain_loss_pct,
                                            "scenario": scenario.get('response'),
                                            "action": response_action,
                                            "reasoning": scenario.get('reasoning'),
                                            "market_regime": self.current_market_regime_us.get('regime') if self.current_market_regime_us else "UNKNOWN"
                                        }
                                    )
                                except Exception as e:
                                    logger.error(f"⚠️ 손실 시나리오 로그 오류: {e}")

                                # 시나리오별 대응
                                if response_action == "SELL_ALL":
                                    logger.info(f"⛔ Toss {symbol} 전량손절: {quantity}주 @ ${market_price:,.2f}")
                                    await self.toss_client.place_order(symbol, quantity, "SELL", market_price)
                                elif response_action == "SELL_PARTIAL":
                                    partial_qty = quantity * scenario.get('quantity_pct', 0.5)
                                    logger.info(f"⛔ Toss {symbol} 부분손절: {partial_qty}주 @ ${market_price:,.2f}")
                                    await self.toss_client.place_order(symbol, partial_qty, "SELL", market_price)
                                elif response_action == "BUY_ADD":
                                    logger.info(f"➕ Toss {symbol} 추가매수 고려: 추천 가격 ${scenario.get('recommendation_price', market_price):,.2f}")
                                    # 실제 추가매수는 리스크팀 승인 필요
                                elif response_action == "HOLD":
                                    logger.info(f"⏸️  Toss {symbol} 보유 (다음 사이클에서 재평가)")

                            except Exception as e:
                                logger.error(f"⚠️ 손실 시나리오 분석 오류 (기본 규칙 적용): {e}")
                                # Fallback: 기본 규칙 적용
                                if gain_loss_pct <= -5:
                                    logger.info(f"⛔ Toss {symbol} 손절: {quantity}주 @ ${market_price:,.2f}")
                                    await self.toss_client.place_order(symbol, quantity, "SELL", market_price)

                        # 익절 (+10%)
                        elif gain_loss_pct >= 10:
                            logger.info(f"🎯 Toss {symbol} 익절: {quantity}주 @ ${market_price:,.2f}")
                            await self.toss_client.place_order(symbol, quantity, "SELL", market_price)

                            # 익절 이벤트 로그
                            try:
                                self.decision_logger.log_event(
                                    "PROFIT_TAKEN",
                                    {
                                        "symbol": symbol,
                                        "quantity": quantity,
                                        "exit_price": market_price,
                                        "entry_price": purchase_price,
                                        "profit_pct": gain_loss_pct
                                    }
                                )
                            except Exception as e:
                                logger.error(f"⚠️ 익절 로그 오류: {e}")

        except Exception as e:
            logger.error(f"❌ 손절/익절 체크 오류: {e}")


async def main():
    """메인 실행"""
    system = MainTradingSystem()
    await system.start(interval_seconds=60)  # 60초마다 실행


if __name__ == "__main__":
    asyncio.run(main())
