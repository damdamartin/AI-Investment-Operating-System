import asyncio
import logging
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from .config import settings
from .toss_client import TossSecuritiesClient
from .position_manager import PositionManager, Position, PositionStatus


# 로깅 설정
log_level = settings.log_level.upper() if isinstance(settings.log_level, str) else "INFO"
logging.basicConfig(
    level=log_level,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class TradingStrategy:
    """AI 자동매매 전략"""

    def __init__(self):
        self.toss = TossSecuritiesClient()
        self.position_manager = PositionManager()
        self.watchlist = self._parse_watchlist()
        self.trading_active = True
        self.buy_count = 0
        self.max_buys = 4

    def _parse_watchlist(self) -> List[Dict[str, str]]:
        """Watchlist 파싱"""
        items = []
        for item in settings.watchlist.split(','):
            parts = item.strip().split(':')
            if len(parts) >= 2:
                items.append({
                    "symbol": parts[0],
                    "name": parts[1],
                    "market": parts[2] if len(parts) > 2 else "KR",
                    "asset_type": parts[3] if len(parts) > 3 else "STOCK"
                })
        logger.info(f"📊 Watchlist 로드: {len(items)}개 종목")
        return items

    async def run(self, once: bool = False) -> None:
        """자동매매 시작"""
        logger.info("🚀 AI 자동매매 시스템 시작")

        # Toss API 인증
        if not await self.toss.authenticate():
            logger.error("❌ Toss API 인증 실패")
            return

        # 기존 포지션 로드
        self.position_manager.load_positions_from_file()

        try:
            if once:
                # 단 한 번 실행
                await self._run_cycle()
            else:
                # 무한 루프 (실시간 모니터링)
                while self.trading_active:
                    try:
                        await self._run_cycle()
                        # 다음 실행까지 대기 (3시간)
                        await asyncio.sleep(3 * 3600)
                    except Exception as e:
                        logger.error(f"❌ 사이클 오류: {e}")
                        await asyncio.sleep(60)  # 오류 후 1분 대기
        except KeyboardInterrupt:
            logger.info("⏹️  사용자 중단")
        finally:
            # 포지션 저장
            self.position_manager.save_positions_to_file()
            # 세션 정리
            await self.toss.close()

    async def _run_cycle(self) -> None:
        """한 사이클 실행 (분석 → 매매 → 모니터링)"""
        logger.info("=" * 60)
        logger.info(f"📈 거래 사이클 시작: {datetime.now().isoformat()}")

        # 1. 계좌 잔고 확인
        balance = await self.toss.get_account_balance()
        available_cash = balance.get("cash", settings.available_cash)
        logger.info(f"💰 가용 현금: {available_cash:,.0f}원")

        # 2. 종목 분석 및 신호 생성
        signals = await self._analyze_watchlist()

        # 3. 신호 기반 매매 실행
        for signal in signals:
            if signal["recommendation"] == "BUY":
                await self._execute_buy_order(signal, available_cash)

        # 4. 보유 포지션 모니터링
        await self._monitor_positions()

        # 5. 포트폴리오 요약
        summary = self.position_manager.get_portfolio_summary()
        logger.info(
            f"📊 포트폴리오: 열린 포지션 {summary['open_positions_count']}개, "
            f"P&L: {summary['total_pnl']:,.0f}원 ({summary.get('open_pnl', 0) + summary.get('closed_pnl', 0):+.1f}%)"
        )

        logger.info("=" * 60)

    async def _analyze_watchlist(self) -> List[Dict]:
        """Watchlist의 모든 종목 분석"""
        signals = []

        for stock in self.watchlist:
            symbol = stock["symbol"]
            name = stock["name"]

            try:
                # 현재가 조회
                current_price = await self.toss.get_stock_price(symbol)
                if not current_price:
                    logger.warning(f"⚠️  {name} 현재가 조회 실패")
                    continue

                logger.info(f"📍 분석 중: {name} ({symbol}) @ {current_price:,.0f}원")

                # 간단한 BUY 신호 생성 (테스트용 4회 매수)
                if self.buy_count < self.max_buys:
                    recommendation = "BUY"
                    confidence = 80.0
                    logger.info(f"✅ {name}: {recommendation} (Buy #{self.buy_count + 1}/{self.max_buys})")
                else:
                    recommendation = "HOLD"
                    confidence = 50.0
                    logger.info(f"⏸️  {name}: {recommendation} (Reached 4 buy limit)")

                signal = {
                    "symbol": symbol,
                    "name": name,
                    "current_price": current_price,
                    "recommendation": recommendation,
                    "confidence": confidence,
                    "entry_price": current_price,
                    "stop_loss_price": current_price * 0.95,
                    "take_profit_price": current_price * 1.10,
                    "reasoning": "Test trading signal"
                }

                signals.append(signal)

            except Exception as e:
                logger.error(f"❌ {name} 분석 오류: {e}")

        return signals

    async def _execute_buy_order(self, signal: Dict, available_cash: float) -> None:
        """매수 주문 실행"""
        symbol = signal["symbol"]
        name = signal["name"]
        current_price = signal["current_price"]
        confidence = signal["confidence"]

        # 신뢰도 필터 (60% 이상만)
        if confidence < 60.0:
            logger.info(f"⏭️  {name} 신뢰도 낮음 ({confidence:.1f}%) - 스킵")
            return

        # 리스크 체크
        risk_check = await self._check_risk(symbol, current_price, available_cash)
        if not risk_check["allowed"]:
            logger.warning(f"⚠️  {name} 리스크 체크 실패: {risk_check['reason']}")
            return

        # 주문 수량 결정
        quantity = risk_check["quantity"]

        # 실제 주문 실행 (토스 API)
        order_id = await self.toss.place_order(
            symbol=symbol,
            quantity=quantity,
            price=current_price,
            side="BUY"
        )

        if order_id:
            # 포지션 생성
            position = Position(
                symbol=symbol,
                quantity=quantity,
                entry_price=current_price,
                entry_time=datetime.now(),
                stop_loss_price=signal["stop_loss_price"],
                take_profit_price=signal["take_profit_price"]
            )
            self.position_manager.add_position(position)
            self.buy_count += 1
            logger.info(f"✓ Buy order executed: {name} x{quantity}, Buy #{self.buy_count}/{self.max_buys}")

    async def _monitor_positions(self) -> None:
        """보유 포지션 모니터링"""
        positions = self.position_manager.get_open_positions()

        if not positions:
            logger.info("📭 열린 포지션 없음")
            return

        logger.info(f"👁️  포지션 모니터링: {len(positions)}개")

        for symbol_key in list(self.position_manager.open_positions.keys()):
            position = self.position_manager.open_positions.get(symbol_key)
            if not position:
                continue

            # 현재가 조회
            current_price = await self.toss.get_stock_price(position.symbol)
            if not current_price:
                continue

            # 포지션 업데이트
            position.update_current_price(current_price)

            # 손절/익절 확인
            exit_status = position.check_exit_condition()
            if exit_status:
                self.position_manager.close_position(symbol_key, current_price, exit_status)

            else:
                # 현재 P&L 로깅
                logger.info(
                    f"  {position.symbol}: {position.quantity}주 @ {position.entry_price:,.0f}원 "
                    f"→ {current_price:,.0f}원 (P&L: {position.pnl_pct:+.2f}%)"
                )

    async def _check_risk(self, symbol: str, current_price: float, available_cash: float) -> Dict:
        """리스크 검증"""
        # 기본 수량 (1주)
        quantity = 1

        # 주문 금액
        order_amount = quantity * current_price

        # 체크 1: 최대 주문액 초과
        if order_amount > settings.max_order_amount:
            return {
                "allowed": False,
                "reason": f"주문액 {order_amount:,.0f}원 > 최대 {settings.max_order_amount:,.0f}원"
            }

        # 체크 2: 가용 현금 부족
        if order_amount > available_cash:
            return {
                "allowed": False,
                "reason": f"가용 현금 부족: {available_cash:,.0f}원 < {order_amount:,.0f}원"
            }

        # 체크 3: 최소 현금 유지
        if (available_cash - order_amount) < settings.min_cash_after_order:
            return {
                "allowed": False,
                "reason": f"최소 현금 미유지: {available_cash - order_amount:,.0f}원 < {settings.min_cash_after_order:,.0f}원"
            }

        return {
            "allowed": True,
            "quantity": quantity
        }

    def stop(self) -> None:
        """전략 종료"""
        self.trading_active = False
        logger.info("⏹️  자동매매 중단됨")


async def main():
    """메인 진입점"""
    strategy = TradingStrategy()

    # 실행 모드 선택
    import sys

    if "--once" in sys.argv:
        # 단 한 번만 실행
        await strategy.run(once=True)
    else:
        # 무한 루프 (실시간)
        await strategy.run(once=False)


if __name__ == "__main__":
    asyncio.run(main())
