"""
실계좌 조회 모듈 - API만 사용, 메모리/테스트 데이터 절대 금지
"""

import asyncio
import logging
import os
from datetime import datetime
from typing import Dict, Any, Optional
from .toss_client import TossSecuritiesClient

# 🔴 KIS_TRADING_ENABLED=false: KIS는 사용하지 않음
# from .kis_client import KISClient  # REMOVED - KIS is disabled

logger = logging.getLogger(__name__)


class RealAccountInquiry:
    """실계좌만 조회 (메모리 금지)"""

    def __init__(self):
        # KIS_TRADING_ENABLED 체크
        kis_trading_enabled = os.environ.get("KIS_TRADING_ENABLED", "false").lower() == "true"

        # 🔴 KIS는 절대 초기화하지 않음 (KIS_TRADING_ENABLED=false 강제)
        self.kis = None  # ✅ KISClient import 제거됨 - 절대 사용하지 않음
        self.toss = TossSecuritiesClient()

        logger.warning("⚠️ KIS API is completely disabled (KIS import removed)")

    async def get_real_account_status(self) -> Dict[str, Any]:
        """
        실계좌 현황을 조회합니다 (API만 사용)
        🔴 KIS는 완전히 비활성화됨 - Toss만 조회
        """

        # 🔴 KIS는 절대 호출하지 않음
        kis_result = {
            "status": "DISABLED",
            "error": "KIS is completely disabled",
            "cash": 0,
            "total_value": 0,
            "holdings": []
        }

        result = {
            "status": "SUCCESS",
            "timestamp": datetime.now().isoformat(),
            "kis": kis_result,  # ← 절대 _get_kis_status() 호출 안 함!
            "toss": await self._get_toss_status(),
            "summary": {}
        }

        # 요약 계산
        kis_total = result["kis"].get("total_value", 0) if result["kis"]["status"] == "SUCCESS" else 0
        toss_krw = result["toss"].get("total_value", 0) if result["toss"]["status"] == "SUCCESS" else 0
        toss_usd = result["toss"].get("cash_usd", 0) if result["toss"]["status"] == "SUCCESS" else 0

        result["summary"] = {
            "kis_total_krw": kis_total,
            "toss_total_krw": toss_krw,
            "toss_usd": toss_usd,
            "total_krw_value": kis_total + toss_krw + (toss_usd * 1300),  # 환율 1300
            "kis_holdings": result["kis"].get("holdings", []) if result["kis"]["status"] == "SUCCESS" else [],
            "toss_holdings": result["toss"].get("holdings", []) if result["toss"]["status"] == "SUCCESS" else []
        }

        # 하나라도 실패하면 전체 실패
        if result["kis"]["status"] == "FAILED" or result["toss"]["status"] == "FAILED":
            result["status"] = "PARTIAL_FAILED"

        return result

    async def _get_kis_status(self) -> Dict[str, Any]:
        """KIS 실계좌 조회"""
        # KIS가 None이면 조회하지 않음 (KIS_TRADING_ENABLED=false 상태)
        if self.kis is None:
            return {
                "status": "DISABLED",
                "error": "KIS is disabled (KIS_TRADING_ENABLED=false)",
                "cash": 0,
                "total_value": 0,
                "holdings": []
            }

        try:
            # 1. 인증
            if not await self.kis.authenticate():
                return {
                    "status": "FAILED",
                    "error": "KIS 인증 실패",
                    "cash": 0,
                    "total_value": 0,
                    "holdings": []
                }

            # 2. 잔고 조회
            balance = await self.kis.get_balance()

            if balance is None:
                return {
                    "status": "FAILED",
                    "error": "KIS 잔고 조회 실패 (API 응답 없음)",
                    "cash": 0,
                    "total_value": 0,
                    "holdings": []
                }

            logger.info(f"✅ KIS 실계좌 조회 성공")
            logger.info(f"   💰 현금: ₩{balance.get('cash', 0):,.0f}")
            logger.info(f"   📊 총자산: ₩{balance.get('total_value', 0):,.0f}")
            logger.info(f"   📈 보유종목: {len(balance.get('holdings', []))}개")

            return {
                "status": "SUCCESS",
                "cash": balance.get("cash", 0),
                "total_value": balance.get("total_value", 0),
                "holdings": balance.get("holdings", [])
            }

        except Exception as e:
            error_msg = f"KIS 조회 중 예외: {str(e)}"
            logger.error(f"❌ {error_msg}")
            return {
                "status": "FAILED",
                "error": error_msg,
                "cash": 0,
                "total_value": 0,
                "holdings": []
            }

    async def _get_toss_status(self) -> Dict[str, Any]:
        """Toss 실계좌 조회"""
        try:
            # 1. 인증
            if not await self.toss.authenticate():
                return {
                    "status": "FAILED",
                    "error": "Toss 인증 실패",
                    "cash": 0,
                    "cash_usd": 0,
                    "total_value": 0,
                    "holdings": []
                }

            # 2. 잔고 조회
            balance = await self.toss.get_account_balance()

            if not balance:
                return {
                    "status": "FAILED",
                    "error": "Toss 잔고 조회 실패 (API 응답 없음)",
                    "cash": 0,
                    "cash_usd": 0,
                    "total_value": 0,
                    "holdings": []
                }

            cash = balance.get("cash", 0)
            cash_usd = balance.get("cash_usd", 0)
            total_value = balance.get("total_value", 0)
            holdings = balance.get("holdings", [])

            logger.info(f"✅ Toss 실계좌 조회 성공")
            logger.info(f"   💰 현금(KRW): ₩{cash:,.0f}")
            logger.info(f"   💵 현금(USD): ${cash_usd:,.2f}")
            logger.info(f"   📊 총자산: ₩{total_value:,.0f}")
            logger.info(f"   📈 보유종목: {len(holdings)}개")

            return {
                "status": "SUCCESS",
                "cash": cash,
                "cash_usd": cash_usd,
                "total_value": total_value,
                "holdings": holdings
            }

        except Exception as e:
            error_msg = f"Toss 조회 중 예외: {str(e)}"
            logger.error(f"❌ {error_msg}")
            return {
                "status": "FAILED",
                "error": error_msg,
                "cash": 0,
                "cash_usd": 0,
                "total_value": 0,
                "holdings": []
            }

    def _get_market_status(self) -> Dict[str, Any]:
        """한국/미국 시장 거래 가능 여부"""
        from datetime import datetime, time

        now = datetime.now()
        korea_time = now.time()
        # 미국 시간 = 한국 시간 - 13시간 (일광절약 미적용 기준)
        us_hours = now.hour - 13
        us_time = time(us_hours % 24, now.minute)

        # 한국 시장: 09:00-15:30 (평일만)
        korea_open = time(9, 0)
        korea_close = time(15, 30)
        korea_tradeable = (korea_open <= korea_time <= korea_close) and now.weekday() < 5

        # 미국 시장: 22:30-05:00 (한국시간 기준, 평일만)
        # 22:30-23:59 또는 00:00-05:00
        us_tradeable = (korea_time >= time(22, 30) or korea_time <= time(5, 0)) and now.weekday() < 5

        return {
            "korea_time": korea_time.strftime("%H:%M:%S"),
            "us_time": us_time.strftime("%H:%M:%S"),
            "korea_tradeable": korea_tradeable,
            "us_tradeable": us_tradeable,
            "korea_status": "🟢 거래 가능" if korea_tradeable else "🔴 거래 불가",
            "us_status": "🟢 거래 가능" if us_tradeable else "🔴 거래 불가"
        }

    async def print_account_status(self) -> None:
        """계좌 현황을 보기 좋게 출력 (한국/미국 함께)"""
        status = await self.get_real_account_status()
        market_status = self._get_market_status()

        print("\n" + "="*80)
        print("🏦 실계좌 현황 조회 (실시간 API)")
        print("="*80)

        # 시간 및 시장 상태
        print(f"\n⏰ 조회 시간:")
        print(f"   한국 시간: {market_status['korea_time']} {market_status['korea_status']}")
        print(f"   미국 시간: {market_status['us_time']} {market_status['us_status']}")

        # 한국 계좌 (KIS)
        print("\n" + "-"*80)
        print("📌 한국주식 계좌 (한국투자증권 - KIS)")
        print("-"*80)
        if status["kis"]["status"] == "SUCCESS":
            print(f"   ✅ 접속: 성공")
            print(f"   💰 현금: ₩{status['kis']['cash']:,.0f}")
            print(f"   📊 총자산: ₩{status['kis']['total_value']:,.0f}")
            print(f"   📈 보유종목: {len(status['kis']['holdings'])}개")
            if status['kis']['holdings']:
                print(f"      ")
                for h in status['kis']['holdings'][:5]:
                    symbol = h.get('PDNO', 'N/A')
                    qty = h.get('HLDG_QTY', 0)
                    price = h.get('PRPR', 0)
                    print(f"      - {symbol}: {qty:,}주 @ ₩{price:,}")
                if len(status['kis']['holdings']) > 5:
                    print(f"      ... 외 {len(status['kis']['holdings'])-5}개")
        else:
            print(f"   ❌ 접속: 실패")
            print(f"   에러: {status['kis'].get('error', '알 수 없는 오류')}")
        print(f"   거래 상태: {market_status['korea_status']}")

        # 미국 계좌 (Toss)
        print("\n" + "-"*80)
        print("📌 미국주식 계좌 (토스증권 - Toss)")
        print("-"*80)
        if status["toss"]["status"] == "SUCCESS":
            print(f"   ✅ 접속: 성공")
            print(f"   💰 현금(KRW): ₩{status['toss']['cash']:,.0f}")
            print(f"   💵 현금(USD): ${status['toss']['cash_usd']:,.2f}")
            print(f"   📊 총자산: ₩{status['toss']['total_value']:,.0f}")
            print(f"   📈 보유종목: {len(status['toss']['holdings'])}개")
            if status['toss']['holdings']:
                print(f"      ")
                for h in status['toss']['holdings'][:5]:
                    symbol = h.get('symbol', 'N/A')
                    qty = h.get('quantity', 0)
                    price = h.get('marketPrice', 0)
                    print(f"      - {symbol}: {qty:.4f}주 @ ${price:,.2f}")
                if len(status['toss']['holdings']) > 5:
                    print(f"      ... 외 {len(status['toss']['holdings'])-5}개")
        else:
            print(f"   ❌ 접속: 실패")
            print(f"   에러: {status['toss'].get('error', '알 수 없는 오류')}")
        print(f"   거래 상태: {market_status['us_status']}")

        # 전체 요약
        print("\n" + "-"*80)
        print("📊 전체 자산 현황 (한국 + 미국)")
        print("-"*80)
        kis_total = status['summary'].get('kis_total_krw', 0)
        toss_krw = status['summary'].get('toss_total_krw', 0)
        toss_usd = status['summary'].get('toss_usd', 0)
        total_krw = status['summary'].get('total_krw_value', 0)

        print(f"   🇰🇷 한국 계좌: ₩{kis_total:,.0f}")
        print(f"   🇺🇸 미국 계좌: ₩{toss_krw:,.0f} + ${toss_usd:,.2f}")
        print(f"   ────────────────────────────")
        print(f"   📌 총자산(KRW): ₩{total_krw:,.0f}")

        # 최종 상태
        print("\n" + "-"*80)
        if status["status"] == "SUCCESS":
            print(f"✅ 계좌 접속: 모두 정상")
        elif status["status"] == "PARTIAL_FAILED":
            print(f"⚠️  계좌 접속: 부분 실패 (일부 계좌 접속 불가)")
        else:
            print(f"❌ 계좌 접속: 실패 (모든 계좌 접속 불가)")

        print(f"   조회 시간: {status['timestamp']} (실시간 API)")
        print("="*80 + "\n")


async def main():
    """테스트 실행 - 실계좌만 조회"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    inquiry = RealAccountInquiry()
    await inquiry.print_account_status()


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    asyncio.run(main())
