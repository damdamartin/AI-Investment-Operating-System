"""
모니터링팀 - 시스템 상태, 포지션, 손절/익절 감시
"""

import logging
from datetime import datetime
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)


class MonitoringAgent:
    """모니터링팀"""

    def __init__(self):
        self.cycle_count = 0
        self.last_cycle_result = None
        self.rejected_orders = []
        self.error_count = 0

    async def check_system_health(
        self,
        process_count: int,
        last_cycle_success: bool,
        api_errors: int = 0,
        price_fetch_errors: int = 0,
        account_sync_ok: bool = True,
    ) -> Dict[str, Any]:
        """
        시스템 상태 점검

        Returns:
            {
                "status": "OK" | "WARNING" | "ERROR",
                "checks": {...},
                "summary": str
            }
        """

        checks = {
            "process_count": {
                "status": "OK" if process_count == 1 else "ERROR",
                "value": process_count,
                "message": "단일 인스턴스" if process_count == 1 else f"중복 인스턴스: {process_count}개"
            },
            "last_cycle": {
                "status": "OK" if last_cycle_success else "WARNING",
                "value": "성공" if last_cycle_success else "실패",
            },
            "api_errors": {
                "status": "OK" if api_errors == 0 else "WARNING",
                "value": api_errors,
            },
            "price_fetch_errors": {
                "status": "OK" if price_fetch_errors == 0 else "WARNING",
                "value": price_fetch_errors,
            },
            "account_sync": {
                "status": "OK" if account_sync_ok else "ERROR",
                "value": "정상" if account_sync_ok else "불일치",
            }
        }

        # 최종 상태 판단
        error_count = sum(1 for c in checks.values() if c["status"] == "ERROR")
        warning_count = sum(1 for c in checks.values() if c["status"] == "WARNING")

        if error_count > 0:
            status = "ERROR"
        elif warning_count > 0:
            status = "WARNING"
        else:
            status = "OK"

        summary = f"[MONITOR] {status} - 프로세스:{checks['process_count']['value']}, " \
                  f"마지막 사이클:{checks['last_cycle']['value']}, " \
                  f"API오류:{checks['api_errors']['value']}"

        logger.info(summary)

        return {
            "status": status,
            "checks": checks,
            "summary": summary,
            "timestamp": datetime.now().isoformat(),
        }

    async def check_rejected_orders(self, orders: List[Dict[str, Any]]) -> Dict[str, Any]:
        """거절된 주문 분석"""
        if not orders:
            return {"count": 0, "top_reason": None}

        # 거절 이유 집계
        reasons = {}
        for order in orders:
            reason = order.get("reason", "알 수 없음")
            reasons[reason] = reasons.get(reason, 0) + 1

        # 가장 많은 이유
        top_reason = max(reasons, key=reasons.get) if reasons else None

        logger.info(f"⚠️  거절된 주문: {len(orders)}건, 주요 사유: {top_reason}")

        return {
            "count": len(orders),
            "top_reason": top_reason,
            "reasons": reasons,
        }

    async def check_positions(
        self,
        holdings: List[Dict[str, Any]],
        total_value_krw: float,
    ) -> Dict[str, Any]:
        """
        포지션 상태 점검

        Returns:
            {
                "count": int,
                "total_value_krw": float,
                "concentration": float (0-1),
                "warning": str | None
            }
        """

        if not holdings:
            return {
                "count": 0,
                "total_value_krw": 0,
                "concentration": 0,
                "warning": None,
            }

        # 단일 종목 비중 계산
        max_position_value = max(
            [float(h.get("value", 0)) for h in holdings],
            default=0
        )
        concentration = max_position_value / total_value_krw if total_value_krw > 0 else 0

        warning = None
        if concentration > 0.5:
            warning = f"높은 집중도: {concentration:.0%}"
        elif len(holdings) > 10:
            warning = f"과다 보유: {len(holdings)}개 종목"

        logger.info(
            f"📊 포지션: {len(holdings)}개, 집중도: {concentration:.0%}, "
            f"총액: ₩{total_value_krw:,.0f}"
        )

        return {
            "count": len(holdings),
            "total_value_krw": total_value_krw,
            "concentration": concentration,
            "warning": warning,
        }

    async def log_cycle_result(
        self,
        cycle_id: str,
        timestamp: str,
        selected_watchlist: List[Dict],
        strategy_intents: List[OrderIntent],
        risk_decisions: List[RiskDecision],
        executed_orders: List[Dict],
        rejected_orders: List[Dict],
    ) -> None:
        """사이클 결과를 JSONL로 로깅"""

        # 나중에 구현
        logger.debug(f"📝 사이클 #{cycle_id} 기록: {len(executed_orders)}건 체결")

    async def check_stop_loss_take_profit(
        self,
        holdings: List[Dict[str, Any]],
        current_prices: Dict[str, float],
    ) -> Dict[str, Any]:
        """손절/익절 조건 점검"""

        triggered = []

        for holding in holdings:
            symbol = holding.get("symbol")
            current_price = current_prices.get(symbol)

            if not current_price:
                continue

            stop_loss = holding.get("stop_loss_price")
            take_profit = holding.get("take_profit_price")

            if stop_loss and current_price <= stop_loss:
                triggered.append({
                    "symbol": symbol,
                    "type": "STOP_LOSS",
                    "price": current_price,
                    "threshold": stop_loss,
                })

            elif take_profit and current_price >= take_profit:
                triggered.append({
                    "symbol": symbol,
                    "type": "TAKE_PROFIT",
                    "price": current_price,
                    "threshold": take_profit,
                })

        if triggered:
            logger.warning(f"⚠️  손절/익절 발동: {len(triggered)}건")

        return {
            "triggered_count": len(triggered),
            "triggered_orders": triggered,
        }


async def main():
    """테스트"""
    print("\n" + "="*70)
    print("👁️  MonitoringAgent 테스트")
    print("="*70)

    agent = MonitoringAgent()

    # 시스템 상태 점검
    health = await agent.check_system_health(
        process_count=1,
        last_cycle_success=True,
        api_errors=0,
        price_fetch_errors=0,
    )
    print(f"\n✅ {health['summary']}")

    print("\n" + "="*70)


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
