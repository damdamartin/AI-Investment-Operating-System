"""
성과 복기 엔진 - 거래 결과를 기반으로 팀별 판단의 정확도를 계산하고 개선 방안을 제시
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
from collections import defaultdict

logger = logging.getLogger(__name__)


class PerformanceReviewEngine:
    """
    거래 결과를 분석하여 팀별 정확도를 계산합니다.

    decision_logger에서 읽은 이벤트를 바탕으로:
    - 각 팀의 신호가 얼마나 정확했는지
    - 시장 국면별 승률
    - 매매 유형별 승률
    - 개선 추천사항
    """

    def __init__(self):
        # 팀별 성과
        self.team_metrics = {
            "research": {"correct": 0, "total": 0, "accuracy": 0.0},
            "analysis": {"correct": 0, "total": 0, "accuracy": 0.0},
            "strategy": {"correct": 0, "total": 0, "accuracy": 0.0},
        }

        # 시장 국면별 성과
        self.regime_metrics = defaultdict(lambda: {
            "correct": 0, "total": 0, "accuracy": 0.0
        })

        # 매매 유형별 성과
        self.trade_type_metrics = defaultdict(lambda: {
            "correct": 0, "total": 0, "accuracy": 0.0
        })

        # 거래 기록
        self.trades = []

    def record_trade_result(
        self,
        symbol: str,
        entry_price: float,
        exit_price: float,
        quantity: float,
        entry_time: datetime,
        exit_time: datetime,
        market_regime: str,
        trade_type: str,
        research_signal: Optional[str] = None,
        analysis_signal: Optional[str] = None,
        strategy_action: Optional[str] = None,
        research_score: float = 0.5,
        analysis_score: float = 0.5,
        strategy_score: float = 0.5,
    ) -> None:
        """
        거래 결과를 기록합니다.

        Args:
            symbol: 종목코드
            entry_price: 진입가
            exit_price: 종료가
            quantity: 거래량
            entry_time: 진입 시간
            exit_time: 종료 시간
            market_regime: 시장 국면
            trade_type: 매매 유형
            research_signal: 리서치팀 신호
            analysis_signal: 분석팀 신호
            strategy_action: 전략팀 신호
            research_score: 리서치팀 신뢰도
            analysis_score: 분석팀 신뢰도
            strategy_score: 전략팀 신뢰도
        """

        # 거래 손익 계산
        realized_pnl = (exit_price - entry_price) * quantity
        realized_pnl_pct = (exit_price - entry_price) / entry_price

        # 거래 성공 판단 (수익 > 0)
        is_profitable = realized_pnl > 0

        trade_record = {
            "symbol": symbol,
            "entry_price": entry_price,
            "exit_price": exit_price,
            "realized_pnl": realized_pnl,
            "realized_pnl_pct": realized_pnl_pct,
            "is_profitable": is_profitable,
            "holding_period_hours": (exit_time - entry_time).total_seconds() / 3600,
            "market_regime": market_regime,
            "trade_type": trade_type,
            "entry_time": entry_time.isoformat(),
            "exit_time": exit_time.isoformat(),
        }

        self.trades.append(trade_record)

        # 팀별 정확도 업데이트
        for team, signal, score in [
            ("research", research_signal, research_score),
            ("analysis", analysis_signal, analysis_score),
            ("strategy", strategy_action, strategy_score),
        ]:
            if signal and signal.upper() in ["BUY", "SELL"]:
                self.team_metrics[team]["total"] += 1

                # 신호가 맞았는지 판정
                if (signal.upper() == "BUY" and is_profitable) or \
                   (signal.upper() == "SELL" and not is_profitable):
                    self.team_metrics[team]["correct"] += 1

                # 정확도 재계산
                self.team_metrics[team]["accuracy"] = (
                    self.team_metrics[team]["correct"] / self.team_metrics[team]["total"]
                )

        # 시장 국면별 성과 업데이트
        self.regime_metrics[market_regime]["total"] += 1
        if is_profitable:
            self.regime_metrics[market_regime]["correct"] += 1
        self.regime_metrics[market_regime]["accuracy"] = (
            self.regime_metrics[market_regime]["correct"] /
            self.regime_metrics[market_regime]["total"]
        )

        # 매매 유형별 성과 업데이트
        self.trade_type_metrics[trade_type]["total"] += 1
        if is_profitable:
            self.trade_type_metrics[trade_type]["correct"] += 1
        self.trade_type_metrics[trade_type]["accuracy"] = (
            self.trade_type_metrics[trade_type]["correct"] /
            self.trade_type_metrics[trade_type]["total"]
        )

        logger.info(
            f"📊 거래 기록 [{symbol}]: "
            f"{realized_pnl_pct:+.2%} "
            f"({market_regime} / {trade_type})"
        )

    def get_team_performance(self) -> Dict[str, Any]:
        """팀별 성과를 반환합니다."""
        return self.team_metrics

    def get_regime_performance(self) -> Dict[str, Any]:
        """시장 국면별 성과를 반환합니다."""
        return dict(self.regime_metrics)

    def get_trade_type_performance(self) -> Dict[str, Any]:
        """매매 유형별 성과를 반환합니다."""
        return dict(self.trade_type_metrics)

    def generate_performance_report(self) -> Dict[str, Any]:
        """
        전체 성과 보고서를 생성합니다.

        Returns:
            {
                "total_trades": 10,
                "profitable_trades": 7,
                "win_rate": 0.70,
                "avg_pnl_pct": 0.032,
                "team_performance": {...},
                "regime_performance": {...},
                "recommendations": [...]
            }
        """

        if not self.trades:
            return {
                "status": "No trades recorded",
                "total_trades": 0
            }

        total_trades = len(self.trades)
        profitable_trades = sum(1 for t in self.trades if t["is_profitable"])
        win_rate = profitable_trades / total_trades if total_trades > 0 else 0

        total_pnl_pct = sum(t["realized_pnl_pct"] for t in self.trades)
        avg_pnl_pct = total_pnl_pct / total_trades if total_trades > 0 else 0

        avg_holding_hours = sum(t["holding_period_hours"] for t in self.trades) / total_trades if total_trades > 0 else 0

        # 추천사항 생성
        recommendations = self._generate_recommendations()

        report = {
            "period": {
                "start": self.trades[0]["entry_time"] if self.trades else None,
                "end": self.trades[-1]["exit_time"] if self.trades else None,
            },
            "summary": {
                "total_trades": total_trades,
                "profitable_trades": profitable_trades,
                "losing_trades": total_trades - profitable_trades,
                "win_rate": win_rate,
                "avg_pnl_pct": avg_pnl_pct,
                "avg_holding_hours": avg_holding_hours,
            },
            "team_performance": self.team_metrics,
            "regime_performance": dict(self.regime_metrics),
            "trade_type_performance": dict(self.trade_type_metrics),
            "recommendations": recommendations,
        }

        return report

    def _generate_recommendations(self) -> List[str]:
        """
        성과 분석 결과를 바탕으로 개선 추천사항을 생성합니다.

        Returns:
            ["추천사항1", "추천사항2", ...]
        """

        recommendations = []

        # 팀별 성과 분석
        best_team = max(
            self.team_metrics.items(),
            key=lambda x: x[1]["accuracy"],
            default=("", {})
        )
        worst_team = min(
            self.team_metrics.items(),
            key=lambda x: x[1]["accuracy"] if x[1]["total"] > 0 else 1,
            default=("", {})
        )

        if best_team[0] and best_team[1]["accuracy"] > 0.6:
            recommendations.append(
                f"✅ {best_team[0]} 팀 성과 우수 ({best_team[1]['accuracy']:.0%}) - 가중치 증가 권장"
            )

        if worst_team[0] and worst_team[1]["total"] > 3 and worst_team[1]["accuracy"] < 0.4:
            recommendations.append(
                f"⚠️ {worst_team[0]} 팀 성과 부진 ({worst_team[1]['accuracy']:.0%}) - 신호 로직 검토 필요"
            )

        # 시장 국면별 분석
        best_regime = max(
            self.regime_metrics.items(),
            key=lambda x: x[1]["accuracy"],
            default=("", {})
        )
        worst_regime = min(
            self.regime_metrics.items(),
            key=lambda x: x[1]["accuracy"],
            default=("", {})
        )

        if best_regime[0] and best_regime[1]["total"] > 2:
            recommendations.append(
                f"📊 {best_regime[0]} 국면에서 성과 우수 ({best_regime[1]['accuracy']:.0%}) - "
                f"해당 국면 매매 비중 확대 권장"
            )

        if worst_regime[0] and worst_regime[1]["total"] > 2 and worst_regime[1]["accuracy"] < 0.3:
            recommendations.append(
                f"📊 {worst_regime[0]} 국면에서 성과 부진 ({worst_regime[1]['accuracy']:.0%}) - "
                f"신호 기준 강화 또는 거래 회피 권장"
            )

        # 전체 승률 분석
        win_rate = sum(1 for t in self.trades if t["is_profitable"]) / len(self.trades) if self.trades else 0

        if win_rate < 0.3:
            recommendations.append(
                "⚠️ 전체 승률이 낮음 - 신호 신뢰도 기준 상향 조정 필요"
            )

        if win_rate > 0.7:
            recommendations.append(
                "✅ 전체 승률이 높음 - 현재 전략 유지 권장"
            )

        if not recommendations:
            recommendations.append("📊 추가 분석 데이터 수집 필요 (최소 5거래 이상)")

        return recommendations

    def reset_performance(self) -> None:
        """성과 기록을 초기화합니다 (일일 리셋용)."""
        self.team_metrics = {
            "research": {"correct": 0, "total": 0, "accuracy": 0.0},
            "analysis": {"correct": 0, "total": 0, "accuracy": 0.0},
            "strategy": {"correct": 0, "total": 0, "accuracy": 0.0},
        }
        self.regime_metrics = defaultdict(lambda: {"correct": 0, "total": 0, "accuracy": 0.0})
        self.trade_type_metrics = defaultdict(lambda: {"correct": 0, "total": 0, "accuracy": 0.0})
        self.trades = []


# 테스트용
def main():
    engine = PerformanceReviewEngine()

    # 테스트 데이터 입력
    from datetime import datetime, timedelta

    now = datetime.now()

    # 거래 1: 수익
    engine.record_trade_result(
        symbol="005930",
        entry_price=50000,
        exit_price=52000,
        quantity=10,
        entry_time=now - timedelta(hours=2),
        exit_time=now,
        market_regime="UPTREND",
        trade_type="PULLBACK",
        research_signal="BUY",
        analysis_signal="BUY",
        strategy_action="BUY",
        research_score=0.75,
        analysis_score=0.70,
        strategy_score=0.72
    )

    # 거래 2: 손실
    engine.record_trade_result(
        symbol="000660",
        entry_price=50000,
        exit_price=48000,
        quantity=10,
        entry_time=now - timedelta(hours=1),
        exit_time=now,
        market_regime="UPTREND",
        trade_type="MOMENTUM",
        research_signal="BUY",
        analysis_signal="HOLD",
        strategy_action="BUY",
        research_score=0.65,
        analysis_score=0.45,
        strategy_score=0.60
    )

    # 보고서 생성
    report = engine.generate_performance_report()
    print("\n=== 성과 복기 보고서 ===")
    print(f"총 거래: {report['summary']['total_trades']}건")
    print(f"승률: {report['summary']['win_rate']:.0%}")
    print(f"평균 수익: {report['summary']['avg_pnl_pct']:+.2%}")
    print(f"\n팀 성과: {report['team_performance']}")
    print(f"\n추천사항:")
    for rec in report['recommendations']:
        print(f"  - {rec}")


if __name__ == "__main__":
    main()
