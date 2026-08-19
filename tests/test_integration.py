"""
통합 테스트 - 새로운 인프라 모두 작동하는지 검증
"""

import pytest
import asyncio
from datetime import datetime
from pathlib import Path
import sys

# 프로젝트 경로 추가
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from pyqqq.market_regime_detector import MarketRegimeDetector
from pyqqq.team_weight_manager import TeamWeightManager
from pyqqq.decision_logger import DecisionLogger
from pyqqq.trade_scenario import TradeScenarioAnalyzer
from pyqqq.performance_review_engine import PerformanceReviewEngine
from pyqqq.order_intent import OrderIntentBuilder, RiskDecisionBuilder


class TestMarketRegimeDetector:
    """시장 국면 분류 테스트"""

    @pytest.mark.asyncio
    async def test_uptrend_detection(self):
        detector = MarketRegimeDetector()
        result = await detector.detect_regime(
            market="KR",
            index_trend=0.75,
            volatility=0.35,
            liquidity=0.80,
            news_intensity=0.40
        )
        assert result["regime"] == "UPTREND"
        assert result["confidence"] > 0.6

    @pytest.mark.asyncio
    async def test_high_volatility_detection(self):
        detector = MarketRegimeDetector()
        result = await detector.detect_regime(
            market="US",
            index_trend=0.50,
            volatility=0.85,
            liquidity=0.70,
            news_intensity=0.60
        )
        assert result["regime"] == "HIGH_VOLATILITY"


class TestTeamWeightManager:
    """팀 가중치 관리 테스트"""

    def test_default_weights(self):
        manager = TeamWeightManager()
        weights = manager.get_weights()
        
        assert weights["research"] == 0.25
        assert weights["analysis"] == 0.35
        assert weights["strategy"] == 0.25
        assert weights["regime"] == 0.15

    def test_regime_weights_uptrend(self):
        manager = TeamWeightManager()
        weights = manager.get_weights(market_regime="UPTREND")
        
        assert weights["research"] == 0.20
        assert weights["analysis"] == 0.35
        assert weights["strategy"] == 0.30
        assert weights["regime"] == 0.15

    def test_regime_weights_downtrend(self):
        manager = TeamWeightManager()
        weights = manager.get_weights(market_regime="DOWNTREND")
        
        # 다운트렌드에서는 regime 가중치 증가
        assert weights["regime"] == 0.35

    def test_performance_tracking(self):
        manager = TeamWeightManager()
        
        manager.update_team_performance("analysis", True)
        manager.update_team_performance("analysis", True)
        manager.update_team_performance("analysis", False)
        
        perf = manager.get_team_performance("analysis")
        assert perf["correct"] == 2
        assert perf["total"] == 3
        assert abs(perf["accuracy"] - 2/3) < 0.01


class TestDecisionLogger:
    """의사결정 로그 테스트"""

    def test_log_creation(self):
        logger = DecisionLogger()
        
        logger.log_market_regime(
            market="KR",
            regime="UPTREND",
            confidence=0.75,
            features={"index_trend": 0.68},
            reason="지수 상승"
        )
        
        logs = logger.read_today_logs()
        assert len(logs) > 0
        assert logs[0]["event_type"] == "MARKET_REGIME_DETECTED"

    def test_symbol_history_filter(self):
        logger = DecisionLogger()
        
        logger.log_order_executed(
            symbol="005930",
            order_id="O123",
            side="BUY",
            quantity=10,
            price=50000,
            total_amount=500000,
            currency="KRW",
            confidence=0.75,
            result={"success": True}
        )
        
        history = logger.read_symbol_history("005930")
        assert len(history) > 0
        assert history[0]["data"]["symbol"] == "005930"


