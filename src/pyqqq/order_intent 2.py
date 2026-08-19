"""
주문 의도 및 리스크 결정 구조
- OrderIntent: 매매팀이 생성하는 주문 의도
- RiskDecision: 리스크팀이 생성하는 최종 결정
"""

from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Optional
import json


@dataclass
class OrderIntent:
    """
    매매팀이 생성하는 주문 의도
    - 무엇을 매수/매도할지
    - 왜 그래야 하는지
    - 어느 정도 확신도가 있는지
    """

    symbol: str                          # 종목코드
    name: str                            # 종목명
    market: str                          # "KR" 또는 "US"
    side: str                            # "BUY", "SELL", "HOLD"
    intent_quantity: float               # 희망 수량

    reference_price: float               # 의도 작성 시점의 참고 현재가
    currency: str                        # "KRW" 또는 "USD"
    confidence: float                    # 신뢰도 (0.0-1.0)

    entry_reason: str                    # 진입 근거 (상세)
    research_reason: str                 # 리서치팀 근거
    analysis_reason: str                 # 분석팀 근거
    strategy_reason: str                 # 매매팀 근거

    stop_loss_price: Optional[float]     # 손절가 (매수 시 필수)
    take_profit_price: Optional[float]   # 익절가 (매수 시 권장)

    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    created_by_team: str = "StrategyAgent"

    def to_dict(self) -> dict:
        """dict로 변환"""
        return asdict(self)

    def to_json(self) -> str:
        """JSON 문자열로 변환"""
        return json.dumps(self.to_dict(), ensure_ascii=False, indent=2)

    def __str__(self) -> str:
        return (
            f"OrderIntent({self.symbol} {self.side} {self.intent_quantity}개 "
            f"@{self.reference_price} {self.currency}, "
            f"신뢰도: {self.confidence:.0%})"
        )


@dataclass
class RiskDecision:
    """
    리스크팀이 생성하는 최종 주문 결정
    - 주문을 승인할 것인가
    - 승인한다면 어떤 수량/손절/익절로 할 것인가
    - 승인하지 않는다면 왜인가
    """

    approved: bool                       # 승인 여부

    symbol: str                          # 종목코드
    market: str                          # "KR" 또는 "US"
    side: str                            # "BUY", "SELL", "HOLD"

    approved_quantity: float             # 승인된 수량 (0이면 주문 없음)
    reference_price: float               # 최종 참고 가격
    currency: str                        # "KRW" 또는 "USD"

    max_order_amount_krw: float          # 최대 주문 가능 금액 (KRW)
    expected_order_amount_krw: float     # 예상 주문 금액 (KRW)

    stop_loss_price: Optional[float]     # 승인된 손절가
    take_profit_price: Optional[float]   # 승인된 익절가

    max_loss_krw: float                  # 최대 손실액 (KRW)
    risk_reward_ratio: float             # 위험/수익 비율

    risk_level: str                      # "LOW", "MEDIUM", "HIGH", "BLOCKED"
    reason: str                          # 결정 사유

    checks: dict = field(default_factory=dict)  # 검증 결과 상세

    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    created_by_team: str = "RiskAgent"

    def to_dict(self) -> dict:
        """dict로 변환"""
        return asdict(self)

    def to_json(self) -> str:
        """JSON 문자열로 변환"""
        return json.dumps(self.to_dict(), ensure_ascii=False, indent=2, default=str)

    def __str__(self) -> str:
        status = "✅ 승인" if self.approved else "❌ 거절"
        return (
            f"RiskDecision({self.symbol} {self.side} {self.approved_quantity}개 "
            f"@{self.reference_price} {self.currency}, "
            f"{status}, 위험도: {self.risk_level})"
        )


class OrderIntentBuilder:
    """OrderIntent를 쉽게 생성하는 빌더"""

    def __init__(self):
        self.intent = OrderIntent(
            symbol="",
            name="",
            market="",
            side="HOLD",
            intent_quantity=0,
            reference_price=0,
            currency="KRW",
            confidence=0,
            entry_reason="",
            research_reason="",
            analysis_reason="",
            strategy_reason="",
            stop_loss_price=None,
            take_profit_price=None,
        )

    def symbol(self, sym: str, name: str = "") -> "OrderIntentBuilder":
        self.intent.symbol = sym
        self.intent.name = name
        return self

    def market(self, mkt: str) -> "OrderIntentBuilder":
        self.intent.market = mkt
        return self

    def side(self, s: str) -> "OrderIntentBuilder":
        self.intent.side = s
        return self

    def quantity(self, qty: float) -> "OrderIntentBuilder":
        self.intent.intent_quantity = qty
        return self

    def price(self, p: float, currency: str = "KRW") -> "OrderIntentBuilder":
        self.intent.reference_price = p
        self.intent.currency = currency
        return self

    def confidence(self, conf: float) -> "OrderIntentBuilder":
        self.intent.confidence = max(0, min(1, conf))
        return self

    def reasons(
        self,
        entry: str = "",
        research: str = "",
        analysis: str = "",
        strategy: str = ""
    ) -> "OrderIntentBuilder":
        if entry:
            self.intent.entry_reason = entry
        if research:
            self.intent.research_reason = research
        if analysis:
            self.intent.analysis_reason = analysis
        if strategy:
            self.intent.strategy_reason = strategy
        return self

    def stop_loss(self, sl_price: float) -> "OrderIntentBuilder":
        self.intent.stop_loss_price = sl_price
        return self

    def take_profit(self, tp_price: float) -> "OrderIntentBuilder":
        self.intent.take_profit_price = tp_price
        return self

    def build(self) -> OrderIntent:
        return self.intent


