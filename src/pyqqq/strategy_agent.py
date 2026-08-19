"""
매매전략팀 에이전트 - 진입/손절/익절, 목표가, 포지션 크기 결정
각 신호를 실제 거래 액션으로 변환합니다.
"""

import os
import json
import asyncio
from datetime import datetime
from typing import Optional, Dict, Any
import anthropic

# 팀장 추가: 데이터 소스 및 API 비용 관리 통합
try:
    from .data_source_manager import DataSourceManager
except ImportError:
    DataSourceManager = None

try:
    from .api_cost_manager import APICallWrapper
except ImportError:
    APICallWrapper = None

from .config import settings
from .order_intent import OrderIntent, OrderIntentBuilder

class StrategyAgent:
    def __init__(self, data_source_manager=None, api_wrapper=None):
        self.client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
        self.model = settings.claude_model

        # 팀장 추가: 데이터 소스와 API 래퍼 주입
        self.data_source = data_source_manager
        if api_wrapper:
            self.api_wrapper = api_wrapper
        elif APICallWrapper:
            self.api_wrapper = APICallWrapper(self.client)
        else:
            self.api_wrapper = None

        # 마켓별 설정 (소규모 계좌 최적화)
        self.market_config = {
            "KR": {  # 한국주식 - 현금 적극 활용
                "stop_loss_pct": 0.02,      # -2%
                "take_profit_pct": 0.03,   # +3%
                "position_size_pct": 0.50, # 포트폴리오 50% (현금 전체 활용)
                "max_concurrent": 3,       # 최대 3개 동시 진입
            },
            "US": {  # 미국주식 - 적극적
                "stop_loss_pct": 0.05,     # -5%
                "take_profit_pct": 0.10,   # +10%
                "position_size_pct": 0.80, # 포트폴리오 80% (현금 전체 활용)
                "max_concurrent": 5,       # 최대 5개 동시 진입
            }
        }

    def _calculate_technical_levels(
        self,
        current_price: float,
        analysis_signal: dict
    ) -> tuple:
        """
        기술적 지표로부터 지지선, 저항선, 추세선 계산

        Returns:
            (support_price, resistance_price, trendline_price)
        """
        support_price = None
        resistance_price = None
        trendline_price = None

        # analysis_signal에서 기술적 지표 추출
        if "support" in analysis_signal:
            support_price = analysis_signal.get("support")
        else:
            # 기본값: 현재가의 -2% ~ -5%
            support_price = current_price * 0.97

        if "resistance" in analysis_signal:
            resistance_price = analysis_signal.get("resistance")
        else:
            # 기본값: 현재가의 +3% ~ +5%
            resistance_price = current_price * 1.04

        if "trendline" in analysis_signal:
            trendline_price = analysis_signal.get("trendline")
        else:
            # 기본값: 지지선과 현재가의 중간값
            trendline_price = (support_price + current_price) / 2

        return support_price, resistance_price, trendline_price

    def _determine_trade_type(
        self,
        research_signal: dict,
        analysis_signal: dict
    ) -> str:
        """
        거래 타입 결정: PULLBACK, TREND_REVERSAL, BREAKOUT, MOMENTUM
        """
        # research_signal에서 거래 타입 추출, 없으면 분석팀 신호로부터 유추
        if "trade_type" in research_signal:
            return research_signal.get("trade_type", "MOMENTUM")

        signal = research_signal.get("signal", "HOLD")

        # 단순 휴리스틱: BUY 신호라면 MOMENTUM, 분석팀의 추가 정보로 개선
        if signal == "BUY":
            # 분석팀에서 추가 정보 활용
            if "reversal" in str(analysis_signal).lower():
                return "TREND_REVERSAL"
            elif "breakout" in str(analysis_signal).lower():
                return "BREAKOUT"
            elif "pullback" in str(analysis_signal).lower():
                return "PULLBACK"
            else:
                return "MOMENTUM"
        return "MOMENTUM"

    def _determine_market_regime(
        self,
        analysis_signal: dict,
        research_signal: dict
    ) -> str:
        """
        시장 국면 결정: UPTREND, DOWNTREND, SIDEWAYS, HIGH_VOLATILITY
        """
        if "market_regime" in analysis_signal:
            return analysis_signal.get("market_regime", "SIDEWAYS")

        # research_signal의 신호로부터 유추
        signal = research_signal.get("signal", "HOLD")

        if signal == "BUY":
            return "UPTREND"
        elif signal == "SELL":
            return "DOWNTREND"
        else:
            return "SIDEWAYS"

    def generate_trade_plan(
        self,
        symbol: str,
        symbol_name: str,
        market: str,  # "KR" or "US"
        research_signal: dict,
        analysis_signal: dict,
        current_price: float = None,
        portfolio_value: float = 1000000,
        available_cash: float = 0,
        current_positions: dict = None,
        market_regime: str = None
    ) -> OrderIntent:
        """
        규칙 기반 거래 계획 - OrderIntent 반환 (Claude API 비용 절감)

        Args:
            symbol: 종목코드
            symbol_name: 종목명
            market: 시장 ("KR" 또는 "US")
            research_signal: 리서치팀 신호
            analysis_signal: 종목분석팀 신호
            current_price: 현재가
            portfolio_value: 포트폴리오 총액
            available_cash: 사용 가능 현금
            current_positions: 현재 보유 포지션
            market_regime: 시장 국면 (옵션)

        Returns:
            OrderIntent 객체
        """

        if current_price is None or current_price == 0:
            # 현재가가 없으면 기본값 사용
            # KR: 평균 주가 50,000원, US: 평균 주가 150달러
            current_price = 50000 if market == "KR" else 150

        config = self.market_config.get(market, self.market_config["KR"])
        current_positions = current_positions or {}

        # 통화 설정
        currency = "KRW" if market == "KR" else "USD"

        # 리서치 신호 점수
        research_score = {
            "BUY": 1.0,
            "HOLD": 0.5,
            "SELL": 0.0
        }.get(research_signal.get("signal"), 0.5)
        research_confidence = research_signal.get("confidence", 0.5)

        # 분석 신호 점수
        analysis_score = {
            "BUY": 1.0,
            "HOLD": 0.5,
            "SELL": 0.0
        }.get(analysis_signal.get("signal"), 0.5)
        analysis_confidence = analysis_signal.get("confidence", 0.5)

        # 규칙 기반 의사결정
        ensemble_score = (research_score + analysis_score) / 2
        avg_confidence = (research_confidence + analysis_confidence) / 2

        # 액션 결정
        if ensemble_score >= 0.65:
            action = "BUY"
            confidence = min(avg_confidence * 0.9, 0.8)
        elif ensemble_score <= 0.35:
            action = "SELL"
            confidence = min(avg_confidence * 0.8, 0.7)
        else:
            action = "HOLD"
            confidence = 0.5

        # 수량 계산: 현금 우선 (소규모 계좌 최적화)
        if action == "BUY" and current_price > 0 and available_cash > 0:
            # 현금이 부족하면 현금 전체를 사용 (포트폴리오 % 무시)
            # 이를 통해 ₩21,195 같은 소규모 현금으로도 거래 가능
            quantity = int(available_cash / current_price)

            # 수량이 0이면 HOLD
            if quantity < 1:
                quantity = 0
                action = "HOLD"
        else:
            quantity = 0

        # 손절/익절 가격
        stop_loss_price = current_price * (1 - config["stop_loss_pct"])
        take_profit_1_price = current_price * (1 + config["take_profit_pct"])
        take_profit_2_price = current_price * (1 + config["take_profit_pct"] * 1.5)

        # 기술적 지표 계산
        support_price, resistance_price, trendline_price = self._calculate_technical_levels(
            current_price, analysis_signal
        )

        # 거래 타입과 시장 국면 결정
        trade_type = self._determine_trade_type(research_signal, analysis_signal)
        if market_regime is None:
            market_regime_determined = self._determine_market_regime(analysis_signal, research_signal)
        else:
            market_regime_determined = market_regime

        # 무효화 조건 결정
        invalidation_reason = ""
        invalidation_price = None

        if action == "BUY":
            # 상승 매수 시: 지지선 이탈이 무효화 신호
            invalidation_reason = "지지선 이탈"
            invalidation_price = support_price * 0.98  # 지지선보다 2% 낮으면 무효화
        elif action == "SELL":
            # 하락 매도 시: 저항선 이탈이 무효화 신호
            invalidation_reason = "저항선 이탈"
            invalidation_price = resistance_price * 1.02  # 저항선보다 2% 높으면 무효화

        # 진입 근거 및 팀별 이유
        entry_reason = f"{trade_type} 거래 신호 감지 (시장 국면: {market_regime_determined})"
        research_reason = research_signal.get("reasoning", f"리서치팀 {research_signal.get('signal')} 신호")
        analysis_reason = analysis_signal.get("reasoning", f"분석팀 {analysis_signal.get('signal')} 신호")
        strategy_reason = f"앙상블 스코어 {ensemble_score:.2f}, 신뢰도 {avg_confidence:.2f}"

        # BUY 신호 필수 필드 검증
        missing_fields = []
        if action == "BUY":
            if not entry_reason:
                missing_fields.append("entry_reason")
            if not invalidation_reason:
                missing_fields.append("invalidation_reason")
            if invalidation_price is None:
                missing_fields.append("invalidation_price")
            if stop_loss_price is None:
                missing_fields.append("stop_loss_price")
            if take_profit_1_price is None:
                missing_fields.append("take_profit_1_price")

        # 필수 필드 누락 시 HOLD로 처리
        if missing_fields:
            print(f"⚠️  BUY 신호 필수 필드 누락: {', '.join(missing_fields)} → HOLD로 변경")
            action = "HOLD"
            quantity = 0
            confidence = 0.3
            entry_reason = f"필수 필드 누락으로 인한 HOLD: {', '.join(missing_fields)}"

        # 팀별 판단 점수
        team_factor_scores = {
            "research": research_confidence,
            "analysis": analysis_confidence,
            "strategy": confidence
        }

        # 추가매수/부분손절 계획
        add_buy_plan = {}
        partial_cut_plan = {}

        if action == "BUY":
            # 추가매수: 5% 내려가면 추가매수
            add_buy_plan = {
                "price": current_price * 0.95,
                "qty_pct": 0.5  # 기존 수량의 50%
            }
            # 부분손절: 3% 올라가면 50% 익절
            partial_cut_plan = {
                "price": current_price * 1.03,
                "qty_pct": 0.3  # 기존 수량의 30%
            }

        # OrderIntent 빌더로 객체 생성
        try:
            intent = (
                OrderIntentBuilder()
                .symbol(symbol, symbol_name)
                .market(market)
                .side(action)
                .quantity(quantity)
                .price(current_price, currency)
                .confidence(confidence)
                .reasons(
                    entry=entry_reason,
                    research=research_reason,
                    analysis=analysis_reason,
                    strategy=strategy_reason
                )
                .stop_loss(stop_loss_price)
                .take_profit(take_profit_1_price, take_profit_2_price)
                .build()
            )

            # 추가 필드 수동으로 설정
            intent.trade_type = trade_type
            intent.market_regime = market_regime_determined
            intent.invalidation_reason = invalidation_reason
            intent.invalidation_price = invalidation_price
            intent.support_price = support_price
            intent.resistance_price = resistance_price
            intent.trendline_price = trendline_price
            intent.take_profit_1_price = take_profit_1_price
            intent.take_profit_2_price = take_profit_2_price
            intent.trailing_stop_pct = config["stop_loss_pct"] * 100
            intent.add_buy_plan = add_buy_plan
            intent.partial_cut_plan = partial_cut_plan
            intent.expected_holding_period = "SHORT" if config["stop_loss_pct"] < 0.03 else "MEDIUM"
            intent.max_loss_pct_of_portfolio = config["stop_loss_pct"]
            intent.team_factor_scores = team_factor_scores

            return intent

        except Exception as e:
            print(f"❌ OrderIntent 생성 실패: {e}")
            # 폴백: 최소한의 OrderIntent 반환
            return OrderIntent(
                symbol=symbol,
                name=symbol_name,
                market=market,
                side="HOLD",
                intent_quantity=0,
                reference_price=current_price,
                currency=currency,
                confidence=0.0,
                entry_reason="OrderIntent 생성 실패",
                research_reason="",
                analysis_reason="",
                strategy_reason=str(e)
            )


