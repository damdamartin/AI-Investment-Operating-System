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
                    # 🔧 안전마진: 만료 직전이 아니라 90% 지점에서 갱신 (네트워크 지연 대비)
                    safe_expiry_seconds = expires_in * 0.9
                    self.token_expiry = datetime.now() + timedelta(seconds=safe_expiry_seconds)
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

    async def get_cash_balance(self) -> Dict[str, float]:
        """현금 잔고 조회 - /api/v1/buying-power 사용 (공식 권장)

        Toss Open API 문서 기반:
        - /api/v1/buying-power로 통화별(KRW, USD) 현금 조회
        - 미수거래를 제외한 현금 기반 매수 가능 금액

        Returns:
            {"krw": float, "usd": float}
        """
        if not await self._check_token():
            return {"krw": 0, "usd": 0}

        try:
            session = await self._ensure_session()
            headers = self._get_headers()
            headers["x-tossinvest-account"] = self.account_ref

            krw_cash = 0
            usd_cash = 0

            # ✅ KRW 현금 조회
            krw_url = f"{self.base_url}/api/v1/buying-power"
            async with session.get(
                krw_url,
                headers=headers,
                params={"currency": "KRW"},
                timeout=aiohttp.ClientTimeout(total=10)
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    krw_cash = float(data.get("result", {}).get("cashBuyingPower", 0))
                    logger.info(f"💰 KRW 현금: ₩{krw_cash:,.0f}")
                elif resp.status == 401:
                    # 토큰 만료 - 재인증
                    logger.info("🔄 토큰 만료 - 재인증 중...")
                    if await self.authenticate():
                        headers = self._get_headers()
                        headers["x-tossinvest-account"] = self.account_ref
                        async with session.get(
                            krw_url,
                            headers=headers,
                            params={"currency": "KRW"},
                            timeout=aiohttp.ClientTimeout(total=10)
                        ) as resp2:
                            if resp2.status == 200:
                                data = await resp2.json()
                                krw_cash = float(data.get("result", {}).get("cashBuyingPower", 0))
                                logger.info(f"💰 KRW 현금: ₩{krw_cash:,.0f}")
                else:
                    logger.warning(f"⚠️  KRW 현금 조회 실패 ({resp.status})")

            # ✅ USD 현금 조회
            usd_url = f"{self.base_url}/api/v1/buying-power"
            async with session.get(
                usd_url,
                headers=headers,
                params={"currency": "USD"},
                timeout=aiohttp.ClientTimeout(total=10)
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    usd_cash = float(data.get("result", {}).get("cashBuyingPower", 0))
                    logger.info(f"💵 USD 현금: ${usd_cash:.2f}")
                else:
                    logger.warning(f"⚠️  USD 현금 조회 실패 ({resp.status})")

            return {"krw": krw_cash, "usd": usd_cash}

        except Exception as e:
            logger.error(f"❌ 현금 조회 오류: {e}")
            return {"krw": 0, "usd": 0}

    async def get_buying_power(self, currency: str = "KRW") -> Dict[str, Any]:
        """구매력(현금) 조회 (레거시 호환용)"""
        cash_balance = await self.get_cash_balance()
        if currency == "KRW":
            return {"amount": cash_balance["krw"], "currency": currency}
        else:
            return {"amount": cash_balance["usd"], "currency": currency}

    async def get_account_balance(self) -> Dict[str, Any]:
        """계좌 잔고 조회 (보유주식 + 현금 기반)

        🆕 get_cash_balance()를 사용하여 직접 현금 조회
        """
        if not await self._check_token():
            return {}

        try:
            session = await self._ensure_session()

            # 1️⃣ /api/v1/holdings에서 보유 주식 정보 조회
            url = f"{self.base_url}/api/v1/holdings"
            headers = self._get_headers()
            headers["x-tossinvest-account"] = self.account_ref

            async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status == 401:
                    # 토큰 만료 - 재인증
                    logger.info("🔄 토큰 만료 - 재인증 중...")
                    if await self.authenticate():
                        # 재인증 후 다시 시도
                        headers = self._get_headers()
                        headers["x-tossinvest-account"] = self.account_ref
                        async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as resp2:
                            if resp2.status == 200:
                                data = await resp2.json()
                                holdings_result = data.get("result", {})

                                # 2️⃣ 현금 직접 조회
                                cash_balance = await self.get_cash_balance()

                                return self._parse_holdings_response(
                                    holdings_result,
                                    cash_balance.get("krw", 0),
                                    cash_balance.get("usd", 0)
                                )
                    return {}

                elif resp.status == 200:
                    data = await resp.json()
                    holdings_result = data.get("result", {})

                    # 2️⃣ 현금 직접 조회
                    cash_balance = await self.get_cash_balance()

                    return self._parse_holdings_response(
                        holdings_result,
                        cash_balance.get("krw", 0),
                        cash_balance.get("usd", 0)
                    )
                else:
                    error_data = await resp.text()
                    logger.error(f"❌ 잔고 조회 실패 ({resp.status}): {error_data}")
                    return {}
        except Exception as e:
            logger.error(f"❌ 잔고 조회 오류: {e}")
            return {}

    def _parse_holdings_response(
        self,
        holdings_result: Dict,
        kr_buying_power: float = 0,
        usd_buying_power: float = 0
    ) -> Dict[str, Any]:
        """보유 종목 응답 파싱 (한국주식 + 미국주식 모두 지원)

        🆕 getBuyingPower API에서 직접 조회한 현금값을 매개변수로 받음
        """
        # 🔍 디버그: 전체 응답 구조 로깅
        logger.debug(f"📋 Toss API 응답 구조: {holdings_result.keys()}")

        # 보유 주식의 시장가치 (KRW 기준)
        market_value = holdings_result.get("marketValue", {})
        market_value_krw_str = market_value.get("amount", {}).get("krw", "0")
        market_value_krw = float(market_value_krw_str) if market_value_krw_str else 0

        # USD 잔고 환산 (1 USD = 약 1300 KRW)
        market_value_usd_str = market_value.get("amount", {}).get("usd")
        market_value_usd = float(market_value_usd_str) if market_value_usd_str else 0
        usd_to_krw_rate = 1300  # 환율
        market_value_usd_krw = market_value_usd * usd_to_krw_rate

        # 한국주식과 미국주식 보유가치 분리 계산
        kr_items_value = 0
        us_items_value = 0
        kr_cash_explicit = None
        us_cash_explicit = None

        for item in holdings_result.get("items", []):
            market = item.get("market", "KRW")  # 기본값: KRW (한국주식)
            item_amount_str = item.get("marketValue", {}).get("amount")
            if item_amount_str:
                item_value = float(item_amount_str)
                if market == "USD" or item.get("currency") == "USD":
                    us_items_value += item_value
                else:
                    kr_items_value += item_value

            # 🆕 현금 항목 직접 확인
            if item.get("symbol") == "CASH_KRW" or item.get("type") == "CASH":
                kr_cash_explicit = float(item.get("marketValue", {}).get("amount", 0))
            if item.get("symbol") == "CASH_USD":
                us_cash_explicit = float(item.get("marketValue", {}).get("amount", 0))

        # 🆕 현금 결정 로직: getBuyingPower > 명시적 현금 항목 > borrowingLimit > 계산된 현금
        if kr_buying_power > 0:
            # getBuyingPower API에서 조회한 값이 있으면 이것을 사용 (가장 정확함)
            kr_cash = kr_buying_power
        elif kr_cash_explicit is not None:
            kr_cash = kr_cash_explicit
        else:
            borrowing_limit_str = holdings_result.get("borrowingLimit", {}).get("amount", {}).get("krw")
            if borrowing_limit_str and borrowing_limit_str != "0":
                kr_cash = float(borrowing_limit_str)
            else:
                kr_cash = max(0, market_value_krw - kr_items_value)

        # 미국주식 현금
        if usd_buying_power > 0:
            usd_cash = usd_buying_power
        elif us_cash_explicit is not None:
            usd_cash = us_cash_explicit
        else:
            usd_cash = market_value_usd

        # 총 자산 = KRW 보유 + USD 보유 환산
        total_market_value = (kr_items_value + kr_cash) + (us_items_value + usd_cash * usd_to_krw_rate)

        result = {
            "cash": kr_cash,  # KRW 현금 (한국주식 거래용)
            "cash_usd": usd_cash,  # USD 현금 (미국주식 거래용)
            "total_value": total_market_value,
            "buying_power": kr_cash,
            "d2_cash": kr_cash,
            "holdings": holdings_result.get("items", []),  # 보유종목 상세정보
            "kr_holdings": [h for h in holdings_result.get("items", []) if h.get("marketCountry") != "US" and h.get("symbol") != "CASH_USD"],
            "us_holdings": [h for h in holdings_result.get("items", []) if h.get("marketCountry") == "US" and h.get("symbol") != "CASH_KRW"],
        }
        logger.info(
            f"💰 계좌 잔고: KRW {kr_items_value:,.0f}원 (현금: {kr_cash:,.0f}) "
            f"+ USD ${usd_cash:.2f} (현금, ${market_value_usd:.2f} 보유) "
            f"= 총자산 {result['total_value']:,.0f}원"
        )
        logger.info(f"   🇰🇷 한국주식 보유: {len(result['kr_holdings'])}개 (가치: {kr_items_value:,.0f}원)")
        logger.info(f"   🇺🇸 미국주식 보유: {len(result['us_holdings'])}개 (가치: {us_items_value:,.0f}원)")
        logger.info(f"   💵 API 조회 현금: KRW {kr_buying_power:,.0f} / USD ${usd_buying_power:.2f}")
        return result

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
        quantity,
        side: str = "BUY",
        price: float = 0.0
    ) -> Optional[str]:
        """주문 생성 (BUY/SELL)"""
        if not await self._check_token():
            return None

        try:
            session = await self._ensure_session()
            url = f"{self.base_url}/api/v1/orders"
            headers = self._get_headers()
            headers["x-tossinvest-account"] = self.account_ref

            # 소수점 매수는 반드시 시장가(MARKET) + orderAmount 사용
            is_fractional_buy = isinstance(quantity, float) and quantity != int(quantity) and side.upper() == "BUY"
            order_type = "MARKET" if is_fractional_buy else ("MARKET" if price <= 0 else "LIMIT")

            payload = {
                "symbol": symbol,
                "side": side.upper(),  # BUY or SELL
                "orderType": order_type
            }

            # qty 변수 초기화 (로깅용)
            qty = quantity

            # 소수점 매수는 orderAmount(금액)으로 처리 (반드시 MARKET 주문)
            if is_fractional_buy:
                # 소수점 수량 → 금액 기반 주문 (시장가만)
                order_amount = quantity * price
                payload["orderAmount"] = round(order_amount, 2)
                logger.info(f"💰 소수점 매수: {quantity}주 → ${order_amount:,.2f} (금액 기반, 시장가)")
            else:
                # 정수 수량 또는 매도 또는 시장가 → 수량 기반 주문
                qty = int(quantity) if isinstance(quantity, float) else quantity
                payload["quantity"] = qty

            # 가격은 지정가(LIMIT) 주문에만 포함
            if order_type == "LIMIT" and price > 0:
                payload["price"] = float(price)

            # 🔧 주문 로깅
            logger.info(f"📤 주문 전송: symbol={symbol}, qty={qty}, price={price}, payload={payload}")

            async with session.post(
                url,
                json=payload,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=10)
            ) as resp:
                data = await resp.json()

                # Toss API는 201 또는 200으로 응답하며, orderId가 있으면 성공
                order_id = data.get("result", {}).get("orderId") or data.get("orderId")

                if order_id:
                    logger.info(
                        f"✅ 주문 생성: {side} {qty}주 @ {price:,.0f}원 "
                        f"(Order ID: {order_id})"
                    )
                    return {
                        "success": True,
                        "order_id": order_id,
                        "message": "주문 생성"
                    }
                else:
                    error_data = await resp.text() if resp.status >= 400 else str(data)
                    logger.error(f"❌ 주문 실패 ({resp.status}): {error_data}")
                    return {
                        "success": False,
                        "error": error_data
                    }
        except Exception as e:
            logger.error(f"❌ 주문 오류: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    async def cancel_order(self, order_id: str) -> bool:
        """주문 취소"""
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
