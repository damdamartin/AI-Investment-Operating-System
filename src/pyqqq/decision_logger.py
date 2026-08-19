"""
의사결정 로그 시스템 - 모든 거래 의사결정을 JSONL로 기록하여 나중에 복기할 수 있도록 함
"""

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)


class DecisionLogger:
    """
    모든 거래 의사결정을 시간순으로 JSONL 파일에 기록합니다.

    이후 성과 복기 엔진에서 읽어서 팀별 정확도를 계산합니다.
    """

    def __init__(self, log_dir: str = "/Users/mac/Desktop/trading_logs"):
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(parents=True, exist_ok=True)

        # 오늘 날짜 기반 로그 파일
        today = datetime.now().strftime("%Y%m%d")
        self.log_file = self.log_dir / f"aios_decisions_{today}.jsonl"

        # 날짜 변경 감지
        self.current_date = today

        logger.info(f"📝 DecisionLogger 초기화: {self.log_file}")

    def _check_date_change(self) -> None:
        """날짜가 변경되었으면 새 로그 파일 생성"""
        today = datetime.now().strftime("%Y%m%d")
        if today != self.current_date:
            self.current_date = today
            self.log_file = self.log_dir / f"aios_decisions_{today}.jsonl"
            logger.info(f"📝 새 로그 파일로 전환: {self.log_file}")

    def log_event(self, event_type: str, data: Dict[str, Any], **kwargs) -> None:
        """
        의사결정 이벤트를 로그에 기록합니다.

        Args:
            event_type: "MARKET_REGIME_DETECTED", "TEAM_SIGNAL_CREATED", "ORDER_EXECUTED" 등
            data: 이벤트 데이터
            **kwargs: 무시되는 추가 파라미터 (호환성용)
        """

        self._check_date_change()

        # cycle_id 등 무시할 필드 필터링
        clean_data = {k: v for k, v in data.items() if k != "cycle_id"}

        event = {
            "timestamp": datetime.now().isoformat(),
            "event_type": event_type,
            "data": clean_data
        }

        try:
            with open(self.log_file, "a") as f:
                f.write(json.dumps(event, ensure_ascii=False) + "\n")

            logger.debug(f"✅ 로그 기록: {event_type}")

        except Exception as e:
            logger.error(f"❌ 로그 기록 오류: {e}")

    def log_market_regime(
        self,
        market: str,
        regime: str,
        confidence: float,
        features: Dict[str, float],
        reason: str,
    ) -> None:
        """시장 국면 감지 로그"""
        self.log_event(
            "MARKET_REGIME_DETECTED",
            {
                "market": market,
                "regime": regime,
                "confidence": confidence,
                "features": features,
                "reason": reason,
            }
        )

    def log_watchlist(
        self,
        symbols: List[str],
        selection_reason: str,
        market: str,
    ) -> None:
        """종목 선정 로그"""
        self.log_event(
            "WATCHLIST_SELECTED",
            {
                "market": market,
                "symbols": symbols,
                "count": len(symbols),
                "selection_reason": selection_reason,
            }
        )

    def log_team_signal(
        self,
        team: str,  # "research", "analysis", "strategy"
        symbol: str,
        signal: str,
        confidence: float,
        factor_scores: Optional[Dict[str, float]] = None,
        reason: str = "",
    ) -> None:
        """팀 신호 생성 로그"""
        self.log_event(
            "TEAM_SIGNAL_CREATED",
            {
                "team": team,
                "symbol": symbol,
                "signal": signal,
                "confidence": confidence,
                "factor_scores": factor_scores or {},
                "reason": reason,
            }
        )

    def log_order_intent(
        self,
        symbol: str,
        market: str,
        trade_type: str,
        entry_price: float,
        stop_loss_price: float,
        take_profit_1_price: float,
        take_profit_2_price: Optional[float],
        market_regime: str,
        team_factor_scores: Dict[str, float],
        entry_reason: str,
        invalidation_reason: str,
    ) -> None:
        """OrderIntent 생성 로그"""
        self.log_event(
            "ORDER_INTENT_CREATED",
            {
                "symbol": symbol,
                "market": market,
                "trade_type": trade_type,
                "entry_price": entry_price,
                "stop_loss_price": stop_loss_price,
                "take_profit_1_price": take_profit_1_price,
                "take_profit_2_price": take_profit_2_price,
                "market_regime": market_regime,
                "team_factor_scores": team_factor_scores,
                "entry_reason": entry_reason,
                "invalidation_reason": invalidation_reason,
            }
        )

    def log_risk_decision(
        self,
        symbol: str,
        approved: bool,
        approved_quantity: float,
        approved_order_currency: str,
        cash_after_order: float,
        max_loss_pct: float,
        risk_reason: str,
        blocked_reason: Optional[str] = None,
    ) -> None:
        """RiskDecision 로그"""
        self.log_event(
            "RISK_DECISION_CREATED",
            {
                "symbol": symbol,
                "approved": approved,
                "approved_quantity": approved_quantity,
                "approved_order_currency": approved_order_currency,
                "cash_after_order": cash_after_order,
                "max_loss_pct": max_loss_pct,
                "risk_reason": risk_reason,
                "blocked_reason": blocked_reason,
            }
        )

    def log_order_executed(
        self,
        symbol: str,
        order_id: Optional[str],
        side: str,  # "BUY" or "SELL"
        quantity: float,
        price: float,
        total_amount: float,
        currency: str,
        confidence: float,
        result: Dict[str, Any],
    ) -> None:
        """주문 실행 로그"""
        self.log_event(
            "ORDER_EXECUTED",
            {
                "symbol": symbol,
                "order_id": order_id,
                "side": side,
                "quantity": quantity,
                "price": price,
                "total_amount": total_amount,
                "currency": currency,
                "confidence": confidence,
                "result": result,
            }
        )

    def log_order_rejected(
        self,
        symbol: str,
        reason: str,
        checks: Dict[str, bool],
    ) -> None:
        """주문 거절 로그"""
        self.log_event(
            "ORDER_REJECTED",
            {
                "symbol": symbol,
                "reason": reason,
                "failed_checks": [check for check, passed in checks.items() if not passed],
            }
        )

    def log_loss_response(
        self,
        symbol: str,
        current_price: float,
        entry_price: float,
        loss_pct: float,
        response_type: str,  # "HOLD_NORMAL_PULLBACK", "PARTIAL_CUT", "FULL_CUT" 등
        action: str,  # "HOLD", "SELL_PARTIAL", "SELL_ALL", "BUY_ADD"
        quantity_pct: Optional[float],
        reason: str,
    ) -> None:
        """손실 대응 시나리오 로그"""
        self.log_event(
            "LOSS_RESPONSE_TRIGGERED",
            {
                "symbol": symbol,
                "current_price": current_price,
                "entry_price": entry_price,
                "loss_pct": loss_pct,
                "response_type": response_type,
                "action": action,
                "quantity_pct": quantity_pct,
                "reason": reason,
            }
        )

    def log_take_profit(
        self,
        symbol: str,
        current_price: float,
        entry_price: float,
        profit_pct: float,
        take_profit_level: int,  # 1 or 2
        quantity_pct: float,
        reason: str,
    ) -> None:
        """익절 트리거 로그"""
        self.log_event(
            "TAKE_PROFIT_TRIGGERED",
            {
                "symbol": symbol,
                "current_price": current_price,
                "entry_price": entry_price,
                "profit_pct": profit_pct,
                "take_profit_level": take_profit_level,
                "quantity_pct": quantity_pct,
                "reason": reason,
            }
        )

    def log_stop_loss(
        self,
        symbol: str,
        current_price: float,
        stop_loss_price: float,
        loss_pct: float,
        reason: str,
    ) -> None:
        """손절 트리거 로그"""
        self.log_event(
            "STOP_LOSS_TRIGGERED",
            {
                "symbol": symbol,
                "current_price": current_price,
                "stop_loss_price": stop_loss_price,
                "loss_pct": loss_pct,
                "reason": reason,
            }
        )

    def log_position_closed(
        self,
        symbol: str,
        entry_price: float,
        exit_price: float,
        quantity: float,
        realized_pnl: float,
        realized_pnl_pct: float,
        holding_period_hours: float,
        exit_reason: str,
    ) -> None:
        """포지션 종료 로그"""
        self.log_event(
            "POSITION_CLOSED",
            {
                "symbol": symbol,
                "entry_price": entry_price,
                "exit_price": exit_price,
                "quantity": quantity,
                "realized_pnl": realized_pnl,
                "realized_pnl_pct": realized_pnl_pct,
                "holding_period_hours": holding_period_hours,
                "exit_reason": exit_reason,
            }
        )

    def read_today_logs(self) -> List[Dict[str, Any]]:
        """
        오늘의 모든 로그를 읽어 반환합니다.

        Returns:
            [
                {"timestamp": "...", "event_type": "...", "data": {...}},
                ...
            ]
        """

        self._check_date_change()

        if not self.log_file.exists():
            return []

        logs = []
        try:
            with open(self.log_file, "r") as f:
                for line in f:
                    if line.strip():
                        logs.append(json.loads(line))
        except Exception as e:
            logger.error(f"❌ 로그 읽기 오류: {e}")

        return logs

    def read_logs_by_type(self, event_type: str) -> List[Dict[str, Any]]:
        """
        특정 타입의 로그만 필터링해서 반환합니다.

        Args:
            event_type: "ORDER_EXECUTED", "LOSS_RESPONSE_TRIGGERED" 등

        Returns:
            [...]
        """

        all_logs = self.read_today_logs()
        return [log for log in all_logs if log.get("event_type") == event_type]

    def read_symbol_history(self, symbol: str) -> List[Dict[str, Any]]:
        """
        특정 종목의 모든 이벤트를 시간순으로 반환합니다.

        Args:
            symbol: "005930", "AAPL" 등

        Returns:
            [...]
        """

        all_logs = self.read_today_logs()
        symbol_logs = []

        for log in all_logs:
            data = log.get("data", {})
            if data.get("symbol") == symbol:
                symbol_logs.append(log)

        return symbol_logs


# 테스트용
def main():
    logger_instance = DecisionLogger()

    # 테스트 1: 시장 국면 로그
    logger_instance.log_market_regime(
        market="KR",
        regime="UPTREND",
        confidence=0.75,
        features={"index_trend": 0.68, "volatility": 0.42},
        reason="지수와 대형주 동반 상승"
    )

    # 테스트 2: 종목 선정 로그
    logger_instance.log_watchlist(
        symbols=["005930", "000660", "000270"],
        selection_reason="반도체/자동차 핫 섹터",
        market="KR"
    )

    # 테스트 3: 팀 신호 로그
    logger_instance.log_team_signal(
        team="analysis",
        symbol="005930",
        signal="BUY",
        confidence=0.68,
        factor_scores={"trend": 0.75, "rsi": 0.65},
        reason="상승 추세 + 기술 지표 우호"
    )

    # 테스트 4: 로그 읽기
    print("\n=== 오늘의 모든 로그 ===")
    logs = logger_instance.read_today_logs()
    for log in logs:
        print(f"{log['timestamp']}: {log['event_type']}")

    print(f"\n총 {len(logs)}개 로그 기록")


if __name__ == "__main__":
    main()
