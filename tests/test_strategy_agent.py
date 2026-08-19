"""
StrategyAgent.generate_trade_plan() 테스트
OrderIntent 객체 생성 및 필드 검증
"""

import pytest
import sys
import os

# 프로젝트 경로 추가
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from pyqqq.strategy_agent import StrategyAgent
from pyqqq.order_intent import OrderIntent


class TestStrategyAgentBUYSignal:
    """BUY 신호 테스트"""

    def setup_method(self):
        self.agent = StrategyAgent()

    def test_buy_signal_with_sufficient_capital(self):
        """강한 매수 신호 (충분한 자금)"""
        plan = self.agent.generate_trade_plan(
            symbol='005930',
            symbol_name='Samsung Electronics',
            market='KR',
            research_signal={
                'signal': 'BUY',
                'confidence': 0.8,
                'reasoning': '신제품 출시 호재'
            },
            analysis_signal={
                'signal': 'BUY',
                'confidence': 0.75,
                'reasoning': '상승 추세 지속'
            },
            current_price=70000,
            portfolio_value=10000000,
            available_cash=5000000
        )

        # 타입 검증
        assert isinstance(plan, OrderIntent), "OrderIntent 객체여야 함"

        # 신호 검증
        assert plan.side == "BUY", "BUY 신호여야 함"
        assert plan.intent_quantity > 0, "수량이 0보다 커야 함"
        assert plan.confidence > 0.5, "신뢰도가 0.5보다 커야 함"

        # 필수 필드 검증
        assert plan.entry_reason, "entry_reason이 있어야 함"
        assert plan.invalidation_reason, "invalidation_reason이 있어야 함"
        assert plan.invalidation_price is not None, "invalidation_price가 있어야 함"
        assert plan.stop_loss_price is not None, "stop_loss_price가 있어야 함"
        assert plan.take_profit_1_price is not None, "take_profit_1_price가 있어야 함"

        # 기술적 지표 검증
        assert plan.support_price is not None, "support_price가 있어야 함"
        assert plan.resistance_price is not None, "resistance_price가 있어야 함"
        assert plan.trendline_price is not None, "trendline_price가 있어야 함"

        # 거래 타입 검증
        assert plan.trade_type in ["PULLBACK", "TREND_REVERSAL", "BREAKOUT", "MOMENTUM"], \
            "trade_type이 유효해야 함"

        # 시장 국면 검증
        assert plan.market_regime in ["UPTREND", "DOWNTREND", "SIDEWAYS", "HIGH_VOLATILITY"], \
            "market_regime이 유효해야 함"

    def test_buy_signal_with_trailing_stop(self):
        """BUY 신호에서 trailing_stop_pct 검증"""
        plan = self.agent.generate_trade_plan(
            symbol='005930',
            symbol_name='Samsung Electronics',
            market='KR',
            research_signal={'signal': 'BUY', 'confidence': 0.8},
            analysis_signal={'signal': 'BUY', 'confidence': 0.75},
            current_price=70000,
            portfolio_value=10000000,
            available_cash=5000000
        )

        assert plan.trailing_stop_pct is not None, "trailing_stop_pct이 있어야 함"
        assert plan.trailing_stop_pct > 0, "trailing_stop_pct이 양수여야 함"

    def test_buy_signal_add_buy_plan(self):
        """BUY 신호에서 add_buy_plan 검증"""
        plan = self.agent.generate_trade_plan(
            symbol='005930',
            symbol_name='Samsung Electronics',
            market='KR',
            research_signal={'signal': 'BUY', 'confidence': 0.8},
            analysis_signal={'signal': 'BUY', 'confidence': 0.75},
            current_price=70000,
            portfolio_value=10000000,
            available_cash=5000000
        )

        assert plan.add_buy_plan, "add_buy_plan이 있어야 함"
        assert 'price' in plan.add_buy_plan, "add_buy_plan.price가 있어야 함"
        assert 'qty_pct' in plan.add_buy_plan, "add_buy_plan.qty_pct가 있어야 함"

    def test_buy_signal_team_factor_scores(self):
        """BUY 신호에서 team_factor_scores 검증"""
        plan = self.agent.generate_trade_plan(
            symbol='005930',
            symbol_name='Samsung Electronics',
            market='KR',
            research_signal={'signal': 'BUY', 'confidence': 0.8},
            analysis_signal={'signal': 'BUY', 'confidence': 0.75},
            current_price=70000,
            portfolio_value=10000000,
            available_cash=5000000
        )

        assert plan.team_factor_scores, "team_factor_scores가 있어야 함"
        assert 'research' in plan.team_factor_scores, "research 점수가 있어야 함"
        assert 'analysis' in plan.team_factor_scores, "analysis 점수가 있어야 함"
        assert 'strategy' in plan.team_factor_scores, "strategy 점수가 있어야 함"

    def test_buy_signal_us_market(self):
        """US 시장 BUY 신호 (USD)"""
        plan = self.agent.generate_trade_plan(
            symbol='AAPL',
            symbol_name='Apple Inc',
            market='US',
            research_signal={'signal': 'BUY', 'confidence': 0.75},
            analysis_signal={'signal': 'BUY', 'confidence': 0.70},
            current_price=150,
            portfolio_value=100000,
            available_cash=50000
        )

        assert plan.side == "BUY", "BUY 신호여야 함"
        assert plan.currency == "USD", "통화가 USD여야 함"
        assert plan.intent_quantity > 0, "수량이 0보다 커야 함"


