#!/usr/bin/env python3
"""
🧪 KIS 실거래 테스트 스크립트
- AAPL 1주 매수 주문 생성
- 실제 거래 확인
"""

import asyncio
import sys
import os

# 프로젝트 경로 추가
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.pyqqq.kis_client import KISClient
from src.pyqqq.config import settings

async def test_kis_live_order():
    """KIS 실거래 테스트"""
    print("=" * 60)
    print("🧪 KIS 미국주식 실거래 테스트")
    print("=" * 60)
    print()

    # 클라이언트 생성
    client = KISClient()

    try:
        # Step 1: 인증
        print("1️⃣ KIS 인증 중...")
        if not await client.authenticate():
            print("❌ 인증 실패")
            return False
        print("✅ 인증 성공")
        print()

        # Step 2: 계좌 잔고 확인
        print("2️⃣ 계좌 잔고 조회...")
        balance = await client.get_balance()
        if not balance:
            print("❌ 잔고 조회 실패")
            return False

        cash = balance.get('cash', 0)
        total_value = balance.get('total_value', 0)
        holdings = balance.get('holdings', [])

        print(f"✅ 계좌 정보:")
        print(f"   📊 현금: ₩{cash:,.0f}")
        print(f"   💼 보유 자산: ₩{total_value:,.0f}")
        print(f"   📈 보유 종목: {len(holdings)}개")

        if len(holdings) > 0:
            print(f"   보유 종목 목록:")
            for h in holdings[:5]:
                print(f"     - {h.get('symbol')}: {h.get('quantity')}주")
        print()

        # Step 3: AAPL 현재가 조회
        print("3️⃣ AAPL 현재가 조회...")
        symbol = "AAPL"
        price = await client.get_stock_price(symbol)
        if not price:
            print(f"❌ {symbol} 현재가 조회 실패")
            return False

        print(f"✅ {symbol} 현재가: ${price:.2f}")
        print()

        # Step 4: 주문 가능 여부 확인
        order_amount = 500000  # ₩50만
        quantity = int(order_amount / (price * 1300))  # 환율: 1 USD = 1300 KRW

        if quantity <= 0:
            print(f"❌ 주문 수량 부족: {quantity}주")
            print(f"   필요 자금: ₩{int(price * 1300):,} (1주)")
            return False

        print(f"4️⃣ 매수 주문 준비:")
        print(f"   종목: {symbol}")
        print(f"   수량: {quantity}주")
        print(f"   예상 금액: ₩{int(price * 1300 * quantity):,}")
        print(f"   가용 현금: ₩{cash:,.0f}")
        print()

        # Step 5: 실제 매수 주문
        print("5️⃣ 실제 매수 주문 생성 중...")
        order_result = await client.buy_order(symbol, int(price * 1300 * quantity))

        if not order_result:
            print("❌ 주문 실패")
            return False

        if isinstance(order_result, dict):
            order_id = order_result.get('order_id')
            success = order_result.get('success')
        else:
            order_id = order_result
            success = True

        if not success and not order_id:
            print("❌ 주문 생성 실패")
            return False

        print(f"✅ 주문 생성 성공!")
        print(f"   주문 번호: {order_id}")
        print(f"   종목: {symbol}")
        print(f"   수량: {quantity}주")
        print(f"   금액: ₩{int(price * 1300 * quantity):,}")
        print()

        # Step 6: 일일 체결 기록 조회
        print("6️⃣ 체결 기록 확인 중 (잠시 대기 중...)...")
        await asyncio.sleep(2)

        daily_orders = await client.get_daily_orders()
        if daily_orders:
            print(f"✅ 체결 기록 조회 성공!")
            print(f"   오늘 체결: {len(daily_orders)}건")
            for order in daily_orders:
                print(f"     - {order.get('PRDT_NAME')}: {order.get('CCLD_QTY')}주 @ ₩{order.get('CCLD_PRC')}")
        else:
            print("⏳ 아직 체결 기록이 없습니다 (처리 대기 중)")
        print()

        # Step 7: 최종 잔고 확인
        print("7️⃣ 최종 계좌 잔고 확인...")
        balance_after = await client.get_balance()
        if balance_after:
            cash_after = balance_after.get('cash', 0)
            print(f"✅ 주문 후 현금: ₩{cash_after:,.0f}")
            print(f"   변화: ₩{cash_after - cash:,}")
        print()

        # 최종 결과
        print("=" * 60)
        print("✅ 실거래 테스트 완료!")
        print("=" * 60)
        print()
        print("📊 거래 내역:")
        print(f"  종목: {symbol}")
        print(f"  수량: {quantity}주")
        print(f"  금액: ₩{int(price * 1300 * quantity):,}")
        print(f"  주문 번호: {order_id}")
        print()
        print("✅ 실거래가 정상 작동합니다!")
        print()

        return True

    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()
        return False

    finally:
        await client.close()

async def main():
    """메인 함수"""
    success = await test_kis_live_order()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    asyncio.run(main())
