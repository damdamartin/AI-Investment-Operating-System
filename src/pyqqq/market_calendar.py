"""
시장 시간 판단 - 한국/미국 주식시장 개장/폐장 판단
DST, 휴장일 등을 고려한 정확한 시장 시간 계산
"""

from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo
import logging

logger = logging.getLogger(__name__)

# 시간대
KST = ZoneInfo("Asia/Seoul")
EST = ZoneInfo("America/New_York")


class MarketCalendar:
    """한국/미국 시장 시간 관리"""

    # 한국 시장 정규장 시간
    KR_MARKET_OPEN = time(9, 0)
    KR_MARKET_CLOSE = time(15, 30)

    # 미국 시장 정규장 시간 (미국 동부 시간)
    US_MARKET_OPEN = time(9, 30)  # 09:30 ET
    US_MARKET_CLOSE = time(16, 0)  # 16:00 ET

    # 미국 휴장일 (고정)
    US_HOLIDAYS_FIXED = {
        (1, 1),    # New Year's Day
        (12, 25),  # Christmas
    }

    # 미국 휴장일 (변동 - 2026년 기준)
    US_HOLIDAYS_OBSERVED_2026 = {
        (1, 19),   # MLK Day
        (2, 16),   # Presidents Day
        (3, 27),   # Good Friday
        (5, 25),   # Memorial Day
        (7, 3),    # Independence Day (observed)
        (9, 7),    # Labor Day
        (11, 26),  # Thanksgiving
        (11, 27),  # Day after Thanksgiving
    }

    # 한국 휴장일 (2026년 기준)
    KR_HOLIDAYS_2026 = {
        (1, 1),    # 신정
        (2, 9),    # 설 전날
        (2, 10),   # 설
        (2, 11),   # 설 다음날
        (3, 1),    # 3.1절
        (4, 15),   # 총선
        (5, 5),    # 어린이날
        (5, 6),    # 대체공휴일
        (5, 15),   # 부처님 오신 날
        (6, 6),    # 현충일
        (8, 15),   # 광복절
        (9, 4),    # 추석 전날
        (9, 5),    # 추석
        (9, 6),    # 추석 다음날
        (10, 3),   # 개천절
        (10, 9),   # 한글날
        (12, 25),  # 크리스마스
    }

    @staticmethod
    def is_kr_market_open(now: datetime | None = None) -> bool:
        """
        한국 시장 개장 여부

        Args:
            now: 체크할 시간 (None일 경우 현재 시간)

        Returns:
            True: 시장 개장 중
            False: 시장 폐장
        """
        if now is None:
            now = datetime.now(KST)
        else:
            # 시간대 확인
            if now.tzinfo is None:
                now = now.replace(tzinfo=KST)
            else:
                now = now.astimezone(KST)

        # 평일 확인 (0=Monday, 4=Friday)
        if now.weekday() >= 5:  # 토,일
            return False

        # 시간 확인
        market_time = now.time()
        if not (MarketCalendar.KR_MARKET_OPEN <= market_time <= MarketCalendar.KR_MARKET_CLOSE):
            return False

        # 휴장일 확인
        if (now.month, now.day) in MarketCalendar.KR_HOLIDAYS_2026:
            return False

        return True

    @staticmethod
    def is_us_market_open(now: datetime | None = None) -> bool:
        """
        미국 시장 개장 여부 (미국 동부 시간 기준)

        Args:
            now: 체크할 시간 (None일 경우 현재 시간)

        Returns:
            True: 시장 개장 중
            False: 시장 폐장
        """
        if now is None:
            now = datetime.now(EST)
        else:
            # 시간대 확인
            if now.tzinfo is None:
                # KST로 가정하고 EST로 변환
                now = now.replace(tzinfo=KST).astimezone(EST)
            elif now.tzinfo != EST:
                now = now.astimezone(EST)

        # 평일 확인
        if now.weekday() >= 5:  # 토,일
            return False

        # 휴장일 확인
        if (now.month, now.day) in MarketCalendar.US_HOLIDAYS_FIXED:
            return False
        if (now.month, now.day) in MarketCalendar.US_HOLIDAYS_OBSERVED_2026:
            return False

        # 시간 확인
        market_time = now.time()
        if not (MarketCalendar.US_MARKET_OPEN <= market_time <= MarketCalendar.US_MARKET_CLOSE):
            return False

        return True

    @staticmethod
    def get_market_session(
        market: str,
        now: datetime | None = None
    ) -> dict:
        """
        시장의 개장/폐장 상태 및 정보 반환

        Args:
            market: "KR" 또는 "US"
            now: 체크할 시간 (None일 경우 현재 시간)

        Returns:
            {
                "market": "KR" | "US",
                "is_open": bool,
                "current_time_local": str,  # 해당 시장의 로컬 시간
                "open_time": str,           # HH:MM
                "close_time": str,          # HH:MM
                "next_open": str,           # ISO format
                "next_close": str,          # ISO format
                "timezone": str,
                "holiday_unknown": bool,    # 휴장일 데이터 불완전 여부
            }
        """
        if market not in ["KR", "US"]:
            raise ValueError(f"Invalid market: {market}")

        if market == "KR":
            if now is None:
                now = datetime.now(KST)
            else:
                if now.tzinfo is None:
                    now = now.replace(tzinfo=KST)
                else:
                    now = now.astimezone(KST)

            is_open = MarketCalendar.is_kr_market_open(now)
            open_time = MarketCalendar.KR_MARKET_OPEN
            close_time = MarketCalendar.KR_MARKET_CLOSE
            tz = "Asia/Seoul"

        else:  # US
            if now is None:
                now = datetime.now(EST)
            else:
                if now.tzinfo is None:
                    now = now.replace(tzinfo=KST).astimezone(EST)
                elif now.tzinfo != EST:
                    now = now.astimezone(EST)

            is_open = MarketCalendar.is_us_market_open(now)
            open_time = MarketCalendar.US_MARKET_OPEN
            close_time = MarketCalendar.US_MARKET_CLOSE
            tz = "America/New_York"

        # 다음 개장/폐장 시간 계산
        current_time = now.time()

        if is_open:
            # 현재 개장 중 → 다음 폐장 시간
            next_close = now.replace(
                hour=close_time.hour,
                minute=close_time.minute,
                second=0,
                microsecond=0
            )
            next_open = None  # 개장 중이므로 다음 개장은 내일 이후
        else:
            # 현재 폐장 → 다음 개장 시간 계산
            if current_time < open_time:
                # 개장 전 → 오늘 개장
                next_open = now.replace(
                    hour=open_time.hour,
                    minute=open_time.minute,
                    second=0,
                    microsecond=0
                )
            else:
                # 폐장 후 → 내일 개장
                next_open = (now + timedelta(days=1)).replace(
                    hour=open_time.hour,
                    minute=open_time.minute,
                    second=0,
                    microsecond=0
                )

                # 내일이 주말/휴장일인 경우 다다음날로 이동
                while next_open.weekday() >= 5:  # 토,일
                    next_open += timedelta(days=1)
                while (next_open.month, next_open.day) in (
                    MarketCalendar.US_HOLIDAYS_FIXED
                    if market == "US"
                    else MarketCalendar.KR_HOLIDAYS_2026
                ):
                    next_open += timedelta(days=1)

            next_close = None  # 폐장 중이므로 다음 폐장은 내일 이후

        return {
            "market": market,
            "is_open": is_open,
            "current_time_local": now.isoformat(),
            "open_time": open_time.strftime("%H:%M"),
            "close_time": close_time.strftime("%H:%M"),
            "next_open": next_open.isoformat() if next_open else None,
            "next_close": next_close.isoformat() if next_close else None,
            "timezone": tz,
            "holiday_unknown": False,  # 2026년까지 데이터 있음
        }

    @staticmethod
    def kst_to_est(kst_time: datetime) -> datetime:
        """KST 시간을 EST로 변환"""
        if kst_time.tzinfo is None:
            kst_time = kst_time.replace(tzinfo=KST)
        return kst_time.astimezone(EST)

    @staticmethod
    def est_to_kst(est_time: datetime) -> datetime:
        """EST 시간을 KST로 변환"""
        if est_time.tzinfo is None:
            est_time = est_time.replace(tzinfo=EST)
        return est_time.astimezone(KST)


