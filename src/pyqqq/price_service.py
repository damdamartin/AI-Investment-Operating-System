"""
실시간 현재가 조회 서비스
- KIS: 한국 주식 현재가
- Toss: 미국 주식 현재가
"""

import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)


class PriceService:
    """실시간 현재가 조회"""

    def __init__(self, kis_client=None, toss_client=None):
        self.kis_client = kis_client
        self.toss_client = toss_client

    async def get_current_price(
        self,
        symbol: str,
        market: str
    ) -> Optional[dict]:
        """
        실시간 현재가 조회

        Args:
            symbol: 종목코드 (한국: 6자리, 미국: 대문자 4자리)
            market: "KR" 또는 "US"

        Returns:
            {
                "symbol": str,
                "market": str,
                "price": float,              # 현재가
                "currency": str,            # KRW 또는 USD
                "source": str,              # kis, toss, fallback
                "timestamp": str,           # ISO format
                "is_realtime": bool,        # 실시간 여부
                "bid": float,               # 매수호가
                "ask": float,               # 매도호가
                "volume": int,              # 거래량
                "change_rate": float,       # 변동률 (%)
            } | None
        """
        if market == "KR":
            return await self._get_kr_price(symbol)
        elif market == "US":
            return await self._get_us_price(symbol)
        else:
            logger.error(f"❌ 잘못된 시장: {market}")
            return None

    async def _get_kr_price(self, symbol: str) -> Optional[dict]:
        """한국 주식 현재가 조회 (KIS API)"""
        if not self.kis_client:
            logger.error("❌ KIS 클라이언트 미설정")
            return None

        try:
            # KIS API 호출 - 주식시세 조회
            result = await self.kis_client.get_current_price(symbol)

            if not result or result.get("status") != "SUCCESS":
                logger.warning(f"⚠️  KIS 현재가 조회 실패: {symbol}")
                return None

            data = result.get("data", {})

            return {
                "symbol": symbol,
                "market": "KR",
                "price": float(data.get("stck_prpr", 0)),  # 주식현재가
                "currency": "KRW",
                "source": "kis",
                "timestamp": datetime.now().isoformat(),
                "is_realtime": True,
                "bid": float(data.get("stck_bprc", 0)),    # 매수호가
                "ask": float(data.get("stck_aprc", 0)),    # 매도호가
                "volume": int(data.get("acml_vol", 0)),    # 누적거래량
                "change_rate": float(data.get("prdy_ctrt", 0)),  # 전일대비율
            }

        except Exception as e:
            logger.error(f"❌ KIS 현재가 조회 오류 ({symbol}): {e}")
            return None

    async def _get_us_price(self, symbol: str) -> Optional[dict]:
        """미국 주식 현재가 조회 (Toss API)"""
        if not self.toss_client:
            logger.error("❌ Toss 클라이언트 미설정")
            return None

        try:
            # Toss API 호출 - 미국 주식 현재가
            result = await self.toss_client.get_current_price(symbol)

            if not result or result.get("status") != "SUCCESS":
                logger.warning(f"⚠️  Toss 현재가 조회 실패: {symbol}")
                return None

            data = result.get("data", {})

            return {
                "symbol": symbol,
                "market": "US",
                "price": float(data.get("price", 0)),  # 현재가
                "currency": "USD",
                "source": "toss",
                "timestamp": datetime.now().isoformat(),
                "is_realtime": True,
                "bid": float(data.get("bid", 0)),      # 매수호가
                "ask": float(data.get("ask", 0)),      # 매도호가
                "volume": int(data.get("volume", 0)),  # 거래량
                "change_rate": float(data.get("change_rate", 0)),  # 변동률
            }

        except Exception as e:
            logger.error(f"❌ Toss 현재가 조회 오류 ({symbol}): {e}")
            return None

    async def validate_price(self, price: float, symbol: str, market: str) -> bool:
        """
        현재가 유효성 검증

        Args:
            price: 검증할 가격
            symbol: 종목코드
            market: 시장

        Returns:
            True: 유효한 가격
            False: 잘못된 가격
        """
        # 가격이 0 이상이어야 함
        if price is None or price <= 0:
            logger.error(f"❌ 무효한 가격: {symbol} = {price}")
            return False

        # 임시 가격 감지 (고정값 감지)
        if price in [50000, 150, 100000, 1000, 10000]:
            logger.error(
                f"❌ 임시/기본값 가격 감지: {symbol} = {price} "
                f"(실시간 현재가를 사용해주세요)"
            )
            return False

        return True

    async def get_prices_batch(
        self,
        symbols: list[str],
        market: str
    ) -> dict:
        """
        여러 종목의 현재가 일괄 조회

        Args:
            symbols: 종목코드 리스트
            market: "KR" 또는 "US"

        Returns:
            {
                symbol: price_data,
                ...
            }
        """
        prices = {}

        for symbol in symbols:
            price_data = await self.get_current_price(symbol, market)
            if price_data:
                prices[symbol] = price_data

        return prices


async def main():
    """테스트"""
    print("\n" + "="*70)
    print("💰 PriceService 테스트")
    print("="*70)
    print("\n주의: KIS/Toss 클라이언트가 필요합니다")


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