class TestStrategyAgentHOLDSignal:
    """HOLD 신호 테스트"""

    def setup_method(self):
        self.agent = StrategyAgent()

    def test_hold_signal(self):
        """HOLD 신호"""
        plan = self.agent.generate_trade_plan(
            symbol='000660',
            symbol_name='SK Hynix',
            market='KR',
            research_signal={'signal': 'HOLD', 'confidence': 0.5},
            analysis_signal={'signal': 'HOLD', 'confidence': 0.5},
            current_price=90000,
            portfolio_value=10000000
        )

        assert plan.side == "HOLD", "HOLD 신호여야 함"
        assert plan.intent_quantity == 0, "수량이 0이어야 함"
        assert plan.confidence == 0.5, "신뢰도가 0.5여야 함"

    def test_hold_signal_invalidation_reason_empty(self):
        """HOLD 신호에서 invalidation_reason은 비어있을 수 있음"""
        plan = self.agent.generate_trade_plan(
            symbol='000660',
            symbol_name='SK Hynix',
            market='KR',
            research_signal={'signal': 'HOLD', 'confidence': 0.5},
            analysis_signal={'signal': 'HOLD', 'confidence': 0.5},
            current_price=90000,
            portfolio_value=10000000
        )

        # HOLD 신호는 invalidation_reason이 비어있을 수 있음
        assert plan.invalidation_reason == "", "invalidation_reason이 비어있어야 함"


class TestStrategyAgentSELLSignal:
    """SELL 신호 테스트"""

    def setup_method(self):
        self.agent = StrategyAgent()

    def test_sell_signal(self):
        """SELL 신호"""
        plan = self.agent.generate_trade_plan(
            symbol='068270',
            symbol_name='Samsung SDS',
            market='KR',
            research_signal={'signal': 'SELL', 'confidence': 0.7},
            analysis_signal={'signal': 'SELL', 'confidence': 0.72},
            current_price=80000,
            portfolio_value=10000000
        )

        assert plan.side == "SELL", "SELL 신호여야 함"
        assert plan.intent_quantity == 0, "수량이 0이어야 함"
        assert plan.confidence > 0.5, "신뢰도가 0.5보다 커야 함"

    def test_sell_signal_invalidation(self):
        """SELL 신호에서 invalidation_reason 검증"""
        plan = self.agent.generate_trade_plan(
            symbol='068270',
            symbol_name='Samsung SDS',
            market='KR',
            research_signal={'signal': 'SELL', 'confidence': 0.7},
            analysis_signal={'signal': 'SELL', 'confidence': 0.72},
            current_price=80000,
            portfolio_value=10000000
        )

        # SELL 신호는 invalidation_reason이 있어야 함
        assert plan.invalidation_reason, "invalidation_reason이 있어야 함"
        assert plan.invalidation_price is not None, "invalidation_price가 있어야 함"


