"""
실시간모니터링 - 보유 종목 실시간 모니터링 및 손절/익절 자동화
가격 변동을 감시하고 손절/익절 조건이 충족되면 자동으로 포지션을 종료합니다.
"""

import asyncio
import json
from datetime import datetime
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from enum import Enum


class PositionStatus(Enum):
    """포지션 상태"""
    OPEN = "OPEN"
    PARTIAL_CLOSE = "PARTIAL_CLOSE"
    CLOSED = "CLOSED"
    STOPPED_OUT = "STOPPED_OUT"


@dataclass
class Position:
    """보유 포지션"""
    position_id: str
    symbol: str
    symbol_name: str
    quantity: int
    entry_price: float
    entry_time: datetime
    current_price: float = 0.0
    stop_loss_price: float = 0.0
    take_profit_price: float = 0.0
    status: PositionStatus = PositionStatus.OPEN
    unrealized_pnl: float = 0.0
    unrealized_pnl_pct: float = 0.0
    realized_pnl: float = 0.0
    exit_price: Optional[float] = None
    exit_time: Optional[datetime] = None


class RealtimeMonitor:
    """
    실시간 모니터링 엔진
    - 보유 포지션의 가격 감시
    - 손절/익절 자동 실행
    - 포트폴리오 실시간 P&L 계산
    """

    def __init__(self, data_source_manager=None):
        self.positions: Dict[str, Position] = {}  # symbol -> Position
        self.price_feed = None  # 실시간 가격 피드
        self.order_engine = None  # 주문 실행 엔진
        self.monitoring = False
        self.trade_log = []

        # 팀장 추가: 데이터 소스에서 가격 피드 자동 설정
        if data_source_manager:
            self.price_feed = data_source_manager.price_feed

    def set_price_feed(self, feed):
        """실시간 가격 피드 설정"""
        self.price_feed = feed

    def set_order_engine(self, engine):
        """주문 실행 엔진 설정"""
        self.order_engine = engine

    def add_position(self, position: Position) -> None:
        """포지션 추가"""
        self.positions[position.symbol] = position
        print(f"포지션 추가: {position.symbol} ({position.quantity}주 @ {position.entry_price})")

    async def start_monitoring(self) -> None:
        """실시간 모니터링 시작"""
        self.monitoring = True
        print("실시간 모니터링 시작...")

        while self.monitoring:
            try:
                await self._check_positions()
                await asyncio.sleep(1)  # 1초마다 체크
            except Exception as e:
                print(f"모니터링 오류: {e}")
                await asyncio.sleep(5)

    def stop_monitoring(self) -> None:
        """모니터링 중지"""
        self.monitoring = False
        print("실시간 모니터링 중지")

    async def _check_positions(self) -> None:
        """모든 포지션 체크"""

        for symbol, position in list(self.positions.items()):
            if position.status == PositionStatus.CLOSED:
                continue

            # 현재가 조회
            current_price = await self._get_current_price(symbol)
            if current_price is None:
                continue

            position.current_price = current_price

            # 손익 계산
            pnl = (current_price - position.entry_price) * position.quantity
            pnl_pct = (current_price - position.entry_price) / position.entry_price

            position.unrealized_pnl = pnl
            position.unrealized_pnl_pct = pnl_pct

            # 손절/익절 체크
            await self._check_stop_loss_and_take_profit(position)

            # 로깅
            self._log_position_update(position)

    async def _check_stop_loss_and_take_profit(self, position: Position) -> None:
        """손절/익절 조건 체크 및 실행"""

        current_price = position.current_price

        # 손절 체크
        if current_price <= position.stop_loss_price:
            print(
                f"🔴 손절 체크: {position.symbol} "
                f"현재가 {current_price} <= 손절가 {position.stop_loss_price}"
            )
            await self._close_position(position, current_price, "STOP_LOSS")
            return

        # 익절 체크
        if current_price >= position.take_profit_price:
            print(
                f"🟢 익절 체크: {position.symbol} "
                f"현재가 {current_price} >= 익절가 {position.take_profit_price}"
            )
            await self._close_position(position, current_price, "TAKE_PROFIT")
            return

    async def _close_position(
        self,
        position: Position,
        exit_price: float,
        reason: str
    ) -> None:
        """포지션 종료"""

        try:
            # 주문 실행
            if self.order_engine:
                result = await self.order_engine.execute_order(
                    symbol=position.symbol,
                    symbol_name=position.symbol_name,
                    market="KR",
                    order_type="SELL",
                    quantity=position.quantity,
                    price=exit_price,
                    stop_loss_price=position.stop_loss_price,
                    take_profit_price=position.take_profit_price
                )

                if result.get("success"):
                    # 포지션 업데이트
                    position.status = PositionStatus.CLOSED
                    position.exit_price = exit_price
                    position.exit_time = datetime.now()

                    # 실현손익 계산
                    realized_pnl = (exit_price - position.entry_price) * position.quantity
                    realized_pnl_pct = (exit_price - position.entry_price) / position.entry_price

                    position.realized_pnl = realized_pnl

                    print(
                        f"✅ 포지션 종료: {position.symbol} "
                        f"@ {exit_price} ({reason})\n"
                        f"   손익: {realized_pnl:+,.0f}원 ({realized_pnl_pct:+.2%})"
                    )

                    # 기록
                    self.trade_log.append({
                        "symbol": position.symbol,
                        "entry_price": position.entry_price,
                        "exit_price": exit_price,
                        "quantity": position.quantity,
                        "pnl": realized_pnl,
                        "pnl_pct": realized_pnl_pct,
                        "reason": reason,
                        "entry_time": position.entry_time.isoformat(),
                        "exit_time": position.exit_time.isoformat()
                    })

                    # 포지션 삭제
                    del self.positions[position.symbol]

        except Exception as e:
            print(f"포지션 종료 오류 ({position.symbol}): {e}")

    async def _get_current_price(self, symbol: str) -> Optional[float]:
        """현재가 조회"""

        if self.price_feed is None:
            return None

        try:
            price = await self.price_feed.get_price(symbol)
            return price
        except Exception as e:
            print(f"가격 조회 오류 ({symbol}): {e}")
            return None

    def get_portfolio_status(self) -> Dict[str, Any]:
        """포트폴리오 상태 조회"""

        total_unrealized_pnl = 0
        total_realized_pnl = 0
        open_positions = 0
        closed_positions = len([p for p in self.positions.values() if p.status == PositionStatus.CLOSED])

        for position in self.positions.values():
            if position.status == PositionStatus.OPEN:
                open_positions += 1
                total_unrealized_pnl += position.unrealized_pnl

        # 실현손익은 거래 기록에서 계산
        total_realized_pnl = sum(t.get("pnl", 0) for t in self.trade_log)

        total_pnl = total_unrealized_pnl + total_realized_pnl

        return {
            "open_positions": open_positions,
            "total_unrealized_pnl": total_unrealized_pnl,
            "total_realized_pnl": total_realized_pnl,
            "total_pnl": total_pnl,
            "positions": [
                {
                    "symbol": p.symbol,
                    "quantity": p.quantity,
                    "entry_price": p.entry_price,
                    "current_price": p.current_price,
                    "unrealized_pnl": p.unrealized_pnl,
                    "unrealized_pnl_pct": p.unrealized_pnl_pct,
                    "status": p.status.value
                }
                for p in self.positions.values() if p.status == PositionStatus.OPEN
            ],
            "timestamp": datetime.now().isoformat()
        }

    def _log_position_update(self, position: Position) -> None:
        """포지션 업데이트 로깅"""
        # 로깅 구현 (필요한 경우)
        pass

    def get_trade_log(self, limit: int = 100) -> List[Dict]:
        """거래 기록 조회"""
        return self.trade_log[-limit:]


if __name__ == "__main__":
    monitor = RealtimeMonitor()

    # 테스트 포지션 추가
    position = Position(
        position_id="POS_001",
        symbol="005930",
        symbol_name="Samsung",
        quantity=10,
        entry_price=70000,
        entry_time=datetime.now(),
        stop_loss_price=68600,
        take_profit_price=72100
    )

    monitor.add_position(position)
    print("실시간 모니터링 준비 완료")
