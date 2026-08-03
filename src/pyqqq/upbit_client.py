import logging
import requests
import websockets
import json
import asyncio
import uuid
import hashlib
import hmac
import jwt
import aiohttp
from datetime import datetime
from typing import Dict, List, Optional, Any, Callable
from pyupbit import Upbit
from urllib.parse import urlencode
from .config import settings


logger = logging.getLogger(__name__)


class UpbitClient:
    """Upbit API 클라이언트 (pyupbit 기반 - 실거래용)"""

    def __init__(self):
        self.access_key = settings.upbit_access_key
        self.secret_key = settings.upbit_secret_key
        self.upbit = Upbit(self.access_key, self.secret_key)
        self.base_url = "https://api.upbit.com"
        self.ws_url = "wss://api.upbit.com/websocket/v1"
        self.ws_connection = None
        self.asset_listeners: List[Callable] = []

    async def test_auth(self) -> bool:
        """인증 테스트"""
        try:
            logger.info("📡 Upbit API 인증 테스트 중...")
            balance = self.upbit.get_balances()
            logger.info(f"✅ Upbit API 인증 성공 (자산 수: {len(balance)}개)")
            return True
        except Exception as e:
            logger.error(f"❌ Upbit API 인증 실패: {e}")
            return False

    async def get_account_balance(self) -> Optional[Dict[str, Any]]:
        """계좌 잔고 조회 (KRW 기준) - pyupbit 사용"""
        try:
            # pyupbit을 사용하여 모든 자산 조회
            balances = self.upbit.get_balances()

            if not balances:
                logger.warning(f"⚠️  계좌 조회 실패: 빈 응답")
                return None

            logger.debug(f"📡 계좌 조회 형식: {type(balances)}")

            # pyupbit.get_balances()는 dict 또는 list를 반환할 수 있음
            if isinstance(balances, dict):
                logger.debug(f"📡 dict 형식 - KRW 항목 조회")

                # 에러 응답 확인
                if 'error' in balances:
                    logger.error(f"❌ Upbit API 에러: {balances.get('error')}")
                    return None

                items = balances.values()
            elif isinstance(balances, list):
                logger.debug(f"📡 list 형식 - KRW 항목 조회")
                items = balances
            else:
                logger.warning(f"⚠️  예상치 못한 형식: {type(balances)}")
                return None

            # KRW 잔액 찾기
            for b in items:
                try:
                    # b가 dict인지 확인
                    if isinstance(b, dict):
                        currency = b.get('currency', '')
                    else:
                        # 특수 객체인 경우 속성 접근
                        currency = getattr(b, 'currency', '')

                    if currency == 'KRW':
                        # balance 추출 (dict 또는 속성)
                        balance_val = b.get('balance', 0) if isinstance(b, dict) else getattr(b, 'balance', 0)
                        locked_val = b.get('locked', 0) if isinstance(b, dict) else getattr(b, 'locked', 0)

                        krw_balance = float(balance_val) if balance_val else 0.0
                        locked_balance = float(locked_val) if locked_val else 0.0

                        result = {
                            "currency": "KRW",
                            "balance": krw_balance,
                            "locked": locked_balance
                        }
                        logger.info(f"✅ KRW 잔액: ₩{krw_balance:,.0f}")
                        return result
                except Exception as item_error:
                    logger.debug(f"⚠️  항목 처리 오류: {item_error}")
                    continue

            logger.warning(f"⚠️  KRW 잔액을 찾을 수 없음")
            return None

        except Exception as e:
            logger.error(f"❌ 계좌 조회 오류: {e}")
            return None

    async def get_all_balances(self) -> Optional[List[Dict[str, Any]]]:
        """모든 자산 잔고 조회 (실시간 - KRW, BTC, ETH 등)"""
        try:
            balances = self.upbit.get_balances()
            logger.info(f"📡 Upbit 조회 결과: {type(balances)}")

            result = []

            # pyupbit.get_balances()는 dict 또는 list를 반환할 수 있음
            if isinstance(balances, dict):
                # dict 형식: {'currency': {...}, ...} 또는 {'error': '...'}
                logger.info(f"📡 dict 형식: {len(balances)}개 항목")
                logger.info(f"📡 dict keys: {list(balances.keys())}")

                # 에러 응답 확인
                if 'error' in balances:
                    logger.error(f"❌ Upbit API 에러: {balances.get('error')}")
                    logger.error(f"❌ 전체 응답: {balances}")
                    return None

                items = balances.values()
            elif isinstance(balances, list):
                # list 형식: [{...}, ...]
                logger.info(f"📡 list 형식: {len(balances)}개 항목")
                items = balances
            else:
                logger.warning(f"⚠️  예상치 못한 형식: {type(balances)}")
                return None

            for b in items:
                try:
                    # b가 dict 또는 객체인지 판단
                    if isinstance(b, dict):
                        currency = b.get('currency', '')
                        balance = float(b.get("balance", 0))
                        locked = float(b.get("locked", 0))
                        avg_buy_price = float(b.get("avg_buy_price", 0))
                    else:
                        # 객체인 경우
                        currency = getattr(b, 'currency', '')
                        balance = float(getattr(b, "balance", 0))
                        locked = float(getattr(b, "locked", 0))
                        avg_buy_price = float(getattr(b, "avg_buy_price", 0))

                    logger.debug(f"📊 {currency}: balance={balance}, locked={locked}")

                    # balance > 0이거나 KRW인 경우만 포함
                    if not currency:
                        logger.debug(f"⏭️  currency 없음, skip")
                        continue

                    if balance <= 0:
                        logger.debug(f"⏭️  {currency}: balance <= 0, skip")
                        continue

                    result.append({
                        "market": f"KRW-{currency}" if currency != 'KRW' else 'KRW',
                        "currency": currency,
                        "balance": balance,
                        "locked": locked,
                        "avg_buy_price": avg_buy_price
                    })
                    logger.info(f"✅ {currency}: {balance} (실시간 조회)")

                except Exception as item_error:
                    logger.warning(f"⚠️  항목 처리 오류: {item_error}")
                    continue

            logger.info(f"✅ 전체 자산 조회 완료: {len(result)}개")
            return result if result else None
        except Exception as e:
            logger.error(f"❌ 전체 자산 조회 오류: {e}", exc_info=True)
            return None

    async def get_ticker(self, market: str) -> Optional[Dict[str, Any]]:
        """실시간 시세 조회 (공개 API)"""
        try:
            response = requests.get(
                f"{self.base_url}/v1/ticker",
                params={"markets": market},
                timeout=10
            )

            if response.status_code == 200:
                tickers = response.json()
                if tickers:
                    ticker = tickers[0]
                    result = {
                        "market": ticker['market'],
                        "trade_price": float(ticker['trade_price']),
                        "high_price": float(ticker.get('high_price', 0)),
                        "low_price": float(ticker.get('low_price', 0)),
                        "opening_price": float(ticker.get('opening_price', 0)),
                        "prev_closing_price": float(ticker.get('prev_closing_price', 0)),
                        "trade_volume": float(ticker.get('trade_volume', 0)),
                        "trade_date": ticker.get('trade_date', '')
                    }
                    logger.debug(f"📊 {market}: ₩{result['trade_price']:,.0f}")
                    return result
            return None
        except Exception as e:
            logger.error(f"❌ 시세 조회 오류 ({market}): {e}")
            return None

    async def get_ohlc(
        self,
        market: str,
        interval: str = "minutes/1",
        count: int = 60
    ) -> Optional[List[Dict[str, Any]]]:
        """캔들 데이터 조회 (OHLCV)"""
        try:
            response = requests.get(
                f"{self.base_url}/v1/candles/{interval}",
                params={
                    "market": market,
                    "count": min(count, 200)  # Upbit API 최대 200개
                },
                timeout=10
            )

            if response.status_code == 200:
                candles = response.json()
                if candles:
                    result = []
                    for candle in reversed(candles):  # 오래된 순서부터
                        result.append({
                            "opening_price": float(candle.get('opening_price', 0)),
                            "high_price": float(candle.get('high_price', 0)),
                            "low_price": float(candle.get('low_price', 0)),
                            "closing_price": float(candle.get('trade_price', 0)),
                            "candle_acc_trade_volume": float(candle.get('candle_acc_trade_volume', 0)),
                            "timestamp": candle.get('candle_date_time_kst', '')
                        })
                    logger.debug(f"📊 {market} 캔들: {len(result)}개 조회")
                    return result
            return None
        except Exception as e:
            logger.error(f"❌ 캔들 조회 오류 ({market}): {e}")
            return None

    async def get_candles_hourly(
        self,
        market: str,
        count: int = 24
    ) -> Optional[List[Dict[str, Any]]]:
        """시간봉 캔들 조회"""
        return await self.get_ohlc(market, interval="minutes/60", count=count)

    async def get_candles_daily(
        self,
        market: str,
        count: int = 30
    ) -> Optional[List[Dict[str, Any]]]:
        """일봉 캔들 조회"""
        return await self.get_ohlc(market, interval="days", count=count)

    async def get_all_markets(self) -> Optional[List[str]]:
        """모든 KRW 마켓 조회"""
        try:
            response = requests.get(
                f"{self.base_url}/v1/market/all",
                params={"isDetails": "false"},
                timeout=10
            )
            if response.status_code == 200:
                markets = response.json()
                krw_markets = [m['market'] for m in markets if m['market'].startswith('KRW-')]
                logger.info(f"✅ KRW 마켓: {len(krw_markets)}개 조회")
                return krw_markets
            return None
        except Exception as e:
            logger.error(f"❌ 마켓 목록 조회 오류: {e}")
            return None

    async def get_today_top_gainers(self, limit: int = 5) -> Optional[List[str]]:
        """당일 급등주 선정 (변동률 기준 상위 N개)"""
        try:
            all_markets = await self.get_all_markets()
            if not all_markets:
                logger.error("❌ 마켓 목록 조회 실패")
                return None

            # 시세 정보 일괄 조회
            markets_str = ','.join(all_markets)
            response = requests.get(
                f"{self.base_url}/v1/ticker",
                params={"markets": markets_str},
                timeout=15
            )

            if response.status_code == 200:
                tickers = response.json()

                # 당일 변동률 기준으로 정렬
                gainers = []
                for ticker in tickers:
                    market = ticker.get('market', '')
                    trade_price = float(ticker.get('trade_price', 0))
                    prev_closing = float(ticker.get('prev_closing_price', 0))

                    if prev_closing > 0:
                        change_rate = ((trade_price - prev_closing) / prev_closing) * 100
                        gainers.append({
                            'market': market,
                            'change_rate': change_rate,
                            'trade_price': trade_price,
                            'prev_closing': prev_closing
                        })

                # 변동률 기준 내림차순 정렬 (상승률 높은 순)
                gainers.sort(key=lambda x: x['change_rate'], reverse=True)

                # 상위 limit개 선택
                top_gainers = [g['market'] for g in gainers[:limit]]

                logger.info(f"📈 당일 급등주 상위 {limit}개:")
                for i, g in enumerate(gainers[:limit], 1):
                    logger.info(f"  {i}. {g['market']}: {g['change_rate']:+.2f}% (₩{g['trade_price']:,.0f})")

                return top_gainers

            logger.error(f"❌ 시세 조회 실패: {response.status_code}")
            return None
        except Exception as e:
            logger.error(f"❌ 급등주 선정 오류: {e}")
            return None

    def _generate_jwt_token(self, query_string: str = "") -> str:
        """Upbit API용 JWT 토큰 생성"""
        try:
            payload = {
                "access_key": self.access_key,
                "nonce": str(uuid.uuid4()),
                "timestamp": int(datetime.now().timestamp() * 1000)
            }

            if query_string:
                m = hashlib.sha512()
                m.update(query_string.encode())
                payload["query_hash"] = m.hexdigest()
                payload["query_hash_alg"] = "SHA512"

            token = jwt.encode(payload, self.secret_key, algorithm="HS256")
            logger.debug(f"✅ JWT 토큰 생성: {token[:20]}...")
            return token
        except Exception as e:
            logger.error(f"❌ JWT 토큰 생성 실패: {e}")
            return ""

    def _get_auth_headers(self, query_string: str = "") -> dict:
        """인증 헤더 생성"""
        try:
            token = self._generate_jwt_token(query_string)
            if not token:
                return {}

            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
            logger.debug(f"✅ 인증 헤더 생성: {list(headers.keys())}")
            return headers
        except Exception as e:
            logger.error(f"❌ 인증 헤더 생성 실패: {e}")
            return {}

    def _generate_upbit_auth_header(self) -> Dict[str, str]:
        """Upbit REST API 인증 헤더 생성 (JWT 버전)"""
        return self._get_auth_headers()

    async def _rest_api_order(
        self,
        market: str,
        side: str,
        ord_type: str,
        volume: float = 0
    ) -> Optional[Dict[str, Any]]:
        """
        Upbit REST API v1/orders로 직접 주문 실행 (비동기)

        Args:
            market: "KRW-BTC" 등
            side: "bid" (매수) 또는 "ask" (매도)
            ord_type: "market" (시장가) 또는 "limit" (지정가)
            price: 주문 가격 또는 매수 금액 (bid일 때는 KRW 금액)
            volume: 주문 수량 (ask일 때는 필수)

        Returns:
            {"uuid": "...", "state": "wait", ...} 또는 None
        """
        try:
            url = f"{self.base_url}/v1/orders"

            payload = {
                "market": market,
                "side": side,
            }

            # 시장가 주문: ord_type 제외 (Upbit API)
            # 지정가 주문: ord_type="limit" 추가
            if ord_type and ord_type.lower() == "limit":
                payload["ord_type"] = "limit"

            # bid/ask: 모두 volume (코인 수량) 사용
            if volume > 0:
                # volume을 문자열로 변환 (8자리 이상 소수점 지원)
                if volume < 0.00000001:
                    logger.error(f"❌ 주문 수량이 너무 작습니다: {volume}")
                    return None
                payload["volume"] = str(volume)
            else:
                logger.error(f"❌ 주문은 volume(수량)이 필수입니다")
                return None

            # 쿼리 스트링 생성
            query_string = urlencode(payload)

            headers = self._get_auth_headers(query_string)
            if not headers:
                logger.error("❌ 인증 헤더 생성 실패")
                return None

            logger.debug(f"📡 REST API 주문 시도: {market} {side} {ord_type}")
            logger.debug(f"   Payload: {payload}")

            # 비동기 HTTP 요청
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    url,
                    params=payload,
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    response_text = await response.text()

                    logger.debug(f"📊 응답 상태: {response.status}")
                    logger.debug(f"   응답 본문: {response_text[:200]}")

                    if response.status == 201:
                        try:
                            result = json.loads(response_text)
                            uuid_val = result.get("uuid", "")

                            if uuid_val:
                                logger.warning(f"✅ 주문 성공!")
                                logger.warning(f"   UUID: {uuid_val}")
                                logger.warning(f"   상태: {result.get('state', 'unknown')}")
                                return result
                            else:
                                logger.error(f"❌ UUID 없음: {result}")
                                return None
                        except json.JSONDecodeError:
                            logger.error(f"❌ JSON 파싱 실패: {response_text[:200]}")
                            return None
                    else:
                        error_msg = response_text if response.status >= 400 else ""
                        logger.error(f"❌ 주문 실패 ({response.status}): {error_msg[:200]}")
                        return None

        except asyncio.TimeoutError:
            logger.error(f"❌ 주문 타임아웃")
            return None
        except Exception as e:
            logger.error(f"❌ 주문 오류: {e}", exc_info=True)
            return None

    def _direct_api_order(self, market: str, side: str, volume: float, price: float) -> Optional[Dict[str, Any]]:
        """Upbit REST API 직접 호출로 주문 (pyupbit 버그 우회)"""
        try:
            url = f"{self.base_url}/v1/orders"

            # 주문 파라미터
            if side.lower() == "buy":
                # 매수: price 파라미터로 구매할 금액 지정
                params = {
                    "market": market,
                    "side": "bid",
                    "ord_type": "price",
                    "price": str(int(price))
                }
            else:
                # 매도: volume 파라미터로 판매할 수량 지정
                params = {
                    "market": market,
                    "side": "ask",
                    "ord_type": "market",
                    "volume": str(volume)
                }

            # 요청
            headers = self._generate_upbit_auth_header()
            response = requests.post(url, params=params, headers=headers, timeout=10)

            logger.debug(f"📊 REST API 응답 상태: {response.status_code}")
            logger.debug(f"📊 REST API 응답 전체: {response.text}")

            if response.status_code == 201:
                try:
                    data = response.json()

                    # UUID 검증 (필수)
                    order_uuid = data.get('uuid')
                    if not order_uuid:
                        logger.error(f"❌ REST API 응답에 uuid 없음: {data}")
                        logger.error(f"   응답 전체: {response.text}")
                        return None

                    logger.info(f"✅ REST API 직접 주문 성공: UUID={order_uuid}, 상태={data.get('state', 'unknown')}")
                    logger.debug(f"   응답 전체: {data}")
                    return data
                except Exception as json_error:
                    logger.error(f"❌ REST API 응답 파싱 오류: {json_error}")
                    logger.error(f"   응답 텍스트: {response.text}")
                    return None
            else:
                logger.error(f"❌ REST API 주문 실패 (상태: {response.status_code})")
                logger.error(f"   응답: {response.text}")
                return None

        except Exception as e:
            logger.error(f"❌ REST API 직접 호출 오류: {e}", exc_info=True)
            return None

    async def place_order(
        self,
        market: str,
        side: str,
        volume: float = 0,
        price: float = 0,
        ord_type: str = "market"
    ) -> Optional[Dict[str, Any]]:
        """
        주문 실행 (업비트 실계좌에 실제 주문) - REST API 비동기 버전

        Args:
            market: "KRW-BTC" 등
            side: "bid" (매수), "ask" (매도) 또는 "buy", "sell"
            volume: 주문 수량 (ask) 또는 매수 금액 (bid)
            price: 매수 금액 (bid) 또는 판매량 (ask)
            ord_type: "market" (시장가) 또는 "limit" (지정가)
        """
        try:
            # side 정규화 ("bid"/"ask"로 변환)
            if side.lower() in ["buy", "bid"]:
                normalized_side = "bid"
            elif side.lower() in ["sell", "ask"]:
                normalized_side = "ask"
            else:
                logger.error(f"❌ 잘못된 side: {side}")
                return None

            # bid/ask: 모두 volume (코인 수량) 사용
            actual_price = 0  # Upbit API는 volume만 사용 (ord_type없이)

            if normalized_side == "bid":
                # 매수: price (KRW 금액) → volume (코인 수량) 변환
                if price > 0:
                    # 현재가 조회
                    ticker = await self.get_ticker(market)
                    if not ticker:
                        logger.error(f"❌ 현재가 조회 실패: {market}")
                        return None

                    current_price = ticker['trade_price']
                    actual_volume = price / current_price  # KRW ÷ 현재가 = 코인 수량

                    if actual_volume < 0.00000001:
                        logger.error(f"❌ 계산된 수량이 너무 작습니다: {actual_volume}")
                        return None

                    logger.warning(f"🔴 실거래 요청: 매수 {market} x {actual_volume:.8f} @ ₩{current_price:,.0f}")
                else:
                    actual_volume = volume
                    logger.warning(f"🔴 실거래 요청: 매수 {market} x {actual_volume:.8f}")
            else:
                # 매도: volume은 그대로 사용
                actual_volume = volume if volume > 0 else price
                logger.warning(f"🔴 실거래 요청: 매도 {market} x {actual_volume:.8f}")

            # Step 1: REST API 직접 호출 (JWT 인증)
            # Upbit API: volume만 필수
            result = await self._rest_api_order(
                market=market,
                side=normalized_side,
                ord_type=ord_type.lower() if isinstance(ord_type, str) else "market",
                volume=actual_volume
            )

            # Step 2: 응답 처리
            if result and result.get("uuid"):
                response = {
                    "uuid": result.get("uuid", ""),
                    "market": market,
                    "side": normalized_side,
                    "ord_type": ord_type,
                    "price": price,
                    "volume": volume,
                    "state": result.get("state", "unknown"),
                    "created_at": result.get("created_at", "")
                }

                logger.warning("=" * 60)
                logger.warning(f"✅ 실거래 주문 성공!")
                logger.warning(f"   주문 UUID: {response['uuid']}")
                logger.warning(f"   상태: {response['state']}")
                logger.warning(f"   업비트 계좌에 반영됨")
                logger.warning("=" * 60)
                return response
            else:
                logger.error(f"❌ {market} {normalized_side} 주문 실패")
                return None

        except Exception as e:
            logger.error(f"❌ 주문 실행 오류: {e}", exc_info=True)
            return None

    async def cancel_order(self, order_uuid: str) -> bool:
        """주문 취소"""
        try:
            result = self.upbit.cancel_order(order_uuid)
            logger.info(f"✅ 주문 취소 완료: {order_uuid}")
            return True
        except Exception as e:
            logger.error(f"❌ 주문 취소 오류: {e}")
            return False

    async def get_order(self, order_uuid: str) -> Optional[Dict[str, Any]]:
        """주문 조회 (REST API 버전)"""
        try:
            # Step 1: pyupbit 시도
            try:
                order = self.upbit.get_order(order_uuid)
                if order and isinstance(order, dict) and order.get("uuid"):
                    result = {
                        "uuid": order.get("uuid", ""),
                        "state": order.get("state", ""),
                        "side": order.get("side", ""),
                        "ord_type": order.get("ord_type", ""),
                        "price": float(order.get("price", 0)),
                        "volume": float(order.get("volume", 0)),
                        "executed_volume": float(order.get("executed_volume", 0)),
                        "executed_price": float(order.get("executed_price", 0) or order.get("avg_price", 0)),
                        "created_at": order.get("created_at", "")
                    }
                    logger.debug(f"✅ pyupbit get_order 성공: {order_uuid}")
                    return result
            except Exception as pyupbit_error:
                logger.debug(f"⚠️  pyupbit get_order 실패 (REST API 직접 호출 시도): {pyupbit_error}")

            # Step 2: REST API 직접 호출
            url = f"{self.base_url}/v1/orders/{order_uuid}"
            headers = self._generate_upbit_auth_header()

            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers, timeout=10) as response:
                    if response.status == 200:
                        order = await response.json()
                        result = {
                            "uuid": order.get("uuid", ""),
                            "state": order.get("state", ""),
                            "side": order.get("side", ""),
                            "ord_type": order.get("ord_type", ""),
                            "price": float(order.get("price", 0)),
                            "volume": float(order.get("volume", 0)),
                            "executed_volume": float(order.get("executed_volume", 0)),
                            "executed_price": float(order.get("executed_price", 0) or order.get("avg_price", 0)),
                            "created_at": order.get("created_at", "")
                        }
                        logger.debug(f"✅ REST API get_order 성공: {order_uuid}")
                        return result
                    else:
                        logger.error(f"❌ REST API 주문 조회 실패 (상태: {response.status})")
                        return None
        except Exception as e:
            logger.error(f"❌ 주문 조회 오류: {e}")
            return None

    async def get_orders(
        self,
        state: str = "wait",
        limit: int = 100
    ) -> Optional[List[Dict[str, Any]]]:
        """주문 목록 조회"""
        try:
            orders = self.upbit.get_orders(state=state, limit=limit)
            result = []
            if orders:
                for order in orders[:limit]:
                    result.append({
                        "uuid": order.get("uuid", ""),
                        "state": order.get("state", ""),
                        "side": order.get("side", ""),
                        "ord_type": order.get("ord_type", ""),
                        "price": float(order.get("price", 0)),
                        "volume": float(order.get("volume", 0)),
                        "created_at": order.get("created_at", "")
                    })
            logger.info(f"✅ 주문 목록 조회: {len(result)}개")
            return result
        except Exception as e:
            logger.error(f"❌ 주문 목록 조회 오류: {e}")
            return None

    async def close(self):
        """세션 종료"""
        if self.ws_connection:
            await self.ws_connection.close()

    async def subscribe_my_assets(self, callback: Callable[[Dict], None]) -> None:
        """내 자산 WebSocket 구독 (실시간 자산 변동) - 재연결 로직 포함"""
        if callback not in self.asset_listeners:
            self.asset_listeners.append(callback)

        reconnect_delay = 1  # 초기 재연결 대기 시간 (1초)
        max_reconnect_delay = 60  # 최대 재연결 대기 시간 (60초)
        reconnect_count = 0
        max_reconnect_attempts = 10  # 최대 재연결 시도 횟수

        while True:
            try:
                logger.info(f"📡 Upbit 내 자산 WebSocket 연결 시도... (시도 {reconnect_count + 1})")

                async with websockets.connect(self.ws_url, ping_interval=30, ping_timeout=10) as websocket:
                    self.ws_connection = websocket
                    reconnect_count = 0  # 연결 성공 시 카운터 리셋
                    reconnect_delay = 1  # 대기 시간 리셋

                    # 내 자산 구독 요청
                    subscribe_msg = [
                        {"ticket": "my_asset_stream"},
                        {"type": "myAsset"}
                    ]

                    await websocket.send(json.dumps(subscribe_msg))
                    logger.info("✅ 내 자산 WebSocket 구독 완료")

                    # 메시지 수신 루프
                    while True:
                        try:
                            message = await websocket.recv()
                            data = json.loads(message)

                            # 자산 데이터 파싱
                            if data.get('type') == 'myAsset' and 'assets' in data:
                                logger.info(f"📊 자산 변동 감지: {len(data['assets'])}개 항목")

                                # 모든 리스너에 콜백
                                for listener in self.asset_listeners:
                                    try:
                                        listener(data)
                                    except Exception as e:
                                        logger.error(f"⚠️  리스너 실행 오류: {e}")

                        except asyncio.TimeoutError:
                            logger.debug("⏳ WebSocket 타임아웃 (정상)")
                            break
                        except asyncio.CancelledError:
                            logger.info("⏹️  WebSocket 구독 취소됨")
                            return
                        except Exception as e:
                            if "1000" in str(e):
                                logger.info(f"ℹ️  WebSocket 정상 종료 (1000 OK): {e}")
                            else:
                                logger.error(f"❌ WebSocket 메시지 처리 오류: {e}")
                            break

            except asyncio.CancelledError:
                logger.info("⏹️  WebSocket 구독 취소됨")
                return
            except Exception as e:
                reconnect_count += 1

                if reconnect_count >= max_reconnect_attempts:
                    logger.error(f"❌ 최대 재연결 시도 횟수 도달 ({max_reconnect_attempts}회). 구독 중단.")
                    return

                logger.warning(f"❌ WebSocket 연결 오류 (시도 {reconnect_count}/{max_reconnect_attempts}): {e}")
                logger.info(f"⏳ {reconnect_delay}초 후 재연결 시도...")

                await asyncio.sleep(reconnect_delay)

                # 지수 백오프 (exponential backoff)
                reconnect_delay = min(reconnect_delay * 2, max_reconnect_delay)

    async def subscribe_ticker(self, markets: List[str], callback: Callable[[Dict], None]) -> None:
        """시세 WebSocket 구독 (실시간 가격 변동) - 재연결 로직 포함"""
        reconnect_delay = 1  # 초기 재연결 대기 시간 (1초)
        max_reconnect_delay = 60  # 최대 재연결 대기 시간 (60초)
        reconnect_count = 0
        max_reconnect_attempts = 10  # 최대 재연결 시도 횟수

        while True:
            try:
                logger.info(f"📡 Upbit 시세 WebSocket 연결 시도... (시도 {reconnect_count + 1}): {', '.join(markets)}")

                async with websockets.connect(self.ws_url, ping_interval=30, ping_timeout=10) as websocket:
                    reconnect_count = 0  # 연결 성공 시 카운터 리셋
                    reconnect_delay = 1  # 대기 시간 리셋

                    # 시세 구독 요청
                    subscribe_msg = [
                        {"ticket": "ticker_stream"},
                        {"type": "ticker", "codes": markets}
                    ]

                    await websocket.send(json.dumps(subscribe_msg))
                    logger.info(f"✅ 시세 WebSocket 구독 완료: {len(markets)}개 마켓")

                    # 메시지 수신 루프
                    while True:
                        try:
                            message = await websocket.recv()
                            data = json.loads(message)

                            if data.get('type') == 'ticker':
                                callback(data)

                        except asyncio.TimeoutError:
                            logger.debug("⏳ WebSocket 타임아웃 (정상)")
                            break
                        except asyncio.CancelledError:
                            logger.info("⏹️  WebSocket 구독 취소됨")
                            return
                        except Exception as e:
                            if "1000" in str(e):
                                logger.info(f"ℹ️  WebSocket 정상 종료 (1000 OK): {e}")
                            else:
                                logger.error(f"❌ WebSocket 메시지 처리 오류: {e}")
                            break

            except asyncio.CancelledError:
                logger.info("⏹️  WebSocket 구독 취소됨")
                return
            except Exception as e:
                reconnect_count += 1

                if reconnect_count >= max_reconnect_attempts:
                    logger.error(f"❌ 최대 재연결 시도 횟수 도달 ({max_reconnect_attempts}회). 구독 중단.")
                    return

                logger.warning(f"❌ WebSocket 연결 오류 (시도 {reconnect_count}/{max_reconnect_attempts}): {e}")
                logger.info(f"⏳ {reconnect_delay}초 후 재연결 시도...")

                await asyncio.sleep(reconnect_delay)

                # 지수 백오프 (exponential backoff)
                reconnect_delay = min(reconnect_delay * 2, max_reconnect_delay)