class TestStrategyAgentMarketRegime:
    """시장 국면 테스트"""

    def setup_method(self):
        self.agent = StrategyAgent()

    def test_market_regime_uptrend(self):
        """UPTREND 시장 국면"""
        plan = self.agent.generate_trade_plan(
            symbol='005930',
            symbol_name='Samsung Electronics',
            market='KR',
            research_signal={'signal': 'BUY', 'confidence': 0.8},
            analysis_signal={'signal': 'BUY', 'confidence': 0.75},
            current_price=70000,
            portfolio_value=10000000,
            available_cash=5000000,
            market_regime='UPTREND'
        )

        assert plan.market_regime == "UPTREND", "시장 국면이 UPTREND여야 함"

    def test_market_regime_downtrend(self):
        """DOWNTREND 시장 국면"""
        plan = self.agent.generate_trade_plan(
            symbol='068270',
            symbol_name='Samsung SDS',
            market='KR',
            research_signal={'signal': 'SELL', 'confidence': 0.7},
            analysis_signal={'signal': 'SELL', 'confidence': 0.72},
            current_price=80000,
            portfolio_value=10000000,
            market_regime='DOWNTREND'
        )

        assert plan.market_regime == "DOWNTREND", "시장 국면이 DOWNTREND여야 함"

    def test_market_regime_auto_detection(self):
        """시장 국면 자동 감지"""
        plan = self.agent.generate_trade_plan(
            symbol='005930',
            symbol_name='Samsung Electronics',
            market='KR',
            research_signal={'signal': 'BUY', 'confidence': 0.8},
            analysis_signal={'signal': 'BUY', 'confidence': 0.75},
            current_price=70000,
            portfolio_value=10000000,
            available_cash=5000000
        )

        # market_regime을 전달하지 않으면 자동 감지
        assert plan.market_regime in ["UPTREND", "DOWNTREND", "SIDEWAYS", "HIGH_VOLATILITY"], \
            "시장 국면이 자동 감지되어야 함"


class TestStrategyAgentPriceLevels:
    """기술적 가격 수준 테스트"""

    def setup_method(self):
        self.agent = StrategyAgent()

    def test_support_resistance_calculation(self):
        """지지선/저항선 계산"""
        plan = self.agent.generate_trade_plan(
            symbol='005930',
            symbol_name='Samsung Electronics',
            market='KR',
            research_signal={'signal': 'BUY', 'confidence': 0.8},
            analysis_signal={
                'signal': 'BUY',
                'confidence': 0.75,
                'support': 68000,
                'resistance': 72000
            },
            current_price=70000,
            portfolio_value=10000000,
            available_cash=5000000
        )

        assert plan.support_price == 68000, "지지선이 68000이어야 함"
        assert plan.resistance_price == 72000, "저항선이 72000이어야 함"
        assert plan.support_price < plan.reference_price, "지지선이 현재가보다 낮아야 함"
        assert plan.resistance_price > plan.reference_price, "저항선이 현재가보다 높아야 함"

    def test_trendline_calculation(self):
        """추세선 계산"""
        plan = self.agent.generate_trade_plan(
            symbol='005930',
            symbol_name='Samsung Electronics',
            market='KR',
            research_signal={'signal': 'BUY', 'confidence': 0.8},
            analysis_signal={
                'signal': 'BUY',
                'confidence': 0.75,
                'support': 68000,
                'resistance': 72000,
                'trendline': 69000
            },
            current_price=70000,
            portfolio_value=10000000,
            available_cash=5000000
        )

        assert plan.trendline_price == 69000, "추세선이 69000이어야 함"


class TestStrategyAgentStopLossAndTakeProfit:
    """손절/익절 테스트"""

    def setup_method(self):
        self.agent = StrategyAgent()

    def test_stop_loss_price(self):
        """손절가 계산"""
        current_price = 70000
        plan = self.agent.generate_trade_plan(
            symbol='005930',
            symbol_name='Samsung Electronics',
            market='KR',
            research_signal={'signal': 'BUY', 'confidence': 0.8},
            analysis_signal={'signal': 'BUY', 'confidence': 0.75},
            current_price=current_price,
            portfolio_value=10000000,
            available_cash=5000000
        )

        # KR 시장에서 손절은 -2%
        expected_sl = current_price * (1 - 0.02)
        assert plan.stop_loss_price == pytest.approx(expected_sl), \
            "손절가가 현재가 -2%여야 함"

    def test_take_profit_levels(self):
        """다단계 익절가 계산"""
        current_price = 70000
        plan = self.agent.generate_trade_plan(
            symbol='005930',
            symbol_name='Samsung Electronics',
            market='KR',
            research_signal={'signal': 'BUY', 'confidence': 0.8},
            analysis_signal={'signal': 'BUY', 'confidence': 0.75},
            current_price=current_price,
            portfolio_value=10000000,
            available_cash=5000000
        )

        # KR 시장에서 1차 익절은 +3%
        expected_tp1 = current_price * (1 + 0.03)
        assert plan.take_profit_1_price == pytest.approx(expected_tp1), \
            "1차 익절가가 현재가 +3%여야 함"

        # 2차 익절은 1.5배
        assert plan.take_profit_2_price is not None, "2차 익절가가 있어야 함"
        assert plan.take_profit_2_price > plan.take_profit_1_price, \
            "2차 익절가가 1차 익절가보다 커야 함"


