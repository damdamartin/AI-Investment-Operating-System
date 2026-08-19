from __future__ import annotations

import asyncio
import logging
from typing import Optional

from .config import TossOnlyConfig
# from .live_preflight import TossOnlyLivePreflight  # 🔴 삭제됨
from .models import ExecutionMode, OrderResult, TradePlan

logger = logging.getLogger(__name__)

# 🔧 P1 수정 #1: 호가 단위 정의 (한국/미국 시장별)
TICK_SIZE_MAP = {
    "KR": {  # 한국 증시 호가 단위 규칙
        (0, 1000): 1,           # 0원 ~ 1000원: 1원 단위
        (1000, 5000): 5,        # 1000원 ~ 5000원: 5원 단위
        (5000, 10000): 10,      # 5000원 ~ 10000원: 10원 단위
        (10000, 50000): 50,     # 10000원 ~ 50000원: 50원 단위
        (50000, float('inf')): 100,  # 50000원 이상: 100원 단위
    },
    "US": {  # 미국 증시 호가 단위 (1센트 = $0.01)
        (0, float('inf')): 0.01,
    }
}

# 🔧 P1 수정 #4: 재시도 설정
MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 2


class TossOnlyOrderGateway:
    """Single broker-write gateway for the Toss-only pipeline."""

    def __init__(self, config: TossOnlyConfig, toss_client=None, live_preflight=None):  # 🔴 preflight 제거
        self.config = config
        self.toss_client = toss_client
        # self.live_preflight = live_preflight or TossOnlyLivePreflight()  # 🔴 삭제됨

    def _get_tick_size(self, market: str, price: float) -> float:
        """🔧 P1 수정 #1: 시장/가격별 호가 단위 반환"""
        if market not in TICK_SIZE_MAP:
            logger.warning(f"Unknown market {market}, defaulting to 0.01")
            return 0.01

        for (price_min, price_max), tick_size in TICK_SIZE_MAP[market].items():
            if price_min <= price < price_max:
                return tick_size
        return 0.01

    def _adjust_to_tick_size(self, price: float, market: str, direction: str = "down") -> float:
        """🔧 P1 수정 #1: 가격을 호가 단위에 맞추기 (direction: 'up' 또는 'down')"""
        tick_size = self._get_tick_size(market, price)
        if tick_size <= 0:
            return price

        if direction == "up":
            # 올림: 호가 단위보다 크거나 같게
            return round((price + tick_size - 0.0001) / tick_size) * tick_size
        else:
            # 내림: 호가 단위보다 작거나 같게
            return round(price / tick_size) * tick_size

    def _validate_plan(self, plan: TradePlan) -> tuple[bool, str]:
        """🔧 최소 검증: plan 기본 유효성 확인"""
        if not plan.symbol or len(plan.symbol) == 0:
            return False, "Plan has no symbol"

        if plan.quantity is None or plan.quantity <= 0:
            return False, "Plan quantity must be > 0"

        if plan.entry_price is None or plan.entry_price <= 0:
            return False, "Plan entry_price must be > 0"

        if plan.notional is None or plan.notional <= 0:
            return False, "Plan notional (금액) must be > 0"

        if plan.side not in {"BUY", "SELL"}:
            return False, f"Plan side must be BUY or SELL, got {plan.side}"

        return True, "validation passed"

    async def submit(self, plan: TradePlan) -> OrderResult:
        if not self.config.allow_live_orders:
            return OrderResult(
                submitted=False,
                mode=self.config.execution_mode,
                symbol=plan.symbol,
                market=plan.market,
                message="LIVE mode blocked: TOSS_ONLY_ALLOW_LIVE_ORDERS is false",
                raw={"plan": plan.__dict__},
            )

        if not self.toss_client:
            return OrderResult(
                submitted=False,
                mode=self.config.execution_mode,
                symbol=plan.symbol,
                market=plan.market,
                message="LIVE mode blocked: Toss client is not configured",
                raw={"plan": plan.__dict__},
            )

        # 🔧 최소 검증: plan 기본 유효성 확인
        is_valid, validation_msg = self._validate_plan(plan)
        if not is_valid:
            logger.error(f"❌ Plan validation failed for {plan.symbol}: {validation_msg}")
            return OrderResult(
                submitted=False,
                mode=self.config.execution_mode,
                symbol=plan.symbol,
                market=plan.market,
                message=f"VALIDATION_FAILED: {validation_msg}",
                raw={"plan": plan.__dict__},
            )

        # 🔧 P1 수정 #1: 호가 단위 검증 및 조정
        adjusted_price = self._adjust_to_tick_size(plan.entry_price, plan.market, direction="down")
        if abs(adjusted_price - plan.entry_price) > 0.001:  # 0.001 이상 차이 나면 경고
            logger.warning(
                f"⚠️ Price adjusted from {plan.entry_price} to {adjusted_price} "
                f"for {plan.symbol} (tick size: {self._get_tick_size(plan.market, plan.entry_price)})"
            )

        # 🔧 P1 수정 #4: 재시도 로직 추가
        for attempt in range(MAX_RETRIES):
            try:
                result = await self.toss_client.place_order(
                    symbol=plan.symbol,
                    quantity=plan.quantity,
                    side=plan.side,
                    price=adjusted_price,  # 조정된 가격 사용
                )
                if isinstance(result, dict) and result.get("success"):
                    logger.info(f"✅ Order submitted for {plan.symbol} (attempt {attempt + 1}/{MAX_RETRIES})")
                    return OrderResult(
                        submitted=True,
                        mode=self.config.execution_mode,
                        symbol=plan.symbol,
                        market=plan.market,
                        order_id=result.get("order_id"),
                        message="submitted",
                        raw=result,
                    )
                else:
                    error_msg = result.get("message", "unknown error") if isinstance(result, dict) else str(result)
                    logger.warning(
                        f"⚠️ Order failed for {plan.symbol}: {error_msg} "
                        f"(attempt {attempt + 1}/{MAX_RETRIES})"
                    )

                    # 마지막 시도가 아니면 대기 후 재시도
                    if attempt < MAX_RETRIES - 1:
                        await asyncio.sleep(RETRY_DELAY_SECONDS)
                        continue

            except Exception as exc:
                logger.error(f"❌ Exception during order submission: {exc} (attempt {attempt + 1}/{MAX_RETRIES})")
                if attempt < MAX_RETRIES - 1:
                    await asyncio.sleep(RETRY_DELAY_SECONDS)
                    continue

        # 모든 재시도 실패
        return OrderResult(
            submitted=False,
            mode=self.config.execution_mode,
            symbol=plan.symbol,
            market=plan.market,
            message="broker rejected order after retries",
            raw=result if isinstance(result, dict) else {"result": result, "attempts": MAX_RETRIES},
        )
