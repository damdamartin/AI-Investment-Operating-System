"""
AI 총괄 관리자(Orchestrator) - 4팀의 신호를 수집하고 최종 거래 결정을 내립니다.
리서치팀, 종목분석팀, 매매전략팀, 리스크관리팀의 의견을 통합해서 최종 신호를 결정합니다.
"""

import json
import logging
from datetime import datetime, time
from typing import List, Dict, Any, Optional
import asyncio
from dataclasses import dataclass

# ========== 새로운 인프라 임포트 ==========
from .market_regime_detector import MarketRegimeDetector
from .team_weight_manager import TeamWeightManager
from .trade_scenario import TradeScenarioAnalyzer
from .decision_logger import DecisionLogger

# ========== 로거 설정 ==========
logger = logging.getLogger(__name__)


@dataclass
class CycleRecord:
    """매매 사이클 기록 - AI Hedge Fund v2 개념 차용"""
    cycle_id: str
    timestamp: datetime
    symbols_analyzed: List[str]
    research_signals: Dict[str, Any]
    analysis_signals: Dict[str, Any]
    strategy_signals: Dict[str, Any]
    final_signals: Dict[str, Any]
    executed_trades: List[Dict]
    portfolio_state: Dict[str, Any]
    performance_metrics: Dict[str, Any]


