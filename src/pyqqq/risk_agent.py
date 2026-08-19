"""
리스크팀 에이전트 - 주문 최종 승인 게이트
모든 주문은 리스크팀 승인을 받아야 실행됨
"""

import logging
from typing import Dict, Any, Optional
from datetime import datetime, time
from .order_intent import RiskDecision, RiskDecisionBuilder, OrderIntent

logger = logging.getLogger(__name__)


class RiskAgent:
    """리스크 관리 에이전트 - 주문 승인 게이트"""

    def __init__(self):
        # 리스크 정책
        self.min_cash_ratio = 0.05  # 거래 후 최소 현금 5% 유지
        self.max_order_amount_krw = 10_000_000  # 최대 주문 금액 1,000만원
        self.max_daily_orders = 50  # 일일 최대 주문 건수
        self.max_daily_loss_pct = 0.05  # 일일 손실 한도 5%
        self.max_position_size_pct = 0.30  # 단일 종목 최대 30%
        self.max_portfolio_exposure_pct = 1.0  # 포트폴리오 최대 노출 100%

    async def validate_order(
        self,
        order_intent: Optional[OrderIntent] = None,
        # 기존 매개변수 (하위호환성)
        symbol: str = "",
        quantity: float = 0,
        side: str = "BUY",
        price: float = 0,
        market: str = "KR",
        kis_cash_krw: float = 0,
        toss_cash_krw: float = 0,
        toss_cash_usd: float = 0,
        current_cash_krw: float = 0,
        portfolio_value_krw: float = 0,
        current_positions: Dict[str, float] = None,
        daily_trades_count: int = 0,
        daily_loss_krw: float = 0,
        toss_read_only: bool = False,
    ) -> RiskDecision:
        """
        주문 검증 및 승인 (시장별 현금 분리)

        Args:
            order_intent: OrderIntent 객체 (있으면 이를 기준으로 사용)
            symbol: 종목코드 (order_intent 없을 때 사용)
            quantity: 주문 수량
            side: "BUY" or "SELL"
            price: 주문 가격
            market: "KR" or "US"
            kis_cash_krw: 한국 현금 (KRW) - KR 주문 시 사용
            toss_cash_krw: 미국 계좌 원화 현금 - 참고용
            toss_cash_usd: 미국 계좌 USD 현금 - US 주문 시 사용
            current_cash_krw: deprecated (하위호환성)
            portfolio_value_krw: 포트폴리오 총가치 (원화)
            current_positions: 현재 포지션 {symbol: qty}
            daily_trades_count: 오늘 거래 건수
            daily_loss_krw: 오늘 손실액 (원화)
            toss_read_only: Toss read-only 모드 여부

        Returns:
            RiskDecision: 승인 결정 및 상세 정보
        """

        # 기본값 설정
        if current_positions is None:
            current_positions = {}

        # OrderIntent에서 필드 추출
        if order_intent:
            symbol = order_intent.symbol
            quantity = order_intent.intent_quantity
            side = order_intent.side
            price = order_intent.reference_price
            market = order_intent.market

        # ✅ 시장별 현금 선택
        if current_cash_krw > 0 and kis_cash_krw == 0:
            kis_cash_krw = current_cash_krw
        market_cash = kis_cash_krw if market == "KR" else toss_cash_usd

        checks = {}
        risk_level = "LOW"
        reasons = []
        blocked_reason = None

        # 1. 가격 검증
        if price <= 0 or price in [50000, 150, 100000, 1000, 10000]:
            checks["valid_price"] = False
            reasons.append(f"유효하지 않은 가격: {price}")
            risk_level = "BLOCKED"
            blocked_reason = f"가격 오류: {price}"
        else:
            checks["valid_price"] = True

        # 2. 시장 시간 확인
        is_market_open = self._is_market_open(market)
        checks["market_open"] = is_market_open
        if not is_market_open:
            reasons.append("시장 시간 외")
            risk_level = "BLOCKED"
            blocked_reason = "시장 시간 외"

        # 3. Toss read-only 모드 확인
        if toss_read_only and market == "US":
            checks["read_only_blocked"] = True
            reasons.append("Toss read-only 모드")
            risk_level = "BLOCKED"
            blocked_reason = "Toss read-only 모드"

        # 4. 현금 충분 여부 (시장별)
        estimated_order_amount = quantity * price if price > 0 else 0
        sufficient_cash = market_cash >= estimated_order_amount if side == "BUY" else True
        checks["sufficient_cash"] = sufficient_cash
        if not sufficient_cash and side == "BUY":
            reasons.append(f"현금 부족 (필요: {estimated_order_amount:,.0f}, 보유: {market_cash:,.0f})")
            risk_level = "BLOCKED"
            blocked_reason = f"현금 부족: {market_cash:,.0f} < {estimated_order_amount:,.0f}"

        # 5. 주문 최소/최대 검증
        valid_size = quantity >= 1
        if price > 0:
            valid_size = valid_size and (quantity * price <= self.max_order_amount_krw)
        checks["valid_order_size"] = valid_size
        if not valid_size:
            reasons.append("주문 금액 범위 초과")
            risk_level = "BLOCKED"
            blocked_reason = "주문 금액 범위 초과"

        # 6. 거래 후 현금 & 최소 현금 유지 (시장별 통화)
        order_amount = quantity * price if price > 0 and side == "BUY" else 0

        if market == "KR":
            cash_after_order = kis_cash_krw - order_amount
            min_cash_required = portfolio_value_krw * self.min_cash_ratio
            cash_currency = "KRW"
            max_loss_amount = kis_cash_krw * 0.02  # 2%
            max_loss_currency = "KRW"
        else:
            cash_after_order = toss_cash_usd - order_amount
            min_cash_required = max(100, toss_cash_usd * self.min_cash_ratio)
            cash_currency = "USD"
            max_loss_amount = toss_cash_usd * 0.02  # 2%
            max_loss_currency = "USD"

        maintains_min_cash = cash_after_order >= min_cash_required if side == "BUY" else True
        checks["maintains_min_cash"] = maintains_min_cash

        if not maintains_min_cash:
            reasons.append(
                f"최소 현금 미달 (필요: {min_cash_required:,.2f} {cash_currency})"
            )
            if risk_level != "BLOCKED":
                risk_level = "HIGH"

        # 7. 종목 포지션 확인
        position_exists = symbol in current_positions and current_positions[symbol] > 0
        if side == "BUY" and position_exists:
            checks["position_increase_allowed"] = True
        elif side == "SELL" and not position_exists:
            checks["sell_without_position"] = False
            reasons.append("보유 포지션 없음")
            risk_level = "BLOCKED"
            blocked_reason = "보유 포지션 없음"

        # 8. 일일 주문 한도
        daily_order_ok = daily_trades_count < self.max_daily_orders
        checks["daily_order_limit"] = daily_order_ok
        if not daily_order_ok:
            reasons.append(f"일일 주문 한도 초과 ({daily_trades_count}/{self.max_daily_orders})")
            if risk_level != "BLOCKED":
                risk_level = "HIGH"

        # 9. 일일 손실 한도
        daily_loss_limit = portfolio_value_krw * self.max_daily_loss_pct
        daily_loss_ok = daily_loss_krw < daily_loss_limit
        checks["daily_loss_limit"] = daily_loss_ok
        if not daily_loss_ok:
            reasons.append(f"일일 손실 한도 초과 ({daily_loss_krw:,.0f}/{daily_loss_limit:,.0f})")
            if risk_level != "BLOCKED":
                risk_level = "HIGH"

        # 최종 승인
        approved = risk_level != "BLOCKED"

        # ✅ RiskDecisionBuilder를 사용해서 체계적으로 빌드
        builder = RiskDecisionBuilder()

        # OrderIntent에서 필드 추출
        if order_intent:
            builder.from_intent(order_intent)
            take_profit_1_price = order_intent.take_profit_1_price
            take_profit_2_price = order_intent.take_profit_2_price
            add_buy_plan = order_intent.add_buy_plan
            partial_cut_plan = order_intent.partial_cut_plan
            max_loss_pct = order_intent.max_loss_pct_of_portfolio
        else:
            # 기존 매개변수로 설정
            builder.decision.symbol = symbol
            builder.decision.market = market
            builder.decision.side = side
            builder.decision.reference_price = price
            builder.decision.currency = "KRW" if market == "KR" else "USD"
            take_profit_1_price = None
            take_profit_2_price = None
            add_buy_plan = {}
            partial_cut_plan = {}
            max_loss_pct = 0.02  # 기본 2%

        # 승인/거절 설정
        if approved:
            builder.approve(
                quantity=quantity,
                reason=" | ".join(reasons) if reasons else "승인됨",
                risk_level=risk_level
            )
        else:
            builder.reject(
                reason=" | ".join(reasons) if reasons else "거절됨",
                risk_level=risk_level
            )

        # 시장별 통화 기준 필드 채우기
        decision = builder.decision
        decision.approved_order_amount = estimated_order_amount
        decision.approved_order_currency = cash_currency
        decision.cash_after_order = cash_after_order
        decision.cash_after_order_currency = cash_currency
        decision.take_profit_1_price = take_profit_1_price
        decision.take_profit_2_price = take_profit_2_price
        decision.max_loss_amount = max_loss_amount
        decision.max_loss_currency = max_loss_currency
        decision.max_loss_pct_of_portfolio = max_loss_pct
        decision.max_loss_krw = max_loss_amount if market == "KR" else 0  # 하위호환성
        decision.approved_add_buy_plan = add_buy_plan
        decision.approved_partial_cut_plan = partial_cut_plan
        decision.risk_reason = " | ".join(reasons) if reasons else "정상 범위"
        decision.blocked_reason = blocked_reason if not approved else None
        decision.checks = checks
        decision.max_order_amount_krw = self.max_order_amount_krw
        decision.expected_order_amount_krw = estimated_order_amount if market == "KR" else 0

        return decision

    def _is_market_open(self, market: str) -> bool:
        """시장 거래 시간 확인"""
        current_time = datetime.now().time()
        current_weekday = datetime.now().weekday()  # 0=Monday, 4=Friday, 5-6=Weekend

        # 주말 확인
        if current_weekday >= 5:
            return False

        if market == "KR":
            # 한국 주식: 09:00-15:30
            return time(9, 0) <= current_time <= time(15, 30)
        elif market == "US":
            # 미국 주식: 22:30-05:00 (한국시간)
            return current_time >= time(22, 30) or current_time <= time(5, 0)

        return False