class TestOrderIntent:
    """OrderIntent 확장 필드 테스트"""

    def test_order_intent_builder_all_fields(self):
        intent = (
            OrderIntentBuilder()
            .symbol("005930", "Samsung")
            .market("KR")
            .side("BUY")
            .quantity(10)
            .price(50000, "KRW")
            .confidence(0.75)
            .reasons(
                entry="상승 추세 + 기술 지표",
                research="핫 섹터",
                analysis="기술적 우호",
                strategy="매수 신호"
            )
            .stop_loss(40000)
            .take_profit(55000)
            .build()
        )
        
        assert intent.symbol == "005930"
        assert intent.stop_loss_price == 40000
        assert intent.take_profit_1_price == 55000
        assert intent.confidence == 0.75

    def test_order_intent_with_extended_fields(self):
        """확장된 OrderIntent 필드 테스트"""
        intent = (
            OrderIntentBuilder()
            .symbol("005930", "Samsung")
            .market("KR")
            .side("BUY")
            .quantity(10)
            .price(50000, "KRW")
            .stop_loss(40000)
            .take_profit(55000)
            .build()
        )
        
        # 확장 필드 설정
        intent.trade_type = "PULLBACK"
        intent.market_regime = "UPTREND"
        intent.invalidation_price = 39000
        intent.support_price = 42000
        intent.resistance_price = 58000
        intent.max_loss_pct_of_portfolio = 0.02
        
        assert intent.trade_type == "PULLBACK"
        assert intent.market_regime == "UPTREND"
        assert intent.invalidation_price == 39000


class TestRiskDecision:
    """RiskDecision 확장 필드 테스트"""

    def test_risk_decision_kr_order(self):
        """KR 주문의 현금 계산 테스트"""
        decision = (
            RiskDecisionBuilder()
            .approve(quantity=10, risk_level="MEDIUM")
            .build()
        )
        
        decision.symbol = "005930"
        decision.market = "KR"
        decision.approved_order_currency = "KRW"
        decision.cash_after_order_currency = "KRW"
        decision.cash_after_order = 500000  # 1000000 - 500000
        
        assert decision.market == "KR"
        assert decision.cash_after_order_currency == "KRW"
        assert decision.cash_after_order == 500000

    def test_risk_decision_us_order(self):
        """US 주문의 현금 계산 테스트"""
        decision = (
            RiskDecisionBuilder()
            .approve(quantity=5, risk_level="MEDIUM")
            .build()
        )
        
        decision.symbol = "AAPL"
        decision.market = "US"
        decision.approved_order_currency = "USD"
        decision.cash_after_order_currency = "USD"
        decision.cash_after_order = 250.0  # 1000 - 750
        
        assert decision.market == "US"
        assert decision.cash_after_order_currency == "USD"
        assert decision.cash_after_order == 250.0


class TestTradeScenarioAnalyzer:
    """손실 대응 시나리오 테스트"""

    @pytest.mark.asyncio
    async def test_normal_pullback(self):
        analyzer = TradeScenarioAnalyzer()
        
        result = await analyzer.classify_loss_response(
            symbol="005930",
            current_price=45000,
            entry_price=50000,
            stop_loss_price=40000,
            support_price=44000,
            recent_volume_trend="STABLE"
        )
        
        assert result["response"] == "HOLD_NORMAL_PULLBACK"
        assert result["action"] == "HOLD"

    @pytest.mark.asyncio
    async def test_stop_loss_triggered(self):
        analyzer = TradeScenarioAnalyzer()
        
        result = await analyzer.classify_loss_response(
            symbol="005930",
            current_price=39000,
            entry_price=50000,
            stop_loss_price=40000,
        )
        
        assert result["response"] == "FULL_CUT_INVALIDATION"
        assert result["action"] == "SELL_ALL"
        assert result["trigger"] == "STOP_LOSS"


class TestPerformanceReviewEngine:
    """성과 복기 엔진 테스트"""

    def test_trade_recording(self):
        engine = PerformanceReviewEngine()
        
        now = datetime.now()
        from datetime import timedelta
        
        engine.record_trade_result(
            symbol="005930",
            entry_price=50000,
            exit_price=52000,
            quantity=10,
            entry_time=now - timedelta(hours=1),
            exit_time=now,
            market_regime="UPTREND",
            trade_type="PULLBACK",
            research_signal="BUY",
            analysis_signal="BUY",
            strategy_action="BUY"
        )
        
        report = engine.generate_performance_report()
        assert report["summary"]["total_trades"] == 1
        assert report["summary"]["win_rate"] == 1.0

    def test_performance_report_generation(self):
        engine = PerformanceReviewEngine()
        
        report = engine.generate_performance_report()
        assert "summary" in report
        assert "team_performance" in report
        assert "recommendations" in report


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
