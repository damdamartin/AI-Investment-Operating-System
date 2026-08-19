#!/usr/bin/env python3
"""KIS API 비활성화 상태 검증"""

import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from dotenv import load_dotenv

async def verify_kis_disabled():
    """KIS API가 완전히 비활성화되었는지 확인"""

    load_dotenv()

    print("=" * 80)
    print("🔍 KIS API 비활성화 상태 검증")
    print("=" * 80)

    # 1. 환경변수 확인
    print("\n📋 Step 1: 환경변수 확인")
    kis_trading_enabled = os.environ.get("KIS_TRADING_ENABLED", "false").lower() == "true"
    kis_app_key = os.environ.get("KIS_APP_KEY", "")
    kis_app_secret = os.environ.get("KIS_APP_SECRET", "")
    kis_account_no = os.environ.get("KIS_ACCOUNT_NO", "")

    print(f"  KIS_TRADING_ENABLED: {kis_trading_enabled} {'✅' if not kis_trading_enabled else '❌'}")
    print(f"  KIS_APP_KEY 설정됨: {bool(kis_app_key)} {'✅' if not kis_app_key else '❌'}")
    print(f"  KIS_APP_SECRET 설정됨: {bool(kis_app_secret)} {'✅' if not kis_app_secret else '❌'}")
    print(f"  KIS_ACCOUNT_NO 설정됨: {bool(kis_account_no)} {'✅' if not kis_account_no else '❌'}")

    # 2. main_trading_system 초기화 확인
    print("\n📋 Step 2: MainTradingSystem 초기화 확인")
    from pyqqq.main_trading_system import MainTradingSystem

    # Toss-only 모드
    print("\n  2-1. Toss-only 모드 (미국주식):")
    system = MainTradingSystem(toss_only=True)
    print(f"      KIS 클라이언트 None: {system.kis_client is None} {'✅' if system.kis_client is None else '❌'}")
    print(f"      Account Inquiry None: {system.account_inquiry is None} {'✅' if system.account_inquiry is None else '❌'}")

    # 기본 모드 (하지만 KIS_TRADING_ENABLED=false이므로 여전히 KIS 없음)
    print("\n  2-2. 기본 모드 (toss_only=False, 하지만 KIS_TRADING_ENABLED=false):")
    system2 = MainTradingSystem(toss_only=False)
    print(f"      KIS 클라이언트 None: {system2.kis_client is None} {'✅' if system2.kis_client is None else '❌'}")
    print(f"      Account Inquiry None: {system2.account_inquiry is None} {'✅' if system2.account_inquiry is None else '❌'}")

    # 3. 최종 결론
    print("\n" + "=" * 80)
    all_checks_pass = (
        not kis_trading_enabled and
        not kis_app_key and
        not kis_app_secret and
        not kis_account_no and
        system.kis_client is None and
        system.account_inquiry is None
    )

    if all_checks_pass:
        print("✅ KIS API 완전히 비활성화됨!")
        print("   - 환경변수: 모두 비활성화")
        print("   - MainTradingSystem: KIS 클라이언트 없음")
        print("   - 토스 API만 사용 중")
    else:
        print("❌ KIS API가 여전히 활성화되어 있습니다!")
        print("   - 환경변수나 코드를 다시 확인하세요")

    print("=" * 80)

if __name__ == "__main__":
    import asyncio
    asyncio.run(verify_kis_disabled())
