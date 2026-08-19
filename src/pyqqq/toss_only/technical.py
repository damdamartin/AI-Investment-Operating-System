from __future__ import annotations

from statistics import mean

from .models import Candle, Quote, Signal, TechnicalSetup


class TechnicalSetupAnalyzer:
    """Finds actionable entry, stop, and target levels from OHLCV candles."""

    def analyze(self, quote: Quote, candles: list[Candle]) -> TechnicalSetup:
        if quote.price <= 0:
            return self._no_data(quote, "invalid quote price")
        if len(candles) < 30:
            return self._no_data(quote, "need at least 30 candles")

        closes = [c.close for c in candles]
        highs = [c.high for c in candles]
        lows = [c.low for c in candles]
        volumes = [c.volume for c in candles]

        support = min(lows[-20:])
        resistance = max(highs[-20:])
        atr = _atr(candles[-15:])
        sma_20 = mean(closes[-20:])
        sma_50 = mean(closes[-50:]) if len(closes) >= 50 else mean(closes)
        rsi = _rsi(closes[-15:])
        volume_ratio = volumes[-1] / max(1, mean(volumes[-20:-1]))

        reasoning: list[str] = []
        score = 0.0

        if quote.price > sma_20:
            score += 0.20
            reasoning.append("price above 20-period average")
        if sma_20 > sma_50:
            score += 0.20
            reasoning.append("20-period average above long average")
        if quote.price >= resistance * 0.995:
            score += 0.20
            reasoning.append("testing or breaking recent resistance")
        elif quote.price <= support * 1.03:
            score += 0.12
            reasoning.append("near recent support")
        if 45 <= rsi <= 68:
            score += 0.18
            reasoning.append("RSI in constructive range")
        if volume_ratio >= 1.20:
            score += 0.17
            reasoning.append("volume expansion confirmed")
        if quote.change_pct is not None and quote.change_pct > 0:
            score += 0.05
            reasoning.append("positive intraday momentum")

        entry = quote.ask or quote.price
        stop_from_support = support - (atr * 0.35)
        stop_from_atr = entry - (atr * 1.4)
        stop_loss = max(0.01, min(stop_from_support, stop_from_atr))
        take_profit = max(resistance + atr, entry + (entry - stop_loss) * 2.0)
        downside_pct = ((entry - stop_loss) / entry) * 100 if entry > 0 else None
        upside_pct = ((take_profit - entry) / entry) * 100 if entry > 0 else None
        reward_risk_ratio = (take_profit - entry) / (entry - stop_loss) if entry > stop_loss else None

        if reward_risk_ratio is not None and reward_risk_ratio < 1.5:
            score -= 0.15
            reasoning.append("reward/risk below preferred threshold")

        if score >= 0.40 and stop_loss < entry < take_profit:  # 낮춤: 0.50 → 0.40
            return TechnicalSetup(
                symbol=quote.symbol,
                market=quote.market,
                currency=quote.currency,
                signal=Signal.BUY,
                confidence=round(min(0.95, score), 4),
                entry_price=round(entry, 4),
                stop_loss=round(stop_loss, 4),
                take_profit=round(take_profit, 4),
                support=round(support, 4),
                resistance=round(resistance, 4),
                upside_pct=round(upside_pct, 4) if upside_pct is not None else None,
                downside_pct=round(downside_pct, 4) if downside_pct is not None else None,
                reward_risk_ratio=round(reward_risk_ratio, 4) if reward_risk_ratio is not None else None,
                reasoning=reasoning,
            )

        return TechnicalSetup(
            symbol=quote.symbol,
            market=quote.market,
            currency=quote.currency,
            signal=Signal.HOLD,
            confidence=round(score, 4),
            entry_price=round(entry, 4),
            stop_loss=round(stop_loss, 4),
            take_profit=round(take_profit, 4),
            support=round(support, 4),
            resistance=round(resistance, 4),
            upside_pct=round(upside_pct, 4) if upside_pct is not None else None,
            downside_pct=round(downside_pct, 4) if downside_pct is not None else None,
            reward_risk_ratio=round(reward_risk_ratio, 4) if reward_risk_ratio is not None else None,
            reasoning=reasoning or ["setup score below entry threshold"],
        )

    def _no_data(self, quote: Quote, reason: str) -> TechnicalSetup:
        return TechnicalSetup(
            symbol=quote.symbol,
            market=quote.market,
            currency=quote.currency,
            signal=Signal.NO_DATA,
            confidence=0.0,
            entry_price=None,
            stop_loss=None,
            take_profit=None,
            support=None,
            resistance=None,
            upside_pct=None,
            downside_pct=None,
            reward_risk_ratio=None,
            reasoning=[reason],
        )


def _atr(candles: list[Candle]) -> float:
    ranges = [max(c.high - c.low, abs(c.high - c.close), abs(c.low - c.close)) for c in candles]
    return mean(ranges) if ranges else 0.0


def _rsi(closes: list[float]) -> float:
    if len(closes) < 2:
        return 50.0
    gains: list[float] = []
    losses: list[float] = []
    for previous, current in zip(closes, closes[1:]):
        delta = current - previous
        if delta >= 0:
            gains.append(delta)
        else:
            losses.append(abs(delta))
    avg_gain = mean(gains) if gains else 0.0
    avg_loss = mean(losses) if losses else 0.0
    if avg_loss == 0:
        return 100.0 if avg_gain > 0 else 50.0
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))
