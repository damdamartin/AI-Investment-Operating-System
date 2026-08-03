"""기술적 지표 계산"""

from typing import List, Dict, Optional
import statistics


class TechnicalIndicators:
    """암호화폐 시장 분석용 기술적 지표"""

    @staticmethod
    def calculate_sma(prices: List[float], period: int = 20) -> Optional[float]:
        """단순이동평균 (Simple Moving Average)"""
        if len(prices) < period:
            return None
        return statistics.mean(prices[-period:])

    @staticmethod
    def calculate_ema(prices: List[float], period: int = 12) -> Optional[float]:
        """지수이동평균 (Exponential Moving Average)"""
        if len(prices) < period:
            return None

        multiplier = 2 / (period + 1)
        ema = statistics.mean(prices[:period])

        for price in prices[period:]:
            ema = price * multiplier + ema * (1 - multiplier)

        return ema

    @staticmethod
    def calculate_rsi(prices: List[float], period: int = 14) -> Optional[float]:
        """상대강도지수 (Relative Strength Index)"""
        if len(prices) < period + 1:
            return None

        deltas = [prices[i] - prices[i-1] for i in range(1, len(prices))]
        gains = [d if d > 0 else 0 for d in deltas]
        losses = [-d if d < 0 else 0 for d in deltas]

        avg_gain = statistics.mean(gains[-period:])
        avg_loss = statistics.mean(losses[-period:])

        if avg_loss == 0:
            return 100 if avg_gain > 0 else 50

        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))
        return rsi

    @staticmethod
    def calculate_macd(prices: List[float]) -> Optional[Dict[str, float]]:
        """MACD (이동평균수렴확산)"""
        if len(prices) < 26:
            return None

        ema12 = TechnicalIndicators.calculate_ema(prices, period=12)
        ema26 = TechnicalIndicators.calculate_ema(prices, period=26)

        if not ema12 or not ema26:
            return None

        macd_line = ema12 - ema26
        signal_line = ema12 * 0.3  # 간단한 신호선 (실제로는 9일 EMA)
        histogram = macd_line - signal_line

        return {
            "macd": macd_line,
            "signal": signal_line,
            "histogram": histogram
        }

    @staticmethod
    def calculate_bollinger_bands(prices: List[float], period: int = 20) -> Optional[Dict[str, float]]:
        """볼린저 밴드 (Bollinger Bands)"""
        if len(prices) < period:
            return None

        recent_prices = prices[-period:]
        sma = statistics.mean(recent_prices)
        std_dev = statistics.stdev(recent_prices)

        return {
            "upper": sma + (2 * std_dev),
            "middle": sma,
            "lower": sma - (2 * std_dev),
            "std_dev": std_dev
        }

    @staticmethod
    def calculate_volume_trend(volumes: List[float], period: int = 5) -> Optional[float]:
        """거래량 추세 (평균 대비 현재 거래량 비율)"""
        if len(volumes) < period:
            return None

        avg_volume = statistics.mean(volumes[-period:])
        if avg_volume == 0:
            return 1.0

        current_volume = volumes[-1]
        return current_volume / avg_volume

    @staticmethod
    def get_price_momentum(prices: List[float], period: int = 5) -> Optional[float]:
        """가격 모멘텀 (최근 변화율)"""
        if len(prices) < period + 1:
            return None

        old_price = prices[-period-1]
        current_price = prices[-1]

        if old_price == 0:
            return 0

        return ((current_price - old_price) / old_price) * 100

    @staticmethod
    def analyze_price_action(prices: List[float], period: int = 10) -> Dict[str, str]:
        """가격 행동 분석"""
        if len(prices) < period:
            return {"trend": "insufficient_data"}

        recent = prices[-period:]
        higher_lows = all(recent[i] > recent[i-1] for i in range(1, len(recent)))
        higher_highs = all(recent[i] >= recent[i-1] for i in range(1, len(recent)))
        lower_highs = all(recent[i] < recent[i-1] for i in range(1, len(recent)))
        lower_lows = all(recent[i] <= recent[i-1] for i in range(1, len(recent)))

        if higher_lows and higher_highs:
            trend = "uptrend"
        elif lower_highs and lower_lows:
            trend = "downtrend"
        else:
            trend = "sideways"

        return {"trend": trend}


def analyze_market(ticker: Dict, ohlc_data: List[Dict]) -> Dict[str, any]:
    """시장 분석 종합"""
    if not ohlc_data or len(ohlc_data) < 2:
        return {"error": "insufficient_data"}

    prices = [candle["closing_price"] for candle in ohlc_data]
    volumes = [candle.get("candle_acc_trade_volume", 0) for candle in ohlc_data]

    indicators = {
        "sma_20": TechnicalIndicators.calculate_sma(prices, 20),
        "sma_50": TechnicalIndicators.calculate_sma(prices, 50),
        "ema_12": TechnicalIndicators.calculate_ema(prices, 12),
        "rsi_14": TechnicalIndicators.calculate_rsi(prices, 14),
        "macd": TechnicalIndicators.calculate_macd(prices),
        "bollinger_bands": TechnicalIndicators.calculate_bollinger_bands(prices, 20),
        "volume_trend": TechnicalIndicators.calculate_volume_trend(volumes, 5),
        "momentum_5d": TechnicalIndicators.get_price_momentum(prices, 5),
        "momentum_10d": TechnicalIndicators.get_price_momentum(prices, 10),
        "price_action": TechnicalIndicators.analyze_price_action(prices, 10),
        "current_price": ticker.get("trade_price", 0),
        "24h_high": ticker.get("high_price", 0),
        "24h_low": ticker.get("low_price", 0),
        "volume": ticker.get("trade_volume", 0)
    }

    return indicators
