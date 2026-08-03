"""
주문실행엔진 - 실제 계좌 연동 자동매매
KIS API, Toss API를 통해 실제 거래를 실행합니다.
"""

import json
from datetime import datetime
from typing import Optional, Dict, Any
from dataclasses import dataclass
from enum import Enum


class OrderType(Enum):
    """주문 유형"""
    BUY = "BUY"
    SELL = "SELL"


class OrderStatus(Enum):
    """주문 상태"""
    PENDING = "PENDING"  # 대기 중
    SUBMITTED = "SUBMITTED"  # 제출됨
    FILLED = "FILLED"  # 체결됨
    PARTIALLY_FILLED = "PARTIALLY_FILLED"  # 부분 체결
    CANCELLED = "CANCELLED"  # 취소됨
    FAILED = "FAILED"  # 실패


@dataclass
class Order:
    """주문 정보"""
    order_id: str
    symbol: str
    symbol_name: str
    order_type: OrderType
    quantity: int
    price: float
    status: OrderStatus
    market: str  # "KR" or "US"
    timestamp: datetime
    filled_quantity: int = 0
    average_fill_price: float = 0.0
    broker_order_id: Optional[str] = None  # 증권사 주문번호


class OrderExecutionEngine:
    """
    주문 실행 엔진
    실제 거래를 KIS, Toss API를 통해 실행하고 기록합니다.
    """

    def __init__(self):
        # 실제 거래를 위해 API 클라이언트가 주입됨
        self.kis_client = None
        self.toss_client = None
        self.orders = {}  # order_id -> Order
        self.execution_log = []

    def set_kis_client(self, client):
        """KIS API 클라이언트 설정"""
        self.kis_client = client

    def set_toss_client(self, client):
        """Toss API 클라이언트 설정"""
        self.toss_client = client

    async def execute_order(
        self,
        symbol: str,
        symbol_name: str,
        market: str,
        order_type: OrderType,
        quantity: int,
        price: float,
        stop_loss_price: float,
        take_profit_price: float
    ) -> Dict[str, Any]:
        """
        실제 주문을 실행합니다.

        Args:
            symbol: 종목코드
            symbol_name: 종목명
            market: "KR" 또는 "US"
            order_type: BUY 또는 SELL
            quantity: 수량
            price: 가격
            stop_loss_price: 손절가
            take_profit_price: 익절가

        Returns:
            {
                'success': bool,
                'order_id': str,
                'broker_order_id': str,
                'status': OrderStatus,
                'message': str,
                'filled_quantity': int,
                'average_fill_price': float,
                'timestamp': str
            }
        """

        order_id = self._generate_order_id()

        try:
            # 주문 생성
            order = Order(
                order_id=order_id,
                symbol=symbol,
                symbol_name=symbol_name,
                order_type=order_type,
                quantity=quantity,
                price=price,
                status=OrderStatus.PENDING,
                market=market,
                timestamp=datetime.now()
            )

            # 증권사별 주문 실행
            if market == "KR":
                result = await self._execute_kis_order(order, stop_loss_price, take_profit_price)
            else:  # US
                result = await self._execute_toss_order(order, stop_loss_price, take_profit_price)

            # 주문 저장
            self.orders[order_id] = order
            self.execution_log.append({
                "timestamp": datetime.now().isoformat(),
                "order_id": order_id,
                "symbol": symbol,
                "type": order_type.value,
                "quantity": quantity,
                "price": price,
                "result": result
            })

            return {
                "success": result.get("success", False),
                "order_id": order_id,
                "broker_order_id": result.get("broker_order_id"),
                "status": result.get("status", "FAILED"),
                "message": result.get("message", ""),
                "filled_quantity": result.get("filled_quantity", 0),
                "average_fill_price": result.get("average_fill_price", 0),
                "timestamp": datetime.now().isoformat()
            }

        except Exception as e:
            print(f"주문 실행 오류: {e}")
            self.execution_log.append({
                "timestamp": datetime.now().isoformat(),
                "order_id": order_id,
                "symbol": symbol,
                "error": str(e)
            })

            return {
                "success": False,
                "order_id": order_id,
                "status": "FAILED",
                "message": f"주문 실행 실패: {str(e)}",
                "timestamp": datetime.now().isoformat()
            }

    async def _execute_kis_order(
        self,
        order: Order,
        stop_loss_price: float,
        take_profit_price: float
    ) -> Dict[str, Any]:
        """KIS API를 통해 한국주식 주문 실행"""

        if not self.kis_client:
            return {
                "success": False,
                "message": "KIS 클라이언트가 설정되지 않음"
            }

        try:
            # 실제 주문 실행
            response = await self.kis_client.place_order(
                symbol=order.symbol,
                order_type="buy" if order.order_type == OrderType.BUY else "sell",
                quantity=order.quantity,
                price=order.price
            )

            if response.get("success"):
                order.status = OrderStatus.SUBMITTED
                order.broker_order_id = response.get("order_id")

                # 손절/익절 주문 설정 (조건부 주문)
                await self.kis_client.set_stop_loss(
                    symbol=order.symbol,
                    price=stop_loss_price,
                    quantity=order.quantity
                )

                await self.kis_client.set_take_profit(
                    symbol=order.symbol,
                    price=take_profit_price,
                    quantity=order.quantity
                )

                return {
                    "success": True,
                    "broker_order_id": response.get("order_id"),
                    "status": "SUBMITTED",
                    "message": "주문 제출됨",
                    "filled_quantity": order.quantity,
                    "average_fill_price": order.price
                }
            else:
                return {
                    "success": False,
                    "message": response.get("error", "주문 실패")
                }

        except Exception as e:
            return {
                "success": False,
                "message": f"KIS 주문 오류: {str(e)}"
            }

    async def _execute_toss_order(
        self,
        order: Order,
        stop_loss_price: float,
        take_profit_price: float
    ) -> Dict[str, Any]:
        """Toss API를 통해 미국주식 주문 실행"""

        if not self.toss_client:
            return {
                "success": False,
                "message": "Toss 클라이언트가 설정되지 않음"
            }

        try:
            # 실제 주문 실행
            response = await self.toss_client.place_order(
                symbol=order.symbol,
                order_type="buy" if order.order_type == OrderType.BUY else "sell",
                quantity=order.quantity,
                price=order.price
            )

            if response.get("success"):
                order.status = OrderStatus.SUBMITTED
                order.broker_order_id = response.get("order_id")

                # 손절/익절 주문
                await self.toss_client.set_stop_loss(
                    symbol=order.symbol,
                    price=stop_loss_price,
                    quantity=order.quantity
                )

                await self.toss_client.set_take_profit(
                    symbol=order.symbol,
                    price=take_profit_price,
                    quantity=order.quantity
                )

                return {
                    "success": True,
                    "broker_order_id": response.get("order_id"),
                    "status": "SUBMITTED",
                    "message": "주문 제출됨",
                    "filled_quantity": order.quantity,
                    "average_fill_price": order.price
                }
            else:
                return {
                    "success": False,
                    "message": response.get("error", "주문 실패")
                }

        except Exception as e:
            return {
                "success": False,
                "message": f"Toss 주문 오류: {str(e)}"
            }

    async def cancel_order(self, order_id: str) -> Dict[str, Any]:
        """주문 취소"""

        if order_id not in self.orders:
            return {
                "success": False,
                "message": f"주문 ID를 찾을 수 없음: {order_id}"
            }

        order = self.orders[order_id]

        try:
            if order.market == "KR":
                result = await self.kis_client.cancel_order(order.broker_order_id)
            else:
                result = await self.toss_client.cancel_order(order.broker_order_id)

            if result.get("success"):
                order.status = OrderStatus.CANCELLED

            return result

        except Exception as e:
            return {
                "success": False,
                "message": f"주문 취소 오류: {str(e)}"
            }

    def _generate_order_id(self) -> str:
        """주문 ID 생성"""
        return f"ORD_{datetime.now().strftime('%Y%m%d%H%M%S%f')}"

    def get_order_status(self, order_id: str) -> Dict[str, Any]:
        """주문 상태 조회"""

        if order_id not in self.orders:
            return {"error": "주문을 찾을 수 없음"}

        order = self.orders[order_id]
        return {
            "order_id": order_id,
            "symbol": order.symbol,
            "type": order.order_type.value,
            "quantity": order.quantity,
            "status": order.status.value,
            "filled_quantity": order.filled_quantity,
            "average_fill_price": order.average_fill_price,
            "price": order.price,
            "timestamp": order.timestamp.isoformat()
        }

    def get_execution_log(self, limit: int = 100) -> list:
        """최근 주문 기록 조회"""
        return self.execution_log[-limit:]


if __name__ == "__main__":
    engine = OrderExecutionEngine()

    # 테스트 (실제 거래는 실행되지 않음)
    print("주문실행엔진이 준비되었습니다.")
    print("주문 형식:", {
        "symbol": "005930",
        "symbol_name": "Samsung",
        "market": "KR",
        "order_type": "BUY",
        "quantity": 10,
        "price": 70000,
        "stop_loss_price": 68600,
        "take_profit_price": 72100
    })