class RiskDecisionBuilder:
    """RiskDecision를 쉽게 생성하는 빌더"""

    def __init__(self):
        self.decision = RiskDecision(
            approved=False,
            symbol="",
            market="",
            side="HOLD",
            approved_quantity=0,
            reference_price=0,
            currency="KRW",
            max_order_amount_krw=0,
            expected_order_amount_krw=0,
            stop_loss_price=None,
            take_profit_price=None,
            max_loss_krw=0,
            risk_reward_ratio=0,
            risk_level="BLOCKED",
            reason="",
        )

    def reject(self, reason: str, risk_level: str = "BLOCKED") -> "RiskDecisionBuilder":
        self.decision.approved = False
        self.decision.reason = reason
        self.decision.risk_level = risk_level
        self.decision.approved_quantity = 0
        return self

    def approve(
        self,
        quantity: float,
        reason: str = "승인됨",
        risk_level: str = "MEDIUM"
    ) -> "RiskDecisionBuilder":
        self.decision.approved = True
        self.decision.approved_quantity = quantity
        self.decision.reason = reason
        self.decision.risk_level = risk_level
        return self

    def from_intent(self, intent: OrderIntent) -> "RiskDecisionBuilder":
        self.decision.symbol = intent.symbol
        self.decision.market = intent.market
        self.decision.side = intent.side
        self.decision.reference_price = intent.reference_price
        self.decision.currency = intent.currency
        self.decision.stop_loss_price = intent.stop_loss_price
        self.decision.take_profit_price = intent.take_profit_price
        return self

    def quantity(self, qty: float) -> "RiskDecisionBuilder":
        self.decision.approved_quantity = qty
        return self

    def amounts(
        self,
        max_krw: float,
        expected_krw: float
    ) -> "RiskDecisionBuilder":
        self.decision.max_order_amount_krw = max_krw
        self.decision.expected_order_amount_krw = expected_krw
        return self

    def stop_loss(self, sl_price: float) -> "RiskDecisionBuilder":
        self.decision.stop_loss_price = sl_price
        return self

    def take_profit(self, tp_price: float) -> "RiskDecisionBuilder":
        self.decision.take_profit_price = tp_price
        return self

    def loss_and_ratio(
        self,
        max_loss_krw: float,
        risk_reward_ratio: float
    ) -> "RiskDecisionBuilder":
        self.decision.max_loss_krw = max_loss_krw
        self.decision.risk_reward_ratio = risk_reward_ratio
        return self

    def checks(self, checks_dict: dict) -> "RiskDecisionBuilder":
        self.decision.checks = checks_dict
        return self

    def build(self) -> RiskDecision:
        return self.decision


async def main():
    """테스트"""
    print("\n" + "="*70)
    print("📋 OrderIntent / RiskDecision 테스트")
    print("="*70)

    # OrderIntent 생성
    intent = (
        OrderIntentBuilder()
        .symbol("AAPL", "Apple")
        .market("US")
        .side("BUY")
        .quantity(10)
        .price(150.0, "USD")
        .confidence(0.75)
        .reasons(
            entry="기술주 강세, 분기별 실적 강화",
            research="AI 섹터 주도, 거래대금 상위",
            analysis="상승 추세, 단기 모멘텀 긍정",
            strategy="매수 신호 확인"
        )
        .stop_loss(140.0)
        .take_profit(160.0)
        .build()
    )

    print(f"\n✅ OrderIntent 생성:")
    print(f"   {intent}")
    print(f"\n📄 상세:")
    print(intent.to_json())

    # RiskDecision 생성
    decision = (
        RiskDecisionBuilder()
        .from_intent(intent)
        .approve(quantity=10, risk_level="MEDIUM")
        .amounts(max_krw=2000000, expected_krw=1500000)
        .loss_and_ratio(max_loss_krw=100000, risk_reward_ratio=2.5)
        .checks({
            "market_open": True,
            "price_valid": True,
            "cash_sufficient": True,
            "position_size_ok": True,
            "daily_limit_ok": True,
            "stop_loss_set": True,
        })
        .build()
    )

    print(f"\n✅ RiskDecision 생성:")
    print(f"   {decision}")
    print(f"\n📄 상세:")
    print(decision.to_json())

    print("\n" + "="*70)


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
