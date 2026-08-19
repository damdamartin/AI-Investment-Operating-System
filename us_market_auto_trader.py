#!/usr/bin/env python3
"""미국주식 시장 open 대기 및 자동매매 시작 (Toss만 사용)"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from pyqqq.toss_client import TossSecuritiesClient
from pyqqq.main_trading_system import MainTradingSystem

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('us_market_auto_trader.log')
    ]
)
logger = logging.getLogger(__name__)

class USMarketAutoTrader:
    """미국주식 시장 시간 대기 및 자동매매"""

    def __init__(self):
        self.market_open_kst = None
        self.first_trade_notified = False

    async def check_us_market_status(self) -> dict:
        """미국 시장 상태 확인"""
        # 현재 시간 (KST)
        now_utc = datetime.now(timezone.utc)
        kst_offset = timedelta(hours=9)
        edt_offset = timedelta(hours=-4)

        now_kst = now_utc + kst_offset
        now_edt = now_utc + edt_offset

        # 정규장 시간 (EDT)
        market_start_edt = now_edt.replace(hour=9, minute=30, second=0, microsecond=0)
        market_end_edt = now_edt.replace(hour=16, minute=0, second=0, microsecond=0)

        # KST로 변환
        market_start_kst = market_start_edt + kst_offset

        status = {
            'now_kst': now_kst,
            'now_edt': now_edt,
            'market_start_edt': market_start_edt,
            'market_end_edt': market_end_edt,
            'market_start_kst': market_start_kst
        }

        # 시장 상태
        if now_edt < market_start_edt:
            status['status'] = 'CLOSED_BEFORE'
            status['hours_until_open'] = (market_start_edt - now_edt).total_seconds() / 3600
        elif now_edt > market_end_edt:
            status['status'] = 'CLOSED_AFTER'
            status['hours_until_open'] = None
        else:
            status['status'] = 'OPEN'
            status['hours_until_open'] = 0

        return status

    async def wait_for_market_open(self) -> bool:
        """미국 시장 open 대기"""
        logger.info("🌍 미국주식 시장 open 대기 중...")

        last_hours = None

        while True:
            status = await self.check_us_market_status()
            now_kst = status['now_kst']

            if status['status'] == 'OPEN':
                logger.info("🟢 미국 시장 OPEN!")
                logger.info(f"   시간: {now_kst.strftime('%Y-%m-%d %H:%M:%S')} (KST)")
                return True

            elif status['status'] == 'CLOSED_BEFORE':
                hours = status['hours_until_open']

                # 시간이 변할 때만 로그 출력
                if last_hours is None or int(last_hours) != int(hours):
                    logger.info(
                        f"⏳ 시장 대기 중... "
                        f"Open까지 {hours:.1f}시간 "
                        f"(KST {status['market_start_kst'].strftime('%H:%M:%S')})"
                    )
                    last_hours = hours

                # 30초마다 확인
                await asyncio.sleep(30)

            else:  # CLOSED_AFTER
                logger.info("🔴 오늘 미국 시장 종료 (이미 닫혔음)")
                logger.info("⏳ 내일 시장 open (EDT 09:30, KST 21:30) 대기 중...")
                # 1분마다 확인
                await asyncio.sleep(60)

    async def start_auto_trading(self, trading_system: MainTradingSystem):
        """자동매매 시작"""
        logger.info("\n" + "=" * 80)
        logger.info("🚀 자동매매 시작!")
        logger.info("=" * 80)

        trade_count = 0

        try:
            while True:
                # 1시간마다 매매 사이클 실행
                logger.info("\n📊 매매 사이클 시작...")

                # 매매 실행
                await trading_system.run()

                trade_count += 1
                logger.info(f"✅ 매매 사이클 {trade_count} 완료")

                # 다음 사이클까지 대기 (60초)
                await asyncio.sleep(60)

        except KeyboardInterrupt:
            logger.info("\n⏸️ 사용자 중단 요청")
        except Exception as e:
            logger.error(f"❌ 자동매매 오류: {e}", exc_info=True)

async def main():
    """메인 루틴"""

    logger.info("=" * 80)
    logger.info("🌍 미국주식 자동매매 시스템 시작 (KIS 비활성화)")
    logger.info("=" * 80)

    # 확인: KIS API는 완전히 비활성화됨
    logger.info("✅ KIS API: 비활성화 (Toss-only 모드)")

    # 1. 토스 클라이언트 인증
    logger.info("\n📡 Step 1: Toss API 인증...")
    toss = TossSecuritiesClient()
    if not await toss.authenticate():
        logger.error("❌ 인증 실패!")
        return
    logger.info("✅ 인증 성공")

    # 2. 현재 계좌 상황 확인
    logger.info("\n💰 현재 계좌 상황:")
    cash = await toss.get_cash_balance()
    logger.info(f"  ├─ KRW 현금: ₩{cash['krw']:,.0f}")
    logger.info(f"  └─ USD 현금: ${cash['usd']:.2f}")

    if cash['usd'] < 1:
        logger.error("❌ USD 현금이 충분하지 않습니다 (최소 $1 필요)")
        return

    # 3. 메인 트레이딩 시스템 초기화 (Toss만 사용)
    logger.info("\n🔧 트레이딩 시스템 초기화...")
    trading_system = MainTradingSystem(toss_only=True)
    await trading_system.initialize()
    logger.info("✅ 시스템 준비 완료")

    # 4. 미국 시장 open 대기
    logger.info("\n" + "=" * 80)
    trader = USMarketAutoTrader()
    await trader.wait_for_market_open()

    # 5. 자동매매 시작
    logger.info("\n" + "=" * 80)
    await trader.start_auto_trading(trading_system)

    # 종료
    if toss.session:
        await toss.session.close()
    logger.info("\n✅ 프로그램 종료")

if __name__ == "__main__":
    load_dotenv()
    asyncio.run(main())
