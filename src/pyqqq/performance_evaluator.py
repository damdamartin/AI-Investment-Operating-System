"""
성과평가·학습 시스템 - 실제 거래 결과를 분석하고 팀의 프롬프트를 자동으로 개선합니다.
"""

import json
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from dataclasses import dataclass


@dataclass
class SignalAccuracy:
    """신호 정확도 기록"""
    team_name: str
    symbol: str
    signal: str
    predicted_direction: str  # UP, DOWN, NEUTRAL
    actual_direction: str     # UP, DOWN, NEUTRAL
    accuracy: bool
    confidence: float
    return_pct: float
    timestamp: datetime


class PerformanceEvaluator:
    """
    성과평가·학습 시스템
    - 신호 정확도 측정
    - 팀별 기여도 분석
    - 프롬프트 자동 개선
    """

    def __init__(self):
        self.signal_records: List[SignalAccuracy] = []
        self.team_metrics = {
            "research": {"correct": 0, "total": 0, "avg_confidence": 0},
            "analysis": {"correct": 0, "total": 0, "avg_confidence": 0},
            "strategy": {"correct": 0, "total": 0, "avg_confidence": 0}
        }
        self.improvement_suggestions = []

    def record_signal(
        self,
        team_name: str,
        symbol: str,
        signal: str,
        confidence: float,
        entry_price: float,
        exit_price: float,
        exit_reason: str = "target_reached"
    ) -> None:
        """
        신호 결과를 기록합니다.

        Args:
            team_name: 팀 이름 (research, analysis, strategy)
            symbol: 종목코드
            signal: BUY/SELL/HOLD
            confidence: 신뢰도 (0~1)
            entry_price: 진입가
            exit_price: 종료가
            exit_reason: TAKE_PROFIT, STOP_LOSS, MANUAL
        """

        # 실제 방향 계산
        return_pct = (exit_price - entry_price) / entry_price
        actual_direction = "UP" if return_pct > 0.01 else "DOWN" if return_pct < -0.01 else "NEUTRAL"

        # 예측 방향
        predicted_direction = "UP" if signal == "BUY" else "DOWN" if signal == "SELL" else "NEUTRAL"

        # 정확도 계산
        accuracy = (
            (predicted_direction == "UP" and actual_direction == "UP") or
            (predicted_direction == "DOWN" and actual_direction == "DOWN") or
            (predicted_direction == "NEUTRAL" and actual_direction == "NEUTRAL")
        )

        record = SignalAccuracy(
            team_name=team_name,
            symbol=symbol,
            signal=signal,
            predicted_direction=predicted_direction,
            actual_direction=actual_direction,
            accuracy=accuracy,
            confidence=confidence,
            return_pct=return_pct,
            timestamp=datetime.now()
        )

        self.signal_records.append(record)

        # 팀 메트릭 업데이트
        self._update_team_metrics(team_name, accuracy, confidence)

    def _update_team_metrics(self, team_name: str, accuracy: bool, confidence: float) -> None:
        """팀 메트릭 업데이트"""

        if team_name not in self.team_metrics:
            return

        metrics = self.team_metrics[team_name]
        metrics["total"] += 1

        if accuracy:
            metrics["correct"] += 1

        # 평균 신뢰도 업데이트
        old_avg = metrics["avg_confidence"]
        new_avg = (old_avg * (metrics["total"] - 1) + confidence) / metrics["total"]
        metrics["avg_confidence"] = new_avg

    def get_team_accuracy(self, team_name: str, period_days: int = 7) -> Dict[str, Any]:
        """
        팀의 신호 정확도를 조회합니다.

        Args:
            team_name: 팀 이름
            period_days: 기간 (기본 7일)

        Returns:
            {
                'accuracy': 정확도,
                'correct': 맞은 신호,
                'total': 전체 신호,
                'avg_confidence': 평균 신뢰도,
                'avg_return': 평균 수익률
            }
        """

        cutoff_date = datetime.now() - timedelta(days=period_days)
        recent_records = [
            r for r in self.signal_records
            if r.team_name == team_name and r.timestamp >= cutoff_date
        ]

        if not recent_records:
            return {
                "team": team_name,
                "accuracy": 0,
                "correct": 0,
                "total": 0,
                "avg_confidence": 0,
                "avg_return": 0,
                "period_days": period_days
            }

        correct = sum(1 for r in recent_records if r.accuracy)
        total = len(recent_records)
        avg_confidence = sum(r.confidence for r in recent_records) / total
        avg_return = sum(r.return_pct for r in recent_records) / total

        return {
            "team": team_name,
            "accuracy": correct / total if total > 0 else 0,
            "correct": correct,
            "total": total,
            "avg_confidence": avg_confidence,
            "avg_return": avg_return,
            "period_days": period_days
        }

    def generate_improvement_suggestions(self) -> List[Dict[str, Any]]:
        """
        팀별 프롬프트 개선 제안을 생성합니다.
        """

        suggestions = []

        for team_name in ["research", "analysis", "strategy"]:
            accuracy = self.get_team_accuracy(team_name)

            if accuracy["total"] < 5:
                continue

            accuracy_pct = accuracy["accuracy"] * 100
            confidence = accuracy["avg_confidence"]

            if accuracy_pct < 60:
                # 정확도가 낮은 경우
                suggestions.append({
                    "team": team_name,
                    "issue": "LOW_ACCURACY",
                    "current_accuracy": accuracy_pct,
                    "target_accuracy": 75,
                    "suggestions": self._get_accuracy_improvement_tips(team_name, accuracy)
                })

            elif accuracy_pct > 75 and confidence > 0.7:
                # 정확도가 높은 경우 - 더 공격적으로 조정
                suggestions.append({
                    "team": team_name,
                    "issue": "HIGH_PERFORMANCE",
                    "suggestion": f"{team_name}팀의 신호를 더 적극적으로 활용하세요.",
                    "recommended_weight_increase": 0.05
                })

            elif accuracy_pct > 50 and accuracy["avg_return"] < 0:
                # 정확도는 있지만 수익이 음수인 경우
                suggestions.append({
                    "team": team_name,
                    "issue": "NEGATIVE_RETURNS",
                    "suggestion": f"{team_name}팀의 손절/익절 규칙을 검토하세요.",
                    "recommendations": [
                        "익절 목표 상향 조정",
                        "손절 기준 재검토",
                        "포지션 크기 최적화"
                    ]
                })

        self.improvement_suggestions = suggestions
        return suggestions

    def _get_accuracy_improvement_tips(self, team_name: str, accuracy: Dict) -> List[str]:
        """팀별 정확도 개선 팁"""

        if team_name == "research":
            return [
                "뉴스 분석 가중치 조정 (속보 vs 배경 뉴스)",
                "감정 분석(sentiment) 기준 재검토",
                "산업별 뉴스 민감도 조정",
                "공시 정보와 주가 움직임 상관성 재분석"
            ]

        elif team_name == "analysis":
            return [
                "기술지표 조합 최적화 (RSI, MACD, 이동평균)",
                "시간대별 분석 기준 조정 (일봉 vs 주봉)",
                "저항선/지지선 계산 방식 재검토",
                "거래량 분석 가중치 증가"
            ]

        elif team_name == "strategy":
            return [
                "손절가 기준 재설정 (현재 -2% vs -3%)",
                "익절가 목표 재설정 (현재 +3% vs +5%)",
                "진입 타이밍 최적화",
                "포지션 크기 동적 조정 로직 추가"
            ]

        return []

    def generate_daily_report(self) -> Dict[str, Any]:
        """일일 성과 리포트 생성"""

        today = datetime.now().date()
        today_records = [r for r in self.signal_records if r.timestamp.date() == today]

        if not today_records:
            return {"date": today.isoformat(), "status": "no_data"}

        total_signals = len(today_records)
        correct_signals = sum(1 for r in today_records if r.accuracy)
        accuracy = correct_signals / total_signals if total_signals > 0 else 0
        avg_return = sum(r.return_pct for r in today_records) / total_signals if total_signals > 0 else 0

        # 팀별 성과
        team_performance = {}
        for team in ["research", "analysis", "strategy"]:
            team_records = [r for r in today_records if r.team_name == team]
            if team_records:
                team_accuracy = sum(1 for r in team_records if r.accuracy) / len(team_records)
                team_performance[team] = {
                    "signals": len(team_records),
                    "accuracy": team_accuracy,
                    "avg_return": sum(r.return_pct for r in team_records) / len(team_records)
                }

        return {
            "date": today.isoformat(),
            "total_signals": total_signals,
            "correct_signals": correct_signals,
            "overall_accuracy": accuracy,
            "avg_return": avg_return,
            "team_performance": team_performance,
            "improvements": self.generate_improvement_suggestions()
        }

    def export_metrics(self, filepath: str) -> None:
        """메트릭을 파일로 내보내기"""

        metrics = {
            "timestamp": datetime.now().isoformat(),
            "team_metrics": self.team_metrics,
            "total_signals": len(self.signal_records),
            "daily_report": self.generate_daily_report()
        }

        with open(filepath, "w") as f:
            json.dump(metrics, f, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    evaluator = PerformanceEvaluator()

    # 테스트 데이터
    evaluator.record_signal(
        team_name="research",
        symbol="005930",
        signal="BUY",
        confidence=0.8,
        entry_price=70000,
        exit_price=71500,  # +2.14%
        exit_reason="TAKE_PROFIT"
    )

    evaluator.record_signal(
        team_name="analysis",
        symbol="000660",
        signal="BUY",
        confidence=0.75,
        entry_price=140000,
        exit_price=138500,  # -1.07%
        exit_reason="STOP_LOSS"
    )

    # 리포트 생성
    report = evaluator.generate_daily_report()
    print(json.dumps(report, indent=2, ensure_ascii=False))

    # 개선 제안
    suggestions = evaluator.generate_improvement_suggestions()
    print("\n[개선 제안]")
    print(json.dumps(suggestions, indent=2, ensure_ascii=False))