class TestStrategyAgentOrderIntentJSON:
    """OrderIntent JSON 변환 테스트"""

    def setup_method(self):
        self.agent = StrategyAgent()

    def test_order_intent_to_json(self):
        """OrderIntent를 JSON으로 변환"""
        plan = self.agent.generate_trade_plan(
            symbol='005930',
            symbol_name='Samsung Electronics',
            market='KR',
            research_signal={'signal': 'BUY', 'confidence': 0.8},
            analysis_signal={'signal': 'BUY', 'confidence': 0.75},
            current_price=70000,
            portfolio_value=10000000,
            available_cash=5000000
        )

        json_str = plan.to_json()
        assert isinstance(json_str, str), "JSON 문자열이어야 함"
        assert '"symbol"' in json_str, "symbol이 JSON에 포함되어야 함"
        assert '"side"' in json_str, "side가 JSON에 포함되어야 함"
        assert '"trade_type"' in json_str, "trade_type이 JSON에 포함되어야 함"
        assert '"market_regime"' in json_str, "market_regime이 JSON에 포함되어야 함"

    def test_order_intent_to_dict(self):
        """OrderIntent를 dict로 변환"""
        plan = self.agent.generate_trade_plan(
            symbol='005930',
            symbol_name='Samsung Electronics',
            market='KR',
            research_signal={'signal': 'BUY', 'confidence': 0.8},
            analysis_signal={'signal': 'BUY', 'confidence': 0.75},
            current_price=70000,
            portfolio_value=10000000,
            available_cash=5000000
        )

        dict_obj = plan.to_dict()
        assert isinstance(dict_obj, dict), "dict 객체여야 함"
        assert dict_obj['symbol'] == '005930', "symbol이 dict에 포함되어야 함"
        assert dict_obj['side'] == 'BUY', "side가 dict에 포함되어야 함"
        assert dict_obj['trade_type'] == 'BREAKOUT', "trade_type이 dict에 포함되어야 함"


class TestStrategyAgentExpectedHoldingPeriod:
    """기대 보유 기간 테스트"""

    def setup_method(self):
        self.agent = StrategyAgent()

    def test_expected_holding_period_short(self):
        """SHORT 보유 기간 (손절이 작을 때)"""
        plan = self.agent.generate_trade_plan(
            symbol='005930',
            symbol_name='Samsung Electronics',
            market='KR',
            research_signal={'signal': 'BUY', 'confidence': 0.8},
            analysis_signal={'signal': 'BUY', 'confidence': 0.75},
            current_price=70000,
            portfolio_value=10000000,
            available_cash=5000000
        )

        # KR 시장에서 손절이 2%이므로 SHORT 기간
        assert plan.expected_holding_period == "SHORT", \
            "손절이 3% 미만이면 SHORT 기간이어야 함"

    def test_max_loss_pct_of_portfolio(self):
        """포트폴리오 최대 손실률"""
        plan = self.agent.generate_trade_plan(
            symbol='005930',
            symbol_name='Samsung Electronics',
            market='KR',
            research_signal={'signal': 'BUY', 'confidence': 0.8},
            analysis_signal={'signal': 'BUY', 'confidence': 0.75},
            current_price=70000,
            portfolio_value=10000000,
            available_cash=5000000
        )

        assert plan.max_loss_pct_of_portfolio == 0.02, \
            "최대 손실률이 2%여야 함"


class TestStrategyAgentDefaultPrices:
    """기본값 가격 설정 테스트"""

    def setup_method(self):
        self.agent = StrategyAgent()

    def test_default_current_price_kr(self):
        """KR 시장 기본 현재가"""
        plan = self.agent.generate_trade_plan(
            symbol='005930',
            symbol_name='Samsung Electronics',
            market='KR',
            research_signal={'signal': 'HOLD', 'confidence': 0.5},
            analysis_signal={'signal': 'HOLD', 'confidence': 0.5},
            current_price=None,
            portfolio_value=10000000
        )

        # current_price가 없으면 기본값 50,000
        assert plan.reference_price == 50000, "KR 시장 기본값이 50,000이어야 함"

    def test_default_current_price_us(self):
        """US 시장 기본 현재가"""
        plan = self.agent.generate_trade_plan(
            symbol='AAPL',
            symbol_name='Apple Inc',
            market='US',
            research_signal={'signal': 'HOLD', 'confidence': 0.5},
            analysis_signal={'signal': 'HOLD', 'confidence': 0.5},
            current_price=None,
            portfolio_value=10000000
        )

        # current_price가 없으면 기본값 150
        assert plan.reference_price == 150, "US 시장 기본값이 150이어야 함"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