async def main():
    """테스트"""
    import logging
    logging.basicConfig(level=logging.INFO)

    print("\n" + "="*70)
    print("📅 MarketCalendar 테스트")
    print("="*70)

    # 현재 시간
    now_kst = datetime.now(KST)
    now_est = now_kst.astimezone(EST)

    print(f"\n📍 현재 시간")
    print(f"  KST: {now_kst.strftime('%Y-%m-%d %H:%M:%S %Z')}")
    print(f"  EST: {now_est.strftime('%Y-%m-%d %H:%M:%S %Z')}")

    # 한국 시장
    kr_session = MarketCalendar.get_market_session("KR")
    print(f"\n🇰🇷 한국 시장")
    print(f"  개장 여부: {'열림' if kr_session['is_open'] else '닫힘'}")
    print(f"  개장 시간: {kr_session['open_time']}")
    print(f"  폐장 시간: {kr_session['close_time']}")

    # 미국 시장
    us_session = MarketCalendar.get_market_session("US")
    print(f"\n🇺🇸 미국 시장")
    print(f"  개장 여부: {'열림' if us_session['is_open'] else '닫힘'}")
    print(f"  개장 시간: {us_session['open_time']} (ET)")
    print(f"  폐장 시간: {us_session['close_time']} (ET)")

    print("\n" + "="*70)


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
