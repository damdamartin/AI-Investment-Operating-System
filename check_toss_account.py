#!/usr/bin/env python3
"""토스증권 한국계좌 현황 조회 (매매 X, 현황만)"""

import asyncio
import sys
import os
from datetime import datetime
from dotenv import load_dotenv

# 프로젝트 경로 추가
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from pyqqq.toss_client import TossSecuritiesClient

async def check_account():
    """토스증권 계좌 현황 조회"""

    print("=" * 80)
    print("🔍 토스증권 한국계좌 현황 조회")
    print("=" * 80)
    print(f"⏰ 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()

    # 클라이언트 초기화
    toss = TossSecuritiesClient()

    print("📡 Step 1: Toss API 인증...")
    auth_ok = await toss.authenticate()
    if not auth_ok:
        print("❌ 인증 실패!")
        return

    print("✅ 인증 성공!\n")

    # Step 2: 현금 잔고 조회
    print("📡 Step 2: 현금 잔고 조회...")
    cash = await toss.get_cash_balance()
    print(f"✅ KRW 현금: ₩{cash['krw']:,.0f}")
    print(f"✅ USD 현금: ${cash['usd']:.2f}\n")

    # Step 3: 전체 계좌 잔고 (보유주식 + 현금)
    print("📡 Step 3: 전체 계좌 잔고 조회...")
    balance = await toss.get_account_balance()

    if balance:
        print("\n" + "=" * 80)
        print("📊 계좌 현황")
        print("=" * 80)

        # 현금
        print(f"\n💰 현금")
        print(f"  ├─ KRW: ₩{balance.get('cash', 0):,.0f}")
        print(f"  └─ USD: ${balance.get('cash_usd', 0):.2f}")

        # 보유 주식
        kr_holdings = balance.get('kr_holdings', [])
        us_holdings = balance.get('us_holdings', [])

        print(f"\n📈 보유 주식")

        if kr_holdings:
            print(f"\n  한국주식 ({len(kr_holdings)}개)")
            for stock in kr_holdings:
                symbol = stock.get('symbol', '?')
                name = stock.get('name', '?')
                qty = stock.get('quantity', 0)
                price = float(stock.get('lastPrice', stock.get('purchasePrice', 0)) or 0)
                market_val = stock.get('marketValue', {})
                value = float(market_val.get('amount', 0)) if isinstance(market_val, dict) else 0
                print(f"    ├─ [{symbol}] {name}: {qty}주 @ ₩{price:,.0f} = ₩{value:,.0f}")
        else:
            print(f"\n  한국주식: 없음")

        if us_holdings:
            print(f"\n  미국주식 ({len(us_holdings)}개)")
            for stock in us_holdings:
                symbol = stock.get('symbol', '?')
                name = stock.get('name', '?')
                qty = stock.get('quantity', 0)
                price = float(stock.get('lastPrice', stock.get('purchasePrice', 0)) or 0)
                market_val = stock.get('marketValue', {})
                value = float(market_val.get('amount', 0)) if isinstance(market_val, dict) else 0
                print(f"    ├─ [{symbol}] {name}: {qty}주 @ ${price:.2f} = ${value:.2f}")
        else:
            print(f"\n  미국주식: 없음")

        # 요약
        print(f"\n💎 자산 요약")
        total_value = balance.get('total_value', 0)
        print(f"  └─ 총 자산가치: ₩{total_value:,.0f}")

    else:
        print("❌ 계좌 잔고 조회 실패")

    # 세션 종료
    if toss.session:
        await toss.session.close()

    print("\n" + "=" * 80)
    print("✅ 조회 완료")
    print("=" * 80)

if __name__ == "__main__":
    # .env 로드
    load_dotenv()

    # 비동기 실행
    asyncio.run(check_account())
