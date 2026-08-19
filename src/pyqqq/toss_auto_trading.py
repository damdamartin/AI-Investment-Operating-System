"""Toss 해외주식 자동매매 엔진"""

import asyncio
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
from .toss_client import TossSecuritiesClient
from .config import settings

logger = logging.getLogger(__name__)


class TossAutoTradingEngine:
    """Toss Securities 자동매매 엔진 - 미국주식"""

    def __init__(self):
        self.client = TossSecuritiesClient()
        self.watchlist = self._parse_watchlist()
        self.positions = {}
        self.running = False

    def _parse_watchlist(self) -> Dict[str, Dict]:
        """설정에서 watchlist 파싱"""
        watchlist = {}
        watchlist_str = settings.watchlist

        for item in watchlist_str.split(','):
            parts = item.strip().split(':')
            if len(parts) >= 2:
                symbol = parts[0].strip()
                name = parts[1].strip()
                watchlist[symbol] = {
                    'name': name,
                    'buy_threshold': settings.buy_threshold,
                    'sell_threshold': settings.sell_threshold,
                    'stop_loss_pct': settings.stop_loss_pct,
                    'take_profit_pct': settings.take_profit_pct
                }

        return watchlist

    async def initialize(self) -> bool:
        """엔진 초기화"""
        try:
            if not await self.client.authenticate():
                logger.error("❌ Toss 인증 실패")
                return False

            # 현재 포지션 조회
            await self._sync_positions()
            logger.info(f"✅ Toss 자동매매 엔진 초기화 완료")
            return True
        except Exception as e:
            logger.error(f"❌ 엔진 초기화 오류: {e}")
            return False

    async def _sync_positions(self) -> None:
        """현재 포지션 동기화"""
        try:
            holdings = await self.client.get_holdings()
            self.positions = {}

            for holding in holdings:
                symbol = holding.get('symbol', '')
                if symbol:
                    self.positions[symbol] = {
                        'quantity': float(holding.get('quantity', 0)),
                        'purchase_price': float(holding.get('purchasePrice', 0)),
                        'market_price': float(holding.get('marketPrice', 0)),
                        'gain_loss_pct': float(holding.get('gainLossPct', 0))
                    }

            logger.info(f"📊 포지션 동기화: {len(self.positions)}개 종목")
        except Exception as e:
            logger.error(f"포지션 동기화 오류: {e}")

    async def execute_trading_cycle(self) -> None:
        """자동매매 사이클 실행"""
        try:
            # 계좌 잔고 확인
            balance = await self.client.get_account_balance()
            if not balance:
                logger.warning("⚠️  계좌 잔고 조회 실패")
                return

            cash = balance.get('cash', 0)
            logger.info(f"💰 현금 잔고: ₩{cash:,.0f}")

            # 포지션 동기화
            await self._sync_positions()

            # 1단계: 보유 종목 정리 (손절/익절 체크)
            logger.debug("📊 1단계: 보유 종목 정리 중...")
            for symbol, position in list(self.positions.items()):
                if symbol != 'cash' and symbol != 'total_value':
                    await self._check_stop_loss_take_profit(symbol, position.get('quantity', 0),
                                                           position.get('purchase_price', 0),
                                                           position.get('market_price', 0), {})

            # 2단계: 자동 리밸런싱 (USD 부족 시 비 Watchlist 종목 매도)
            # Watchlist에 없는 종목(한국 주식 등)을 매도해서 현금 확보
            await self._rebalance_and_liquidate()

            # 3단계: 신규 거래 (매수 신호)
            logger.debug("📊 3단계: 신규 거래 검토 중...")
            for symbol, config in self.watchlist.items():
                await self._process_symbol(symbol, config, cash)

        except Exception as e:
            logger.error(f"❌ 거래 사이클 오류: {e}")

    async def _process_symbol(self, symbol: str, config: Dict, cash: float) -> None:
        """종목별 거래 처리"""
        try:
            # 현재가 조회
            price = await self.client.get_stock_price(symbol)
            if not price or price == 0:
                logger.debug(f"⚠️  {symbol} 가격 조회 실패 또는 0")
                return

            position = self.positions.get(symbol, {})
            quantity = position.get('quantity', 0)
            purchase_price = position.get('purchase_price', 0)

            # 손절/익절 체크
            if quantity > 0:
                await self._check_stop_loss_take_profit(symbol, quantity, purchase_price, price, config)
            else:
                # 매수 신호 체크
                await self._check_buy_signal(symbol, price, config, cash)

        except Exception as e:
            logger.error(f"❌ {symbol} 처리 오류: {e}")

    async def _rebalance_and_liquidate(self) -> None:
        """포트폴리오 리밸런싱 - 일부 종목 매도해서 현금화"""
        try:
            holdings = await self.client.get_holdings()
            if not holdings:
                return

            # 비 Watchlist 종목 (한국 주식 등)부터 매도 시도
            for holding in holdings:
                symbol = holding.get('symbol', '')
                quantity = float(holding.get('quantity', 0))

                # Watchlist 종목은 제외
                if symbol in self.watchlist or quantity <= 0:
                    continue

                # 현재가 조회
                price = await self.client.get_stock_price(symbol)
                if not price or price == 0:
                    continue

                # 수량의 50% 매도
                sell_qty = int(quantity * 0.5)
                if sell_qty > 0:
                    result = await self.client.place_order(symbol, sell_qty, "SELL", price)
                    if result and result.get('success'):
                        logger.info(f"💰 리밸런싱 매도: {symbol} {sell_qty}주 @ ${price:,.2f}")
                        return  # 한 번에 하나씩만 매도

        except Exception as e:
            logger.error(f"리밸런싱 오류: {e}")

    async def _check_buy_signal(self, symbol: str, price: float, config: Dict, cash: float) -> None:
        """매수 신호 체크"""
        try:
            # 간단한 매수 전략: 특정 신호에 따라 매수
            # TODO: 실제 거래 신호 엔진 연동 필요

            # 현금이 충분하면 매수 진행 (테스트용)
            min_amount = 100000  # 최소 10만원
            max_order_amount = 50000000  # Toss API 최대 주문액 (5천만원)

            if cash >= min_amount:
                # 매수 수량 계산 (현금의 20%를 사용, 최대 5천만원 이내)
                amount = min(cash * 0.2, max_order_amount)
                quantity = int(amount / price)

                if quantity > 0:
                    result = await self.client.place_order(symbol, quantity, "BUY", price)
                    if result and result.get('success'):
                        logger.info(f"✅ {symbol} 매수 신호: {quantity}주 @ ${price:,.2f}")
                    else:
                        logger.debug(f"⚠️  {symbol} 매수 실패: {result}")
        except Exception as e:
            logger.error(f"매수 신호 오류 ({symbol}): {e}")

    async def _check_stop_loss_take_profit(self, symbol: str, quantity: float,
                                          purchase_price: float, current_price: float,
                                          config: Dict) -> None:
        """손절/익절 체크"""
        try:
            if purchase_price <= 0 or quantity <= 0:
                return

            # 수익률 계산
            gain_loss_pct = ((current_price - purchase_price) / purchase_price) * 100

            # 익절 (take profit)
            tp_pct = config.get('take_profit_pct', 10)
            if gain_loss_pct >= tp_pct:
                # 소수점 주식도 처리 가능 (반올림)
                sell_qty = round(quantity, 2)  # 소수점 2자리까지 허용
                if sell_qty > 0:
                    result = await self.client.place_order(symbol, sell_qty, "SELL", current_price)
                    if result and result.get('success'):
                        logger.info(f"🎯 {symbol} 익절: {quantity}주 @ ${current_price:,.2f} ({gain_loss_pct:.2f}% 수익)")
                return

            # 손절 (stop loss)
            sl_pct = config.get('stop_loss_pct', -5)
            if gain_loss_pct <= sl_pct:
                sell_qty = round(quantity, 2)
                if sell_qty > 0:
                    result = await self.client.place_order(symbol, sell_qty, "SELL", current_price)
                    if result and result.get('success'):
                        logger.info(f"⛔ {symbol} 손절: {quantity}주 @ ${current_price:,.2f} ({gain_loss_pct:.2f}% 손실)")
                return

        except Exception as e:
            logger.error(f"손절/익절 오류 ({symbol}): {e}")

    async def start(self, interval_seconds: int = 60) -> None:
        """자동매매 엔진 시작"""
        try:
            if not await self.initialize():
                return

            self.running = True
            logger.info(f"🚀 Toss 해외주식 자동매매 시작 (간격: {interval_seconds}초)")

            while self.running:
                try:
                    await self.execute_trading_cycle()
                except Exception as e:
                    logger.error(f"거래 사이클 오류: {e}")

                await asyncio.sleep(interval_seconds)

        except Exception as e:
            logger.error(f"❌ 엔진 오류: {e}")
        finally:
            await self.stop()

    async def stop(self) -> None:
        """자동매매 엔진 중지"""
        self.running = False
        await self.client.close()
        logger.info("⏹️  Toss 해외주식 자동매매 중지")


async def run_toss_auto_trading(interval_seconds: int = 60) -> None:
    """Toss 자동매매 실행 진입점"""
    engine = TossAutoTradingEngine()
    await engine.start(interval_seconds)


if __name__ == "__main__":
    import logging.config

    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    asyncio.run(run_toss_auto_trading(interval_seconds=60))
