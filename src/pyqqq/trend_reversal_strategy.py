"""
추세 전환 패턴 감지 전략
- 무릎 매수: 하락곡선에서 저점 전환 후 상승 전환 구간
- 어깨 매도: 상승곡선에서 고점 둔화/반전 후 하락 전환 구간
"""

import logging
from typing import List, Optional, Dict, Any
import numpy as np

logger = logging.getLogger(__name__)


class TrendReversalStrategy:
    """추세 전환 패턴 기반 매매 전략"""

    def __init__(self, market: str = "KR"):
        self.market = market
        self.min_data_points = 20  # 최소 데이터 포인트

    def analyze(
        self,
        prices: List[float],
        volumes: Optional[List[float]] = None,
        market: str = "KR",
    ) -> Dict[str, Any]:
        """
        추세 전환 신호 분석

        Args:
            prices: 종가 시계열 (최소 20개)
            volumes: 거래량 시계열 (선택)
            market: "KR" or "US"

        Returns:
            {
                "signal": "BUY" | "SELL" | "HOLD",
                "pattern": "KNEE_REVERSAL" | "SHOULDER_REVERSAL" | "NONE",
                "confidence": 0.0-1.0,
                "current_phase": "FALLING" | "BASING" | "RISING" | "TOPPING" | "UNKNOWN",
                "knee_score": 0.0-1.0,
                "shoulder_score": 0.0-1.0,
                "entry_price": float,
                "stop_loss_price": float,
                "take_profit_price": float,
                "reasoning": str,
                "features": {...}
            }
        """

        # 데이터 검증
        if not prices or len(prices) < self.min_data_points:
            logger.warning(f"❌ 데이터 부족: {len(prices) if prices else 0} < {self.min_data_points}")
            return self._hold_response("insufficient_price_history")

        try:
            prices = np.array(prices, dtype=float)
            volumes = np.array(volumes, dtype=float) if volumes else None

            # 기술적 지표 계산
            features = self._calculate_features(prices, volumes)

            # 현재 단계 판별
            current_phase = self._detect_phase(prices, features)

            # 무릎/어깨 패턴 감지
            knee_score = self._score_knee_pattern(prices, volumes, features)
            shoulder_score = self._score_shoulder_pattern(prices, volumes, features)

            # 최종 신호 결정
            signal, pattern, confidence = self._make_decision(
                knee_score, shoulder_score, current_phase, features
            )

            # 진입가, 손절, 익절 계산
            entry_price = float(prices[-1])
            stop_loss = self._calculate_stop_loss(prices, pattern)
            take_profit = self._calculate_take_profit(prices, pattern)

            reasoning = self._generate_reasoning(
                signal, pattern, confidence, current_phase, features
            )

            return {
                "signal": signal,
                "pattern": pattern,
                "confidence": confidence,
                "current_phase": current_phase,
                "knee_score": knee_score,
                "shoulder_score": shoulder_score,
                "entry_price": entry_price,
                "stop_loss_price": stop_loss,
                "take_profit_price": take_profit,
                "reasoning": reasoning,
                "features": features,
            }

        except Exception as e:
            logger.error(f"❌ 분석 오류: {e}")
            return self._hold_response(f"analysis_error: {str(e)}")

    def _calculate_features(self, prices: np.ndarray, volumes: Optional[np.ndarray]) -> Dict[str, Any]:
        """기술적 지표 계산"""

        # 기울기 (Slope)
        short_window = 5
        long_window = 20

        short_slope = (prices[-1] - prices[-short_window]) / short_window if len(prices) >= short_window else 0
        long_slope = (prices[-1] - prices[-long_window]) / long_window if len(prices) >= long_window else 0

        # 곡률 (Curvature) - 기울기 변화율
        mid_point = len(prices) // 2
        if len(prices) >= 10:
            first_slope = (prices[mid_point] - prices[0]) / mid_point
            second_slope = (prices[-1] - prices[mid_point]) / (len(prices) - mid_point)
            curvature = second_slope - first_slope
        else:
            curvature = 0

        # 이동평균
        ma5 = np.mean(prices[-5:]) if len(prices) >= 5 else prices[-1]
        ma10 = np.mean(prices[-10:]) if len(prices) >= 10 else prices[-1]
        ma20 = np.mean(prices[-20:]) if len(prices) >= 20 else prices[-1]

        # RSI (14-period)
        rsi = self._calculate_rsi(prices, period=14)

        # Pivot Points
        pivot_low_idx, pivot_high_idx = self._find_pivots(prices)
        pivot_low_confirmed = pivot_low_idx is not None and (len(prices) - pivot_low_idx > 2)
        pivot_high_confirmed = pivot_high_idx is not None and (len(prices) - pivot_high_idx > 2)

        # 거래량 확인
        volume_confirmation = False
        if volumes is not None and len(volumes) >= 3:
            recent_vol = volumes[-1]
            avg_vol = np.mean(volumes[-10:])
            volume_confirmation = recent_vol > avg_vol * 0.8

        return {
            "short_slope": float(short_slope),
            "long_slope": float(long_slope),
            "curvature": float(curvature),
            "ma5": float(ma5),
            "ma10": float(ma10),
            "ma20": float(ma20),
            "rsi": float(rsi),
            "pivot_low_confirmed": pivot_low_confirmed,
            "pivot_high_confirmed": pivot_high_confirmed,
            "volume_confirmation": volume_confirmation,
            "current_price": float(prices[-1]),
        }

    def _calculate_rsi(self, prices: np.ndarray, period: int = 14) -> float:
        """RSI 계산"""
        if len(prices) < period:
            return 50.0

        deltas = np.diff(prices[-period-1:])
        gains = np.where(deltas > 0, deltas, 0)
        losses = np.where(deltas < 0, -deltas, 0)

        avg_gain = np.mean(gains)
        avg_loss = np.mean(losses)

        if avg_loss == 0:
            return 100.0 if avg_gain > 0 else 50.0

        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))

        return float(rsi)

    def _find_pivots(self, prices: np.ndarray) -> tuple:
        """최근 pivot low/high 찾기"""
        if len(prices) < 5:
            return None, None

        # 최근 20개 바에서 찾기
        window = min(20, len(prices))
        recent_prices = prices[-window:]

        pivot_low_idx = None
        pivot_high_idx = None

        for i in range(1, len(recent_prices) - 1):
            if recent_prices[i] < recent_prices[i-1] and recent_prices[i] < recent_prices[i+1]:
                pivot_low_idx = len(prices) - window + i
            if recent_prices[i] > recent_prices[i-1] and recent_prices[i] > recent_prices[i+1]:
                pivot_high_idx = len(prices) - window + i

        return pivot_low_idx, pivot_high_idx

    def _detect_phase(self, prices: np.ndarray, features: Dict) -> str:
        """현재 시장 단계 판별"""
        short_slope = features["short_slope"]
        long_slope = features["long_slope"]
        curvature = features["curvature"]
        ma10 = features["ma10"]
        current = features["current_price"]

        # 하락 중
        if long_slope < 0 and short_slope < 0:
            return "FALLING"

        # 바닥/정리 중 (곡률 양수, 기울기 약화)
        if long_slope < 0 and curvature > 0:
            return "BASING"

        # 상승 중
        if long_slope > 0 and short_slope > 0 and current > ma10:
            return "RISING"

        # 꼭대기/둔화 중 (곡률 음수)
        if long_slope > 0 and curvature < 0:
            return "TOPPING"

        return "UNKNOWN"

    def _score_knee_pattern(self, prices: np.ndarray, volumes: Optional[np.ndarray], features: Dict) -> float:
        """무릎 패턴 점수 (0-1)"""
        score = 0

        # 현재 단계가 바닥/정리 중
        short_slope = features["short_slope"]
        curvature = features["curvature"]
        rsi = features["rsi"]
        pivot_low = features["pivot_low_confirmed"]

        # 기울기 약화 (상승 전환)
        if curvature > 0:
            score += 0.3

        if short_slope >= 0:  # 상승 전환
            score += 0.3

        # RSI 회복 (과매도에서 벗어남)
        if 30 < rsi < 50:
            score += 0.2

        # Pivot low 확인
        if pivot_low:
            score += 0.2

        return min(1.0, score)

    def _score_shoulder_pattern(self, prices: np.ndarray, volumes: Optional[np.ndarray], features: Dict) -> float:
        """어깨 패턴 점수 (0-1)"""
        score = 0

        short_slope = features["short_slope"]
        curvature = features["curvature"]
        rsi = features["rsi"]
        pivot_high = features["pivot_high_confirmed"]

        # 기울기 약화 (하락 전환)
        if curvature < 0:
            score += 0.3

        if short_slope <= 0:  # 하락 전환
            score += 0.3

        # RSI 과열에서 회복
        if 50 < rsi < 70:
            score += 0.2

        # Pivot high 확인
        if pivot_high:
            score += 0.2

        return min(1.0, score)

    def _make_decision(
        self,
        knee_score: float,
        shoulder_score: float,
        current_phase: str,
        features: Dict
    ) -> tuple:
        """최종 신호 결정 (signal, pattern, confidence)"""

        knee_threshold = 0.65
        shoulder_threshold = 0.65

        # 무릎 매수 조건
        if knee_score >= knee_threshold and current_phase in ["BASING", "RISING"]:
            return "BUY", "KNEE_REVERSAL", min(0.95, knee_score + 0.2)

        # 어깨 매도 조건
        if shoulder_score >= shoulder_threshold and current_phase in ["TOPPING", "FALLING"]:
            return "SELL", "SHOULDER_REVERSAL", min(0.95, shoulder_score + 0.2)

        # 기본값: HOLD
        return "HOLD", "NONE", 0.0

    def _calculate_stop_loss(self, prices: np.ndarray, pattern: str) -> float:
        """손절가 계산"""
        current = prices[-1]
        recent_low = np.min(prices[-10:])

        if pattern == "KNEE_REVERSAL":
            # 무릎 패턴: 최근 저점 아래 1-2%
            return recent_low * 0.98
        else:
            # 기본값: 현재가 -2%
            return current * 0.98

    def _calculate_take_profit(self, prices: np.ndarray, pattern: str) -> float:
        """익절가 계산"""
        current = prices[-1]

        if pattern == "KNEE_REVERSAL":
            # 무릎 패턴: 현재가 +5%
            return current * 1.05
        else:
            # 기본값: 현재가 +3%
            return current * 1.03

    def _generate_reasoning(
        self,
        signal: str,
        pattern: str,
        confidence: float,
        current_phase: str,
        features: Dict
    ) -> str:
        """신호 근거 설명"""

        if signal == "HOLD":
            return f"신호 없음 (단계: {current_phase})"

        reasoning = f"{pattern} 감지 (신뢰도: {confidence:.1%})"
        reasoning += f" | 단계: {current_phase}"
        reasoning += f" | RSI: {features['rsi']:.0f}"

        return reasoning

    def _hold_response(self, reason: str) -> Dict[str, Any]:
        """HOLD 반응 생성"""
        return {
            "signal": "HOLD",
            "pattern": "NONE",
            "confidence": 0.0,
            "current_phase": "UNKNOWN",
            "knee_score": 0.0,
            "shoulder_score": 0.0,
            "entry_price": 0.0,
            "stop_loss_price": 0.0,
            "take_profit_price": 0.0,
            "reasoning": reason,
            "features": {},
        }
