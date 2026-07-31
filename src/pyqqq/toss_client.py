import aiohttp
import json
import base64
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from .config import settings


logger = logging.getLogger(__name__)


class TossSecuritiesClient:
    """Toss Securities Open API 클라이언트"""

    def __init__(self):
        self.base_url = settings.toss_api_base_url.rstrip('/')
        self.client_id = settings.toss_client_id
        self.client_secret = settings.toss_client_secret
        self.account_ref = settings.toss_account_ref
        self.read_only = settings.toss_read_only_mode.lower() == 'true'

        self.access_token: Optional[str] = None
        self.token_expiry: Optional[datetime] = None
        self.session: Optional[aiohttp.ClientSession] = None

    async def _ensure_session(self) -> aiohttp.ClientSession:
        """세션 생성 또는 재사용"""
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession()
        return self.session

    async def authenticate(self) -> bool:
        """OAuth 2.0 인증 (Client Credentials)"""
        try:
            session = await self._ensure_session()
            auth_url = f"{self.base_url}/oauth2/token"

            headers = {
                "Content-Type": "application/x-www-form-urlencoded"
            }

            payload = {
                "grant_type": "client_credentials",
                "client_id": self.client_id,
                "client_secret": self.client_secret
            }

            async with session.post(auth_url, data=payload, headers=headers) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    self.access_token = data.get("access_token")
                    expires_in = data.get("expires_in", 3600)  # 기본 1시간
                    self.token_expiry = datetime.now() + timedelta(seconds=expires_in)
                    logger.info(f"✅ Toss API 인증 성공 (만료: {self.token_expiry.isoformat()})")
                    return True
                else:
                    error_data = await resp.text()
                    logger.error(f"❌ Toss 인증 실패 ({resp.status}): {error_data}")
                    return False
        except Exception as e:
            logger.error(f"❌ 인증 오류: {e}")
            return False

    async def _check_token(self) -> bool:
        """토큰 유효성 확인 및 재인증"""
        if not self.access_token:
            return await self.authenticate()

        if self.token_expiry and datetime.now() >= self.token_expiry:
            logger.info("🔄 토큰 만료 - 재인증 중...")
            return await self.authenticate()

        return True

    def _get_headers(self) -> Dict[str, str]:
        """요청 헤더 생성"""
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
            "User-Agent": "PyQQQ/1.0"
        }

    async def get_account_balance(self) -> Dict[str, Any]:
        """계좌 잔고 조회"""
        if not await self._check_token():
            return {}

        try:
            session = await self._ensure_session()
            url = f"{self.base_url}/api/v1/accounts"
            headers = self._get_headers()
            headers["x-tossinvest-account"] = self.account_ref

            async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    result = {
                        "cash": float(data.get("cashBalance", 0)),
                        "total_value": float(data.get("totalAsset", 0)),
                        "buying_power": float(data.get("buyingPower", 0)),
                        "d2_cash": float(data.get("d2CashBalance", 0))
                    }
                    logger.info(
                        f"💰 계좌 잔고: 현금 {result['cash']:,.0f}원, "
                        f"총자산 {result['total_value']:,.0f}원"
                    )
                    return result
                else:
                    error_data = await resp.text()
                    logger.error(f"❌ 잔고 조회 실패 ({resp.status}): {error_data}")
                    return {}
        except Exception as e:
            logger.error(f"❌ 잔고 조회 오류: {e}")
            return {}

    async def get_holdings(self) -> List[Dict[str, Any]]:
        """보유주식 조회"""
        if not await self._check_token():
            return []

        try:
            session = await self._ensure_session()
            url = f"{self.base_url}/api/v1/holdings"
            headers = self._get_headers()
            headers["x-tossinvest-account"] = self.account_ref

            async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    result = data.get("result", {})
                    items = result.get("items", [])
                    logger.info(f"📊 보유주식: {len(items)}개")
                    for h in items[:3]:
                        logger.info(
                            f"  - {h.get('symbol')}: {h.get('quantity')}주 @ "
                            f"{h.get('marketPrice', h.get('purchasePrice', 0)):,.0f}원"
                        )
                    return items
                else:
                    error_data = await resp.text()
                    logger.error(f"❌ 보유주식 조회 실패 ({resp.status}): {error_data}")
                    return []
        except Exception as e:
            logger.error(f"❌ 보유주식 조회 오류: {e}")
            return []

    async def get_stock_price(self, symbol: str) -> Optional[float]:
        """주식 현재가 조회 (시세 API)"""
        if not await self._check_token():
            return None

        try:
            session = await self._ensure_session()
            url = f"{self.base_url}/api/v1/prices"
            headers = self._get_headers()
            params = {"symbols": symbol}

            async with session.get(url, headers=headers, params=params, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    # 응답이 result 객체 안에 있는 경우
                    result = data.get("result", [])
                    if isinstance(result, list) and len(result) > 0:
                        price = float(result[0].get("lastPrice", 0))
                        return price
                    # 직접 배열인 경우
                    elif isinstance(result, list):
                        logger.warning(f"⚠️  주가 조회 결과 없음 ({symbol})")
                        return None
                    else:
                        logger.warning(f"⚠️  주가 조회 응답 형식 불일치 ({symbol}): {type(result)}")
                        return None
                else:
                    logger.warning(f"⚠️  주가 조회 실패 ({symbol}): {resp.status}")
                    return None
        except Exception as e:
            logger.error(f"❌ 주가 조회 오류 ({symbol}): {e}")
            return None

    async def place_order(
        self,
        symbol: str,
        quantity: int,
        price: float,
        side: str = "BUY"
    ) -> Optional[str]:
        """주문 생성 (BUY/SELL)"""
        if self.read_only:
            logger.warning(f"⚠️  READ_ONLY 모드: 주문 실행 불가")
            return None

        if not await self._check_token():
            return None

        try:
            session = await self._ensure_session()
            url = f"{self.base_url}/api/v1/orders"
            headers = self._get_headers()
            headers["x-tossinvest-account"] = self.account_ref

            payload = {
                "symbol": symbol,
                "quantity": quantity,
                "price": price,
                "orderType": "LIMIT",  # LIMIT or MARKET
                "side": side  # BUY or SELL
            }

            async with session.post(
                url,
                json=payload,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=10)
            ) as resp:
                if resp.status == 201:
                    data = await resp.json()
                    order_id = data.get("orderId")
                    logger.info(
                        f"✅ 주문 생성: {side} {quantity}주 @ {price:,.0f}원 "
                        f"(Order ID: {order_id})"
                    )
                    return order_id
                else:
                    error_data = await resp.text()
                    logger.error(f"❌ 주문 실패 ({resp.status}): {error_data}")
                    return None
        except Exception as e:
            logger.error(f"❌ 주문 오류: {e}")
            return None

    async def cancel_order(self, order_id: str) -> bool:
        """주문 취소"""
        if self.read_only:
            logger.warning(f"⚠️  READ_ONLY 모드: 취소 실행 불가")
            return False

        if not await self._check_token():
            return False

        try:
            session = await self._ensure_session()
            url = f"{self.base_url}/api/v1/orders/{order_id}"
            headers = self._get_headers()
            headers["x-tossinvest-account"] = self.account_ref

            async with session.delete(
                url,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=10)
            ) as resp:
                if resp.status == 200:
                    logger.info(f"✅ 주문 취소: {order_id}")
                    return True
                else:
                    error_data = await resp.text()
                    logger.error(f"❌ 취소 실패 ({resp.status}): {error_data}")
                    return False
        except Exception as e:
            logger.error(f"❌ 취소 오류: {e}")
            return False

    async def get_orders(self, status: str = "OPEN") -> List[Dict[str, Any]]:
        """주문 조회 (status: OPEN 또는 CLOSED)"""
        if not await self._check_token():
            return []

        # 상태 정규화
        if status.upper() == "PENDING":
            status = "OPEN"

        try:
            session = await self._ensure_session()
            url = f"{self.base_url}/api/v1/orders"
            headers = self._get_headers()
            headers["x-tossinvest-account"] = self.account_ref
            params = {"status": status.upper()}

            async with session.get(
                url,
                headers=headers,
                params=params,
                timeout=aiohttp.ClientTimeout(total=10)
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    orders = data.get("orders", [])
                    logger.info(f"📋 주문 조회: {len(orders)}개 ({status})")
                    return orders
                else:
                    logger.warning(f"⚠️  주문 조회 실패: {resp.status}")
                    return []
        except Exception as e:
            logger.error(f"❌ 주문 조회 오류: {e}")
            return []

    async def close(self) -> None:
        """세션 종료"""
        if self.session:
            await self.session.close()
            logger.info("✅ Toss API 세션 종료")
