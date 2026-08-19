from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any


class ExecutionMode(str, Enum):
    LIVE = "LIVE"


class Signal(str, Enum):
    BUY = "BUY"
    SELL = "SELL"
    HOLD = "HOLD"
    NO_DATA = "NO_DATA"
    BLOCKED = "BLOCKED"


@dataclass(frozen=True)
class Instrument:
    symbol: str
    name: str
    market: str
    currency: str


@dataclass(frozen=True)
class CashBalance:
    usd: float
    krw: float = 0.0
    as_of: datetime = field(default_factory=datetime.utcnow)


@dataclass(frozen=True)
class Position:
    symbol: str
    market: str
    quantity: float
    average_price: float
    market_value: float
    currency: str = "USD"


@dataclass(frozen=True)
class AccountSnapshot:
    cash: CashBalance
    positions: list[Position] = field(default_factory=list)

    @property
    def us_equity(self) -> float:
        return self.cash.usd + sum(p.market_value for p in self.positions if p.currency == "USD")

    @property
    def kr_equity(self) -> float:
        return self.cash.krw + sum(p.market_value for p in self.positions if p.currency == "KRW")


@dataclass(frozen=True)
class Quote:
    symbol: str
    market: str
    price: float
    currency: str = "USD"
    bid: float | None = None
    ask: float | None = None
    volume: int | None = None
    relative_volume: float | None = None
    change_pct: float | None = None
    source: str = "unknown"
    timestamp: datetime = field(default_factory=datetime.utcnow)


@dataclass(frozen=True)
class Candle:
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: int


@dataclass(frozen=True)
class Candidate:
    symbol: str
    name: str
    market: str
    currency: str
    theme: str
    reason: str
    liquidity_score: float
    momentum_score: float
    catalyst_score: float
    issue_summary: str = ""

    @property
    def score(self) -> float:
        return round(
            self.liquidity_score * 0.30
            + self.momentum_score * 0.40
            + self.catalyst_score * 0.30,
            4,
        )


@dataclass(frozen=True)
class MarketRegime:
    risk_on_score: float
    dominant_themes: list[str]
    notes: list[str] = field(default_factory=list)

    @property
    def risk_on(self) -> bool:
        return self.risk_on_score >= 0.55


@dataclass(frozen=True)
class TechnicalSetup:
    symbol: str
    market: str
    currency: str
    signal: Signal
    confidence: float
    entry_price: float | None
    stop_loss: float | None
    take_profit: float | None
    support: float | None
    resistance: float | None
    upside_pct: float | None = None
    downside_pct: float | None = None
    reward_risk_ratio: float | None = None
    reasoning: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class TradePlan:
    symbol: str
    market: str
    currency: str
    side: str
    quantity: float
    entry_price: float
    stop_loss: float
    take_profit: float
    risk_amount: float
    notional: float
    confidence: float
    upside_pct: float | None = None
    downside_pct: float | None = None
    reward_risk_ratio: float | None = None
    rationale: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class RiskDecision:
    approved: bool
    reasons: list[str]
    adjusted_plan: TradePlan | None = None


@dataclass(frozen=True)
class OrderResult:
    submitted: bool
    mode: ExecutionMode
    symbol: str
    market: str
    order_id: str | None = None
    message: str = ""
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class TradingCycleResult:
    mode: ExecutionMode
    account: AccountSnapshot
    regime: MarketRegime
    candidates: list[Candidate]
    setups: list[TechnicalSetup]
    plans: list[TradePlan]
    risk_decisions: list[RiskDecision]
    orders: list[OrderResult]
    generated_at: datetime = field(default_factory=datetime.utcnow)
