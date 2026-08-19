"""
손실 대응 시나리오 - 거래 손실 시 상황별 대응 규칙
적극적 매매를 허용하되, 손실 발생 시 사전에 정의된 시나리오에 따라 대응
"""

import logging
from typing import Dict, Any, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class LossResponse:
    """손실 대응 유형 열거"""
    HOLD_NORMAL_PULLBACK = "HOLD_NORMAL_PULLBACK"           # 정상 눌림, 보유
    ADD_BUY_SUPPORT_HELD = "ADD_BUY_SUPPORT_HELD"           # 지지선 유지, 추가매수
    PARTIAL_CUT_TRENDLINE_BREAK = "PARTIAL_CUT_TRENDLINE_BREAK"  # 추세선 이탈, 부분손절
    FULL_CUT_INVALIDATION = "FULL_CUT_INVALIDATION"         # 무효화 가격 도달, 전량손절
    NO_ADD_BUY_FAILED_REBOUND = "NO_ADD_BUY_FAILED_REBOUND"  # 반등 실패, 추가매수 금지


class TradeScenarioAnalyzer:
    """
    현재 손실 상태를 분류하고 대응 시나리오를 결정합니다.
    모니터링 에이전트에서 포지션 확인 시 매 사이클마다 호출됩니다.
    """

    def __init__(self):
        self.scenario_history = {}  # symbol -> [scenario1, scenario2, ...]

    async def classify_loss_response(
        self,
        symbol: str,
        current_price: float,
        entry_price: float,
        stop_loss_price: float,
        invalidation_price: Optional[float] = None,
        support_price: Optional[float] = None,
        resistance_price: Optional[float] = None,
        trendline_price: Optional[float] = None,
        add_buy_price: Optional[float] = None,
        recent_volume_trend: Optional[str] = None,  # "INCREASE", "DECREASE", "STABLE"
        market_regime: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        손실 상태를 분류하고 대응 시나리오를 반환합니다.

        Args:
            symbol: 종목코드
            current_price: 현재가
            entry_price: 진입가
            stop_loss_price: 손절가
            invalidation_price: 무효화 가격
            support_price: 지지선
            resistance_price: 저항선
            trendline_price: 추세선
            add_buy_price: 추가매수 계획 가격
            recent_volume_trend: 최근 거래량 추세
            market_regime: 시장 국면

        Returns:
            {
                "response": "PARTIAL_CUT_TRENDLINE_BREAK",
                "action": "SELL_PARTIAL" | "HOLD" | "BUY_ADD" | "SELL_ALL",
                "quantity_pct": 0.5,  # 부분 손절/추가매수 시 비율
                "reasoning": "상승 추세선 이탈, 전저점은 유지되어 50% 축소",
                "next_check": "전저점 이탈 시 전량 손절",
                "recommendation_price": float,  # 실행 추천 가격
            }
        """

        # 손실률 계산
        if entry_price <= 0:
            return {
                "response": "ERROR",
                "action": "HOLD",
                "reasoning": "진입가 오류",
                "error": True
            }

        loss_pct = (entry_price - current_price) / entry_price
        loss_amount = entry_price - current_price

        # Case 1: 이미 손절가 도달 → 전량손절
        if current_price <= stop_loss_price:
            response = {
                "response": LossResponse.FULL_CUT_INVALIDATION,
                "action": "SELL_ALL",
                "quantity_pct": 1.0,
                "reasoning": f"손절가({stop_loss_price}) 도달, 즉시 전량손절",
                "next_check": "포지션 종료",
                "recommendation_price": stop_loss_price,
                "trigger": "STOP_LOSS"
            }
            self._record_scenario(symbol, response)
            return response

        # Case 2: 무효화 가격 도달 → 전량손절
        if invalidation_price and current_price <= invalidation_price:
            response = {
                "response": LossResponse.FULL_CUT_INVALIDATION,
                "action": "SELL_ALL",
                "quantity_pct": 1.0,
                "reasoning": f"무효화 가격({invalidation_price}) 도달, 전략 무효화로 전량손절",
                "next_check": "포지션 종료",
                "recommendation_price": invalidation_price,
                "trigger": "INVALIDATION"
            }
            self._record_scenario(symbol, response)
            return response

        # Case 3: 추세선 이탈 + 지지선 유지 → 부분손절
        if trendline_price and current_price <= trendline_price:
            if support_price and current_price >= support_price:
                response = {
                    "response": LossResponse.PARTIAL_CUT_TRENDLINE_BREAK,
                    "action": "SELL_PARTIAL",
                    "quantity_pct": 0.5,
                    "reasoning": f"추세선({trendline_price}) 이탈하지만 지지선({support_price}) 유지 중, 50% 축소",
                    "next_check": "지지선 이탈 시 나머지 50% 손절",
                    "recommendation_price": trendline_price,
                    "hold_price": support_price
                }
                self._record_scenario(symbol, response)
                return response

        # Case 4: 작은 손실 + 지지선 유지 + 추가매수 가격 가깝다면 → 보유 + 추가매수 고려
        if loss_pct < 0.05 and support_price and current_price >= support_price:  # 손실 5% 미만
            if add_buy_price and current_price <= add_buy_price * 1.02:  # 추가매수 가격 근처
                # 거래량 확인
                if recent_volume_trend != "INCREASE":  # 거래량 급증하지 않으면 추가매수 가능
                    response = {
                        "response": LossResponse.ADD_BUY_SUPPORT_HELD,
                        "action": "BUY_ADD",
                        "quantity_pct": 0.5,
                        "reasoning": f"정상 눌림, 지지선({support_price}) 유지, 거래량 안정적 → 추가매수 50%",
                        "next_check": "지지선 이탈 시 정지",
                        "recommendation_price": add_buy_price,
                    }
                    self._record_scenario(symbol, response)
                    return response

        # Case 5: 정상 눌림 → 보유
        if loss_pct < 0.10 and support_price and current_price >= support_price:  # 손실 10% 미만 + 지지선 유지
            response = {
                "response": LossResponse.HOLD_NORMAL_PULLBACK,
                "action": "HOLD",
                "quantity_pct": 0.0,
                "reasoning": f"정상 눌림 (손실 {loss_pct:.1%}), 지지선({support_price}) 유지 중, 보유",
                "next_check": "지지선 이탈 또는 반등 확인",
                "support_level": support_price,
                "resistance_level": resistance_price
            }
            self._record_scenario(symbol, response)
            return response

        # Case 6: 추가매수 실패 + 거래량 급증 → 추가매수 금지
        if recent_volume_trend == "INCREASE" and loss_pct > 0.05:
            response = {
                "response": LossResponse.NO_ADD_BUY_FAILED_REBOUND,
                "action": "HOLD",
                "quantity_pct": 0.0,
                "reasoning": f"반등 실패 + 거래량 급증, 추가매수 불가, 대기",
                "next_check": "거래량 정상화까지 대기, 손절 경계",
                "stop_loss_price": stop_loss_price
            }
            self._record_scenario(symbol, response)
            return response

        # 기본값: 보유
        response = {
            "response": LossResponse.HOLD_NORMAL_PULLBACK,
            "action": "HOLD",
            "quantity_pct": 0.0,
            "reasoning": f"추가 신호 없음, 보유 중 (손실 {loss_pct:.1%})",
            "next_check": "지지선 확인"
        }
        self._record_scenario(symbol, response)
        return response

    def _record_scenario(self, symbol: str, scenario: Dict[str, Any]) -> None:
        """시나리오 이력 기록"""
        if symbol not in self.scenario_history:
            self.scenario_history[symbol] = []

        self.scenario_history[symbol].append(scenario)

        # 최근 10개만 유지
        if len(self.scenario_history[symbol]) > 10:
            self.scenario_history[symbol].pop(0)

        logger.info(
            f"📊 [{symbol}] 손실 대응: {scenario['response']} → {scenario['action']}"
        )

    def get_scenario_count(self, symbol: str, scenario_type: str) -> int:
        """특정 종목의 시나리오 발생 횟수"""
        if symbol not in self.scenario_history:
            return 0

        return sum(
            1 for s in self.scenario_history[symbol]
            if s.get("response") == scenario_type
        )

    def is_scenario_repeated(self, symbol: str, scenario_type: str, threshold: int = 3) -> bool:
        """같은 시나리오가 반복 발생했는지 확인"""
        count = self.get_scenario_count(symbol, scenario_type)
        return count >= threshold


# 테스트용
async def main():
    analyzer = TradeScenarioAnalyzer()

    # 테스트 1: 정상 눌림
    result1 = await analyzer.classify_loss_response(
        symbol="005930",
        current_price=45000,
        entry_price=50000,
        stop_loss_price=40000,
        support_price=44000,
        recent_volume_trend="STABLE"
    )
    print(f"\n테스트 1 - 정상 눌림:\n{result1}")

    # 테스트 2: 손절가 도달
    result2 = await analyzer.classify_loss_response(
        symbol="000660",
        current_price=39000,
        entry_price=50000,
        stop_loss_price=40000,
    )
    print(f"\n테스트 2 - 손절 도달:\n{result2}")

    # 테스트 3: 추세선 이탈 + 지지선 유지
    result3 = await analyzer.classify_loss_response(
        symbol="005380",
        current_price=44000,
        entry_price=50000,
        stop_loss_price=40000,
        trendline_price=45000,
        support_price=44000,
    )
    print(f"\n테스트 3 - 추세선 이탈:\n{result3}")


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
