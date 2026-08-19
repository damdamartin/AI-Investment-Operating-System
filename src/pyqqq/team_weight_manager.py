"""
팀 가중치 관리자 - 시장 국면과 성과에 따라 팀별 신호 가중치를 동적 조정
"""

import logging
from typing import Dict, Any
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class TeamWeights:
    """팀별 가중치"""
    research: float = 0.25  # 리서치팀
    analysis: float = 0.35  # 분석팀
    strategy: float = 0.25  # 전략팀
    regime: float = 0.15  # 시장 국면


class TeamWeightManager:
    """
    시장 국면과 팀별 성과에 따라 신호 가중치를 동적으로 조정합니다.

    orchestrator.py의 _ensemble_signals()에서 사용되며,
    각 팀의 과거 판단이 얼마나 정확했는지 반영합니다.
    """

    # 기본 가중치
    DEFAULT_WEIGHTS = TeamWeights(
        research=0.25,
        analysis=0.35,
        strategy=0.25,
        regime=0.15
    )

    # 시장 국면별 가중치 조정
    REGIME_WEIGHTS = {
        "UPTREND": {
            "research": 0.20,
            "analysis": 0.35,
            "strategy": 0.30,
            "regime": 0.15
        },
        "DOWNTREND": {
            "research": 0.20,
            "analysis": 0.25,
            "strategy": 0.20,
            "regime": 0.35  # 다운트렌드에서는 국면 신호를 더 중시
        },
        "SIDEWAYS": {
            "research": 0.25,
            "analysis": 0.30,
            "strategy": 0.30,
            "regime": 0.15
        },
        "HIGH_VOLATILITY": {
            "research": 0.20,
            "analysis": 0.20,
            "strategy": 0.20,
            "regime": 0.40  # 고변동성에서는 국면 우선
        },
        "LOW_LIQUIDITY": {
            "research": 0.15,
            "analysis": 0.20,
            "strategy": 0.15,
            "regime": 0.50  # 저유동성에서는 거래 자제
        },
        "EVENT_DRIVEN": {
            "research": 0.40,  # 이벤트에서는 리서치 중시
            "analysis": 0.20,
            "strategy": 0.25,
            "regime": 0.15
        }
    }

    def __init__(self):
        self.current_weights = TeamWeights(**self.DEFAULT_WEIGHTS.__dict__)
        self.team_performance = {
            "research": {"correct": 0, "total": 0, "accuracy": 0.5},
            "analysis": {"correct": 0, "total": 0, "accuracy": 0.5},
            "strategy": {"correct": 0, "total": 0, "accuracy": 0.5},
        }
        self.regime_history = []  # 최근 시장 국면 기록

    def get_weights(self, market_regime: str = None) -> Dict[str, float]:
        """
        현재 적용할 가중치를 반환합니다.

        Args:
            market_regime: "UPTREND", "DOWNTREND", "SIDEWAYS" 등

        Returns:
            {
                "research": 0.25,
                "analysis": 0.35,
                "strategy": 0.25,
                "regime": 0.15
            }
        """

        # 시장 국면 기반 가중치 선택
        if market_regime and market_regime in self.REGIME_WEIGHTS:
            regime_weights = self.REGIME_WEIGHTS[market_regime]
            self.current_weights = TeamWeights(**regime_weights)
            logger.info(
                f"📊 팀 가중치 조정 [{market_regime}]: "
                f"R={regime_weights['research']:.2f} "
                f"A={regime_weights['analysis']:.2f} "
                f"S={regime_weights['strategy']:.2f} "
                f"Regime={regime_weights['regime']:.2f}"
            )
        else:
            self.current_weights = TeamWeights(**self.DEFAULT_WEIGHTS.__dict__)

        return {
            "research": self.current_weights.research,
            "analysis": self.current_weights.analysis,
            "strategy": self.current_weights.strategy,
            "regime": self.current_weights.regime
        }

    def update_team_performance(
        self,
        team: str,  # "research", "analysis", "strategy"
        was_correct: bool,
    ) -> None:
        """
        팀의 판단이 맞았는지 기록하고 정확도를 업데이트합니다.

        Args:
            team: "research", "analysis", "strategy"
            was_correct: 판단이 맞았는지 여부
        """

        if team not in self.team_performance:
            logger.warning(f"⚠️ 알 수 없는 팀: {team}")
            return

        perf = self.team_performance[team]
        perf["total"] += 1
        if was_correct:
            perf["correct"] += 1

        # 정확도 업데이트 (최소 1, 최대 5 거래로 계산)
        if perf["total"] > 0:
            perf["accuracy"] = perf["correct"] / perf["total"]

        logger.info(
            f"📈 {team} 팀 성과: {perf['correct']}/{perf['total']} "
            f"({perf['accuracy']:.1%})"
        )

    def get_team_performance(self, team: str = None) -> Dict[str, Any]:
        """
        팀별 성과를 반환합니다.

        Args:
            team: 특정 팀 또는 None (모든 팀)

        Returns:
            팀별 {correct, total, accuracy}
        """

        if team:
            return self.team_performance.get(team, {})

        return self.team_performance

    def should_boost_weights(self) -> str:
        """
        성과 기반 가중치 부스트 대상을 반환합니다.

        반환값:
            - "research": 리서치팀 정확도가 높으면
            - "analysis": 분석팀 정확도가 높으면
            - "strategy": 전략팀 정확도가 높으면
            - None: 모두 비슷하면
        """

        accuracies = {
            team: data["accuracy"]
            for team, data in self.team_performance.items()
        }

        if not accuracies:
            return None

        best_team = max(accuracies, key=accuracies.get)
        best_accuracy = accuracies[best_team]

        # 다른 팀과 5% 이상 차이 나면 부스트
        avg_accuracy = sum(accuracies.values()) / len(accuracies)
        if best_accuracy > avg_accuracy + 0.05:
            logger.info(
                f"✅ {best_team} 팀 성과 우수 ({best_accuracy:.1%}) - 가중치 부스트 권장"
            )
            return best_team

        return None

    def apply_performance_boost(self, boost_team: str, boost_amount: float = 0.05) -> Dict[str, float]:
        """
        특정 팀의 가중치를 부스트합니다.

        Args:
            boost_team: "research", "analysis", "strategy"
            boost_amount: 부스트 양 (기본 5%)

        Returns:
            조정된 가중치
        """

        if boost_team not in ["research", "analysis", "strategy"]:
            logger.warning(f"⚠️ 알 수 없는 팀: {boost_team}")
            return self.get_weights()

        # 부스트 대상팀 가중치 증가
        setattr(self.current_weights, boost_team, getattr(self.current_weights, boost_team) + boost_amount)

        # 다른 팀 가중치는 유지 (regime 제외)
        total_team_weight = (
            self.current_weights.research +
            self.current_weights.analysis +
            self.current_weights.strategy
        )
        if total_team_weight > 0.85:  # 합계가 0.85를 초과하면 정규화
            scale_factor = 0.85 / total_team_weight
            self.current_weights.research *= scale_factor
            self.current_weights.analysis *= scale_factor
            self.current_weights.strategy *= scale_factor

        logger.info(f"🚀 {boost_team} 팀 가중치 부스트 (+{boost_amount:.2f})")

        return self.get_weights()

    def record_regime(self, regime: str) -> None:
        """시장 국면을 기록합니다."""
        self.regime_history.append(regime)
        if len(self.regime_history) > 10:
            self.regime_history.pop(0)

    def get_regime_distribution(self) -> Dict[str, int]:
        """최근 시장 국면 분포를 반환합니다."""
        distribution = {}
        for regime in self.regime_history:
            distribution[regime] = distribution.get(regime, 0) + 1
        return distribution


# 테스트용
def main():
    manager = TeamWeightManager()

    # 테스트 1: 기본 가중치
    print("\n=== 기본 가중치 ===")
    weights = manager.get_weights()
    print(f"기본: {weights}")

    # 테스트 2: 상승 추세 가중치
    print("\n=== 상승 추세 가중치 ===")
    weights = manager.get_weights(market_regime="UPTREND")
    print(f"상승추세: {weights}")

    # 테스트 3: 성과 기록
    print("\n=== 팀 성과 기록 ===")
    manager.update_team_performance("analysis", True)
    manager.update_team_performance("analysis", True)
    manager.update_team_performance("analysis", False)
    manager.update_team_performance("research", False)
    print(f"성과: {manager.get_team_performance()}")

    # 테스트 4: 부스트 대상
    print("\n=== 부스트 추천 ===")
    boost_team = manager.should_boost_weights()
    print(f"부스트 대상: {boost_team}")


if __name__ == "__main__":
    main()