if __name__ == "__main__":
    agent = StrategyAgent()

    print("\n" + "="*70)
    print("📋 StrategyAgent.generate_trade_plan() 테스트")
    print("="*70)

    # 테스트 1: BUY 신호 (완전한 필드)
    print("\n✅ 테스트 1: BUY 신호 (강한 매수 신호)")
    print("-" * 70)
    plan_buy = agent.generate_trade_plan(
        symbol="005930",
        symbol_name="Samsung Electronics",
        market="KR",
        research_signal={
            "signal": "BUY",
            "confidence": 0.8,
            "reasoning": "신제품 출시 호재",
            "trade_type": "BREAKOUT"
        },
        analysis_signal={
            "signal": "BUY",
            "confidence": 0.75,
            "reasoning": "상승 추세 지속",
            "support": 68000,
            "resistance": 72000,
            "trendline": 69000
        },
        current_price=70000,
        portfolio_value=1000000,
        available_cash=500000,
        market_regime="UPTREND"
    )

    print(f"📌 OrderIntent 객체:")
    print(f"   {plan_buy}")
    print(f"\n📄 상세 정보:")
    print(plan_buy.to_json())

    # 테스트 2: HOLD 신호
    print("\n\n✅ 테스트 2: HOLD 신호")
    print("-" * 70)
    plan_hold = agent.generate_trade_plan(
        symbol="000660",
        symbol_name="SK Hynix",
        market="KR",
        research_signal={
            "signal": "HOLD",
            "confidence": 0.5,
            "reasoning": "관망 중"
        },
        analysis_signal={
            "signal": "HOLD",
            "confidence": 0.5,
            "reasoning": "횡보 중"
        },
        current_price=90000,
        portfolio_value=1000000,
        market_regime="SIDEWAYS"
    )

    print(f"📌 OrderIntent 객체:")
    print(f"   {plan_hold}")
    print(f"\n📄 상세 정보:")
    print(plan_hold.to_json())

    # 테스트 3: SELL 신호
    print("\n\n✅ 테스트 3: SELL 신호")
    print("-" * 70)
    plan_sell = agent.generate_trade_plan(
        symbol="068270",
        symbol_name="Samsung SDS",
        market="KR",
        research_signal={
            "signal": "SELL",
            "confidence": 0.7,
            "reasoning": "호재 소진으로 인한 매도"
        },
        analysis_signal={
            "signal": "SELL",
            "confidence": 0.72,
            "reasoning": "하락 추세 확인",
            "support": 75000,
            "resistance": 85000
        },
        current_price=80000,
        portfolio_value=1000000,
        market_regime="DOWNTREND"
    )

    print(f"📌 OrderIntent 객체:")
    print(f"   {plan_sell}")
    print(f"\n📄 상세 정보:")
    print(plan_sell.to_json())

    # 테스트 4: US 주식 (USD)
    print("\n\n✅ 테스트 4: US 주식 (USD)")
    print("-" * 70)
    plan_us = agent.generate_trade_plan(
        symbol="AAPL",
        symbol_name="Apple Inc",
        market="US",
        research_signal={
            "signal": "BUY",
            "confidence": 0.75,
            "reasoning": "기술주 강세"
        },
        analysis_signal={
            "signal": "BUY",
            "confidence": 0.70,
            "reasoning": "모멘텀 매매",
            "support": 145,
            "resistance": 160
        },
        current_price=150,
        portfolio_value=10000,  # USD 기준
        available_cash=5000,
        market_regime="UPTREND"
    )

    print(f"📌 OrderIntent 객체:")
    print(f"   {plan_us}")
    print(f"\n📄 상세 정보:")
    print(plan_us.to_json())

    print("\n" + "="*70)
    print("✅ 모든 테스트 완료")
    print("="*70)
