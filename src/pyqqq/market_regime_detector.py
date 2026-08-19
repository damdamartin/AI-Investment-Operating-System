"""
시장 국면 분류기 - 현재 시장의 특성을 판단하여 팀별 가중치 조정에 활용
상승추세, 하락추세, 박스권, 고변동성, 저유동성, 이벤트장 분류
"""

import logging
from datetime import datetime
from typing import Dict, Any, Optional, List
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class MarketRegime:
    """시장 국면 열거"""
    UPTREND = "UPTREND"                  # 상승 추세장
    DOWNTREND = "DOWNTREND"              # 하락 추세장
    SIDEWAYS = "SIDEWAYS"                # 박스권
    HIGH_VOLATILITY = "HIGH_VOLATILITY"  # 급등락 변동성장
    LOW_LIQUIDITY = "LOW_LIQUIDITY"      # 거래대금 고갈장
    EVENT_DRIVEN = "EVENT_DRIVEN"        # 뉴스/이벤트 장세


class MarketRegimeDetector:
    """
    시장 국면 분류기

    리서치팀의 시장 분석 데이터를 받아 현재 국면을 판단하고,
    orchestrator에서 팀별 신호 가중치를 조정하는 데 사용됨.
    """

    def __init__(self):
        self.recent_regimes = []  # 최근 5개 사이클의 국면 기록
        self.regime_change_count = 0  # 국면 변화 횟수

    async def detect_regime(
        self,
        market: str,  # "KR" or "US"
        index_trend: Optional[float] = None,  # -1.0 ~ 1.0 (음수=하락, 양수=상승)
        volatility: Optional[float] = None,  # 0.0 ~ 1.0
        liquidity: Optional[float] = None,  # 0.0 ~ 1.0
        news_intensity: Optional[float] = None,  # 0.0 ~ 1.0
        candidate_count: int = 0,  # 분석 종목 수
        market_analysis: Optional[Dict] = None,  # research_team에서 제공하는 분석 데이터
    ) -> Dict[str, Any]:
        """
        시장 국면을 판단합니다.

        Args:
            market: "KR" 또는 "US"
            index_trend: 지수 추세 (-1.0 ~ 1.0)
            volatility: 변동성 (0.0 ~ 1.0)
            liquidity: 유동성 (0.0 ~ 1.0)
            news_intensity: 뉴스 강도 (0.0 ~ 1.0)
            candidate_count: 분석 대상 종목 수
            market_analysis: research_team 분석 데이터

        Returns:
            {
                "market": "KR",
                "regime": "UPTREND",
                "confidence": 0.72,
                "features": {
                    "index_trend": 0.68,
                    "volatility": 0.42,
                    "liquidity": 0.75,
                    "news_intensity": 0.55
                },
                "reason": "지수와 대형주가 동반 상승하고 거래대금이 평균 이상"
            }
        """

        # 기본값 설정 (데이터 부족 시)
        index_trend = index_trend or 0.5  # 중립
        volatility = volatility or 0.5  # 중간
        liquidity = liquidity or 0.6  # 평균
        news_intensity = news_intensity or 0.3  # 낮음

        # 시장 분석 데이터 활용
        if market_analysis:
            index_trend = market_analysis.get("index_trend", index_trend)
            volatility = market_analysis.get("volatility", volatility)
            liquidity = market_analysis.get("liquidity", liquidity)
            news_intensity = market_analysis.get("news_intensity", news_intensity)

        # 국면 판정 로직
        regime, confidence, reason = self._classify_regime(
            index_trend=index_trend,
            volatility=volatility,
            liquidity=liquidity,
            news_intensity=news_intensity,
        )

        # 기록 추가
        self.recent_regimes.append(regime)
        if len(self.recent_regimes) > 5:
            self.recent_regimes.pop(0)

        result = {
            "market": market,
            "regime": regime,
            "confidence": confidence,
            "features": {
                "index_trend": index_trend,
                "volatility": volatility,
                "liquidity": liquidity,
                "news_intensity": news_intensity,
            },
            "reason": reason,
            "timestamp": datetime.now().isoformat(),
        }

        logger.info(
            f"🌍 시장 국면 [{market}]: {regime} (신뢰도: {confidence:.2f}) - {reason}"
        )

        return result

    def _classify_regime(
        self, index_trend: float, volatility: float, liquidity: float, news_intensity: float
    ) -> tuple:
        """
        개별 지표를 조합하여 국면을 판정합니다.

        Returns:
            (regime, confidence, reason)
        """

        # 변동성이 높으면 고변동성 장세
        if volatility > 0.70:
            confidence = volatility  # 변동성이 높을수록 신뢰도 높음
            reason = f"고변동성 장세 (변동성: {volatility:.2f})"
            return MarketRegime.HIGH_VOLATILITY, confidence, reason

        # 유동성이 낮으면 저유동성 장세
        if liquidity < 0.40:
            confidence = 1.0 - liquidity  # 유동성이 낮을수록 신뢰도 높음
            reason = f"저유동성 장세 (거래대금 부족: {liquidity:.2f})"
            return MarketRegime.LOW_LIQUIDITY, confidence, reason

        # 뉴스 강도가 높으면 이벤트 장세
        if news_intensity > 0.70:
            confidence = news_intensity
            reason = f"이벤트/뉴스 장세 (뉴스 강도: {news_intensity:.2f})"
            return MarketRegime.EVENT_DRIVEN, confidence, reason

        # 지수 추세 판정 (0.5를 중심으로 ±0.25 범위)
        if index_trend > 0.60:
            # 상승 추세
            confidence = min(index_trend, 0.9)
            reason = f"상승 추세장 (지수: {index_trend:.2f}, 유동성: {liquidity:.2f})"
            return MarketRegime.UPTREND, confidence, reason

        elif index_trend < 0.40:
            # 하락 추세
            confidence = min(1.0 - index_trend, 0.9)
            reason = f"하락 추세장 (지수: {index_trend:.2f}, 변동성: {volatility:.2f})"
            return MarketRegime.DOWNTREND, confidence, reason

        else:
            # 박스권 (0.40 ~ 0.60)
            confidence = 1.0 - abs(index_trend - 0.5) * 2  # 0.5에 가까울수록 높음
            reason = f"박스권/보합 (지수: {index_trend:.2f})"
            return MarketRegime.SIDEWAYS, confidence, reason

    def get_regime_change_alert(self) -> Optional[Dict[str, Any]]:
        """
        최근 국면 변화가 있었는지 확인하고 알림을 반환합니다.

        Returns:
            국면 변화가 없으면 None
            변화가 있으면 {"previous": "...", "current": "...", "change_count": N}
        """

        if len(self.recent_regimes) < 2:
            return None

        prev = self.recent_regimes[-2]
        current = self.recent_regimes[-1]

        if prev != current:
            logger.warning(f"⚠️ 시장 국면 변화: {prev} → {current}")
            return {
                "previous": prev,
                "current": current,
                "change_count": len(self.recent_regimes),
            }

        return None

    def get_current_regime(self) -> Optional[str]:
        """현재 시장 국면을 반환합니다."""
        return self.recent_regimes[-1] if self.recent_regimes else None


# 테스트용
async def main():
    detector = MarketRegimeDetector()

    # 테스트 케이스 1: 상승 추세
    result1 = await detector.detect_regime(
        market="KR",
        index_trend=0.75,
        volatility=0.35,
        liquidity=0.80,
        news_intensity=0.40,
    )
    print(f"\n테스트 1 - 상승 추세: {result1}")

    # 테스트 케이스 2: 고변동성
    result2 = await detector.detect_regime(
        market="US",
        index_trend=0.50,
        volatility=0.85,
        liquidity=0.70,
        news_intensity=0.60,
    )
    print(f"\n테스트 2 - 고변동성: {result2}")

    # 테스트 케이스 3: 저유동성
    result3 = await detector.detect_regime(
        market="KR",
        index_trend=0.45,
        volatility=0.40,
        liquidity=0.25,
        news_intensity=0.30,
    )
    print(f"\n테스트 3 - 저유동성: {result3}")


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