class AIOrchestrator:
    """
    AI 총괄 관리자
    - 4팀의 신호를 수집
    - 가중 앙상블로 최종 신호 결정
    - 거래 실행
    - 성과 평가
    """

    def __init__(self):
        # ========== 기본 에이전트 ==========
        self.research_agent = None
        self.analysis_agent = None
        self.strategy_agent = None
        self.watchlist_manager = None
        self.order_engine = None
        self.monitor = None
        self.kis_client = None
        self.toss_client = None
        self.naver_news_client = None
        self.price_service = None  # ✅ 실제 현재가 조회용

        # ========== 새로운 인프라 인스턴스 ==========
        self.regime_detector = MarketRegimeDetector()
        self.weight_manager = TeamWeightManager()
        self.scenario_analyzer = TradeScenarioAnalyzer()
        self.decision_logger = DecisionLogger()

        # 팀별 신뢰도 가중치 (초기값)
        self.weights = {
            "research": 0.25,
            "analysis": 0.35,
            "strategy": 0.25,
            "trend": 0.15
        }

        self.cycles = []  # CycleRecord 저장
        self.current_market_regime = None  # 현재 시장 국면

        # 거래 시간 설정
        self.korea_market_open = time(9, 0)      # 09:00
        self.korea_market_close = time(15, 30)   # 15:30
        self.us_market_open = time(22, 30)       # 22:30 (겨울)
        self.us_market_close = time(5, 0)        # 05:00 (다음날)

    def set_agents(
        self,
        research_agent,
        analysis_agent,
        strategy_agent,
        watchlist_manager,
        order_engine,
        monitor,
        kis_client=None,
        toss_client=None,
        naver_news_client=None
    ):
        """각 팀의 에이전트 설정"""
        self.research_agent = research_agent
        self.analysis_agent = analysis_agent
        self.strategy_agent = strategy_agent
        self.watchlist_manager = watchlist_manager
        self.order_engine = order_engine
        self.monitor = monitor
        self.kis_client = kis_client
        self.toss_client = toss_client
        self.naver_news_client = naver_news_client

    async def run_trading_cycle(
        self,
        watchlist: List[Dict],
        portfolio_value: float,
        current_positions: Dict = None,
        available_cash: float = 0,  # deprecated: 하위호환성용
        kis_available_cash: float = 0,  # 한국 주식용 현금 (KRW)
        toss_available_cash: float = 0,  # 미국 주식용 현금 (KRW)
        pending_symbols: set = None,
        market_regime_kr: str = "SIDEWAYS",  # 한국 시장 국면
        market_regime_us: str = "SIDEWAYS"  # 미국 시장 국면
    ) -> CycleRecord:
        """
        전체 거래 사이클을 실행합니다.

        Args:
            watchlist: 분석할 종목 리스트
            portfolio_value: 포트폴리오 총액
            current_positions: 현재 보유 포지션
            available_cash: 사용 가능한 현금 (deprecated, kis_available_cash 사용 권장)
            kis_available_cash: 한국 주식용 현금 (KRW)
            toss_available_cash: 미국 주식용 현금 (KRW)

        Returns:
            CycleRecord: 이 사이클의 모든 기록
        """

        cycle_id = self._generate_cycle_id()
        cycle_start = datetime.now()
        current_positions = current_positions or {}
        available_cash = available_cash or portfolio_value * 0.1  # 기본값: 포트폴리오 10%
        pending_symbols = pending_symbols or set()  # pending 주문 종목

        print(f"\n{'='*60}")
        print(f"📊 거래 사이클 시작: {cycle_id}")
        print(f"{'='*60}")

        # ========== Step 0: 시장 국면 감지 (새로운 인프라) ==========
        print("\n[Step 0] 시장 국면 감지...")
        try:
            market_regime_result = await self.regime_detector.detect_regime(market="KR")
            market_regime = market_regime_result.get("regime", "UPTREND")
            self.current_market_regime = market_regime
            logger.info(f"🔍 시장 국면 감지: {market_regime}")
            self.decision_logger.log_event(
                event_type="MARKET_REGIME_DETECTED",
                data={
                    
                    "regime": market_regime,
                    "confidence": market_regime_result.get("confidence", 0),
                    "reason": market_regime_result.get("reason", ""),
                    "timestamp": datetime.now().isoformat()
                }
            )
            print(f"  국면: {market_regime} (신뢰도: {market_regime_result.get('confidence', 0):.2f})")
        except Exception as e:
            logger.warning(f"⚠️ 시장 국면 감지 오류: {e}, 기본값 사용")
            market_regime = "UPTREND"
            self.current_market_regime = market_regime
            print(f"  국면: {market_regime} (기본값)")

        # ========== Step 1: 각 팀의 신호 수집 (병렬 처리) ==========
        print("\n[Step 1] 신호 생성...")
        research_signals = await self._collect_research_signals(watchlist)
        analysis_signals = await self._collect_analysis_signals(watchlist)
        strategy_signals = await self._collect_strategy_signals(
            watchlist, research_signals, analysis_signals, portfolio_value, available_cash
        )

        # 팀별 신호 로깅
        for symbol in research_signals.keys():
            strategy_signal = strategy_signals.get(symbol, {})
            strategy_action = (
                strategy_signal.side if hasattr(strategy_signal, 'side')  # OrderIntent 객체
                else strategy_signal.get("action")  # dict
            )
            self.decision_logger.log_event(
                event_type="TEAM_SIGNAL_CREATED",
                data={
                    "symbol": symbol,
                    "research": research_signals.get(symbol, {}).get("signal"),
                    "analysis": analysis_signals.get(symbol, {}).get("signal"),
                    "strategy": strategy_action
                }
            )

        # ========== Step 2: 신호 통합 (앙상블) ==========
        print("\n[Step 2] 신호 앙상블...")
        final_signals = self._ensemble_signals(
            research_signals,
            analysis_signals,
            strategy_signals,
            market_regime=market_regime,  # 시장 국면 전달
            available_cash=available_cash,  # 하위호환성
            kis_available_cash=kis_available_cash,  # 한국 주식용
            toss_available_cash=toss_available_cash  # 미국 주식용
        )

        # ========== Step 3: 워치리스트 업데이트 ==========
        print("\n[Step 3] 워치리스트 업데이트...")

        # 선정된 종목 로깅
        for symbol, signal in final_signals.items():
            if signal.get("signal") == "BUY":
                self.decision_logger.log_event(
                    event_type="WATCHLIST_SELECTED",
                    
                    data={
                        "symbol": symbol,
                        "confidence": signal.get("confidence"),
                        "quantity": signal.get("quantity")
                    }
                )

        watchlist_update = await self._update_watchlist(
            watchlist, final_signals, current_positions
        )

        # 4단계: 거래 실행
        print("\n[Step 4] 거래 실행...")
        if final_signals:
            for symbol, signal in final_signals.items():
                signal_info = f"{symbol}: {signal.get('signal')} (신뢰도: {signal.get('confidence'):.2f}, 수량: {signal.get('quantity', 0)})"
                print(f"  {signal_info}")
                import logging
                logging.getLogger(__name__).info(f"📊 신호 {signal_info}")
        else:
            print("  신호 없음")

        executed_trades = await self._execute_trades(final_signals, portfolio_value, pending_symbols)

        # 5단계: 성과 평가
        print("\n[Step 5] 성과 평가...")
        performance = await self._evaluate_performance(executed_trades)

        # 사이클 기록 저장
        cycle = CycleRecord(
            cycle_id=cycle_id,
            timestamp=cycle_start,
            symbols_analyzed=[s.get("code") for s in watchlist],
            research_signals=research_signals,
            analysis_signals=analysis_signals,
            strategy_signals=strategy_signals,
            final_signals=final_signals,
            executed_trades=executed_trades,
            portfolio_state={
                "portfolio_value": portfolio_value,
                "positions": current_positions
            },
            performance_metrics=performance
        )

        self.cycles.append(cycle)

        print(f"\n✅ 거래 사이클 완료: {len(executed_trades)}건의 거래 실행")
        print(f"{'='*60}\n")

        return cycle

    async def _collect_research_signals(self, watchlist: List[Dict]) -> Dict[str, Any]:
        """리서치팀 신호 수집"""

        if not self.research_agent:
            return {}

        signals = {}
        for symbol_info in watchlist:
            # 네이버 뉴스 조회 (있으면)
            recent_news = None
            if self.naver_news_client:
                try:
                    recent_news = await self.naver_news_client.get_symbol_news(
                        symbol_info.get("code"),
                        symbol_info.get("name")
                    )
                except:
                    recent_news = None

            signal = await self.research_agent.analyze_symbol(
                symbol_info.get("code"),
                symbol_info.get("name"),
                recent_news=recent_news
            )
            signals[symbol_info.get("code")] = signal

        return signals

    async def _collect_analysis_signals(self, watchlist: List[Dict]) -> Dict[str, Any]:
        """종목분석팀 신호 수집"""

        if not self.analysis_agent:
            return {}

        signals = {}
        for symbol_info in watchlist:
            symbol = symbol_info.get("code")
            market = symbol_info.get("market", "KR")

            # 실제 현재가 조회
            current_price = 0
            if market == "KR" and self.kis_client:
                # KIS 한국 주식
                current_price = await self.kis_client.get_stock_price(symbol)
            elif market == "USD" and self.toss_client:
                # Toss 미국 주식 - 프리매켓 데이터 활용
                try:
                    holdings = await self.toss_client.get_holdings()
                    for holding in holdings:
                        if holding.get("symbol") == symbol:
                            current_price = float(holding.get("marketPrice", 0))
                            break
                except:
                    current_price = 0

            # 가격 정보 없으면 기본값 사용
            if not current_price or current_price == 0:
                current_price = 50000 if market == "KR" else 150

            signal = await self.analysis_agent.analyze_symbol(
                symbol,
                symbol_info.get("name"),
                current_price=current_price,
            )
            signals[symbol] = signal

        return signals

    async def _collect_strategy_signals(
        self,
        watchlist: List[Dict],
        research_signals: Dict,
        analysis_signals: Dict,
        portfolio_value: float,
        available_cash: float = 0
    ) -> Dict[str, Any]:
        """매매전략팀 신호 수집"""

        if not self.strategy_agent:
            return {}

        signals = {}
        for symbol_info in watchlist:
            code = symbol_info.get("code")

            if code not in research_signals or code not in analysis_signals:
                continue

            # 분석 신호에서 현재가 추출 (실제 조회된 가격)
            current_price = analysis_signals[code].get("current_price", 0)
            market = symbol_info.get("market", "KR")

            strategy = self.strategy_agent.generate_trade_plan(
                symbol=code,
                symbol_name=symbol_info.get("name"),
                market=market,
                research_signal=research_signals[code],
                analysis_signal=analysis_signals[code],
                current_price=current_price,
                portfolio_value=portfolio_value,
                available_cash=available_cash
            )
            signals[code] = strategy

        return signals

    def _ensemble_signals(
        self,
        research_signals: Dict,
        analysis_signals: Dict,
        strategy_signals: Dict,
        market_regime: str = None,  # 시장 국면
        available_cash: float = 0,  # deprecated
        kis_available_cash: float = 0,  # 한국 주식용 현금
        toss_available_cash: float = 0  # 미국 주식용 현금
    ) -> Dict[str, Any]:
        """
        다중 신호를 가중 앙상블로 통합합니다.

        market_regime에 따라 weight_manager에서 동적으로 가중치를 조회합니다.
        kis_available_cash와 toss_available_cash를 사용하여
        종목별 시장(KR/US)에 맞는 현금 기준을 적용합니다.
        """

        final_signals = {}

        # ========== 시장 국면 기반 가중치 조회 ==========
        if market_regime:
            regime_weights = self.weight_manager.get_weights(market_regime)
            logger.info(f"📊 {market_regime} 국면 가중치 적용: {regime_weights}")
            self.weights = regime_weights
        else:
            logger.warning("⚠️ 시장 국면 정보 없음, 기본 가중치 사용")

        # 공통 종목만 처리
        common_symbols = set(research_signals.keys()) & set(analysis_signals.keys())

        for symbol in common_symbols:
            research = research_signals.get(symbol, {})
            analysis = analysis_signals.get(symbol, {})
            strategy_raw = strategy_signals.get(symbol, {})

            # OrderIntent를 dict로 변환
            if hasattr(strategy_raw, 'to_dict'):  # OrderIntent 객체
                strategy = strategy_raw.to_dict()
            else:  # 이미 dict
                strategy = strategy_raw

            market = strategy.get("market", "KR")

            # 시장별로 올바른 현금 적용
            market_cash = kis_available_cash if market == "KR" else toss_available_cash

            # 거래 시간 필터링
            if market == "US" and not self._is_us_market_open():
                # 미국 주식 시간 아님 → HOLD
                final_signals[symbol] = {
                    "signal": "HOLD",
                    "reason": "US market closed",
                    "confidence": 0.0,
                    "quantity": 0
                }
                continue

            if market == "KR" and not self._is_korea_market_open():
                # 한국 주식 시간 아님 → HOLD
                final_signals[symbol] = {
                    "signal": "HOLD",
                    "reason": "Korea market closed",
                    "confidence": 0.0,
                    "quantity": 0
                }
                continue

            # 신호를 점수로 변환
            research_score = self._signal_to_score(research.get("signal"))
            analysis_score = self._signal_to_score(analysis.get("signal"))

            # strategy는 이미 dict로 변환됨
            strategy_action = strategy.get("side") or strategy.get("action", "HOLD")  # OrderIntent는 'side', dict는 'action'
            strategy_score = self._signal_to_score(strategy_action)

            # ========== 동적 가중치 기반 가중 평균 ==========
            ensemble_score = (
                research_score * self.weights.get("research", 0.25) +
                analysis_score * self.weights.get("analysis", 0.35) +
                strategy_score * self.weights.get("strategy", 0.25)
            )

            # 점수를 신호로 변환 (SIDEWAYS 시장에서도 거래 가능하도록 임계값 조정)
            if ensemble_score >= 0.60:  # BUY 임계값 낮춤 (0.65 → 0.60)
                final_signal = "BUY"
            elif ensemble_score <= 0.40:  # SELL 임계값 올림 (0.35 → 0.40)
                final_signal = "SELL"
            else:
                # SIDEWAYS 시장에서는 neutral 신호로도 거래 가능 (0.45~0.55)
                if 0.45 <= ensemble_score <= 0.55:
                    final_signal = "BUY"  # 중립 신호도 BUY로 진입 (소규모 거래)
                else:
                    final_signal = "HOLD"

            # 수량 조정: 시장별 현금 잔고 기반으로 최대 수량 제한
            # strategy는 이미 dict로 변환됨 (OrderIntent.to_dict() 또는 원본 dict)
            quantity = strategy.get("intent_quantity") or strategy.get("quantity", 0)
            entry_price = strategy.get("reference_price") or strategy.get("entry_price", 0)

            if final_signal == "BUY" and entry_price > 0:
                # 수량이 0이면 현금의 10%로 자동 계산
                if quantity == 0:
                    quantity = int((market_cash * 0.1) / entry_price)

                # 현금으로 구매 가능한 최대 수량 제한
                max_quantity = int(market_cash / entry_price)
                quantity = min(quantity, max_quantity)

                # 수량이 0이면 주문하지 않음 (1주 강제 금지)
                if quantity < 1:
                    quantity = 0  # 주문 없음 → HOLD 신호로 변경됨

            final_signals[symbol] = {
                "signal": final_signal,
                "ensemble_score": ensemble_score,
                "confidence": abs(ensemble_score - 0.5) * 2,
                "quantity": quantity,
                "entry_price": entry_price,
                "stop_loss_price": strategy.get("stop_loss_price", 0),
                "take_profit_price": strategy.get("take_profit_price", 0),
                "components": {
                    "research": research.get("signal"),
                    "analysis": analysis.get("signal"),
                    "strategy": strategy.get("action")
                }
            }

        return final_signals

    async def _update_watchlist(
        self,
        current_watchlist: List[Dict],
        signals: Dict,
        current_positions: Dict
    ) -> Dict[str, Any]:
        """워치리스트 동적 업데이트"""

        if not self.watchlist_manager:
            return {"watchlist": current_watchlist}

        # 신호를 리스트 형식으로 변환
        signal_list = [
            {
                "symbol": symbol,
                "signal": data.get("signal"),
                "confidence": data.get("confidence", 0)
            }
            for symbol, data in signals.items()
        ]

        update_result = self.watchlist_manager.update_watchlist(
            current_watchlist, signal_list
        )

        return update_result

    async def _execute_trades(
        self,
        signals: Dict,
        portfolio_value: float,
        pending_symbols: set = None
    ) -> List[Dict]:
        """
        최종 신호를 기반으로 거래를 실행하고, 손실 대응을 처리합니다.
        """

        if not self.order_engine:
            return []

        executed_trades = []

        for symbol, signal_data in signals.items():
            if signal_data.get("signal") != "BUY":
                continue

            # 거래 정보 추출
            quantity = signal_data.get("quantity", 0)
            entry_price = signal_data.get("entry_price", 0)
            confidence = signal_data.get("confidence", 0)
            stop_loss_price = signal_data.get("stop_loss_price", 0)
            take_profit_price = signal_data.get("take_profit_price", 0)

            # 신뢰도 낮으면 스킵 (confidence < 0.0) - 모든 신호 거래 활성화!
            if confidence < 0.0 or quantity == 0 or entry_price == 0:
                continue

            # pending 종목 확인 (중복 주문 방지)
            if pending_symbols and symbol in pending_symbols:
                print(f"⏳ {symbol}: 이미 pending 주문이 있습니다. 스킵")
                continue

            # ⚠️ 실제 거래 실행 전: entry_price 최종 검증
            try:
                # ✅ 1. entry_price 기본값 검증
                if not entry_price or entry_price <= 0:
                    logger.error(f"❌ 주문 금지: {symbol} 유효하지 않은 가격 (price={entry_price})")
                    self.decision_logger.log_event(
                        event_type="ORDER_REJECTED",
                        data={"symbol": symbol, "reason": "Invalid price", "price": entry_price}
                    )
                    continue

                # ✅ 2. fallback 기본값 감지 (50000, 150, 100000 등)
                if entry_price in [50000, 150, 100000, 1000, 10000]:
                    logger.error(
                        f"❌ 주문 금지: {symbol} 기본값 가격 감지 (price={entry_price}) - "
                        f"실시간 현재가 조회 실패"
                    )
                    self.decision_logger.log_event(
                        event_type="ORDER_REJECTED",
                        data={"symbol": symbol, "reason": "Fallback price detected", "price": entry_price}
                    )
                    continue

                # ✅ 3. 실제 현재가 재확인 (price_service 사용 가능 시)
                if self.price_service:
                    market = "KR" if symbol.isdigit() else "US"
                    price_data = await self.price_service.get_current_price(symbol, market)
                    if price_data and price_data.get("price"):
                        actual_price = price_data.get("price")
                        if abs(actual_price - entry_price) / entry_price > 0.10:  # 10% 이상 차이
                            logger.warning(
                                f"⚠️ 가격 갭 감지: {symbol} "
                                f"({entry_price} → {actual_price}) - 최신 가격 적용"
                            )
                            entry_price = actual_price

                # ========== 주문 인텐트 로깅 ==========
                self.decision_logger.log_event(
                    event_type="ORDER_INTENT_CREATED",
                    data={
                        "symbol": symbol,
                        "quantity": quantity,
                        "side": "BUY",
                        "price": entry_price,
                        "confidence": confidence
                    }
                )

                # ========== 리스크 결정 로깅 ==========
                self.decision_logger.log_event(
                    event_type="RISK_DECISION_CREATED",
                    data={
                        "symbol": symbol,
                        "entry_price": entry_price,
                        "stop_loss_price": stop_loss_price,
                        "take_profit_price": take_profit_price,
                        "risk_level": "MEDIUM" if confidence > 0.6 else "LOW"
                    }
                )

                result = await self.order_engine.place_order(
                    symbol=symbol,
                    quantity=quantity,
                    side="BUY",
                    price=entry_price  # 검증된 현재가
                )

                # 주문 성공 여부 확인 (Toss는 {"success": True/False}로 반환)
                is_success = result and result.get('success', False) if isinstance(result, dict) else bool(result)

                trade = {
                    "symbol": symbol,
                    "action": "BUY",
                    "quantity": quantity,
                    "price": entry_price,
                    "confidence": confidence,
                    "order_result": result,
                    "timestamp": datetime.now().isoformat(),
                    "status": "SUCCESS" if is_success else "FAILED"
                }

                if is_success:  # 성공한 거래만 추가
                    executed_trades.append(trade)
                    logger.info(f"✅ 주문 실행: {symbol} {quantity}주 @ {entry_price}")
                    self.decision_logger.log_event(
                        event_type="ORDER_EXECUTED",
                        data={
                            "symbol": symbol,
                            "quantity": quantity,
                            "price": entry_price,
                            "confidence": confidence
                        }
                    )
                else:
                    logger.warning(f"⚠️ 주문 실패: {symbol}")
                    self.decision_logger.log_event(
                        event_type="ORDER_REJECTED",
                        data={"symbol": symbol, "reason": "Order execution failed"}
                    )

            except Exception as e:
                print(f"❌ 거래 실행 오류 ({symbol}): {e}")
                logger.error(f"❌ 거래 실행 오류 ({symbol}): {e}")
                self.decision_logger.log_event(
                    event_type="ORDER_REJECTED",
                    data={"symbol": symbol, "reason": f"Exception: {str(e)}"}
                )

        # ========== 손실 대응 로직 (거래 실행 후) ==========
        await self._monitor_and_handle_losses(executed_trades)

        return executed_trades

    async def _monitor_and_handle_losses(self, executed_trades: List[Dict]) -> None:
        """
        거래 후 포지션을 모니터링하고 손실 대응을 처리합니다.
        """

        if not executed_trades or not self.scenario_analyzer:
            return

        for trade in executed_trades:
            symbol = trade.get("symbol")
            entry_price = trade.get("price")
            quantity = trade.get("quantity")

            # ========== 현재 포지션 정보 조회 ==========
            # 실제 구현에서는 현재가 조회 필요
            current_price = entry_price * 0.98  # 임시: 매입가 대비 2% 손실로 가정

            try:
                # ========== 손실 시나리오 분류 ==========
                # classify_loss_response()는 async 메서드이고, current_price가 필수
                loss_response = await self.scenario_analyzer.classify_loss_response(
                    symbol=symbol,
                    current_price=current_price,
                    entry_price=entry_price,
                    stop_loss_price=entry_price * 0.95,  # 기본값: 진입가 대비 5% 손절
                    market_regime=self.current_market_regime
                )

                if loss_response:
                    scenario = loss_response.get("scenario")
                    action = loss_response.get("action")
                    logger.info(f"📊 {symbol} 손실 대응 시나리오: {scenario} → {action}")

                    self.decision_logger.log_event(
                        event_type="LOSS_RESPONSE_TRIGGERED",
                        data={
                            "symbol": symbol,
                            "scenario": scenario,
                            "action": action,
                            "current_price": current_price,
                            "entry_price": entry_price,
                            "unrealized_loss": (current_price - entry_price) * quantity,
                            "details": loss_response
                        }
                    )

                    # ========== 시나리오별 처리 ==========
                    if "ADD_BUY" in scenario:
                        logger.info(f"💰 추가매수 권고: {symbol}")
                        # TODO: 추가 매수 로직 구현
                    elif "PARTIAL_CUT" in scenario:
                        logger.info(f"📉 부분손절 권고: {symbol}")
                        # TODO: 부분손절 로직 구현
                    elif "FULL_CUT" in scenario:
                        logger.info(f"🚨 전량손절 권고: {symbol}")
                        # TODO: 전량손절 로직 구현
                    else:
                        logger.info(f"⏸️ {symbol} 대기 중: {action}")

            except Exception as e:
                logger.error(f"❌ 손실 대응 처리 오류 ({symbol}): {e}")

    async def _evaluate_performance(
        self,
        executed_trades: List[Dict]
    ) -> Dict[str, Any]:
        """
        성과를 평가하고 팀별 정확도를 계산합니다.
        """

        if not executed_trades:
            return {
                "trades_count": 0,
                "success_rate": 0,
                "avg_return": 0,
                "team_scores": {}
            }

        # 추후 실제 거래 결과와 비교해서 정확도 계산
        return {
            "trades_count": len(executed_trades),
            "success_rate": 0,  # 추후 계산
            "avg_return": 0,    # 추후 계산
            "team_scores": {
                "research": 0.5,
                "analysis": 0.5,
                "strategy": 0.5
            }
        }

    def update_weights(self, new_weights: Dict[str, float]) -> None:
        """
        팀의 가중치를 업데이트합니다.
        성과평가 결과에 따라 자동으로 조정됩니다.
        """

        total = sum(new_weights.values())
        self.weights = {k: v / total for k, v in new_weights.items()}

        print(f"✅ 가중치 업데이트:")
        for team, weight in self.weights.items():
            print(f"   {team}: {weight:.1%}")

    def _signal_to_score(self, signal: str) -> float:
        """신호를 점수로 변환 (0~1)"""

        signal_map = {
            "BUY": 1.0,
            "HOLD": 0.5,
            "SELL": 0.0,
            None: 0.5
        }

        return signal_map.get(signal, 0.5)

    def _is_korea_market_open(self) -> bool:
        """한국 주식 시장 거래 시간 여부"""
        now = datetime.now().time()
        is_weekday = datetime.now().weekday() < 5  # 월~금
        return is_weekday and self.korea_market_open <= now <= self.korea_market_close

    def _is_us_market_open(self) -> bool:
        """미국 주식 시장 거래 시간 여부"""
        now = datetime.now().time()
        is_weekday = datetime.now().weekday() < 5  # 월~금
        # 22:30 ~ 05:00 (다음날)
        return is_weekday and (now >= self.us_market_open or now <= self.us_market_close)

    def _generate_cycle_id(self) -> str:
        """사이클 ID 생성"""
        return f"CYCLE_{datetime.now().strftime('%Y%m%d%H%M%S')}"

    def get_cycle_history(self, limit: int = 10) -> List[CycleRecord]:
        """사이클 기록 조회"""
        return self.cycles[-limit:]

    def generate_daily_report(self) -> Dict[str, Any]:
        """일일 리포트 생성"""

        today_cycles = [c for c in self.cycles if c.timestamp.date() == datetime.now().date()]

        if not today_cycles:
            return {"status": "no_data"}

        total_trades = sum(len(c.executed_trades) for c in today_cycles)
        total_pnl = 0  # 실제로는 P&L 계산

        return {
            "date": datetime.now().isoformat(),
            "cycles_count": len(today_cycles),
            "total_trades": total_trades,
            "total_pnl": total_pnl,
            "team_performance": self._calculate_team_performance(today_cycles)
        }

    def _calculate_team_performance(self, cycles: List[CycleRecord]) -> Dict[str, Any]:
        """팀별 성과 계산"""

        return {
            "research": {"accuracy": 0, "signals": 0},
            "analysis": {"accuracy": 0, "signals": 0},
            "strategy": {"accuracy": 0, "signals": 0}
        }


if __name__ == "__main__":
    orchestrator = AIOrchestrator()
    print("AI 총괄 관리자(Orchestrator)가 준비되었습니다.")