# ========================================
# 테스트
# ========================================
async def test_risk_agent():
    """RiskAgent 테스트"""
    print("\n" + "="*80)
    print("🔐 리스크팀 에이전트 테스트")
    print("="*80)

    agent = RiskAgent()

    # ✅ 테스트 1: KR 주문 - 정상 승인
    print("\n[테스트 1] KR 주문 - 정상 승인")
    print("-" * 80)
    kr_intent = OrderIntent(
        symbol="005930",
        name="삼성전자",
        market="KR",
        side="BUY",
        intent_quantity=10,
        reference_price=51234,  # 실제 가격
        currency="KRW",
        confidence=0.75,
        entry_reason="기술주 강세",
        research_reason="주가 지지선 반등",
        analysis_reason="단기 상승 추세",
        strategy_reason="매수 신호 확인",
        stop_loss_price=48000,
        take_profit_1_price=52000,
        take_profit_2_price=55000,
        max_loss_pct_of_portfolio=0.02,
        add_buy_plan={"price": 48000, "qty_pct": 0.5},
        partial_cut_plan={"price": 52000, "qty_pct": 0.3},
    )

    decision = await agent.validate_order(
        order_intent=kr_intent,
        kis_cash_krw=1000000,
        toss_cash_usd=0,
        portfolio_value_krw=5000000,
        current_positions={"005930": 0},
        daily_trades_count=5,
        daily_loss_krw=-100000,
    )

    print(f"✅ 승인 여부: {decision.approved}")
    print(f"   위험도: {decision.risk_level}")
    print(f"   승인 수량: {decision.approved_quantity}개")
    print(f"   주문 금액: {decision.approved_order_amount:,.0f} {decision.approved_order_currency}")
    print(f"   거래 후 현금: {decision.cash_after_order:,.0f} {decision.cash_after_order_currency}")
    print(f"   최대 손실: {decision.max_loss_amount:,.0f} {decision.max_loss_currency} ({decision.max_loss_pct_of_portfolio:.1%})")
    print(f"   익절 1: {decision.take_profit_1_price} / 익절 2: {decision.take_profit_2_price}")
    print(f"   추가매수: {decision.approved_add_buy_plan}")
    print(f"   부분손절: {decision.approved_partial_cut_plan}")
    print(f"   판단 사유: {decision.risk_reason}")

    # ✅ 테스트 2: US 주문 - 정상 승인
    print("\n[테스트 2] US 주문 - 정상 승인")
    print("-" * 80)
    us_intent = OrderIntent(
        symbol="AAPL",
        name="Apple",
        market="US",
        side="BUY",
        intent_quantity=5,
        reference_price=154.67,  # 실제 가격
        currency="USD",
        confidence=0.80,
        entry_reason="기술주 강세",
        research_reason="AI 섹터 주도",
        analysis_reason="상승 추세",
        strategy_reason="매수 신호 확인",
        stop_loss_price=140.0,
        take_profit_1_price=160.0,
        take_profit_2_price=170.0,
        max_loss_pct_of_portfolio=0.02,
        add_buy_plan={"price": 145.0, "qty_pct": 0.5},
        partial_cut_plan={"price": 160.0, "qty_pct": 0.4},
    )

    decision = await agent.validate_order(
        order_intent=us_intent,
        kis_cash_krw=0,
        toss_cash_usd=1000,
        portfolio_value_krw=5000000,
        current_positions={"AAPL": 0},
        daily_trades_count=5,
        daily_loss_krw=-100000,
    )

    print(f"✅ 승인 여부: {decision.approved}")
    print(f"   위험도: {decision.risk_level}")
    print(f"   승인 수량: {decision.approved_quantity}개")
    print(f"   주문 금액: ${decision.approved_order_amount:,.2f} {decision.approved_order_currency}")
    print(f"   거래 후 현금: ${decision.cash_after_order:,.2f} {decision.cash_after_order_currency}")
    print(f"   최대 손실: ${decision.max_loss_amount:,.2f} {decision.max_loss_currency} ({decision.max_loss_pct_of_portfolio:.1%})")
    print(f"   익절 1: ${decision.take_profit_1_price} / 익절 2: ${decision.take_profit_2_price}")
    print(f"   판단 사유: {decision.risk_reason}")

    # ✅ 테스트 3: KR 주문 - 현금 부족으로 거절
    print("\n[테스트 3] KR 주문 - 현금 부족 (거절)")
    print("-" * 80)
    kr_intent_fail = OrderIntent(
        symbol="005930",
        name="삼성전자",
        market="KR",
        side="BUY",
        intent_quantity=10,
        reference_price=51234,  # 실제 가격
        currency="KRW",
        confidence=0.75,
        entry_reason="매수",
        research_reason="상승",
        analysis_reason="긍정",
        strategy_reason="승인",
        stop_loss_price=48000,
        take_profit_1_price=52000,
        take_profit_2_price=55000,
    )

    decision = await agent.validate_order(
        order_intent=kr_intent_fail,
        kis_cash_krw=100000,  # 부족한 현금
        toss_cash_usd=0,
        portfolio_value_krw=5000000,
        current_positions={"005930": 0},
    )

    print(f"❌ 승인 여부: {decision.approved}")
    print(f"   위험도: {decision.risk_level}")
    print(f"   거절 사유: {decision.blocked_reason}")

    # ✅ 테스트 4: 기존 매개변수로 호출 (하위호환성)
    print("\n[테스트 4] 기존 매개변수로 호출 (하위호환성)")
    print("-" * 80)
    decision = await agent.validate_order(
        symbol="005930",
        quantity=5,
        side="BUY",
        price=51234,  # 실제 가격
        market="KR",
        kis_cash_krw=500000,
        toss_cash_usd=0,
        portfolio_value_krw=5000000,
        current_positions={"005930": 0},
    )

    print(f"✅ 승인 여부: {decision.approved}")
    print(f"   위험도: {decision.risk_level}")
    print(f"   주문 금액: {decision.approved_order_amount:,.0f} {decision.approved_order_currency}")
    print(f"   거래 후 현금: {decision.cash_after_order:,.0f} {decision.cash_after_order_currency}")
    print(f"   판단 사유: {decision.risk_reason}")

    print("\n" + "="*80)


if __name__ == "__main__":
    import asyncio
    asyncio.run(test_risk_agent())
