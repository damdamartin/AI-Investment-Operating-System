import asyncio
from pyupbit import Upbit
from src.pyqqq.config import settings
from datetime import datetime, timedelta

async def simple_trading(duration_days=1):
    """pyupbit으로 간단한 실거래"""
    upbit = Upbit(settings.upbit_access_key, settings.upbit_secret_key)
    
    print(f"\n🚀 pyupbit 직접 거래 시작!")
    print(f"   기간: {duration_days}일\n")
    
    trades = 0
    
    # 단순히 현금으로 소액 매수/매도
    try:
        # 현금 확인
        balances = upbit.get_balances()
        krw = next((b for b in balances if b['currency'] == 'KRW'), None)
        cash = float(krw['balance']) if krw else 0
        
        print(f"✅ 현금: ₩{cash:,.0f}\n")
        
        if cash > 10000:
            # 매수 (₩10,000)
            print("📨 주문 1: KRW-BTC 매수 ₩10,000")
            order1 = upbit.buy_market_order("KRW-BTC", 10000)
            print(f"   결과: {order1}\n")
            trades += 1
            
            # 5초 대기
            await asyncio.sleep(5)
            
            # 매도
            print("📨 주문 2: KRW-BTC 매도")
            holdings = upbit.get_balances()
            btc = next((b for b in holdings if b['currency'] == 'BTC'), None)
            if btc and float(btc['balance']) > 0:
                order2 = upbit.sell_market_order("KRW-BTC", float(btc['balance']))
                print(f"   결과: {order2}\n")
                trades += 1
    
    except Exception as e:
        print(f"❌ 오류: {e}")
    
    print(f"🎉 완료! 거래: {trades}회")

asyncio.run(simple_trading())
