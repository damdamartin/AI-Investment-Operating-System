from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from datetime import datetime
from enum import Enum
import json


class PositionStatus(str, Enum):
    OPEN = "OPEN"
    CLOSED = "CLOSED"
    STOPPED = "STOPPED"  # 손절
    PROFITED = "PROFITED"  # 익절


@dataclass
class Position:
    """포지션 객체"""
    symbol: str
    quantity: int
    entry_price: float
    entry_time: datetime
    stop_loss_price: float
    take_profit_price: float
    status: PositionStatus = PositionStatus.OPEN
    current_price: Optional[float] = None
    exit_price: Optional[float] = None
    exit_time: Optional[datetime] = None
    pnl: float = 0.0  # Profit & Loss
    pnl_pct: float = 0.0  # P&L %

    def update_current_price(self, price: float) -> None:
        """현재가 업데이트 및 P&L 계산"""
        self.current_price = price
        if self.status == PositionStatus.OPEN:
            self.pnl = (price - self.entry_price) * self.quantity
            self.pnl_pct = ((price - self.entry_price) / self.entry_price) * 100

    def check_exit_condition(self) -> Optional[PositionStatus]:
        """손절/익절 확인"""
        if self.status != PositionStatus.OPEN or not self.current_price:
            return None

        if self.current_price <= self.stop_loss_price:
            return PositionStatus.STOPPED
        elif self.current_price >= self.take_profit_price:
            return PositionStatus.PROFITED

        return None

    def close_position(self, exit_price: float, status: PositionStatus) -> None:
        """포지션 종료"""
        self.current_price = exit_price
        self.exit_price = exit_price
        self.exit_time = datetime.now()
        self.status = status
        self.pnl = (exit_price - self.entry_price) * self.quantity
        self.pnl_pct = ((exit_price - self.entry_price) / self.entry_price) * 100

    def to_dict(self) -> Dict[str, Any]:
        """딕셔너리 변환"""
        data = asdict(self)
        data['entry_time'] = self.entry_time.isoformat()
        if self.exit_time:
            data['exit_time'] = self.exit_time.isoformat()
        data['status'] = self.status.value
        return data


class PositionManager:
    """포지션 관리자"""

    def __init__(self):
        self.open_positions: Dict[str, Position] = {}
        self.closed_positions: List[Position] = []

    def add_position(self, position: Position) -> None:
        """포지션 추가"""
        key = f"{position.symbol}_{position.entry_time.timestamp()}"
        self.open_positions[key] = position
        print(f"✅ 포지션 생성: {position.symbol} {position.quantity}주 @ {position.entry_price:,.0f}원")

    def get_open_positions(self) -> List[Position]:
        """열린 포지션 조회"""
        return list(self.open_positions.values())

    def get_position_by_symbol(self, symbol: str) -> Optional[Position]:
        """종목별 포지션 조회 (첫 번째)"""
        for pos in self.open_positions.values():
            if pos.symbol == symbol:
                return pos
        return None

    def close_position(self, key: str, exit_price: float, status: PositionStatus) -> bool:
        """포지션 종료"""
        if key in self.open_positions:
            pos = self.open_positions[key]
            pos.close_position(exit_price, status)
            self.closed_positions.append(pos)
            del self.open_positions[key]

            status_label = "손절" if status == PositionStatus.STOPPED else "익절"
            print(f"✅ 포지션 종료 ({status_label}): {pos.symbol} {pos.quantity}주 @ {exit_price:,.0f}원 (P&L: {pos.pnl_pct:.2f}%)")
            return True
        return False

    def update_all_positions(self, symbol: str, current_price: float) -> None:
        """모든 포지션 업데이트"""
        for pos in self.open_positions.values():
            if pos.symbol == symbol:
                pos.update_current_price(current_price)

    def check_all_exit_conditions(self) -> List[tuple[str, Position, PositionStatus]]:
        """모든 포지션의 손절/익절 확인"""
        to_close = []
        for key, pos in self.open_positions.items():
            status = pos.check_exit_condition()
            if status:
                to_close.append((key, pos, status))
        return to_close

    def get_portfolio_summary(self) -> Dict[str, Any]:
        """포트폴리오 요약"""
        total_value = 0
        total_pnl = 0

        for pos in self.open_positions.values():
            if pos.current_price:
                total_value += pos.current_price * pos.quantity
                total_pnl += pos.pnl

        closed_pnl = sum(pos.pnl for pos in self.closed_positions)

        return {
            "open_positions_count": len(self.open_positions),
            "closed_positions_count": len(self.closed_positions),
            "open_positions_value": total_value,
            "open_pnl": total_pnl,
            "closed_pnl": closed_pnl,
            "total_pnl": total_pnl + closed_pnl
        }

    def save_positions_to_file(self, filename: str = "positions.json") -> None:
        """포지션 저장"""
        data = {
            "open_positions": [pos.to_dict() for pos in self.open_positions.values()],
            "closed_positions": [pos.to_dict() for pos in self.closed_positions]
        }
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"💾 포지션 저장: {filename}")

    def load_positions_from_file(self, filename: str = "positions.json") -> None:
        """포지션 로드"""
        try:
            with open(filename, 'r', encoding='utf-8') as f:
                data = json.load(f)

            # 열린 포지션 복원
            for pos_data in data.get("open_positions", []):
                pos = Position(
                    symbol=pos_data["symbol"],
                    quantity=pos_data["quantity"],
                    entry_price=pos_data["entry_price"],
                    entry_time=datetime.fromisoformat(pos_data["entry_time"]),
                    stop_loss_price=pos_data["stop_loss_price"],
                    take_profit_price=pos_data["take_profit_price"],
                    status=PositionStatus(pos_data["status"]),
                    current_price=pos_data.get("current_price"),
                    pnl=pos_data.get("pnl", 0.0),
                    pnl_pct=pos_data.get("pnl_pct", 0.0)
                )
                self.open_positions[f"{pos.symbol}_{pos.entry_time.timestamp()}"] = pos

            # 종료된 포지션 복원
            for pos_data in data.get("closed_positions", []):
                pos = Position(
                    symbol=pos_data["symbol"],
                    quantity=pos_data["quantity"],
                    entry_price=pos_data["entry_price"],
                    entry_time=datetime.fromisoformat(pos_data["entry_time"]),
                    stop_loss_price=pos_data["stop_loss_price"],
                    take_profit_price=pos_data["take_profit_price"],
                    status=PositionStatus(pos_data["status"]),
                    current_price=pos_data.get("current_price"),
                    exit_price=pos_data.get("exit_price"),
                    exit_time=datetime.fromisoformat(pos_data["exit_time"]) if pos_data.get("exit_time") else None,
                    pnl=pos_data.get("pnl", 0.0),
                    pnl_pct=pos_data.get("pnl_pct", 0.0)
                )
                self.closed_positions.append(pos)

            print(f"✅ 포지션 로드: {filename} (열림: {len(self.open_positions)}, 종료: {len(self.closed_positions)})")

        except FileNotFoundError:
            print(f"⚠️  포지션 파일 없음: {filename}")
